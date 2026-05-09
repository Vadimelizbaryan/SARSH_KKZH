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
  "currentZh",
  "family",
  "officer",
  "civil",
  "leaveSharq",
  "leaveSpa",
  "leavePaym"
];

const PHOTO_RECOGNITION_MODEL = (Deno.env.get("OPENAI_PHOTO_MODEL") || "gpt-5.4-mini").trim();

const PHOTO_FIELD_MAPPINGS = [
  { cell: 1, key: "beenTotal", label: "Ð•Ð“Ð•Ð› Ð­ / Õ¨Õ¶Õ¤" },
  { cell: 2, key: "beenSoldier", label: "Ð•Ð“Ð•Ð› Ð­ / Õª/Õ®" },
  { cell: 3, key: "beenSeries", label: "Ð•Ð“Ð•Ð› Ð­ / Õ·Õ¡Ö€Ö„" },
  { cell: 4, key: "admittedTotal", label: "Ô¸Õ†Ô´ÕˆÕ’Õ†ÕŽÔµÔ¼ Ô· / Õ¨Õ¶Õ¤" },
  { cell: 5, key: "admittedSoldier", label: "Ô¸Õ†Ô´ÕˆÕ’Õ†ÕŽÔµÔ¼ Ô· / Õª/Õ®" },
  { cell: 6, key: "admittedSeries", label: "Ô¸Õ†Ô´ÕˆÕ’Õ†ÕŽÔµÔ¼ Ô· / Õ·Õ¡Ö€Ö„" },
  { cell: 7, key: "dgTotal", label: "Ô´/Ô³ / Õ¨Õ¶Õ¤" },
  { cell: 8, key: "dgSoldier", label: "Ô´/Ô³ / Õª/Õ®" },
  { cell: 9, key: "dgSeries", label: "Ô´/Ô³ / Õ·Õ¡Ö€Ö„" },
  { cell: 10, key: "transferFromDepartment", label: "ÕÕ¥Õ²Õ¡ÖƒÕ¸Õ­ / Õ¢Õ¡ÕªÕ¶Õ«Ö" },
  { cell: 11, key: "transferToDepartment", label: "ÕÕ¥Õ²Õ¡ÖƒÕ¸Õ­ / Õ¢Õ¡ÕªÕ«Õ¶" },
  { cell: 12, key: "photoCell12Derived", label: "derived total / ignored by app" },
  { cell: 13, key: "currentShar", label: "present / shar / first soldier column" },
  { cell: 14, key: "currentSpa", label: "present / spa / second soldier column" },
  { cell: 15, key: "currentPaym", label: "present / paym / third soldier column" },
  { cell: 16, key: "currentZh", label: "present / zh / single column immediately after the three soldier columns" },
  { cell: 17, key: "family", label: "present / zts-ent / single column immediately after currentZh" },
  { cell: 18, key: "officer", label: "present / z-p / single column immediately after family" },
  { cell: 19, key: "civil", label: "present / q-i / single column immediately after officer" },
  { cell: 20, key: "leaveSharq", label: "leave / sharq" },
  { cell: 21, key: "leaveSpa", label: "leave / spa" },
  { cell: 22, key: "leavePaym", label: "leave / paym" }
] as const;

const PHOTO_SCHEMA_VALUE_KEYS = PHOTO_FIELD_MAPPINGS
  .map((item) => item.key)
  .filter((key): key is string => typeof key === "string");

