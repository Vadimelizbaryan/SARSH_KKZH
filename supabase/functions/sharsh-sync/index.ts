import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_DATE = "05,05,26";
const VALUE_KEYS = [
  "beenTotal",
  "beenSoldier",
  "beenSeries",
  "admittedTotal",
  "admittedSoldier",
  "admittedSeries",
  "dgTotal",
  "dgSoldier",
  "dgSeries",
  "transferFromDepartment",
  "transferToDepartment",
  "currentShar",
  "currentSpa",
  "currentPaym",
  "zh",
  "family",
  "officer",
  "civil",
  "leaveSharq",
  "leaveSpa",
  "leavePaym"
];

const DEPARTMENTS = {
  r4: { department: "Վիրաբուժական", group: "primary" },
  r5: { department: "Դ/Ծ վ/բ բաժանմունք", group: "primary" },
  r6: { department: "Քիթ-կոկորդ բ-ք", group: "primary" },
  r7: { department: "Ակնաբուժական", group: "primary" },
  r8: { department: "Վնասվածքաբանական", group: "primary" },
  r9: { department: "Կրծքային վ/բ", group: "primary" },
  r10: { department: "Ուռոլոգիական", group: "primary" },
  r11: { department: "Նեյրովիրաբուժական", group: "primary" },
  r12: { department: "Թռիչքային", group: "primary" },
  r13: { department: "Թերապիա", group: "primary" },
  r14: { department: "Վերակենդանացման", group: "primary" },
  r15: { department: "Նյարդաբանական", group: "primary" },
  r16: { department: "Գինեկոլոգիական", group: "primary" },
  r17: { department: "Անոթային", group: "primary" },
  r19: { department: "ԻՆՖ", group: "extra" },
  r20: { department: "ԱՏԴ", group: "extra" },
  r21: { department: "Ք/Հ", group: "extra" }
} as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
}

function sanitizeNumber(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.trunc(parsed));
}

function sanitizeValues(values: Record<string, unknown> | null | undefined) {
  const output: Record<string, number | null> = {};
  VALUE_KEYS.forEach((key) => {
    output[key] = sanitizeNumber(values ? values[key] : null);
  });
  return output;
}

function getDepartmentCodes() {
  const raw = Deno.env.get("DEPARTMENT_CODES_JSON");
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch (_error) {
    return {};
  }
}

function getAllowedGoogleEmails() {
  const raw = Deno.env.get("ALLOWED_GOOGLE_EMAILS");
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function getDepartmentAccessError(departmentId: string, accessCode: unknown) {
  const accessCodes = getDepartmentCodes();
  const expectedCode = accessCodes[departmentId];
  if (!expectedCode) {
    return null;
  }

  const normalizedAccessCode = String(accessCode ?? "").trim();
  return expectedCode === normalizedAccessCode
    ? null
    : "Неверный код отделения.";
}

function extractBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return "";
  }

  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer" || !token) {
    return "";
  }

  return token.trim();
}

async function authorizeOwner(request: Request, supabase: ReturnType<typeof createClient>) {
  const allowedEmails = getAllowedGoogleEmails();
  if (!allowedEmails.length) {
    return "Google owner access is not configured on the server.";
  }

  const token = extractBearerToken(request);
  if (!token) {
    return "Google sign-in is required.";
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return "Google sign-in is required.";
  }

  const email = String(data.user.email || "").trim().toLowerCase();
  if (!email || !allowedEmails.includes(email)) {
    return "Access is allowed only for the owner Google account.";
  }

  return null;
}

async function loadSnapshot(supabase: ReturnType<typeof createClient>) {
  const { data: departmentRows, error: departmentsError } = await supabase
    .from("sharsh_departments")
    .select("department_id, values, updated_at");

  if (departmentsError) {
    throw departmentsError;
  }

  const { data: metaRow, error: metaError } = await supabase
    .from("sharsh_report_meta")
    .select("report_date, updated_at")
    .eq("report_key", "main")
    .maybeSingle();

  if (metaError) {
    throw metaError;
  }

  const map = new Map((departmentRows || []).map((row) => [row.department_id, row]));

  return {
    reportDate: metaRow?.report_date || DEFAULT_DATE,
    updatedAt: metaRow?.updated_at || new Date().toISOString(),
    rows: Object.entries(DEPARTMENTS).map(([id]) => {
      const saved = map.get(id);
      return {
        id,
        values: sanitizeValues(saved?.values as Record<string, unknown> | undefined),
        updatedAt: saved?.updated_at || null
      };
    })
  };
}

function createSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createSupabaseAdmin();
    const authError = await authorizeOwner(request, supabase);
    if (authError) {
      return jsonResponse({ error: authError }, 403);
    }

    if (request.method === "GET") {
      return jsonResponse(await loadSnapshot(supabase));
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    const payload = await request.json();
    const type = typeof payload?.type === "string" ? payload.type : "";

    if (type === "save_report_date") {
      const reportDate = typeof payload.reportDate === "string" && payload.reportDate.trim()
        ? payload.reportDate.trim()
        : DEFAULT_DATE;

      const { error } = await supabase
        .from("sharsh_report_meta")
        .upsert({
          report_key: "main",
          report_date: reportDate,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      return jsonResponse(await loadSnapshot(supabase));
    }

    if (type === "verify_access_code") {
      const departmentId = typeof payload.departmentId === "string" ? payload.departmentId : "";
      if (!Object.prototype.hasOwnProperty.call(DEPARTMENTS, departmentId)) {
        return jsonResponse({ error: "Unknown department." }, 400);
      }

      const accessError = getDepartmentAccessError(departmentId, payload.accessCode);
      if (accessError) {
        return jsonResponse({ error: accessError }, 403);
      }

      return jsonResponse({ ok: true });
    }

    if (type !== "save_department") {
      return jsonResponse({ error: "Unknown request type." }, 400);
    }

    const departmentId = typeof payload.departmentId === "string" ? payload.departmentId : "";
    if (!Object.prototype.hasOwnProperty.call(DEPARTMENTS, departmentId)) {
      return jsonResponse({ error: "Unknown department." }, 400);
    }

    const accessError = getDepartmentAccessError(departmentId, payload.accessCode);
    if (accessError) {
      return jsonResponse({ error: accessError }, 403);
    }

    const reportDate = typeof payload.reportDate === "string" && payload.reportDate.trim()
      ? payload.reportDate.trim()
      : DEFAULT_DATE;
    const departmentMeta = DEPARTMENTS[departmentId as keyof typeof DEPARTMENTS];

    const { error: rowError } = await supabase
      .from("sharsh_departments")
      .upsert({
        department_id: departmentId,
        department_name: departmentMeta.department,
        department_group: departmentMeta.group,
        values: sanitizeValues(payload.values as Record<string, unknown> | undefined),
        updated_at: new Date().toISOString()
      });

    if (rowError) {
      throw rowError;
    }

    const { error: metaError } = await supabase
      .from("sharsh_report_meta")
      .upsert({
        report_key: "main",
        report_date: reportDate,
        updated_at: new Date().toISOString()
      });

    if (metaError) {
      throw metaError;
    }

    return jsonResponse(await loadSnapshot(supabase));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonResponse({ error: message }, 500);
  }
});
