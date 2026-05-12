import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_DATE = "05,05,26";
const DEFAULT_SITE_BASE_URL = "https://vadimelizbaryan.github.io/SARSH_KKZH";
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
  "leavePaym",
  "qhIncomingSoldier",
  "qhIncomingOfficer",
  "qhIncomingContract",
  "qhDischargedSoldier",
  "qhDischargedOfficer",
  "qhDischargedContract"
];

const PHOTO_RECOGNITION_MODEL = (Deno.env.get("OPENAI_PHOTO_MODEL") || "gpt-5.4-mini").trim();
const OCR_FEEDBACK_STATUSES = ["accepted_as_is", "corrected_by_operator"] as const;

const PHOTO_FIELD_MAPPINGS = [
  { cell: 1, key: "beenTotal", label: "been / total" },
  { cell: 2, key: "beenSoldier", label: "been / soldier" },
  { cell: 3, key: "beenSeries", label: "been / series" },
  { cell: 4, key: "admittedTotal", label: "admitted / total" },
  { cell: 5, key: "admittedSoldier", label: "admitted / soldier" },
  { cell: 6, key: "admittedSeries", label: "admitted / series" },
  { cell: 7, key: "dgTotal", label: "dg / total" },
  { cell: 8, key: "dgSoldier", label: "dg / soldier" },
  { cell: 9, key: "dgSeries", label: "dg / series" },
  { cell: 10, key: "transferFromDepartment", label: "transfer / from department" },
  { cell: 11, key: "transferToDepartment", label: "transfer / to department" },
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
  .filter((item) => item.key !== "photoCell12Derived")
  .map((item) => item.key)
  .filter((key): key is string => typeof key === "string");

const PHOTO_CELL_REVIEW_KEYS = PHOTO_FIELD_MAPPINGS
  .filter((item) => item.key !== "photoCell12Derived")
  .map((item) => item.key)
  .filter((key): key is string => typeof key === "string");

const PHOTO_CELL_REVIEW_CELL_MAP = Object.fromEntries(
  PHOTO_FIELD_MAPPINGS
    .filter((item) => item.key !== "photoCell12Derived")
    .map((item) => [item.key, item.cell])
) as Record<string, number>;

const DEPARTMENTS = {
  r4: { department: "Վիրաբուժական", group: "primary", marker: "SR-4" },
  r5: { department: "Դ/Ծ վ/բ բաժանմունք", group: "primary", marker: "SR-5" },
  r6: { department: "Քիթ-կոկորդ բ-ք", group: "primary", marker: "SR-6" },
  r7: { department: "Ակնաբուժական", group: "primary", marker: "SR-7" },
  r8: { department: "Վնասվածքաբանական", group: "primary", marker: "SR-8" },
  r9: { department: "Կրծքային վ/բ", group: "primary", marker: "SR-9" },
  r10: { department: "Ուռոլոգիական", group: "primary", marker: "SR-10" },
  r11: { department: "Նեյրովիրաբուժական", group: "primary", marker: "SR-11" },
  r12: { department: "Թռիչքային", group: "primary", marker: "SR-12" },
  r13: { department: "Թերապիա", group: "primary", marker: "SR-13" },
  r14: { department: "Վերակենդանացման", group: "primary", marker: "SR-14" },
  r15: { department: "Նյարդաբանական", group: "primary", marker: "SR-15" },
  r16: { department: "Գինեկոլոգիական", group: "primary", marker: "SR-16" },
  r17: { department: "Անոթային", group: "primary", marker: "SR-17" },
  r19: { department: "ԻՆՖ", group: "extra", marker: "SR-19" },
  r20: { department: "ԱՏԴ", group: "extra", marker: "SR-20" },
  r21: { department: "Ք/Հ", group: "extra", marker: "SR-21" }
} as const;

const PHOTO_TEMPLATE_GUIDE = [
  "Template layout of the 22 handwritten cells from left to right:",
  "- cells 1, 2, 3: first three-cell block on the far left",
  "- cells 4, 5, 6: second three-cell block",
  "- cells 7, 8, 9: third three-cell block",
  "- cells 10, 11: two narrow transfer cells",
  "- cell 12: one narrow single cell immediately after cell 11",
  "- cells 13, 14, 15: one three-cell group immediately after cell 12",
  "- cells 16, 17, 18, 19: four consecutive single cells immediately after cells 13-15",
  "- cells 20, 21, 22: final three-cell leave block on the far right",
  "Use the printed vertical borders of the table as the main source of separation between neighboring cells."
].join("\n");

const OCR_TEMPLATE_BLANK_IMAGE_PATH = "/assets/ocr-template-blank.jpg";

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

function sanitizePhotoCellReviews(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: Array<{
    key: string;
    cell: number;
    status: "recognized" | "review";
    valueText: string | null;
    reason: string | null;
    left: number;
    top: number;
    width: number;
    height: number;
  }> = [];

  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const key = typeof (rawItem as { key?: unknown }).key === "string"
      ? String((rawItem as { key: string }).key).trim()
      : "";
    if (!PHOTO_CELL_REVIEW_KEYS.includes(key)) {
      continue;
    }

    const rawStatus = typeof (rawItem as { status?: unknown }).status === "string"
      ? String((rawItem as { status: string }).status).trim()
      : "";
    const status = rawStatus === "recognized" || rawStatus === "review"
      ? rawStatus
      : null;
    if (!status) {
      continue;
    }

    const left = Number((rawItem as { left?: unknown }).left);
    const top = Number((rawItem as { top?: unknown }).top);
    const width = Number((rawItem as { width?: unknown }).width);
    const height = Number((rawItem as { height?: unknown }).height);
    if (![left, top, width, height].every(Number.isFinite)) {
      continue;
    }

    const valueText = typeof (rawItem as { valueText?: unknown }).valueText === "string"
      ? String((rawItem as { valueText: string }).valueText).trim()
      : "";
    const reason = typeof (rawItem as { reason?: unknown }).reason === "string"
      ? String((rawItem as { reason: string }).reason).trim()
      : "";

    items.push({
      key,
      cell: PHOTO_CELL_REVIEW_CELL_MAP[key],
      status,
      valueText: valueText || null,
      reason: reason || null,
      left: Math.max(0, Math.min(1000, left)),
      top: Math.max(0, Math.min(1000, top)),
      width: Math.max(1, Math.min(1000, width)),
      height: Math.max(1, Math.min(1000, height))
    });
  }

  return items;
}