const DEPARTMENTS = {
  r4: { department: "ÕŽÕ«Ö€Õ¡Õ¢Õ¸Ö‚ÕªÕ¡Õ¯Õ¡Õ¶", group: "primary", marker: "SR-4" },
  r5: { department: "Ô´/Ô¾ Õ¾/Õ¢ Õ¢Õ¡ÕªÕ¡Õ¶Õ´Õ¸Ö‚Õ¶Ö„", group: "primary", marker: "SR-5" },
  r6: { department: "Õ”Õ«Õ©-Õ¯Õ¸Õ¯Õ¸Ö€Õ¤ Õ¢-Ö„", group: "primary", marker: "SR-6" },
  r7: { department: "Ô±Õ¯Õ¶Õ¡Õ¢Õ¸Ö‚ÕªÕ¡Õ¯Õ¡Õ¶", group: "primary", marker: "SR-7" },
  r8: { department: "ÕŽÕ¶Õ¡Õ½Õ¾Õ¡Õ®Ö„Õ¡Õ¢Õ¡Õ¶Õ¡Õ¯Õ¡Õ¶", group: "primary", marker: "SR-8" },
  r9: { department: "Ô¿Ö€Õ®Ö„Õ¡ÕµÕ«Õ¶ Õ¾/Õ¢", group: "primary", marker: "SR-9" },
  r10: { department: "ÕˆÖ‚Õ¼Õ¸Õ¬Õ¸Õ£Õ«Õ¡Õ¯Õ¡Õ¶", group: "primary", marker: "SR-10" },
  r11: { department: "Õ†Õ¥ÕµÖ€Õ¸Õ¾Õ«Ö€Õ¡Õ¢Õ¸Ö‚ÕªÕ¡Õ¯Õ¡Õ¶", group: "primary", marker: "SR-11" },
  r12: { department: "Ô¹Õ¼Õ«Õ¹Ö„Õ¡ÕµÕ«Õ¶", group: "primary", marker: "SR-12" },
  r13: { department: "Ô¹Õ¥Ö€Õ¡ÕºÕ«Õ¡", group: "primary", marker: "SR-13" },
  r14: { department: "ÕŽÕ¥Ö€Õ¡Õ¯Õ¥Õ¶Õ¤Õ¡Õ¶Õ¡ÖÕ´Õ¡Õ¶", group: "primary", marker: "SR-14" },
  r15: { department: "Õ†ÕµÕ¡Ö€Õ¤Õ¡Õ¢Õ¡Õ¶Õ¡Õ¯Õ¡Õ¶", group: "primary", marker: "SR-15" },
  r16: { department: "Ô³Õ«Õ¶Õ¥Õ¯Õ¸Õ¬Õ¸Õ£Õ«Õ¡Õ¯Õ¡Õ¶", group: "primary", marker: "SR-16" },
  r17: { department: "Ô±Õ¶Õ¸Õ©Õ¡ÕµÕ«Õ¶", group: "primary", marker: "SR-17" },
  r19: { department: "Ô»Õ†Õ–", group: "extra", marker: "SR-19" },
  r20: { department: "Ô±ÕÔ´", group: "extra", marker: "SR-20" },
  r21: { department: "Õ”/Õ€", group: "extra", marker: "SR-21" }
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

async function requestOpenAiStructuredVision(
  prompt: string,
  imageDataUrl: string,
  schemaName: string,
  schema: Record<string, unknown>
) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

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
          name: schemaName,
          strict: true,
          schema
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

  try {
    return JSON.parse(outputText) as Record<string, unknown>;
  } catch (_error) {
    throw new Error("OpenAI photo recognition returned invalid JSON.");
  }
}

function buildPhotoRecognitionSchema() {
  const valueProperties = Object.fromEntries(
    PHOTO_SCHEMA_VALUE_KEYS.map((key) => [key, { type: ["integer", "null"] }])
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
        required: PHOTO_SCHEMA_VALUE_KEYS
      },
      notes: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["reportDate", "values", "notes"]
  };
}

function buildDepartmentDetectionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      departmentId: {
        type: ["string", "null"]
      },
      notes: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["departmentId", "notes"]
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
  const departmentMeta = DEPARTMENTS[departmentId as keyof typeof DEPARTMENTS];
  if (!departmentMeta) {
    throw new Error("Unknown department.");
  }

  const fieldInstructions = PHOTO_FIELD_MAPPINGS
    .map((item) => item.cell === 12
      ? `- cell ${item.cell}: ${item.key} (${item.label}). Return the handwritten value here, but the app will ignore it.`
      : `- cell ${item.cell}: ${item.key} (${item.label})`)
    .join("\n");

  const prompt = [
    "You extract handwritten numeric values from a standardized Armenian hospital department form.",
    `Department id: ${departmentId}. Department name: ${departmentMeta.department}.`,
    "The department is already fixed by the current page.",
    "Do not determine or change the department from SR markers, headers, or any other text in the image.",
    "If the photo is missing SR markers or the printed title is unclear, continue extracting values for the given department anyway.",
    "Read only the top numeric table and the handwritten report date near the header.",
    "Ignore the handwritten descriptive text in the lower part of the page.",
    "Return null for any cell that is blank, crossed out, unreadable, or uncertain.",
    "Do not infer values from formulas. Do not copy printed column numbers.",
    "After the three soldier columns in the 'present' block there are four consecutive single-column fields.",
    "Those four single-column fields must be read strictly in this order: cell 16 currentZh, cell 17 family, cell 18 officer, cell 19 civil.",
    "Do not shift handwritten values left or right between cells 16, 17, 18, and 19.",
    "Map the handwritten values into these fields:",
    fieldInstructions,
    "Cell 12 is a derived total between cell 11 and cell 13. Return it only under photoCell12Derived and never assign that handwritten number to currentShar or any later field.",
    "If the photo clearly shows a handwritten value under the single column between the three soldier columns and the family column, that value belongs to currentZh.",
    "The top table also contains derived totals. Do not return those derived totals unless they correspond to one of the listed fields above.",
    "Return reportDate in dd.mm.yy or dd.mm.yyyy when visible, otherwise null.",
    "Use notes for short uncertainty comments only when needed."
  ].join("\n");

  const parsed = await requestOpenAiStructuredVision(
    prompt,
    imageDataUrl,
    "department_photo_recognition",
    buildPhotoRecognitionSchema()
  );

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

async function detectDepartmentFromPhoto(imageDataUrl: string) {
  const departmentInstructions = Object.entries(DEPARTMENTS)
    .map(([id, meta]) => `- ${id}: ${meta.department} (marker: ${meta.marker})`)
    .join("\n");

  const prompt = [
    "You determine which Armenian hospital department blank is shown in a photo.",
    "Use the printed department title in the header, the large department marker such as SR-4, or any clearly readable identifying text.",
    "Do not use handwritten notes in the lower part to guess the department unless they explicitly repeat the printed department name.",
    "Choose exactly one departmentId from this list when confident:",
    departmentInstructions,
    "If the image is too unclear or you are not confident, return departmentId as null.",
    "Use notes for short comments such as marker found, title found, or uncertain header."
  ].join("\n");

  const parsed = await requestOpenAiStructuredVision(
    prompt,
    imageDataUrl,
    "department_photo_detection",
    buildDepartmentDetectionSchema()
  );

  const rawDepartmentId = typeof parsed.departmentId === "string" ? parsed.departmentId.trim() : "";
  const departmentId = Object.prototype.hasOwnProperty.call(DEPARTMENTS, rawDepartmentId)
    ? rawDepartmentId
    : null;

  return {
    departmentId,
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
    : "ÐÐµÐ²ÐµÑ€Ð½Ñ‹Ð¹ ÐºÐ¾Ð´ Ð¾Ñ‚Ð´ÐµÐ»ÐµÐ½Ð¸Ñ.";
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

    if (type === "detect_department_photo") {
      const imageDataUrl = typeof payload.imageDataUrl === "string" ? payload.imageDataUrl.trim() : "";
      if (!imageDataUrl.startsWith("data:image/")) {
        return jsonResponse({ error: "A valid image is required." }, 400);
      }

      const detection = await detectDepartmentFromPhoto(imageDataUrl);
      return jsonResponse(detection);
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


