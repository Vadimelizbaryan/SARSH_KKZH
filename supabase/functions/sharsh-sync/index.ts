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

const PHOTO_RECOGNITION_MODEL = (Deno.env.get("OPENAI_PHOTO_MODEL") || "gpt-5.4-mini").trim();

const PHOTO_FIELD_MAPPINGS = [
  { cell: 1, key: "beenTotal", label: "ЕГЕЛ Э / ընդ" },
  { cell: 2, key: "beenSoldier", label: "ЕГЕЛ Э / ժ/ծ" },
  { cell: 3, key: "beenSeries", label: "ЕГЕЛ Э / շարք" },
  { cell: 4, key: "admittedTotal", label: "ԸՆԴՈՒՆՎԵԼ Է / ընդ" },
  { cell: 5, key: "admittedSoldier", label: "ԸՆԴՈՒՆՎԵԼ Է / ժ/ծ" },
  { cell: 6, key: "admittedSeries", label: "ԸՆԴՈՒՆՎԵԼ Է / շարք" },
  { cell: 7, key: "dgTotal", label: "Դ/Գ / ընդ" },
  { cell: 8, key: "dgSoldier", label: "Դ/Գ / ժ/ծ" },
  { cell: 9, key: "dgSeries", label: "Դ/Գ / շարք" },
  { cell: 10, key: "transferFromDepartment", label: "Տեղափոխ / բաժնից" },
  { cell: 11, key: "transferToDepartment", label: "Տեղափոխ / բաժին" },
  { cell: 13, key: "currentShar", label: "Առկա է / շարք" },
  { cell: 14, key: "currentSpa", label: "Առկա է / սպա" },
  { cell: 15, key: "currentPaym", label: "Առկա է / պայման" },
  { cell: 16, key: "zh", label: "Առկա է / ժ-հ" },
  { cell: 17, key: "family", label: "Առկա է / գ/վ" },
  { cell: 18, key: "officer", label: "Առկա է / գ/ծ ընդ" },
  { cell: 19, key: "civil", label: "Առկա է / ք-հ" },
  { cell: 20, key: "leaveSharq", label: "Արձակուրդ / շարք" },
  { cell: 21, key: "leaveSpa", label: "Արձակուրդ / սպա" },
  { cell: 22, key: "leavePaym", label: "Արձակուրդ / պայման" }
] as const;

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

function sanitizeReportDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replaceAll(",", ".").replaceAll("/", ".");
  if (!normalized) {
    return null;
  }

  return /^\d{2}\.\d{2}\.\d{2,4}$/.test(normalized) ? normalized : null;
}

function getOpenAiApiKey() {
  const secret = Deno.env.get("OPENAI_API_KEY");
  return secret && secret.trim() ? secret.trim() : "";
}

function buildPhotoRecognitionSchema() {
  const valueProperties = Object.fromEntries(
    VALUE_KEYS.map((key) => [key, { type: ["integer", "null"] }])
  );

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      reportDate: { type: ["string", "null"] },
      values: {
        type: "object",
        additionalProperties: false,
        properties: valueProperties,
        required: VALUE_KEYS
      },
      notes: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["reportDate", "values", "notes"]
  };
}

function extractOpenAiOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];

    for (const part of content) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const typedPart = part as { type?: string; text?: string };
      if (typedPart.type === "output_text" && typeof typedPart.text === "string" && typedPart.text.trim()) {
        return typedPart.text.trim();
      }
    }
  }

  return "";
}

async function recognizeDepartmentPhoto(
  departmentId: string,
  imageDataUrl: string
) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const departmentMeta = DEPARTMENTS[departmentId as keyof typeof DEPARTMENTS];
  if (!departmentMeta) {
    throw new Error("Unknown department.");
  }

  const fieldInstructions = PHOTO_FIELD_MAPPINGS
    .map((item) => `- cell ${item.cell}: ${item.key} (${item.label})`)
    .join("\n");

  const prompt = [
    "You extract handwritten numeric values from a standardized Armenian hospital department form.",
    `Department id: ${departmentId}. Department name: ${departmentMeta.department}.`,
    "Read only the top numeric table and the handwritten report date near the header.",
    "Ignore the handwritten descriptive text in the lower part of the page.",
    "Return null for any cell that is blank, crossed out, unreadable, or uncertain.",
    "Do not infer values from formulas. Do not copy printed column numbers.",
    "Map the handwritten values into these fields:",
    fieldInstructions,
    "The top table also contains derived totals. Do not return those derived totals unless they correspond to one of the listed fields above.",
    "Return reportDate in dd.mm.yy or dd.mm.yyyy when visible, otherwise null.",
    "Use notes for short uncertainty comments only when needed."
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: PHOTO_RECOGNITION_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high"
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "department_photo_recognition",
          strict: true,
          schema: buildPhotoRecognitionSchema()
        }
      }
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object") {
    const message = payload && typeof payload === "object" && typeof (payload as { error?: { message?: string } }).error?.message === "string"
      ? (payload as { error: { message: string } }).error.message
      : `OpenAI photo recognition request failed (${response.status}).`;
    throw new Error(message);
  }

  const outputText = extractOpenAiOutputText(payload as Record<string, unknown>);
  if (!outputText) {
    throw new Error("OpenAI photo recognition returned an empty response.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(outputText) as Record<string, unknown>;
  } catch (_error) {
    throw new Error("OpenAI photo recognition returned invalid JSON.");
  }

  const sanitizedValues = sanitizeValues(parsed.values as Record<string, unknown> | undefined);

  return {
    reportDate: sanitizeReportDate(parsed.reportDate),
    values: sanitizedValues,
    recognizedKeys: Object.entries(sanitizedValues)
      .filter(([, value]) => value !== null)
      .map(([key]) => key),
    notes: Array.isArray(parsed.notes)
      ? parsed.notes.filter((item) => typeof item === "string" && item.trim()).map((item) => String(item).trim())
      : []
  };
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

function getAllowedOwnerEmails() {
  const secretNames = [
    "ALLOWED_OWNER_EMAILS",
    "ALLOWED_ACCOUNT_EMAILS",
    ["ALLOWED_", "GOO", "GLE", "_EMAILS"].join("")
  ];

  for (const name of secretNames) {
    const raw = Deno.env.get(name);
    if (!raw || !raw.trim()) {
      continue;
    }

    return raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
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
  const allowedEmails = getAllowedOwnerEmails();
  if (!allowedEmails.length) {
    return "Owner access is not configured on the server.";
  }

  const token = extractBearerToken(request);
  if (!token) {
    return "Owner sign-in is required.";
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return "Owner sign-in is required.";
  }

  const email = String(data.user.email || "").trim().toLowerCase();
  if (!email || !allowedEmails.includes(email)) {
    return "Access is allowed only for the owner account.";
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

    if (type === "recognize_department_photo") {
      const departmentId = typeof payload.departmentId === "string" ? payload.departmentId : "";
      if (!Object.prototype.hasOwnProperty.call(DEPARTMENTS, departmentId)) {
        return jsonResponse({ error: "Unknown department." }, 400);
      }

      const imageDataUrl = typeof payload.imageDataUrl === "string" ? payload.imageDataUrl.trim() : "";
      if (!imageDataUrl.startsWith("data:image/")) {
        return jsonResponse({ error: "A valid image is required." }, 400);
      }

      const recognition = await recognizeDepartmentPhoto(departmentId, imageDataUrl);
      return jsonResponse(recognition);
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