function sanitizePhotoStructure(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const all22CellsVisible = payload.all22CellsVisible === true;
  const rawCount = Number(payload.gridCellCount);
  const gridCellCount = Number.isFinite(rawCount)
    ? Math.max(0, Math.min(22, Math.trunc(rawCount)))
    : 0;
  const missingCells = Array.isArray(payload.missingCells)
    ? payload.missingCells
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
      .map((item) => Math.trunc(item))
      .filter((item) => item >= 1 && item <= 22)
    : [];
  const reason = typeof payload.reason === "string" && payload.reason.trim()
    ? payload.reason.trim()
    : null;

  return {
    all22CellsVisible,
    gridCellCount,
    missingCells,
    reason
  };
}

function sanitizeFeedbackKeys(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && VALUE_KEYS.includes(item))
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeFeedbackNotes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim())
    .map((item) => item.trim());
}

function sanitizeOcrFeedbackPayload(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const departmentId = typeof payload.departmentId === "string" ? payload.departmentId.trim() : "";
  const departmentName = typeof payload.departmentName === "string" ? payload.departmentName.trim() : "";
  const reportDate = typeof payload.reportDate === "string" ? payload.reportDate.trim() : "";
  const photoReportDate = typeof payload.photoReportDate === "string" ? payload.photoReportDate.trim() : "";
  const imageName = typeof payload.imageName === "string" ? payload.imageName.trim() : "";
  const imageDataUrl = typeof payload.imageDataUrl === "string" && payload.imageDataUrl.startsWith("data:image/")
    ? payload.imageDataUrl
    : "";
  const saveStatus = typeof payload.status === "string" && OCR_FEEDBACK_STATUSES.includes(payload.status as (typeof OCR_FEEDBACK_STATUSES)[number])
    ? payload.status as (typeof OCR_FEEDBACK_STATUSES)[number]
    : null;

  if (!departmentId || !departmentName || !reportDate || !saveStatus) {
    return null;
  }

  return {
    departmentId,
    departmentName,
    reportDate,
    photoReportDate: photoReportDate || null,
    imageName: imageName || null,
    imageDataUrl: imageDataUrl || null,
    saveStatus,
    recognizedKeys: sanitizeFeedbackKeys(payload.recognizedKeys),
    changedKeys: sanitizeFeedbackKeys(payload.changedKeys),
    ocrRaw: sanitizeValues(payload.recognizedValues as Record<string, unknown> | undefined),
    finalValues: sanitizeValues(payload.finalValues as Record<string, unknown> | undefined),
    notes: sanitizeFeedbackNotes(payload.notes),
    cellReviews: sanitizePhotoCellReviews(payload.cellReviews)
  };
}

function getOpenAiApiKey() {
  const secret = Deno.env.get("OPENAI_API_KEY");
  return secret && secret.trim() ? secret.trim() : "";
}

function getPublicSiteBaseUrl() {
  const raw = Deno.env.get("PUBLIC_SITE_BASE_URL") || DEFAULT_SITE_BASE_URL;
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
  } catch (_error) {
    // Fall back to the known-good public site URL below.
  }
  return DEFAULT_SITE_BASE_URL;
}

function getOcrTemplateBlankImageUrl() {
  return `${getPublicSiteBaseUrl()}${OCR_TEMPLATE_BLANK_IMAGE_PATH}`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchImageAsDataUrl(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "image/*"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load reference image (${response.status}) from ${url}.`);
  }

  const contentType = response.headers.get("content-type")?.trim() || "image/jpeg";
  const bytes = new Uint8Array(await response.arrayBuffer());
  return `data:${contentType};base64,${bytesToBase64(bytes)}`;
}

function getTelegramBotToken() {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  return token && token.trim() ? token.trim() : "";
}

function getTelegramNotifyChatIds() {
  const raw = Deno.env.get("TELEGRAM_NOTIFY_CHAT_IDS") || Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS") || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getTelegramApiBaseUrl() {
  const token = getTelegramBotToken();
  if (!token) {
    return "";
  }
  return `https://api.telegram.org/bot${token}`;
}

async function callTelegramApi(method: string, body: Record<string, unknown>) {
  const apiBaseUrl = getTelegramApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured on the server.");
  }

  const response = await fetch(`${apiBaseUrl}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ok !== true) {
    const message = payload && typeof payload.description === "string" && payload.description.trim()
      ? payload.description.trim()
      : `Telegram API call ${method} failed (${response.status}).`;
    throw new Error(message);
  }

  return payload.result ?? null;
}

async function sendTelegramMessage(chatId: string, text: string) {
  await callTelegramApi("sendMessage", {
    chat_id: chatId,
    text
  });
}

function tryRepairUtf8Mojibake(value: string) {
  try {
    const bytes = Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8").decode(bytes);
  } catch (_error) {
    return value;
  }
}

function normalizeTelegramText(value: unknown) {
  let text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return "";
  }

  for (let index = 0; index < 3; index += 1) {
    if (!/[ÃÐÑ]/.test(text)) {
      break;
    }
    const repaired = tryRepairUtf8Mojibake(text).trim();
    if (!repaired || repaired === text) {
      break;
    }
    text = repaired;
  }

  return text;
}

async function notifyOwnerLogin(details: Record<string, unknown> | null | undefined) {
  const chatIds = getTelegramNotifyChatIds();
  if (!chatIds.length) {
    return { ok: false, skipped: true, reason: "no-chat-ids" };
  }

  const email = normalizeTelegramText(details?.email);
  const pageTitle = normalizeTelegramText(details?.pageTitle);
  const pagePath = normalizeTelegramText(details?.pagePath);
  const happenedAt = normalizeTelegramText(details?.happenedAt) || new Date().toISOString();

  const lines = [
    "Mainflow: site login",
    email ? `Email: ${email}` : "",
    pageTitle ? `Page: ${pageTitle}` : "",
    pagePath ? `Path: ${pagePath}` : "",
    `Time: ${happenedAt}`
  ].filter(Boolean);

  for (const chatId of chatIds) {
    await sendTelegramMessage(chatId, lines.join("\n"));
  }

  return { ok: true, sent: chatIds.length };
}

async function requestOpenAiStructuredVision(
  prompt: string,
  imageDataUrl: string,
  schemaName: string,
  schema: Record<string, unknown>,
  referenceImageUrls: string[] = [],
  extraImageDataUrls: string[] = []
) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const referenceImageDataUrls = await Promise.all(
    referenceImageUrls
      .filter((url) => typeof url === "string" && url.trim())
      .map((url) => fetchImageAsDataUrl(url.trim()))
  );

  const content = [
    {
      type: "input_text",
      text: prompt
    },
    ...referenceImageDataUrls.map((dataUrl) => ({
        type: "input_image",
        image_url: dataUrl,
        detail: "high"
      })),
    {
      type: "input_image",
      image_url: imageDataUrl,
      detail: "high"
    },
    ...extraImageDataUrls
      .filter((dataUrl) => typeof dataUrl === "string" && dataUrl.startsWith("data:image/"))
      .map((dataUrl) => ({
        type: "input_image",
        image_url: dataUrl,
        detail: "high"
      }))
  ];

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
          content
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
      },
      cellReviews: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: {
              type: "string",
              enum: PHOTO_CELL_REVIEW_KEYS
            },
            cell: { type: "integer" },
            status: {
              type: "string",
              enum: ["recognized", "review"]
            },
            valueText: { type: ["string", "null"] },
            reason: { type: ["string", "null"] },
            left: { type: "number" },
            top: { type: "number" },
            width: { type: "number" },
            height: { type: "number" }
          },
          required: ["key", "cell", "status", "valueText", "reason", "left", "top", "width", "height"]
        }
      },
      structure: {
        type: "object",
        additionalProperties: false,
        properties: {
          all22CellsVisible: { type: "boolean" },
          gridCellCount: { type: "integer" },
          missingCells: {
            type: "array",
            items: { type: "integer" }
          },
          reason: { type: ["string", "null"] }
        },
        required: ["all22CellsVisible", "gridCellCount", "missingCells", "reason"]
      }
    },
    required: ["reportDate", "values", "notes", "cellReviews", "structure"]
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
  imageDataUrl: string,
  extraImageDataUrls: string[] = []
) {
  const departmentMeta = DEPARTMENTS[departmentId as keyof typeof DEPARTMENTS];
  if (!departmentMeta) {
    throw new Error("Unknown department.");
  }

  const fieldInstructions = PHOTO_FIELD_MAPPINGS
    .map((item) => item.cell === 12
      ? `- cell ${item.cell}: ${item.key} (${item.label}). Do not extract or return this cell at all because the app calculates cell 12 automatically.`
      : `- cell ${item.cell}: ${item.key} (${item.label})`)
    .join("\n");

  const prompt = [
    "You extract handwritten numeric values from a standardized Armenian hospital department form.",
    `Department id: ${departmentId}. Department name: ${departmentMeta.department}.`,
    "The department is already fixed by the current page.",
    "You will receive images in this order: first a blank template reference of the same form, second the filled top-table crop, optionally one extra zoomed crop of the right-hand part of the same table, and optionally ten single-cell crops for cells 13 through 22.",
    "Use the blank template image only to align the printed grid and cell borders. Extract handwritten values only from the filled form image.",
    "If an extra zoomed right-side crop is present, use it to resolve cells 13 through 22 more accurately than the wider crop.",
    "The extra zoomed crop and the single-cell crops may be geometrically aligned versions of the same table. Prefer them over the wider crop for exact cell borders.",
    "If ten single-cell crops are present after the right-side zoom crop, they correspond exactly in this order: cell 13, cell 14, cell 15, cell 16, cell 17, cell 18, cell 19, cell 20, cell 21, cell 22.",
    "When the single-cell crops are present, use them as the primary source for cells 13-22 and use the larger crops only as context.",
    "Do not determine or change the department from SR markers, headers, or any other text in the image.",
    "If the photo is missing SR markers or the printed title is unclear, continue extracting values for the given department anyway.",
    "Read only the top numeric table and the handwritten report date near the header.",
    "Ignore the handwritten descriptive text in the lower part of the page.",
    "The standard top numeric row always contains exactly 22 handwritten cells from left to right.",
    "You must explicitly verify the printed top-row grid structure before trusting any values.",
    "Return structure.all22CellsVisible=true only if you can confidently follow all 22 printed cell positions from cell 1 through cell 22 in the top numeric row.",
    "Return structure.gridCellCount as the number of distinct top-row cell positions you can confidently identify by printed borders, including blank cells and including the position of cell 12.",
    "If you cannot confidently identify all 22 positions, set structure.all22CellsVisible=false, set structure.gridCellCount to the count you can see, list the missing or ambiguous cell numbers in structure.missingCells, and explain briefly in structure.reason.",
    PHOTO_TEMPLATE_GUIDE,
    "Return null for any cell that is blank, crossed out, unreadable, or uncertain.",
    "Do not infer values from formulas. Do not copy printed column numbers.",
    "Cells 10 and 11 are the two transfer columns. Immediately after cell 11 there is exactly one narrow single column: that is cell 12 only.",
    "Cell 12 is never entered by the operator and must not be extracted. The app calculates cell 12 automatically.",
    "Immediately after cell 12 there are exactly three adjacent cells under the soldier subgroup: those are cell 13 currentShar, cell 14 currentSpa, and cell 15 currentPaym in that strict left-to-right order.",
    "Do not merge cell 12 with cells 13-15. Do not shift values between cells 12, 13, 14, and 15 even when the handwriting is close to the border lines.",
    "If you see any writing in the narrow column for cell 12, ignore it completely and still read the next three values as cells 13, 14, and 15.",
    "After the three soldier columns in the 'present' block there are four consecutive single-column fields.",
    "Those four single-column fields must be read strictly in this order: cell 16 currentZh, cell 17 family, cell 18 officer, cell 19 civil.",
    "Do not shift handwritten values left or right between cells 16, 17, 18, and 19.",
    "Map the handwritten values into these fields:",
    fieldInstructions,
    "Cell 12 is a derived total between cell 11 and cell 13. Do not return it in values and never assign it to currentShar or any later field.",
    "If the photo clearly shows a handwritten value under the single column between the three soldier columns and the family column, that value belongs to currentZh.",
    "The top table also contains derived totals. Do not return those derived totals unless they correspond to one of the listed fields above.",
    "Return reportDate in dd.mm.yy or dd.mm.yyyy when visible, otherwise null.",
    "Return cellReviews only for cells where you see handwritten content in the top numeric table.",
    "For cellReviews use status recognized when the handwritten value is read confidently, and status review when the cell has handwriting but the read is uncertain or may be wrong.",
    "For each cellReviews item return approximate bounding box coordinates relative to the full image: left, top, width, height in a 0..1000 scale.",
    "Do not add blank cells to cellReviews.",
    "Do not include cell 12 in values or in cellReviews.",
    "Use notes for short uncertainty comments only when needed."
  ].join("\n");

  const parsed = await requestOpenAiStructuredVision(
    prompt,
    imageDataUrl,
    "department_photo_recognition",
    buildPhotoRecognitionSchema(),
    [getOcrTemplateBlankImageUrl()],
    extraImageDataUrls
  );

  const sanitizedValues = sanitizeValues(parsed.values as Record<string, unknown> | undefined);
  const finalValues = sanitizedValues;
  const structure = sanitizePhotoStructure(parsed.structure);
  const baseNotes = Array.isArray(parsed.notes)
    ? parsed.notes.filter((item) => typeof item === "string" && item.trim()).map((item) => String(item).trim())
    : [];
  const structureInvalid = !!structure && (!structure.all22CellsVisible || structure.gridCellCount !== 22);
  const notes = [...baseNotes];
  if (structureInvalid) {
    notes.push(
      structure?.reason
        ? `Структура верхней строки не подтверждена: найдено ${structure.gridCellCount}/22 ячеек. ${structure.reason}`
        : `Структура верхней строки не подтверждена: найдено ${structure?.gridCellCount ?? 0}/22 ячеек.`
    );
  }

  return {
    reportDate: sanitizeReportDate(parsed.reportDate),
    values: finalValues,
    recognizedKeys: structureInvalid
      ? []
      : Object.entries(finalValues)
      .filter(([, value]) => value !== null)
      .map(([key]) => key),
    notes,
    cellReviews: sanitizePhotoCellReviews(parsed.cellReviews),
    structure
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
    .select("department_id, values, updated_at, photo_workflow_status, photo_feedback_id, photo_feedback_updated_at, photo_name");

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
        updatedAt: saved?.updated_at || null,
        photoWorkflowStatus: typeof saved?.photo_workflow_status === "string" ? saved.photo_workflow_status : "idle",
        photoFeedbackId: typeof saved?.photo_feedback_id === "number" ? saved.photo_feedback_id : null,
        photoFeedbackUpdatedAt: saved?.photo_feedback_updated_at || null,
        photoName: typeof saved?.photo_name === "string" ? saved.photo_name : ""
      };
    })
  };
}

async function listOcrFeedbackRecords(supabase: ReturnType<typeof createClient>, limit: number) {
  const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit || 100)));
  const { data, error } = await supabase
    .from("sharsh_ocr_feedback")
    .select("id, created_at, department_id, department_name, report_date, photo_report_date, save_status, image_name, image_data_url, recognized_keys, changed_keys, ocr_raw, final_values, notes, cell_reviews")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    departmentId: row.department_id,
    departmentName: row.department_name,
    reportDate: row.report_date,
    photoReportDate: row.photo_report_date,
    status: row.save_status,
    imageName: row.image_name,
    imageDataUrl: row.image_data_url,
    recognizedKeys: Array.isArray(row.recognized_keys) ? row.recognized_keys : [],
    changedKeys: Array.isArray(row.changed_keys) ? row.changed_keys : [],
    recognizedValues: sanitizeValues(row.ocr_raw as Record<string, unknown> | undefined),
    finalValues: sanitizeValues(row.final_values as Record<string, unknown> | undefined),
    notes: sanitizeFeedbackNotes(row.notes),
    cellReviews: sanitizePhotoCellReviews(row.cell_reviews)
  }));
}

async function insertOcrFeedbackRecord(
  supabase: ReturnType<typeof createClient>,
  feedback: ReturnType<typeof sanitizeOcrFeedbackPayload>
) {
  if (!feedback) {
    return;
  }

  const { error } = await supabase
    .from("sharsh_ocr_feedback")
    .insert({
      department_id: feedback.departmentId,
      department_name: feedback.departmentName,
      report_date: feedback.reportDate,
      photo_report_date: feedback.photoReportDate,
      save_status: feedback.saveStatus,
      image_name: feedback.imageName,
      image_data_url: feedback.saveStatus === "corrected_by_operator" ? feedback.imageDataUrl : null,
      recognized_keys: feedback.recognizedKeys,
      changed_keys: feedback.changedKeys,
      ocr_raw: feedback.ocrRaw,
      final_values: feedback.finalValues,
      notes: feedback.notes,
      cell_reviews: feedback.cellReviews,
      created_at: new Date().toISOString()
    });

  if (error) {
    throw error;
  }
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

      const extraImageDataUrls = Array.isArray(payload.extraImageDataUrls)
        ? payload.extraImageDataUrls
          .filter((item): item is string => typeof item === "string" && item.trim().startsWith("data:image/"))
          .map((item) => item.trim())
        : [];

      const recognition = await recognizeDepartmentPhoto(departmentId, imageDataUrl, extraImageDataUrls);
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

    if (type === "list_ocr_feedback") {
      const limit = Number(payload?.limit);
      return jsonResponse({
        records: await listOcrFeedbackRecords(supabase, Number.isFinite(limit) ? limit : 100)
      });
    }

    if (type === "save_ocr_feedback") {
      const feedback = sanitizeOcrFeedbackPayload(payload.feedback);
      if (!feedback) {
        return jsonResponse({ error: "A valid OCR feedback payload is required." }, 400);
      }

      await insertOcrFeedbackRecord(supabase, feedback);
      return jsonResponse({ ok: true });
    }

    if (type === "notify_owner_login") {
      const details = payload && typeof payload.details === "object" ? payload.details as Record<string, unknown> : {};
      return jsonResponse(await notifyOwnerLogin(details));
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

    const { error: workflowError } = await supabase
      .from("sharsh_departments")
      .update({
        photo_workflow_status: "processed",
        photo_feedback_updated_at: new Date().toISOString()
      })
      .eq("department_id", departmentId)
      .not("photo_feedback_id", "is", null);

    if (workflowError) {
      throw workflowError;
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


