import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

// deploy-touch: 2026-05-10
const DEFAULT_DATE = "05,05,26";
const PHOTO_RECOGNITION_MODEL = (Deno.env.get("OPENAI_PHOTO_MODEL") || "gpt-5.4-mini").trim();
const DEFAULT_SITE_BASE_URL = "https://vadimelizbaryan.github.io/SARSH_KKZH";
const OCR_TEMPLATE_BLANK_IMAGE_PATH = "/assets/ocr-template-blank.jpg";
const DEPARTMENT_SHEET_TEMPLATE_PATH = "/assets/templates/SHARSH_KKZH_template.xlsx";
const TELEGRAM_RETRY_ATTEMPTS = 3;
const TELEGRAM_RETRY_BASE_DELAY_MS = 700;
const TELEGRAM_COLLEAGUES_META_KEY = "telegram_colleagues_access";
const TELEGRAM_COLLEAGUE_CHATS_META_KEY = "telegram_colleague_chats";
const TELEGRAM_DAILY_REMINDER_META_PREFIX = "telegram_daily_reminder_sent";
const TELEGRAM_MAIN_PDFS_META_KEY = "telegram_main_pdfs_sent";
const MAIN_MOVEMENT_PDF_FILE_NAME = "MAINFLOW.pdf";
const REPORT_PDF_FILE_NAME = "Report.pdf";
const ARMENIAN_PDF_FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansarmenian/NotoSansArmenian%5Bwdth,wght%5D.ttf";
const TELEGRAM_DAILY_REMINDERS = {
  midday: {
    label: "12:00",
    text: [
      "Հարգելի կոլլեգաներ։",
      "Հիշեցնում եմ, որ ժամը 14։00-ին ընդունարանը սպասում է Ձեր բաժանմունքի շարժի բլանկների լուսանկարներին։",
      "Խնդրում եմ լուսանկարները տեղադրել իմ այս էջում և հետևել հրահանգներին։",
      "Հարգանքներով՝ Վադիմ Աշոտիչ"
    ].join("\n")
  },
  evening: {
    label: "17:00",
    text: [
      "Հարգելի կոլլեգաներ։",
      "Հիշեցնում եմ, որ ժամը 18։00-ին ընդունարանը սպասում է Ձեր բաժանմունքի շարժի բլանկների լուսանկարներին։",
      "Խնդրում եմ լուսանկարները տեղադրել իմ այս էջում և հետևել հրահանգներին։",
      "Հարգանքներով՝ Վադիմ Աշոտիչ"
    ].join("\n")
  }
} as const;
type TelegramDailyReminderSlot = keyof typeof TELEGRAM_DAILY_REMINDERS;

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
  "qhBaseSoldier",
  "qhBaseOfficer",
  "qhBaseContract",
  "qhIncomingSoldier",
  "qhIncomingOfficer",
  "qhIncomingContract",
  "qhDischargedSoldier",
  "qhDischargedOfficer",
  "qhDischargedContract"
] as const;

const PHOTO_FIELD_MAPPINGS = [
  { cell: 1, key: "beenTotal", label: "been / total" },
  { cell: 2, key: "beenSoldier", label: "been / soldier" },
  { cell: 3, key: "beenSeries", label: "been / series" },
  { cell: 4, key: "admittedTotal", label: "admitted / total" },
  { cell: 5, key: "admittedSoldier", label: "admitted / soldier" },
  { cell: 6, key: "admittedSeries", label: "admitted / series" },
  { cell: 7, key: "dgTotal", label: "discharged / total" },
  { cell: 8, key: "dgSoldier", label: "discharged / soldier" },
  { cell: 9, key: "dgSeries", label: "discharged / series" },
  { cell: 10, key: "transferFromDepartment", label: "transfer / from department" },
  { cell: 11, key: "transferToDepartment", label: "transfer / to department" },
  { cell: 12, key: "presentTotal", label: "present calculated/control total; display only, never currentShar" },
  { cell: 13, key: "currentShar", label: "present / shar / first soldier column" },
  { cell: 14, key: "currentSpa", label: "present / spa / second soldier column" },
  { cell: 15, key: "currentPaym", label: "present / paym / third soldier column" },
  { cell: 16, key: "currentZh", label: "present / zh / single column immediately after the three soldier columns" },
  { cell: 17, key: "family", label: "present / family" },
  { cell: 18, key: "officer", label: "present / officer" },
  { cell: 19, key: "civil", label: "present / civil" },
  { cell: 20, key: "leaveSharq", label: "leave / sharq" },
  { cell: 21, key: "leaveSpa", label: "leave / spa" },
  { cell: 22, key: "leavePaym", label: "leave / paym; final rightmost normal variable" }
] as const;

const PHOTO_RIGHT_CELL_MAPPINGS = PHOTO_FIELD_MAPPINGS
  .filter((item) => item.cell >= 12 && item.cell <= 22);

const PHOTO_RIGHT_CELL_KEYS = PHOTO_RIGHT_CELL_MAPPINGS
  .map((item) => item.key);

const PHOTO_SCHEMA_VALUE_KEYS = PHOTO_FIELD_MAPPINGS
  .map((item) => item.key);

const DEPARTMENTS = {
  r4: { department: "Վիրաբուժական", group: "primary", marker: "SR-4", slug: "te9625wg" },
  r5: { department: "Դ/Ծ վ/բ բաժանմունք", group: "primary", marker: "SR-5", slug: "1ei6dnv2" },
  r6: { department: "Քիթ-կոկորդ բ-ք", group: "primary", marker: "SR-6", slug: "du9wa6oq" },
  r7: { department: "Ակնաբուժական", group: "primary", marker: "SR-7", slug: "08xa44ew" },
  r8: { department: "Վնասվածքաբանական", group: "primary", marker: "SR-8", slug: "v1914tm9" },
  r9: { department: "Կրծքային վ/բ", group: "primary", marker: "SR-9", slug: "c3usp3r9" },
  r10: { department: "Ուռոլոգիական", group: "primary", marker: "SR-10", slug: "g5u3jca0" },
  r11: { department: "Նեյրովիրաբուժական", group: "primary", marker: "SR-11", slug: "4k6uv2xu" },
  r12: { department: "Թռիչքային", group: "primary", marker: "SR-12", slug: "ltndeohl" },
  r13: { department: "Թերապիա", group: "primary", marker: "SR-13", slug: "ptf9nvbv" },
  r14: { department: "Վերակենդանացման", group: "primary", marker: "SR-14", slug: "9htuxle8" },
  r15: { department: "Նյարդաբանական", group: "primary", marker: "SR-15", slug: "ldvp99z7" },
  r16: { department: "Գինեկոլոգիական", group: "primary", marker: "SR-16", slug: "zzphaoqo" },
  r17: { department: "Անոթային", group: "primary", marker: "SR-17", slug: "4zby7qi3" },
  r19: { department: "ԻՆՖ", group: "extra", marker: "SR-19", slug: "c5mv5bh4" },
  r20: { department: "ԱՏԴ", group: "extra", marker: "SR-20", slug: "5s7rrwg9" },
  r21: { department: "Ք/Հ", group: "extra", marker: "SR-21", slug: "3ofsacp6" }
} as const;

const DEPARTMENT_PDF_FILES: Record<keyof typeof DEPARTMENTS, { folder: string; file: string }> = {
  r4: { folder: "Վիրաբուժական", file: "Վիրաբուժական.pdf" },
  r5: { folder: "Դիմածնոտային վիր", file: "Դիմածնոտային վիր.pdf" },
  r6: { folder: "Քիթ-կոկորդ բ-ք", file: "Քիթ-կոկորդ բ-ք.pdf" },
  r7: { folder: "Ակնաբուժական", file: "Ակնաբուժական.pdf" },
  r8: { folder: "Վնասվածքաբանական", file: "Վնասվածքաբանական.pdf" },
  r9: { folder: "Կրծքային մ-բ", file: "Կրծքային մ-բ.pdf" },
  r10: { folder: "Ուռոլոգիական", file: "Ուռոլոգիական.pdf" },
  r11: { folder: "Նեյրովիրաբուժական", file: "Նեյրովիրաբուժական.pdf" },
  r12: { folder: "Թռիչքային", file: "Թռիչքային.pdf" },
  r13: { folder: "Թերապիա", file: "Թերապիա.pdf" },
  r14: { folder: "Վերակենդանացման", file: "Վերակենդանացման.pdf" },
  r15: { folder: "Նյարդաբանական", file: "Նյարդաբանական.pdf" },
  r16: { folder: "Գինեկոլոգիական", file: "Գինեկոլոգիական.pdf" },
  r17: { folder: "ԱՆՈԹԱՅԻՆ", file: "ԱՆՈԹԱՅԻՆ.pdf" },
  r19: { folder: "ԻՆՖ", file: "ԻՆՖ.pdf" },
  r20: { folder: "ԱՏԴ", file: "ԱՏԴ.pdf" },
  r21: { folder: "Ք-Հ", file: "Ք-Հ.pdf" }
};

const DEPARTMENT_PDF_VALUE_X = [
  51, 85, 121, 156, 190, 224, 258, 292, 327, 361, 395,
  443, 477, 511, 545, 579, 614, 648, 682, 717, 752, 786
];
const DEPARTMENT_PDF_VALUE_Y = 367;
const DEPARTMENT_PDF_DATE_X = 82;
const DEPARTMENT_PDF_DATE_Y = 72;
const DEPARTMENT_PDF_DATE_FONT_SIZE = 11;

const DEPARTMENT_SHEET_ROW_BY_ID: Record<keyof typeof DEPARTMENTS, number> = {
  r4: 4,
  r5: 5,
  r6: 6,
  r7: 7,
  r8: 8,
  r9: 9,
  r10: 10,
  r11: 11,
  r12: 12,
  r13: 13,
  r14: 14,
  r15: 15,
  r16: 16,
  r17: 17,
  r19: 19,
  r20: 20,
  r21: 21
};
const DEPARTMENT_SHEET_INPUT_COLUMNS = [
  "B", "C", "D",
  "E", "F", "G",
  "H", "I", "J",
  "M", "N", "O",
  "P", "Q", "R", "S",
  "T", "U", "V",
  "Y", "Z"
];
const DEPARTMENT_SHEET_VALUE_COLUMNS = {
  beenTotal: "B",
  beenSoldier: "C",
  beenSeries: "D",
  admittedTotal: "E",
  admittedSoldier: "F",
  admittedSeries: "G",
  dgTotal: "H",
  dgSoldier: "I",
  dgSeries: "J",
  currentShar: "M",
  currentSpa: "N",
  currentPaym: "O",
  currentZh: "P",
  family: "Q",
  officer: "R",
  civil: "S",
  leaveSharq: "T",
  leaveSpa: "U",
  leavePaym: "V",
  transferFromDepartment: "Y",
  transferToDepartment: "Z"
} as const;
const DEPARTMENT_SHEET_VALUE_KEYS = Object.keys(DEPARTMENT_SHEET_VALUE_COLUMNS);
const DEPARTMENT_SHEET_PRESENT_SUM_KEYS = [
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
] as const;
const DEPARTMENT_SHEET_LEAVE_SUM_KEYS = [
  "leaveSharq",
  "leaveSpa",
  "leavePaym"
] as const;
const MAIN_PDF_COLUMNS = [
  { key: "beenTotal", label: "1" },
  { key: "beenSoldier", label: "2" },
  { key: "beenSeries", label: "3" },
  { key: "admittedTotal", label: "4" },
  { key: "admittedSoldier", label: "5" },
  { key: "admittedSeries", label: "6" },
  { key: "dgTotal", label: "7" },
  { key: "dgSoldier", label: "8" },
  { key: "dgSeries", label: "9" },
  { key: "transferFromDepartment", label: "10" },
  { key: "transferToDepartment", label: "11" },
  { key: "presentTotal", label: "12" },
  { key: "currentShar", label: "13" },
  { key: "currentSpa", label: "14" },
  { key: "currentPaym", label: "15" },
  { key: "currentZh", label: "16" },
  { key: "family", label: "17" },
  { key: "officer", label: "18" },
  { key: "civil", label: "19" },
  { key: "leaveSharq", label: "20" },
  { key: "leaveSpa", label: "21" },
  { key: "leavePaym", label: "22" },
  { key: "leaveTotal", label: "23" }
] as const;
const REPORT_PRIMARY_ITEMS = [
  { key: "beenTotal", cell: 1, label: "Հոսպիտալում եղել է" },
  { key: "admittedTotal", cell: 4, label: "Ընդունվել է" },
  { key: "dgTotal", cell: 7, label: "Դուրս է գրվել" },
  { key: "presentTotal", cell: 12, label: "Առկա է" },
  { divider: true, label: "Որից" },
  { key: "currentShar", cell: 13, label: "Ժամկետային զ/ծ" },
  { key: "currentSpa", cell: 14, label: "Սպա" },
  { key: "currentPaym", cell: 15, label: "Պայմանագր" },
  { key: "currentZh", cell: 16, label: "Զինհաշմանդամ" },
  { key: "family", cell: 17, label: "Զինծառայ․ընտ․անդ․" },
  { key: "officer", cell: 18, label: "Զինապարտ" },
  { key: "civil", cell: 19, label: "Քաղաքացի" },
  { divider: true, label: "Արձակուրդում առկա է", totalKey: "leaveTotal" },
  { key: "leaveSharq", cell: 20, label: "Ժամկետային զ/ծ" },
  { key: "leaveSpa", cell: 21, label: "Սպա" },
  { key: "leavePaym", cell: 22, label: "Պայմանագրային" }
] as const;
const REPORT_SPECIAL_GROUPS = [
  {
    rowId: "r19",
    title: "ԻՆՖ-ում առկա է",
    items: [
      { key: "presentTotal", cell: 12, label: "ԻՆՖ-ում առկա է" },
      { key: "currentShar", cell: 13, label: "Ժամկետային" },
      { key: "currentSpa", cell: 14, label: "Սպա" },
      { key: "currentPaym", cell: 15, label: "Պայմ" }
    ]
  },
  {
    rowId: "r21",
    title: "Քաղաքացիական հիվանդան․ առկա է",
    items: [
      { key: "presentTotal", cell: 12, label: "Քաղաքացիական հիվանդան․ առկա է" },
      { key: "currentShar", cell: 13, label: "Ժամկետային զ/ծ" },
      { key: "currentSpa", cell: 14, label: "Սպա" },
      { key: "currentPaym", cell: 15, label: "Պայմանագրային" }
    ]
  },
  {
    rowId: "r20",
    title: "ԱՏԴ-ում առկա է",
    items: [
      { key: "presentTotal", cell: 12, label: "ԱՏԴ-ում առկա է" },
      { key: "currentShar", cell: 13, label: "Ժամկետային" },
      { key: "currentSpa", cell: 14, label: "Սպա" },
      { key: "currentPaym", cell: 15, label: "Պայմանագրային" }
    ]
  }
] as const;
const DEPARTMENT_SHEET_FORMULA_COLUMNS = ["K", "L", "W", "X"];
const DEPARTMENT_SHEET_LAST_COLUMN = "Z";
const DEPARTMENT_SHEET_FIRST_INPUT_COLUMN = "B";
const DEPARTMENT_SHEET_PROTECTION_TAG = [
  '<sheetProtection algorithmName="SHA-512"',
  ' hashValue="Cp0WkSPoNf7F8vuLdTav6oyw9QDLU/fmbtQm4BnGFi4aUlCX8ks4uP/bMtM0OhudRVMphOU4WXv374N67WNvEw=="',
  ' saltValue="isomLFp1CwyyV8C3DxAtUg==" spinCount="100000"',
  ' sheet="1" objects="1" scenarios="1"',
  ' selectLockedCells="1"',
  ' formatCells="1" formatColumns="1" formatRows="1"',
  ' insertColumns="1" insertRows="1" insertHyperlinks="1"',
  ' deleteColumns="1" deleteRows="1"',
  ' sort="1" autoFilter="1" pivotTables="1"/>'
].join("");

const PHOTO_TEMPLATE_GUIDE = [
  "Template layout of the 22 visible top-row positions from left to right:",
  "- cells 1, 2, 3: first three-cell block on the far left",
  "- cells 4, 5, 6: second three-cell block",
  "- cells 7, 8, 9: third three-cell block",
  "- cells 10, 11: two narrow transfer cells",
  "- cell 12: one narrow calculated/control total cell immediately after cell 11; read it as presentTotal only",
  "- cells 13, 14, 15: one three-cell group immediately after cell 12",
  "- cells 16, 17, 18, 19: four consecutive single cells immediately after cells 13-15",
  "- cells 20, 21, 22: final three-cell leave block on the far right; cell 22 is the last visible handwritten cell and is a normal variable",
  "Use the printed vertical borders of the table as the main source of separation between neighboring cells."
].join("\n");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token, x-telegram-reminder-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

type DepartmentId = keyof typeof DEPARTMENTS;

const QH_CALC_DEPARTMENT_IDS = new Set<DepartmentId>(["r19", "r20", "r21"]);
const QH_CALC_CARRYOVER_PAIRS = [
  { base: "qhBaseSoldier", current: "currentShar" },
  { base: "qhBaseOfficer", current: "currentSpa" },
  { base: "qhBaseContract", current: "currentPaym" }
] as const;

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
  for (const key of VALUE_KEYS) {
    output[key] = sanitizeNumber(values ? values[key] : null);
  }
  return output;
}

function sanitizeDepartmentFormValues(values: unknown) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return sanitizeValues(null);
  }
  const rawValues = values as Record<string, unknown>;
  const allowedValues: Record<string, unknown> = {};
  DEPARTMENT_SHEET_VALUE_KEYS.forEach((key) => {
    allowedValues[key] = rawValues[key];
  });
  return sanitizeValues(allowedValues);
}

function sanitizeRightCellValues(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return PHOTO_RIGHT_CELL_KEYS.map((_key, index) => sanitizeNumber(value[index]));
}

function applyRightCellValues(
  values: Record<string, number | null>,
  rightCellValues: Array<number | null> | null
) {
  if (!rightCellValues || rightCellValues.length !== PHOTO_RIGHT_CELL_KEYS.length) {
    return false;
  }
  if (!rightCellValues.some((value) => value !== null)) {
    return false;
  }

  PHOTO_RIGHT_CELL_KEYS.forEach((key, index) => {
    values[key] = rightCellValues[index];
  });
  return true;
}

function extractPresentTotalFromNotes(notes: string[]) {
  for (const note of notes) {
    if (typeof note !== "string" || !note.trim()) {
      continue;
    }
    const englishMatch = note.match(/\bcell\s*12\b.*?\b(?:as|=|is)\s*(\d+)\b/i);
    if (englishMatch) {
      return sanitizeNumber(englishMatch[1]);
    }
    const russianMatch = note.match(/\bяч(?:ейк[аи]|\.?)\s*12\b.*?\b(?:как|=|это|значение)\s*(\d+)\b/i);
    if (russianMatch) {
      return sanitizeNumber(russianMatch[1]);
    }
  }
  return null;
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

function getTelegramBotToken() {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  return token && token.trim() ? token.trim() : "";
}

function getTelegramSecretToken() {
  const token = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  return token && token.trim() ? token.trim() : "";
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function textToArrayBuffer(value: string) {
  const bytes = new TextEncoder().encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function hmacSha256(keyBytes: ArrayBuffer, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
}

async function verifyTelegramWebAppInitData(initData: string) {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured on the server.");
  }

  const params = new URLSearchParams(initData || "");
  const receivedHash = String(params.get("hash") || "").trim().toLowerCase();
  if (!receivedHash) {
    return null;
  }

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = await hmacSha256(textToArrayBuffer("WebAppData"), token);
  const calculatedHash = bytesToHex(await hmacSha256(secretKey, dataCheckString));
  if (!timingSafeEqual(receivedHash, calculatedHash)) {
    return null;
  }

  const userJson = params.get("user") || "";
  const user = userJson ? JSON.parse(userJson) as Record<string, unknown> : null;
  return {
    userId: typeof user?.id === "number" ? user.id : null,
    firstName: typeof user?.first_name === "string" ? user.first_name : "",
    lastName: typeof user?.last_name === "string" ? user.last_name : "",
    username: typeof user?.username === "string" ? user.username : ""
  };
}

function getTelegramAllowedChatIds() {
  const raw = Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS") || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isTelegramChatAccessRestricted() {
  const raw = (Deno.env.get("TELEGRAM_RESTRICT_CHAT_IDS") || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function getTelegramNotifyChatIds(currentChatId?: number | string | null) {
  const explicitRaw = Deno.env.get("TELEGRAM_NOTIFY_CHAT_IDS");
  const raw = explicitRaw || Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS") || "";
  const current = currentChatId === null || typeof currentChatId === "undefined" ? "" : String(currentChatId);
  return Array.from(new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => explicitRaw || value !== current)
  ));
}

function splitTelegramChatIds(raw: string) {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getTelegramAdminChatIds() {
  const raw = Deno.env.get("TELEGRAM_ADMIN_CHAT_IDS")
    || Deno.env.get("TELEGRAM_NOTIFY_CHAT_IDS")
    || Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS")
    || "";
  return splitTelegramChatIds(raw);
}

function isTelegramAdminChat(chatId: number | string | null) {
  if (chatId === null) {
    return false;
  }
  const admins = getTelegramAdminChatIds();
  return admins.includes(String(chatId));
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

function getTelegramWebFormUrl(
  departmentId: DepartmentId,
  reportDate: string,
  carryoverValues?: Record<string, number | null>
) {
  const params = new URLSearchParams();
  params.set("department", departmentId);
  params.set("date", reportDate);
  if (carryoverValues) {
    params.set("c1", String(carryoverValues.beenTotal ?? 0));
    params.set("c2", String(carryoverValues.beenSoldier ?? 0));
    params.set("c3", String(carryoverValues.beenSeries ?? 0));
  }
  return `${getPublicSiteBaseUrl()}/tg-form.html?${params.toString()}`;
}

function getOcrTemplateBlankImageUrl() {
  return `${getPublicSiteBaseUrl()}${OCR_TEMPLATE_BLANK_IMAGE_PATH}`;
}

function getDepartmentSheetTemplateUrl() {
  return `${getPublicSiteBaseUrl()}${DEPARTMENT_SHEET_TEMPLATE_PATH}`;
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

async function requestOpenAiStructuredVision(
  prompt: string,
  imageDataUrl: string,
  schemaName: string,
  schema: Record<string, unknown>,
  referenceImageUrls: string[] = []
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
    }
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
      rightCellValues: {
        type: "array",
        minItems: PHOTO_RIGHT_CELL_KEYS.length,
        maxItems: PHOTO_RIGHT_CELL_KEYS.length,
        items: { type: ["integer", "null"] }
      },
      notes: {
        type: "array",
        items: { type: "string" }
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
    required: ["reportDate", "values", "rightCellValues", "notes", "structure"]
  };
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

async function recognizeDepartmentPhoto(departmentId: DepartmentId, imageDataUrl: string) {
  const departmentMeta = DEPARTMENTS[departmentId];
  const fieldInstructions = PHOTO_FIELD_MAPPINGS
    .map((item) => `- cell ${item.cell}: ${item.key} (${item.label})`)
    .join("\n");

  const prompt = [
    "You extract handwritten numeric values from a standardized Armenian hospital department form.",
    `Department id: ${departmentId}. Department name: ${departmentMeta.department}.`,
    "The department is already fixed by the current request.",
    "You will receive two images in order: first a blank template reference of the same form, then the filled form to extract.",
    "Use the blank template image only to align the printed grid and cell borders. Extract handwritten values only from the filled form image.",
    "Do not determine or change the department from SR markers, headers, or any other text in the image.",
    "Read only the top numeric table and the handwritten report date near the header.",
    "Ignore the handwritten descriptive text in the lower part of the page.",
    "The standard top numeric row contains exactly cells 1 through 22. There is no cell 23 in the photo.",
    "You must explicitly verify the printed top-row grid structure before trusting any values.",
    "Return structure.all22CellsVisible=true only if you can confidently follow cells 1 through 22 in the top numeric row.",
    "Return structure.gridCellCount as the number of distinct top-row cell positions you can confidently identify by printed borders, including blank cells and including the position of cell 12.",
    "If you cannot confidently identify all 22 positions, set structure.all22CellsVisible=false, set structure.gridCellCount to the count you can see, list the missing or ambiguous cell numbers in structure.missingCells, and explain briefly in structure.reason.",
    PHOTO_TEMPLATE_GUIDE,
    "Return null for any cell that is blank, crossed out, unreadable, or uncertain.",
    "Do not infer values from formulas. Do not copy printed column numbers.",
    "Cells 10 and 11 are the two transfer columns. Immediately after cell 11 there is exactly one narrow single column: that is visual cell 12.",
    "Return rightCellValues as exactly 11 items for the visual right side of the printed row, strictly left to right: [cell 12, cell 13, cell 14, cell 15, cell 16, cell 17, cell 18, cell 19, cell 20, cell 21, cell 22].",
    "The program applies the required left-shift correction from rightCellValues: item 0 goes to presentTotal/cell 12, item 1 to currentShar/cell 13, item 2 to currentSpa/cell 14, item 3 to currentPaym/cell 15, item 4 to currentZh/cell 16, item 5 to family/cell 17, item 6 to officer/cell 18, item 7 to civil/cell 19, item 8 to leaveSharq/cell 20, item 9 to leaveSpa/cell 21, item 10 to leavePaym/cell 22.",
    "This positional rightCellValues array is more important than semantic labels for cells 12-22. Do not let the visual cell 12 value move to cell 13; put it in rightCellValues[0].",
    "The last visible rightmost handwritten cell is visual cell 22 and must be preserved in rightCellValues[10].",
    "After the three soldier columns in the 'present' block there are four consecutive single-column fields.",
    "Those four single-column fields must be read strictly in this order: cell 16 currentZh, cell 17 family, cell 18 officer, cell 19 civil.",
    "For rightCellValues, keep the visual left-to-right order between cells 16, 17, 18, and 19.",
    "Cell 22 is the final rightmost handwritten value on the blank and is a normal variable, not a calculated total.",
    "Map the handwritten values into these fields:",
    fieldInstructions,
    "Return reportDate in dd.mm.yy or dd.mm.yyyy when visible, otherwise null.",
    "Return the handwritten value in visual cell 12 as rightCellValues[0] when it is visibly written in the filled form.",
    "Do not calculate visual cell 12 from any other cells. Return only the raw handwritten value you see in visual cell 12.",
    "Use notes for short uncertainty comments only when needed."
  ].join("\n");

  const parsed = await requestOpenAiStructuredVision(
    prompt,
    imageDataUrl,
    "telegram_department_photo_recognition",
    buildPhotoRecognitionSchema(),
    [getOcrTemplateBlankImageUrl()]
  );

  const parsedValues = parsed.values && typeof parsed.values === "object"
    ? parsed.values as Record<string, unknown>
    : {};
  const sanitizedValues = sanitizeValues(parsedValues);
  sanitizedValues.presentTotal = sanitizeNumber(parsedValues.presentTotal);
  const rightCellValues = sanitizeRightCellValues(parsed.rightCellValues);
  applyRightCellValues(sanitizedValues, rightCellValues);
  const finalValues = sanitizedValues;
  const structure = sanitizePhotoStructure(parsed.structure);
  const baseNotes = Array.isArray(parsed.notes)
    ? parsed.notes.filter((item) => typeof item === "string" && item.trim()).map((item) => String(item).trim())
    : [];
  if (sanitizedValues.presentTotal === null) {
    sanitizedValues.presentTotal = extractPresentTotalFromNotes(baseNotes);
  }
  const structureInvalid = !!structure && (!structure.all22CellsVisible || structure.gridCellCount !== 22);
  const notes = [...baseNotes];
  if (structureInvalid) {
    notes.push(
      structure?.reason
        ? `Վերին տողի կառուցվածքը հաստատված չէ. գտնվել է ${structure.gridCellCount}/22 բջիջ։ ${structure.reason}`
        : `Վերին տողի կառուցվածքը հաստատված չէ. գտնվել է ${structure?.gridCellCount ?? 0}/22 բջիջ։`
    );
  }

  return {
    reportDate: sanitizeReportDate(parsed.reportDate),
    values: finalValues,
    recognizedKeys: structureInvalid
      ? []
      : Object.entries(finalValues)
      .filter(([_key, value]) => value !== null)
      .map(([key]) => key),
    notes,
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
    "Choose exactly one departmentId from this list when confident:",
    departmentInstructions,
    "If the image is too unclear or you are not confident, return departmentId as null.",
    "Use notes for short comments such as marker found, title found, or uncertain header."
  ].join("\n");

  const parsed = await requestOpenAiStructuredVision(
    prompt,
    imageDataUrl,
    "telegram_department_photo_detection",
    buildDepartmentDetectionSchema()
  );

  const rawDepartmentId = typeof parsed.departmentId === "string" ? parsed.departmentId.trim() : "";
  const departmentId = Object.prototype.hasOwnProperty.call(DEPARTMENTS, rawDepartmentId)
    ? rawDepartmentId as DepartmentId
    : null;

  return {
    departmentId,
    notes: Array.isArray(parsed.notes)
      ? parsed.notes.filter((item) => typeof item === "string" && item.trim()).map((item) => String(item).trim())
      : []
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

async function areTelegramColleaguesEnabled(supabase: ReturnType<typeof createClient>) {
  if (isTelegramChatAccessRestricted()) {
    return false;
  }

  const { data, error } = await supabase
    .from("sharsh_report_meta")
    .select("report_date")
    .eq("report_key", TELEGRAM_COLLEAGUES_META_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const value = String(data?.report_date || "on").trim().toLowerCase();
  return value !== "off" && value !== "0" && value !== "false";
}

async function setTelegramColleaguesEnabled(
  supabase: ReturnType<typeof createClient>,
  enabled: boolean
) {
  const { error } = await supabase
    .from("sharsh_report_meta")
    .upsert({
      report_key: TELEGRAM_COLLEAGUES_META_KEY,
      report_date: enabled ? "on" : "off",
      updated_at: new Date().toISOString()
    });

  if (error) {
    throw error;
  }
}

type TelegramColleagueChat = {
  chatId: string;
  firstName: string;
  lastName: string;
  username: string;
  updatedAt: string;
};

function parseTelegramColleagueChats(raw: unknown): TelegramColleagueChat[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const record = item as Record<string, unknown>;
        const chatId = typeof record.chatId === "string" || typeof record.chatId === "number"
          ? String(record.chatId).trim()
          : "";
        if (!chatId) {
          return null;
        }
        return {
          chatId,
          firstName: typeof record.firstName === "string" ? record.firstName : "",
          lastName: typeof record.lastName === "string" ? record.lastName : "",
          username: typeof record.username === "string" ? record.username : "",
          updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : ""
        };
      })
      .filter((item): item is TelegramColleagueChat => item !== null);
  } catch (_error) {
    return [];
  }
}

async function loadTelegramColleagueChats(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("sharsh_report_meta")
    .select("report_date")
    .eq("report_key", TELEGRAM_COLLEAGUE_CHATS_META_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parseTelegramColleagueChats(data?.report_date);
}

async function saveTelegramColleagueChats(
  supabase: ReturnType<typeof createClient>,
  chats: TelegramColleagueChat[]
) {
  const uniqueChats = Array.from(new Map(chats.map((item) => [item.chatId, item])).values());
  const { error } = await supabase
    .from("sharsh_report_meta")
    .upsert({
      report_key: TELEGRAM_COLLEAGUE_CHATS_META_KEY,
      report_date: JSON.stringify(uniqueChats),
      updated_at: new Date().toISOString()
    });

  if (error) {
    throw error;
  }
}

async function rememberTelegramColleagueChat(
  supabase: ReturnType<typeof createClient>,
  message: Record<string, unknown>,
  chatId: number | string
) {
  if (isTelegramAdminChat(chatId)) {
    return;
  }

  const from = message.from as {
    first_name?: unknown;
    last_name?: unknown;
    username?: unknown;
  } | undefined;
  const chats = await loadTelegramColleagueChats(supabase);
  const current: TelegramColleagueChat = {
    chatId: String(chatId),
    firstName: typeof from?.first_name === "string" ? from.first_name : "",
    lastName: typeof from?.last_name === "string" ? from.last_name : "",
    username: typeof from?.username === "string" ? from.username : "",
    updatedAt: new Date().toISOString()
  };
  const nextChats = [current, ...chats.filter((item) => item.chatId !== current.chatId)];
  await saveTelegramColleagueChats(supabase, nextChats);
}

function getYerevanDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Yerevan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function normalizeDailyReminderSlot(value: string | null | undefined): TelegramDailyReminderSlot {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "evening" || normalized === "17" || normalized === "17:00") {
    return "evening";
  }
  return "midday";
}

function getDailyReminderMetaKey(slot: TelegramDailyReminderSlot) {
  return `${TELEGRAM_DAILY_REMINDER_META_PREFIX}_${slot}`;
}

async function loadMetaValue(
  supabase: ReturnType<typeof createClient>,
  reportKey: string
) {
  const { data, error } = await supabase
    .from("sharsh_report_meta")
    .select("report_date")
    .eq("report_key", reportKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return typeof data?.report_date === "string" ? data.report_date : "";
}

async function saveMetaValue(
  supabase: ReturnType<typeof createClient>,
  reportKey: string,
  value: string
) {
  const { error } = await supabase
    .from("sharsh_report_meta")
    .upsert({
      report_key: reportKey,
      report_date: value,
      updated_at: new Date().toISOString()
    });

  if (error) {
    throw error;
  }
}

async function sendDailyReminderToColleagues(
  supabase: ReturnType<typeof createClient>,
  slot: TelegramDailyReminderSlot,
  options: { force?: boolean } = {}
) {
  const reminder = TELEGRAM_DAILY_REMINDERS[slot];
  const metaKey = getDailyReminderMetaKey(slot);
  const dateKey = getYerevanDateKey();
  if (!options.force) {
    const lastSentDate = await loadMetaValue(supabase, metaKey);
    if (lastSentDate === dateKey) {
      return { sent: 0, skipped: "already_sent", dateKey, slot, label: reminder.label };
    }
    if (!await areTelegramColleaguesEnabled(supabase)) {
      return { sent: 0, skipped: "colleagues_disabled", dateKey, slot, label: reminder.label };
    }
  }

  const storedChats = await loadTelegramColleagueChats(supabase);
  const storedIds = storedChats.map((item) => item.chatId);
  const fallbackAllowedIds = getTelegramAllowedChatIds()
    .filter((chatId) => !isTelegramAdminChat(chatId));
  const chatIds = Array.from(new Set([...storedIds, ...fallbackAllowedIds]))
    .filter((chatId) => chatId && !isTelegramAdminChat(chatId));

  if (!chatIds.length) {
    return { sent: 0, skipped: "no_colleagues", dateKey, slot, label: reminder.label };
  }

  await sendTelegramMessageToMany(chatIds, reminder.text);
  await saveMetaValue(supabase, metaKey, dateKey);
  return { sent: chatIds.length, skipped: "", dateKey, slot, label: reminder.label };
}

async function isTelegramUserAllowedByRuntimeState(
  supabase: ReturnType<typeof createClient>,
  chatId: number | string | null
) {
  if (chatId === null) {
    return false;
  }
  if (isTelegramAdminChat(chatId)) {
    return true;
  }
  if (!await areTelegramColleaguesEnabled(supabase)) {
    return false;
  }
  return isAllowedChat(Number(chatId));
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

  const rows = Object.entries(DEPARTMENTS).map(([id, meta]) => {
    const saved = map.get(id);
    return {
      id,
      marker: meta.marker,
      department: meta.department,
      group: meta.group,
      values: sanitizeValues(saved?.values as Record<string, unknown> | undefined),
      updatedAt: saved?.updated_at || null,
      photoWorkflowStatus: typeof saved?.photo_workflow_status === "string" ? saved.photo_workflow_status : "idle",
      photoFeedbackId: typeof saved?.photo_feedback_id === "number" ? saved.photo_feedback_id : null,
      photoFeedbackUpdatedAt: saved?.photo_feedback_updated_at || null,
      photoName: typeof saved?.photo_name === "string" ? saved.photo_name : ""
    };
  });

  return {
    reportDate: metaRow?.report_date || DEFAULT_DATE,
    updatedAt: metaRow?.updated_at || new Date().toISOString(),
    rows: syncQhCalculatedSnapshotRows(rows)
  };
}

let armenianPdfFontBytesPromise: Promise<Uint8Array | null> | null = null;

async function getArmenianPdfFontBytes() {
  if (!armenianPdfFontBytesPromise) {
    armenianPdfFontBytesPromise = fetch(ARMENIAN_PDF_FONT_URL)
      .then(async (response) => {
        if (!response.ok) {
          console.warn(`Armenian PDF font was not loaded: ${response.status}`);
          return null;
        }
        return new Uint8Array(await response.arrayBuffer());
      })
      .catch((error) => {
        console.warn("Armenian PDF font request failed:", sanitizePublicErrorMessage(error));
        return null;
      });
  }
  return await armenianPdfFontBytesPromise;
}

async function buildPdfFonts(pdf: PDFDocument) {
  const regularFallback = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFallback = await pdf.embedFont(StandardFonts.HelveticaBold);
  const armenianFontBytes = await getArmenianPdfFontBytes();

  if (!armenianFontBytes) {
    return {
      regular: regularFallback,
      bold: boldFallback,
      hasArmenian: false
    };
  }

  try {
    pdf.registerFontkit(fontkit as any);
    const armenianFont = await pdf.embedFont(armenianFontBytes, { subset: true });
    return {
      regular: armenianFont,
      bold: armenianFont,
      hasArmenian: true
    };
  } catch (error) {
    console.warn("Armenian PDF font embedding failed:", sanitizePublicErrorMessage(error));
    return {
      regular: regularFallback,
      bold: boldFallback,
      hasArmenian: false
    };
  }
}

function getPdfText(text: string, fonts: { hasArmenian: boolean }, fallback = "") {
  if (fonts.hasArmenian) {
    return text;
  }
  const ascii = text.replace(/[^\x20-\x7E]/g, "").trim();
  return ascii || fallback;
}

function getRowPdfValue(row: { values: Record<string, number | null> }, key: string) {
  if (key === "presentTotal") {
    return DEPARTMENT_SHEET_PRESENT_SUM_KEYS.reduce((sum, itemKey) => sum + getSheetNumber(row.values, itemKey), 0);
  }
  if (key === "leaveTotal") {
    return DEPARTMENT_SHEET_LEAVE_SUM_KEYS.reduce((sum, itemKey) => sum + getSheetNumber(row.values, itemKey), 0);
  }
  return getSheetNumber(row.values, key);
}

function getRowsPdfValue(rows: Array<{ values: Record<string, number | null> }>, key: string) {
  return rows.reduce((sum, row) => sum + getRowPdfValue(row, key), 0);
}

function drawPdfCell(
  page: any,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    font: any;
    size?: number;
    align?: "left" | "center" | "right";
    color?: ReturnType<typeof rgb>;
    fill?: ReturnType<typeof rgb>;
    border?: ReturnType<typeof rgb>;
    padding?: number;
  }
) {
  const borderColor = options.border || rgb(0, 0, 0);
  if (options.fill) {
    page.drawRectangle({ x, y, width, height, color: options.fill });
  }
  page.drawRectangle({ x, y, width, height, borderColor, borderWidth: 0.7 });

  const size = options.size || 8;
  const padding = typeof options.padding === "number" ? options.padding : 3;
  const safeText = String(text ?? "");
  const textWidth = options.font.widthOfTextAtSize(safeText, size);
  let textX = x + padding;
  if (options.align === "center") {
    textX = x + Math.max(padding, (width - textWidth) / 2);
  } else if (options.align === "right") {
    textX = x + Math.max(padding, width - textWidth - padding);
  }
  page.drawText(safeText, {
    x: textX,
    y: y + Math.max(2, (height - size) / 2),
    size,
    font: options.font,
    color: options.color || rgb(0, 0, 0)
  });
}

function drawPdfText(
  page: any,
  text: string,
  x: number,
  y: number,
  options: {
    font: any;
    size?: number;
    color?: ReturnType<typeof rgb>;
  }
) {
  page.drawText(String(text ?? ""), {
    x,
    y,
    size: options.size || 10,
    font: options.font,
    color: options.color || rgb(0, 0, 0)
  });
}

async function buildMainMovementPdfBytes(snapshot: Awaited<ReturnType<typeof loadSnapshot>>) {
  const pdf = await PDFDocument.create();
  const fonts = await buildPdfFonts(pdf);
  const page = pdf.addPage([841.92, 595.32]);
  const primaryRows = snapshot.rows.filter((row) => row.group === "primary");
  const allRows = snapshot.rows;
  const title = getPdfText("ԿԿԶՀ-Շարժ․", fonts, "KKZH-Sharzh");
  const subtitle = getPdfText(`Ամսաթիվ՝ ${snapshot.reportDate}`, fonts, `Date: ${snapshot.reportDate}`);
  const generated = getPdfText(`Ստեղծվել է՝ ${buildDepartmentSheetMessageDateTimeText(snapshot.reportDate)}`, fonts, `Generated: ${snapshot.reportDate}`);

  drawPdfText(page, title, 28, 560, { font: fonts.bold, size: 18, color: rgb(0.03, 0.25, 0.16) });
  drawPdfText(page, subtitle, 28, 540, { font: fonts.regular, size: 10 });
  drawPdfText(page, generated, 650, 540, { font: fonts.regular, size: 9, color: rgb(0.32, 0.32, 0.32) });

  const startX = 24;
  const startY = 513;
  const markerWidth = 42;
  const nameWidth = 92;
  const valueWidth = 28.2;
  const rowHeight = 22;
  const headerFill = rgb(0.98, 0.78, 0.57);
  const totalFill = rgb(1, 0.92, 0.02);
  const nameFill = rgb(0.99, 0.97, 0.92);

  drawPdfCell(page, "SR", startX, startY, markerWidth, rowHeight, {
    font: fonts.bold,
    size: 8,
    align: "center",
    fill: headerFill
  });
  drawPdfCell(page, getPdfText("Բաժանմունք", fonts, "Department"), startX + markerWidth, startY, nameWidth, rowHeight, {
    font: fonts.bold,
    size: 8,
    align: "center",
    fill: headerFill
  });

  MAIN_PDF_COLUMNS.forEach((column, index) => {
    drawPdfCell(page, column.label, startX + markerWidth + nameWidth + (index * valueWidth), startY, valueWidth, rowHeight, {
      font: fonts.bold,
      size: 7,
      align: "center",
      fill: headerFill
    });
  });

  allRows.forEach((row, rowIndex) => {
    const y = startY - ((rowIndex + 1) * rowHeight);
    drawPdfCell(page, row.marker, startX, y, markerWidth, rowHeight, {
      font: fonts.bold,
      size: 8,
      align: "center",
      fill: nameFill
    });
    drawPdfCell(page, getPdfText(row.department, fonts, row.id), startX + markerWidth, y, nameWidth, rowHeight, {
      font: fonts.regular,
      size: row.department.length > 16 ? 6.5 : 7,
      align: "left",
      fill: nameFill
    });
    MAIN_PDF_COLUMNS.forEach((column, columnIndex) => {
      drawPdfCell(page, String(getRowPdfValue(row, column.key)), startX + markerWidth + nameWidth + (columnIndex * valueWidth), y, valueWidth, rowHeight, {
        font: fonts.bold,
        size: 8,
        align: "center",
        fill: column.key === "presentTotal" || column.key === "leaveTotal" ? rgb(1, 0.96, 0.35) : undefined
      });
    });
  });

  const totalY = startY - ((allRows.length + 1) * rowHeight);
  drawPdfCell(page, "", startX, totalY, markerWidth, rowHeight, {
    font: fonts.bold,
    size: 8,
    align: "center",
    fill: totalFill
  });
  drawPdfCell(page, getPdfText("Ընդամենը", fonts, "Total"), startX + markerWidth, totalY, nameWidth, rowHeight, {
    font: fonts.bold,
    size: 8,
    align: "center",
    fill: totalFill
  });
  MAIN_PDF_COLUMNS.forEach((column, columnIndex) => {
    drawPdfCell(page, String(getRowsPdfValue(primaryRows, column.key)), startX + markerWidth + nameWidth + (columnIndex * valueWidth), totalY, valueWidth, rowHeight, {
      font: fonts.bold,
      size: 8,
      align: "center",
      fill: totalFill
    });
  });

  return await pdf.save();
}

async function buildReportPdfBytes(snapshot: Awaited<ReturnType<typeof loadSnapshot>>) {
  const pdf = await PDFDocument.create();
  const fonts = await buildPdfFonts(pdf);
  const page = pdf.addPage([841.92, 595.32]);
  const primaryRows = snapshot.rows.filter((row) => row.group === "primary");
  const title = getPdfText("Օրվա շարժ․", fonts, "Report");
  const subtitle = getPdfText(`Ամսաթիվ՝ ${snapshot.reportDate}`, fonts, `Date: ${snapshot.reportDate}`);
  const headerFill = rgb(0.95, 0.88, 0.76);
  const sectionFill = rgb(0.9, 0.96, 0.92);
  const border = rgb(0.15, 0.15, 0.15);

  drawPdfText(page, title, 34, 555, { font: fonts.bold, size: 20, color: rgb(0.03, 0.25, 0.16) });
  drawPdfText(page, subtitle, 34, 532, { font: fonts.regular, size: 11 });

  const leftX = 34;
  const rightX = 446;
  const topY = 500;
  const rowHeight = 22;
  const cellWidth = 44;
  const labelWidth = 255;
  const valueWidth = 74;

  drawPdfCell(page, getPdfText("Բջ.", fonts, "Cell"), leftX, topY, cellWidth, rowHeight, {
    font: fonts.bold,
    size: 8,
    align: "center",
    fill: headerFill,
    border
  });
  drawPdfCell(page, getPdfText("Ցուցիչ", fonts, "Indicator"), leftX + cellWidth, topY, labelWidth, rowHeight, {
    font: fonts.bold,
    size: 8,
    align: "center",
    fill: headerFill,
    border
  });
  drawPdfCell(page, getPdfText("Ընդամենը", fonts, "Total"), leftX + cellWidth + labelWidth, topY, valueWidth, rowHeight, {
    font: fonts.bold,
    size: 8,
    align: "center",
    fill: headerFill,
    border
  });

  let y = topY - rowHeight;
  REPORT_PRIMARY_ITEMS.forEach((item) => {
    if ("divider" in item && item.divider) {
      const totalValue = item.totalKey ? getRowsPdfValue(primaryRows, item.totalKey) : "";
      drawPdfCell(page, getPdfText(item.label, fonts, item.label), leftX, y, cellWidth + labelWidth, rowHeight, {
        font: fonts.bold,
        size: 8,
        align: "left",
        fill: sectionFill,
        border
      });
      drawPdfCell(page, String(totalValue), leftX + cellWidth + labelWidth, y, valueWidth, rowHeight, {
        font: fonts.bold,
        size: 9,
        align: "center",
        fill: sectionFill,
        border
      });
    } else {
      const valueItem = item as { key: string; cell: number; label: string };
      drawPdfCell(page, String(valueItem.cell), leftX, y, cellWidth, rowHeight, {
        font: fonts.bold,
        size: 8,
        align: "center",
        border
      });
      drawPdfCell(page, getPdfText(valueItem.label, fonts, valueItem.key), leftX + cellWidth, y, labelWidth, rowHeight, {
        font: fonts.regular,
        size: 8,
        align: "left",
        border
      });
      drawPdfCell(page, String(getRowsPdfValue(primaryRows, valueItem.key)), leftX + cellWidth + labelWidth, y, valueWidth, rowHeight, {
        font: fonts.bold,
        size: 9,
        align: "center",
        border
      });
    }
    y -= rowHeight;
  });

  drawPdfCell(page, getPdfText("Բաժին / ցուցիչ", fonts, "Department / indicator"), rightX, topY, labelWidth, rowHeight, {
    font: fonts.bold,
    size: 8,
    align: "center",
    fill: headerFill,
    border
  });
  drawPdfCell(page, getPdfText("Արժեք", fonts, "Value"), rightX + labelWidth, topY, valueWidth, rowHeight, {
    font: fonts.bold,
    size: 8,
    align: "center",
    fill: headerFill,
    border
  });

  y = topY - rowHeight;
  REPORT_SPECIAL_GROUPS.forEach((group) => {
    const row = snapshot.rows.find((item) => item.id === group.rowId);
    drawPdfCell(page, getPdfText(group.title, fonts, group.rowId), rightX, y, labelWidth + valueWidth, rowHeight, {
      font: fonts.bold,
      size: 8,
      align: "left",
      fill: sectionFill,
      border
    });
    y -= rowHeight;
    group.items.forEach((item) => {
      drawPdfCell(page, `${item.cell} ${getPdfText(item.label, fonts, item.key)}`, rightX, y, labelWidth, rowHeight, {
        font: fonts.regular,
        size: 8,
        align: "left",
        border
      });
      drawPdfCell(page, String(row ? getRowPdfValue(row, item.key) : 0), rightX + labelWidth, y, valueWidth, rowHeight, {
        font: fonts.bold,
        size: 9,
        align: "center",
        border
      });
      y -= rowHeight;
    });
    y -= 5;
  });

  return await pdf.save();
}

function getMainPdfTelegramChatIds() {
  const pdfChannelRaw = Deno.env.get("TELEGRAM_MAIN_PDF_CHAT_IDS") || "";
  const explicitRaw = Deno.env.get("TELEGRAM_NOTIFY_CHAT_IDS") || "";
  const adminRaw = Deno.env.get("TELEGRAM_ADMIN_CHAT_IDS") || "";
  const fallbackRaw = Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS") || "";
  const parsePdfTargets = (raw: string) => splitTelegramChatIds(raw)
    .filter((chatId) => !/^https?:\/\//i.test(chatId));
  const pdfTargets = parsePdfTargets(pdfChannelRaw);
  if (pdfTargets.length) {
    return Array.from(new Set(pdfTargets));
  }
  return Array.from(new Set(splitTelegramChatIds(explicitRaw || adminRaw || fallbackRaw)));
}

async function sendMainPdfsToTelegram(
  supabase: ReturnType<typeof createClient>,
  options: { force?: boolean; source?: string } = {}
) {
  const dateKey = getYerevanDateKey();
  if (!options.force) {
    const lastSentDate = await loadMetaValue(supabase, TELEGRAM_MAIN_PDFS_META_KEY);
    if (lastSentDate === dateKey) {
      return { sent: 0, skipped: "already_sent", dateKey };
    }
  }

  const chatIds = getMainPdfTelegramChatIds();
  if (!chatIds.length) {
    return { sent: 0, skipped: "no_chat_ids", dateKey };
  }

  const snapshot = await loadSnapshot(supabase);
  const reportPdfBytes = await buildReportPdfBytes(snapshot);
  const mainPdfBytes = await buildMainMovementPdfBytes(snapshot);
  const captionPrefix = options.source === "morning"
    ? "Առավոտյան ավտոմատ PDF ֆայլեր"
    : "PDF ֆայլերը պատրաստ են";
  const captionDate = `Ամսաթիվ՝ ${snapshot.reportDate}`;

  for (const chatId of chatIds) {
    await sendTelegramDocument(
      chatId,
      REPORT_PDF_FILE_NAME,
      reportPdfBytes,
      `${captionPrefix}\n${captionDate}`,
      "application/pdf"
    );
    await sendTelegramDocument(
      chatId,
      MAIN_MOVEMENT_PDF_FILE_NAME,
      mainPdfBytes,
      `${captionPrefix}\n${captionDate}`,
      "application/pdf"
    );
  }

  if (!options.force) {
    await saveMetaValue(supabase, TELEGRAM_MAIN_PDFS_META_KEY, dateKey);
  }

  return {
    sent: chatIds.length,
    skipped: "",
    dateKey,
    files: [REPORT_PDF_FILE_NAME, MAIN_MOVEMENT_PDF_FILE_NAME]
  };
}

async function saveDepartmentSnapshot(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  reportDate: string,
  values: Record<string, number | null>
) {
  const departmentMeta = DEPARTMENTS[departmentId];

  const { error: rowError } = await supabase
    .from("sharsh_departments")
    .upsert({
      department_id: departmentId,
      department_name: departmentMeta.department,
      department_group: departmentMeta.group,
      values: sanitizeValues(values),
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
}

async function markDepartmentPhotoPending(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  feedbackId: string,
  imageName: string | null
) {
  const { error } = await supabase
    .from("sharsh_departments")
    .update({
      photo_workflow_status: "pending",
      photo_feedback_id: feedbackId ? Number(feedbackId) : null,
      photo_feedback_updated_at: new Date().toISOString(),
      photo_name: imageName || ""
    })
    .eq("department_id", departmentId);

  if (error) {
    throw error;
  }
}

async function insertAcceptedFeedback(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  reportDate: string,
  photoReportDate: string | null,
  imageName: string | null,
  imageDataUrl: string | null,
  recognizedValues: Record<string, number | null>,
  recognizedKeys: string[],
  notes: string[]
) {
  const departmentMeta = DEPARTMENTS[departmentId];

  const { data, error } = await supabase
    .from("sharsh_ocr_feedback")
    .insert({
      department_id: departmentId,
      department_name: departmentMeta.department,
      report_date: reportDate,
      photo_report_date: photoReportDate,
      save_status: "accepted_as_is",
      image_name: imageName,
      image_data_url: imageDataUrl,
      recognized_keys: recognizedKeys,
      changed_keys: [],
      ocr_raw: recognizedValues,
      final_values: recognizedValues,
      notes,
      cell_reviews: [],
      created_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data?.id ? String(data.id) : "";
}

async function insertTelegramWebFormFeedback(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  reportDate: string,
  values: Record<string, number | null>,
  userId: number | null,
  userName: string
) {
  const notes = [
    "Telegram Web App form submission.",
    userId ? `Telegram user id: ${userId}` : "",
    userName ? `Telegram user: ${userName}` : ""
  ].filter(Boolean);

  return await insertAcceptedFeedback(
    supabase,
    departmentId,
    reportDate,
    null,
    "telegram-web-app-form",
    null,
    values,
    DEPARTMENT_SHEET_VALUE_KEYS,
    notes
  );
}

async function loadAcceptedFeedbackPreview(
  supabase: ReturnType<typeof createClient>,
  feedbackId: string,
  departmentId: DepartmentId | ""
) {
  const normalizedId = String(feedbackId || "").trim();
  if (!normalizedId) {
    return null;
  }

  let query = supabase
    .from("sharsh_ocr_feedback")
    .select("id, department_id, report_date, photo_report_date, image_name, image_data_url, recognized_keys, final_values, notes, cell_reviews, save_status, created_at")
    .eq("id", normalizedId)
    .limit(1)
    .maybeSingle();

  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  const imageDataUrl = typeof data.image_data_url === "string" ? data.image_data_url : "";
  const imageName = typeof data.image_name === "string" ? data.image_name : "";
  const recognizedKeys = Array.isArray(data.recognized_keys) ? data.recognized_keys.map((item) => String(item)) : [];
  const finalValues = data.final_values && typeof data.final_values === "object" ? data.final_values : {};
  const hasFormValues = recognizedKeys.length > 0 || Object.keys(finalValues).length > 0;
  if (!imageDataUrl.startsWith("data:image/") && imageName !== "telegram-web-app-form" && !hasFormValues) {
    return null;
  }

  return {
    id: String(data.id),
    departmentId: String(data.department_id || ""),
    reportDate: typeof data.report_date === "string" ? data.report_date : DEFAULT_DATE,
    photoReportDate: typeof data.photo_report_date === "string" ? data.photo_report_date : "",
    imageName,
    imageDataUrl,
    recognizedKeys,
    finalValues,
    notes: Array.isArray(data.notes) ? data.notes.map((item) => String(item)) : [],
    cellReviews: Array.isArray(data.cell_reviews) ? data.cell_reviews : [],
    saveStatus: typeof data.save_status === "string" ? data.save_status : "accepted_as_is",
    createdAt: typeof data.created_at === "string" ? data.created_at : ""
  };
}

function getTelegramApiBaseUrl() {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured on the server.");
  }
  return `https://api.telegram.org/bot${token}`;
}

function getTelegramFileBaseUrl() {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured on the server.");
  }
  return `https://api.telegram.org/file/bot${token}`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function sanitizePublicErrorMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "неизвестная ошибка";

  return message
    .replace(/https:\/\/api\.telegram\.org\/(?:file\/)?bot[^\s)]+/g, "https://api.telegram.org/bot***/...")
    .replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, "bot***");
}

function isRetryableTelegramError(error: unknown) {
  const message = sanitizePublicErrorMessage(error).toLowerCase();
  return message.includes("connection") ||
    message.includes("reset") ||
    message.includes("timeout") ||
    message.includes("temporarily") ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("(429)") ||
    /\(5\d\d\)/.test(message);
}

async function withTelegramRetry<T>(operation: () => Promise<T>, actionLabel: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= TELEGRAM_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= TELEGRAM_RETRY_ATTEMPTS || !isRetryableTelegramError(error)) {
        break;
      }

      console.warn(
        `${actionLabel} failed, retry ${attempt + 1}/${TELEGRAM_RETRY_ATTEMPTS}:`,
        sanitizePublicErrorMessage(error)
      );
      await sleep(TELEGRAM_RETRY_BASE_DELAY_MS * attempt);
    }
  }

  throw new Error(sanitizePublicErrorMessage(lastError));
}

async function callTelegramApi(method: string, body: Record<string, unknown>) {
  return await withTelegramRetry(async () => {
    const response = await fetch(`${getTelegramApiBaseUrl()}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.ok !== true) {
      const description = payload && typeof payload === "object" && typeof payload.description === "string"
        ? payload.description
        : `Telegram API call ${method} failed (${response.status}).`;
      throw new Error(description);
    }

    return payload.result;
  }, `Telegram API ${method}`);
}

async function sendTelegramMessage(chatId: number | string, text: string) {
  await callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true
  });
}

async function sendTelegramMessageWithReplyMarkup(
  chatId: number | string,
  text: string,
  replyMarkup: Record<string, unknown>
) {
  await callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    reply_markup: replyMarkup
  });
}

async function sendTelegramMessageToMany(chatIds: Array<number | string>, text: string) {
  for (const chatId of chatIds) {
    try {
      await sendTelegramMessage(chatId, text);
    } catch (error) {
      console.error("Failed to send Telegram notification:", sanitizePublicErrorMessage(error));
    }
  }
}

async function copyTelegramMessage(
  chatId: number | string,
  fromChatId: number | string,
  messageId: number,
  caption?: string
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId
  };
  if (caption) {
    body.caption = caption;
  }
  await callTelegramApi("copyMessage", body);
}

async function copyTelegramMessageToMany(
  chatIds: Array<number | string>,
  fromChatId: number | string,
  messageId: number,
  caption?: string
) {
  for (const chatId of chatIds) {
    try {
      await copyTelegramMessage(chatId, fromChatId, messageId, caption);
    } catch (error) {
      console.error("Failed to copy Telegram photo notification:", sanitizePublicErrorMessage(error));
    }
  }
}

async function sendTelegramDocument(
  chatId: number | string,
  fileName: string,
  bytes: Uint8Array,
  caption: string,
  mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  replyMarkup?: Record<string, unknown>
) {
  const fileBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(fileBuffer).set(bytes);

  await withTelegramRetry(async () => {
    const formData = new FormData();
    formData.append("chat_id", String(chatId));
    if (caption) {
      formData.append("caption", caption);
    }
    if (replyMarkup) {
      formData.append("reply_markup", JSON.stringify(replyMarkup));
    }
    formData.append("document", new File([fileBuffer.slice(0)], fileName, { type: mimeType }));

    const response = await fetch(`${getTelegramApiBaseUrl()}/sendDocument`, {
      method: "POST",
      body: formData
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.ok !== true) {
      const description = payload && typeof payload === "object" && typeof payload.description === "string"
        ? payload.description
        : `Telegram API call sendDocument failed (${response.status}).`;
      throw new Error(description);
    }

    return true;
  }, "Telegram API sendDocument");
}

async function fetchDepartmentSheetTemplateBytes() {
  const url = getDepartmentSheetTemplateUrl();
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить рабочую таблицу (${response.status}) из ${url}.`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function setXmlAttribute(tag: string, name: string, value: string) {
  const attributePattern = new RegExp(`\\s${name}="[^"]*"`);
  if (attributePattern.test(tag)) {
    return tag.replace(attributePattern, ` ${name}="${value}"`);
  }
  if (/\/>$/.test(tag)) {
    return tag.replace(/\s*\/>$/, ` ${name}="${value}"/>`);
  }
  return tag.replace(/>$/, ` ${name}="${value}">`);
}

function removeXmlAttribute(tag: string, name: string) {
  return tag.replace(new RegExp(`\\s${name}="[^"]*"`, "g"), "");
}

function columnToIndex(column: string) {
  return column
    .split("")
    .reduce((index, letter) => (index * 26) + (letter.charCodeAt(0) - 64), 0);
}

function isDepartmentSheetUsedColumn(column: string) {
  return columnToIndex(column) <= columnToIndex(DEPARTMENT_SHEET_LAST_COLUMN);
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

function normalizeDepartmentSheetReportDate(reportDate: string) {
  const match = String(reportDate || "").trim().match(/^(\d{2})[.,/](\d{2})[.,/](\d{2,4})$/);
  if (!match) {
    return DEFAULT_DATE;
  }
  return `${match[1]},${match[2]},${match[3].slice(-2)}`;
}

function getYerevanTimeText(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yerevan",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour}:${minute}`;
}

function buildDepartmentSheetDateTimeText(reportDate: string) {
  return `${normalizeDepartmentSheetReportDate(reportDate)} ${getYerevanTimeText()}`;
}

function buildDepartmentSheetMessageDateTimeText(reportDate: string) {
  const match = String(reportDate || "").trim().match(/^(\d{2})[.,/](\d{2})[.,/](\d{2,4})$/);
  if (!match) {
    return `${reportDate || DEFAULT_DATE} ${getYerevanTimeText()}`;
  }

  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${match[1]}.${match[2]}.${year} ${getYerevanTimeText()}`;
}

function isDepartmentSheetInputColumn(column: string) {
  return DEPARTMENT_SHEET_INPUT_COLUMNS.includes(column);
}

function isDepartmentSheetFormulaColumn(column: string) {
  return DEPARTMENT_SHEET_FORMULA_COLUMNS.includes(column);
}

function collectDepartmentSheetColumnStyleIds(
  worksheetXml: string,
  targetRow: number,
  isTargetColumn: (column: string) => boolean
) {
  const styleIds = new Set<number>();

  worksheetXml.replace(/<c\b[^>]*\br="([A-Z]+)(\d+)"[^>]*>/g, (cellTag, column, rowText) => {
    if (Number(rowText) !== targetRow || !isTargetColumn(column)) {
      return cellTag;
    }

    const styleMatch = cellTag.match(/\bs="(\d+)"/);
    styleIds.add(styleMatch ? Number(styleMatch[1]) : 0);
    return cellTag;
  });

  return styleIds;
}

function collectDepartmentSheetInputStyleIds(worksheetXml: string, targetRow: number) {
  return collectDepartmentSheetColumnStyleIds(worksheetXml, targetRow, isDepartmentSheetInputColumn);
}

function collectDepartmentSheetFormulaStyleIds(worksheetXml: string, targetRow: number) {
  return collectDepartmentSheetColumnStyleIds(worksheetXml, targetRow, isDepartmentSheetFormulaColumn);
}

function upsertProtectionTag(xfTag: string, attributes: Record<string, string>) {
  let updated = xfTag.replace(/^<xf\b[^>]*?(?:\/>|>)/, (openingTag) => (
    setXmlAttribute(openingTag, "applyProtection", "1")
  ));

  const applyAttributes = (protectionTag: string) => Object.entries(attributes)
    .reduce((tag, [name, value]) => setXmlAttribute(tag, name, value), protectionTag);

  if (/<protection\b/.test(updated)) {
    return updated.replace(/<protection\b[^>]*(?:\/>|>[\s\S]*?<\/protection>)/, applyAttributes);
  }

  const protectionAttributes = Object.entries(attributes)
    .map(([name, value]) => `${name}="${value}"`)
    .join(" ");
  const protectionTag = `<protection ${protectionAttributes}/>`;

  if (/\/>$/.test(updated)) {
    return updated.replace(/\s*\/>$/, `>${protectionTag}</xf>`);
  }

  return updated.replace(/<\/xf>$/, `${protectionTag}</xf>`);
}

function createUnlockedCellXfTag(xfTag: string) {
  return upsertProtectionTag(xfTag, { locked: "0" });
}

function createLockedCellXfTag(xfTag: string) {
  return upsertProtectionTag(xfTag, { locked: "1" });
}

function createHiddenFormulaCellXfTag(xfTag: string) {
  return upsertProtectionTag(xfTag, { locked: "1", hidden: "1" });
}

function addDepartmentSheetStyles(
  stylesXml: string,
  styleIds: Set<number>,
  createStyleTag: (xfTag: string) => string
) {
  const styleMap = new Map<number, number>();
  if (!styleIds.size) {
    return { stylesXml, styleMap };
  }

  const cellXfsMatch = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
  if (!cellXfsMatch) {
    throw new Error("В рабочем XLSX не найден блок стилей cellXfs.");
  }

  const cellXfsBlock = cellXfsMatch[0];
  const openingTagMatch = cellXfsBlock.match(/^<cellXfs\b[^>]*>/);
  if (!openingTagMatch) {
    throw new Error("В рабочем XLSX повреждён блок стилей cellXfs.");
  }

  const openingTag = openingTagMatch[0];
  const innerXml = cellXfsMatch[1];
  const xfTags = Array.from(innerXml.matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)).map((match) => match[0]);
  const appendedTags: string[] = [];

  Array.from(styleIds)
    .sort((left, right) => left - right)
    .forEach((styleId) => {
      const sourceTag = xfTags[styleId];
      if (!sourceTag) {
        return;
      }

      styleMap.set(styleId, xfTags.length + appendedTags.length);
      appendedTags.push(createStyleTag(sourceTag));
    });

  if (!appendedTags.length) {
    return { stylesXml, styleMap };
  }

  const updatedOpeningTag = setXmlAttribute(openingTag, "count", String(xfTags.length + appendedTags.length));
  const updatedCellXfsBlock = `${updatedOpeningTag}${innerXml}${appendedTags.join("")}</cellXfs>`;

  return {
    stylesXml: stylesXml.replace(cellXfsBlock, updatedCellXfsBlock),
    styleMap
  };
}

function addUnlockedDepartmentSheetStyles(stylesXml: string, styleIds: Set<number>) {
  return addDepartmentSheetStyles(stylesXml, styleIds, createUnlockedCellXfTag);
}

function addLockedDepartmentSheetStyles(stylesXml: string, styleIds: Set<number>) {
  return addDepartmentSheetStyles(stylesXml, styleIds, createLockedCellXfTag);
}

function addHiddenFormulaDepartmentSheetStyles(stylesXml: string, styleIds: Set<number>) {
  return addDepartmentSheetStyles(stylesXml, styleIds, createHiddenFormulaCellXfTag);
}

function collectDepartmentSheetVisibleStyleIds(worksheetXml: string, visibleRows: Set<number>) {
  const styleIds = new Set<number>();

  worksheetXml.replace(/<c\b[^>]*\br="([A-Z]+)(\d+)"[^>]*>/g, (cellTag, column, rowText) => {
    if (!visibleRows.has(Number(rowText)) || !isDepartmentSheetUsedColumn(column)) {
      return cellTag;
    }

    const styleMatch = cellTag.match(/\bs="(\d+)"/);
    styleIds.add(styleMatch ? Number(styleMatch[1]) : 0);
    return cellTag;
  });

  return styleIds;
}

function lockDepartmentSheetVisibleCells(worksheetXml: string, visibleRows: Set<number>, styleMap: Map<number, number>) {
  if (!styleMap.size) {
    return worksheetXml;
  }

  return worksheetXml.replace(/<c\b[^>]*?\br="([A-Z]+)(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, (cellTag, column, rowText) => {
    if (!visibleRows.has(Number(rowText)) || !isDepartmentSheetUsedColumn(column)) {
      return cellTag;
    }

    return cellTag.replace(/^<c\b[^>]*?(?:\/>|>)/, (openingTag) => {
      const styleMatch = openingTag.match(/\bs="(\d+)"/);
      const originalStyleId = styleMatch ? Number(styleMatch[1]) : 0;
      const lockedStyleId = styleMap.get(originalStyleId);
      return typeof lockedStyleId === "number"
        ? setXmlAttribute(openingTag, "s", String(lockedStyleId))
        : openingTag;
    });
  });
}

function unlockDepartmentSheetInputCells(worksheetXml: string, targetRow: number, styleMap: Map<number, number>) {
  if (!styleMap.size) {
    return worksheetXml;
  }

  return worksheetXml.replace(/<c\b[^>]*?\br="([A-Z]+)(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, (cellTag, column, rowText) => {
    if (Number(rowText) !== targetRow || !isDepartmentSheetInputColumn(column)) {
      return cellTag;
    }

    return cellTag.replace(/^<c\b[^>]*?(?:\/>|>)/, (openingTag) => {
      const styleMatch = openingTag.match(/\bs="(\d+)"/);
      const originalStyleId = styleMatch ? Number(styleMatch[1]) : 0;
      const unlockedStyleId = styleMap.get(originalStyleId);
      return typeof unlockedStyleId === "number"
        ? setXmlAttribute(openingTag, "s", String(unlockedStyleId))
        : openingTag;
    });
  });
}

function hideDepartmentSheetFormulaCells(worksheetXml: string, targetRow: number, styleMap: Map<number, number>) {
  if (!styleMap.size) {
    return worksheetXml;
  }

  return worksheetXml.replace(/<c\b[^>]*?\br="([A-Z]+)(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, (cellTag, column, rowText) => {
    if (Number(rowText) !== targetRow || !isDepartmentSheetFormulaColumn(column)) {
      return cellTag;
    }

    return cellTag.replace(/^<c\b[^>]*?(?:\/>|>)/, (openingTag) => {
      const styleMatch = openingTag.match(/\bs="(\d+)"/);
      const originalStyleId = styleMatch ? Number(styleMatch[1]) : 0;
      const hiddenStyleId = styleMap.get(originalStyleId);
      return typeof hiddenStyleId === "number"
        ? setXmlAttribute(openingTag, "s", String(hiddenStyleId))
        : openingTag;
    });
  });
}

function setDepartmentSheetInputDefaults(worksheetXml: string, targetRow: number) {
  return DEPARTMENT_SHEET_INPUT_COLUMNS.reduce((updatedXml, column) => {
    const cellRef = `${column}${targetRow}`;
    const cellPattern = new RegExp(`<c\\b[^>]*\\br="${cellRef}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`);
    return updatedXml.replace(cellPattern, (cellTag) => {
      const openingMatch = cellTag.match(/^<c\b[^>]*?(?:\/>|>)/);
      if (!openingMatch) {
        return cellTag;
      }

      const openingTag = removeXmlAttribute(
        openingMatch[0].replace(/\s*\/>$/, ">"),
        "t"
      );
      return `${openingTag}<v>0</v></c>`;
    });
  }, worksheetXml);
}

function resetDepartmentSheetFormulaCachedValues(worksheetXml: string, targetRow: number) {
  return DEPARTMENT_SHEET_FORMULA_COLUMNS.reduce((updatedXml, column) => {
    const cellRef = `${column}${targetRow}`;
    const cellPattern = new RegExp(`<c\\b[^>]*\\br="${cellRef}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`);
    return updatedXml.replace(cellPattern, (cellTag) => {
      if (!/<f\b/.test(cellTag)) {
        return cellTag;
      }
      if (/<v>[\s\S]*?<\/v>/.test(cellTag)) {
        return cellTag.replace(/<v>[\s\S]*?<\/v>/, "<v>0</v>");
      }
      return cellTag.replace("</c>", "<v>0</v></c>");
    });
  }, worksheetXml);
}

function setDepartmentSheetInlineStringCell(worksheetXml: string, cellRef: string, value: string) {
  const rowMatch = cellRef.match(/\d+/);
  const rowNumber = rowMatch ? rowMatch[0] : "";
  const escapedValue = escapeXmlText(value);
  const cellPattern = new RegExp(`<c\\b[^>]*\\br="${cellRef}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`);
  const rowPattern = new RegExp(`(<row\\b[^>]*\\br="${rowNumber}"[^>]*>)`);
  const replacementForCell = (cellTag: string) => {
    const styleMatch = cellTag.match(/\bs="(\d+)"/);
    const styleAttribute = styleMatch ? ` s="${styleMatch[1]}"` : "";
    return `<c r="${cellRef}"${styleAttribute} t="inlineStr"><is><t>${escapedValue}</t></is></c>`;
  };

  if (cellPattern.test(worksheetXml)) {
    return worksheetXml.replace(cellPattern, replacementForCell);
  }

  return rowNumber
    ? worksheetXml.replace(rowPattern, `$1<c r="${cellRef}" t="inlineStr"><is><t>${escapedValue}</t></is></c>`)
    : worksheetXml;
}

function setDepartmentSheetTitle(worksheetXml: string, departmentId: DepartmentId) {
  const meta = DEPARTMENTS[departmentId];
  return setDepartmentSheetInlineStringCell(worksheetXml, "A1", meta.department);
}

function setDepartmentSheetA3DateTime(worksheetXml: string, dateTimeText: string) {
  return setDepartmentSheetInlineStringCell(worksheetXml, "A3", dateTimeText);
}

function setDepartmentSheetUsedRange(worksheetXml: string, targetRow: number) {
  const usedRange = `A1:${DEPARTMENT_SHEET_LAST_COLUMN}${targetRow}`;
  const activeCell = `${DEPARTMENT_SHEET_FIRST_INPUT_COLUMN}${targetRow}`;

  let updatedXml = worksheetXml.replace(/<dimension\b[^>]*(?:\/>|>[\s\S]*?<\/dimension>)/, `<dimension ref="${usedRange}"/>`);

  updatedXml = updatedXml.replace(/<sheetView\b[^>]*>/g, (tag) => {
    let updatedTag = setXmlAttribute(tag, "showGridLines", "0");
    updatedTag = setXmlAttribute(updatedTag, "topLeftCell", "A1");
    return updatedTag;
  });

  updatedXml = updatedXml.replace(/<selection\b[^>]*\/>/g, `<selection activeCell="${activeCell}" sqref="${activeCell}"/>`);

  updatedXml = updatedXml.replace(/<col\b[^>]*\bmin="27"[^>]*\bmax="16384"[^>]*\/>/g, (tag) => (
    setXmlAttribute(tag, "hidden", "1")
  ));

  return updatedXml;
}

function protectDepartmentSheetXml(worksheetXml: string) {
  if (/<sheetProtection\b[\s\S]*?\/>/.test(worksheetXml)) {
    return worksheetXml.replace(/<sheetProtection\b[\s\S]*?\/>/, DEPARTMENT_SHEET_PROTECTION_TAG);
  }
  if (/<sheetProtection\b[\s\S]*?<\/sheetProtection>/.test(worksheetXml)) {
    return worksheetXml.replace(/<sheetProtection\b[\s\S]*?<\/sheetProtection>/, DEPARTMENT_SHEET_PROTECTION_TAG);
  }
  return worksheetXml.replace("</sheetData>", `</sheetData>${DEPARTMENT_SHEET_PROTECTION_TAG}`);
}

function parseSharedStringsXml(sharedStringsXml: string) {
  return Array.from(sharedStringsXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
    .map((match) => {
      const texts = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
        .map((textMatch) => decodeXmlText(textMatch[1]));
      return texts.join("");
    });
}

function getWorksheetCellXml(worksheetXml: string, cellRef: string) {
  const pattern = new RegExp(`<c\\b[^>]*\\br="${cellRef}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`);
  const match = worksheetXml.match(pattern);
  return match ? match[0] : "";
}

function getWorksheetCellText(worksheetXml: string, cellRef: string, sharedStrings: string[]) {
  const cellXml = getWorksheetCellXml(worksheetXml, cellRef);
  if (!cellXml) {
    return "";
  }

  if (/\bt="s"/.test(cellXml)) {
    const indexMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
    const index = indexMatch ? Number(indexMatch[1]) : NaN;
    return Number.isFinite(index) ? sharedStrings[index] || "" : "";
  }

  if (/\bt="inlineStr"/.test(cellXml)) {
    return Array.from(cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
      .map((match) => decodeXmlText(match[1]))
      .join("");
  }

  const valueMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
  return valueMatch ? decodeXmlText(valueMatch[1]) : "";
}

function detectDepartmentFromSheetTitle(worksheetXml: string, sharedStrings: string[]) {
  const title = getWorksheetCellText(worksheetXml, "A1", sharedStrings);
  return detectDepartmentFromHint(title);
}

function detectDepartmentFromVisibleSheetRow(worksheetXml: string) {
  const visibleRows = Array.from(worksheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>/g))
    .map((match) => {
      const rowNumber = Number(match[1]);
      return {
        rowNumber,
        isHidden: /\bhidden="1"/.test(match[0])
      };
    })
    .filter((row) => row.rowNumber >= 4 && row.rowNumber <= 22 && !row.isHidden);

  if (visibleRows.length !== 1) {
    return null;
  }

  const found = Object.entries(DEPARTMENT_SHEET_ROW_BY_ID)
    .find(([, rowNumber]) => rowNumber === visibleRows[0].rowNumber);
  return found ? found[0] as DepartmentId : null;
}

function validateReturnedDepartmentSheetIntegrity(
  worksheetXml: string,
  sharedStrings: string[],
  departmentId: DepartmentId
) {
  const issues: string[] = [];
  const targetRow = DEPARTMENT_SHEET_ROW_BY_ID[departmentId];
  const titleDepartmentId = detectDepartmentFromSheetTitle(worksheetXml, sharedStrings);
  const visibleDepartmentId = detectDepartmentFromVisibleSheetRow(worksheetXml);

  if (titleDepartmentId !== departmentId) {
    issues.push("название отделения в заголовке было изменено или удалено");
  }
  if (visibleDepartmentId !== departmentId) {
    issues.push("видимая строка отделения была изменена");
  }

  const brokenFormulaCells = DEPARTMENT_SHEET_FORMULA_COLUMNS
    .map((column) => `${column}${targetRow}`)
    .filter((cellRef) => !/<f\b/.test(getWorksheetCellXml(worksheetXml, cellRef)));
  if (brokenFormulaCells.length) {
    issues.push(`формульные ячейки изменены: ${brokenFormulaCells.join(", ")}`);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

function getSheetNumber(values: Record<string, number | null>, key: string) {
  return values[key] ?? 0;
}

function syncQhCalculatedSnapshotRows<T extends { id: string; values: Record<string, number | null> }>(rows: T[]) {
  rows.forEach((row) => {
    if (!QH_CALC_DEPARTMENT_IDS.has(row.id as DepartmentId)) {
      return;
    }

    QH_CALC_CARRYOVER_PAIRS.forEach(({ base, current }) => {
      const currentValue = getSheetNumber(row.values, current);
      if (row.values[base] === null && currentValue > 0) {
        row.values[base] = currentValue;
      }
      row.values[current] = getSheetNumber(row.values, base);
    });
  });
  return rows;
}

function getTelegramWebFormCarryoverValues(values: Record<string, number | null>) {
  const currentShar = getSheetNumber(values, "currentShar");
  const currentSpa = getSheetNumber(values, "currentSpa");
  const currentPaym = getSheetNumber(values, "currentPaym");
  const presentTotal = DEPARTMENT_SHEET_PRESENT_SUM_KEYS
    .reduce((sum, key) => sum + getSheetNumber(values, key), 0);

  return {
    beenTotal: presentTotal,
    beenSoldier: currentShar + currentSpa + currentPaym,
    beenSeries: currentShar
  };
}

function getTelegramWebFormCarryoverFromSnapshot(
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>,
  departmentId: DepartmentId
) {
  const row = snapshot.rows.find((item) => item.id === departmentId);
  return getTelegramWebFormCarryoverValues(row ? row.values : sanitizeValues(null));
}

function applyTelegramWebFormCarryoverValues(
  values: Record<string, number | null>,
  carryoverValues: Record<string, number | null>
) {
  values.beenTotal = carryoverValues.beenTotal ?? 0;
  values.beenSoldier = carryoverValues.beenSoldier ?? 0;
  values.beenSeries = carryoverValues.beenSeries ?? 0;
  return values;
}

function validateDepartmentSheetValues(values: Record<string, number | null>) {
  const actual = DEPARTMENT_SHEET_PRESENT_SUM_KEYS
    .reduce((sum, key) => sum + getSheetNumber(values, key), 0);
  const expected = (
    getSheetNumber(values, "beenTotal")
    + getSheetNumber(values, "admittedTotal")
    + getSheetNumber(values, "transferToDepartment")
  ) - (
    getSheetNumber(values, "dgTotal")
    + getSheetNumber(values, "transferFromDepartment")
  );

  return {
    isValid: actual === expected,
    actual,
    expected
  };
}

async function parseReturnedDepartmentSheet(bytes: Uint8Array, fileName: string) {
  const zip = await JSZip.loadAsync(bytes);
  const worksheet = zip.file("xl/worksheets/sheet1.xml");
  if (!worksheet) {
    throw new Error("В XLSX не найден лист Sheet1.");
  }

  const worksheetXml = await worksheet.async("string");
  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsFile
    ? parseSharedStringsXml(await sharedStringsFile.async("string"))
    : [];
  const departmentId = detectDepartmentFromHint(fileName)
    || detectDepartmentFromSheetTitle(worksheetXml, sharedStrings)
    || detectDepartmentFromVisibleSheetRow(worksheetXml);
  if (!departmentId) {
    throw new Error("Не удалось определить отделение из XLSX-файла.");
  }

  const targetRow = DEPARTMENT_SHEET_ROW_BY_ID[departmentId];
  const values = sanitizeValues(null);
  Object.entries(DEPARTMENT_SHEET_VALUE_COLUMNS).forEach(([key, column]) => {
    values[key] = sanitizeNumber(getWorksheetCellText(worksheetXml, `${column}${targetRow}`, sharedStrings));
  });

  return {
    departmentId,
    values,
    integrity: validateReturnedDepartmentSheetIntegrity(worksheetXml, sharedStrings, departmentId),
    validation: validateDepartmentSheetValues(values)
  };
}

async function buildDepartmentOnlySheetBytes(templateBytes: Uint8Array, departmentId: DepartmentId, reportDate: string) {
  const targetRow = DEPARTMENT_SHEET_ROW_BY_ID[departmentId];
  if (!targetRow) {
    return templateBytes;
  }

  const zip = await JSZip.loadAsync(templateBytes);
  const worksheet = zip.file("xl/worksheets/sheet1.xml");
  if (!worksheet) {
    throw new Error("В рабочем XLSX не найден лист Sheet1.");
  }
  const styles = zip.file("xl/styles.xml");
  if (!styles) {
    throw new Error("В рабочем XLSX не найден файл стилей.");
  }

  const visibleRows = new Set([1, 2, 3, targetRow]);
  const xml = await worksheet.async("string");
  const stylesXml = await styles.async("string");
  const visibleStyleIds = collectDepartmentSheetVisibleStyleIds(xml, visibleRows);
  const lockedStyles = addLockedDepartmentSheetStyles(stylesXml, visibleStyleIds);
  const filteredXml = xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*>/g, (tag, rowNumberText) => {
    const rowNumber = Number(rowNumberText);
    if (!Number.isFinite(rowNumber) || visibleRows.has(rowNumber)) {
      return setXmlAttribute(tag, "hidden", "0");
    }
    if (rowNumber >= 4) {
      return setXmlAttribute(tag, "hidden", "1");
    }
    return tag;
  });
  const zeroedXml = setDepartmentSheetInputDefaults(filteredXml, targetRow);
  const formulaZeroedXml = resetDepartmentSheetFormulaCachedValues(zeroedXml, targetRow);
  const lockedXml = lockDepartmentSheetVisibleCells(formulaZeroedXml, visibleRows, lockedStyles.styleMap);
  const inputStyleIds = collectDepartmentSheetInputStyleIds(lockedXml, targetRow);
  const formulaStyleIds = collectDepartmentSheetFormulaStyleIds(lockedXml, targetRow);
  const unlockedStyles = addUnlockedDepartmentSheetStyles(lockedStyles.stylesXml, inputStyleIds);
  const formulaProtectedStyles = addHiddenFormulaDepartmentSheetStyles(unlockedStyles.stylesXml, formulaStyleIds);
  const unlockedXml = unlockDepartmentSheetInputCells(lockedXml, targetRow, unlockedStyles.styleMap);
  const formulaHiddenXml = hideDepartmentSheetFormulaCells(unlockedXml, targetRow, formulaProtectedStyles.styleMap);
  const titledXml = setDepartmentSheetTitle(formulaHiddenXml, departmentId);
  const datedXml = setDepartmentSheetA3DateTime(titledXml, buildDepartmentSheetDateTimeText(reportDate));
  const usedRangeXml = setDepartmentSheetUsedRange(datedXml, targetRow);
  const protectedXml = protectDepartmentSheetXml(usedRangeXml);

  zip.file("xl/styles.xml", formulaProtectedStyles.stylesXml);
  zip.file("xl/worksheets/sheet1.xml", protectedXml);
  return await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE"
  });
}

async function getTelegramWebhookInfo() {
  return await callTelegramApi("getWebhookInfo", {});
}

async function repairTelegramWebhook(request: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const currentUrl = new URL(request.url);
  const webhookUrl = supabaseUrl
    ? `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/Mainflow-telegram`
    : `${currentUrl.origin}${currentUrl.pathname}`;
  return await callTelegramApi("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "edited_message"]
  });
}

async function getTelegramFilePath(fileId: string) {
  const result = await callTelegramApi("getFile", { file_id: fileId });
  const filePath = result && typeof result.file_path === "string" ? result.file_path : "";
  if (!filePath) {
    throw new Error("Telegram did not return a valid file_path.");
  }
  return filePath;
}

function inferImageMimeType(filePath: string, contentType: string | null) {
  const normalizedHeader = String(contentType || "").toLowerCase();
  if (normalizedHeader.startsWith("image/")) {
    return normalizedHeader.split(";")[0];
  }

  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith(".png")) {
    return "image/png";
  }
  if (lowerPath.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

async function downloadTelegramImageAsDataUrl(fileId: string) {
  const filePath = await getTelegramFilePath(fileId);
  const response = await fetch(`${getTelegramFileBaseUrl()}/${filePath}`);
  if (!response.ok) {
    throw new Error(`Telegram file download failed (${response.status}).`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const mimeType = inferImageMimeType(filePath, response.headers.get("content-type"));
  return {
    dataUrl: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
    fileName: filePath.split("/").pop() || "telegram-image.jpg"
  };
}

async function downloadTelegramFileBytes(fileId: string) {
  const filePath = await getTelegramFilePath(fileId);
  const response = await fetch(`${getTelegramFileBaseUrl()}/${filePath}`);
  if (!response.ok) {
    throw new Error(`Telegram file download failed (${response.status}).`);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    fileName: filePath.split("/").pop() || "telegram-file",
    contentType: response.headers.get("content-type") || ""
  };
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function detectDepartmentFromHint(text: string): DepartmentId | null {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  const idMatch = normalized.match(/\br(4|5|6|7|8|9|10|11|12|13|14|15|16|17|19|20|21)\b/);
  if (idMatch) {
    const candidate = `r${idMatch[1]}` as DepartmentId;
    if (Object.prototype.hasOwnProperty.call(DEPARTMENTS, candidate)) {
      return candidate;
    }
  }

  const srMatch = normalized.match(/\bsr[- ]?(4|5|6|7|8|9|10|11|12|13|14|15|16|17|19|20|21)\b/i);
  if (srMatch) {
    const marker = `SR-${srMatch[1]}`;
    const found = Object.entries(DEPARTMENTS).find(([, meta]) => meta.marker.toLowerCase() === marker.toLowerCase());
    if (found) {
      return found[0] as DepartmentId;
    }
  }

  const foundByName = Object.entries(DEPARTMENTS).find(([, meta]) => normalized.includes(normalizeText(meta.department)));
  return foundByName ? foundByName[0] as DepartmentId : null;
}

function detectReportDateFromHint(text: string) {
  const match = text.match(/\b\d{2}[.,/]\d{2}[.,/]\d{2,4}\b/);
  return match ? sanitizeReportDate(match[0]) : null;
}

function getDepartmentPageUrl(departmentId: DepartmentId, feedbackId?: string | null) {
  const meta = DEPARTMENTS[departmentId];
  const baseUrl = `${getPublicSiteBaseUrl()}/bgej6lyx/${meta.slug}.html`;
  const normalizedFeedbackId = String(feedbackId || "").trim();
  if (!normalizedFeedbackId) {
    return baseUrl;
  }
  return `${baseUrl}?tgFeedback=${encodeURIComponent(normalizedFeedbackId)}`;
}

function getMainPageUrl() {
  return `${getPublicSiteBaseUrl()}/index.html`;
}

function buildSrDepartmentsText() {
  const lines = Object.values(DEPARTMENTS).map((meta) => `${meta.marker} — ${meta.department}`);
  return ["Բաժանմունքների ցանկը.", ...lines].join("\n");
}

function isSrDepartmentsListRequest(text: string) {
  return /^sr\s*[- ]?\?$/i.test(text.trim());
}

function buildColleagueStartText() {
  return [
    "Բարև Ձեզ։ Սա Mainflow բոտն է բաժանմունքների տվյալները ուղարկելու համար։",
    "",
    "Ինչպես աշխատել.",
    "1. Ուղարկեք բաժանմունքի կոդը, օրինակ՝ SR-7։",
    "2. Բոտը կուղարկի ընթացիկ PDF-ը և Telegram ձևը բացելու կոճակը։",
    "3. Լրացրեք ձևը և ուղարկեք բլանկի լուսանկարը։",
    "",
    "SR-? հրամանը ցույց կտա բաժանմունքների ցանկը։",
    "",
    buildSrDepartmentsText()
  ].join("\n");
}

function buildAdminHelpText() {
  return [
    "Mainflow Telegram բոտի հրամանները",
    "",
    "Կոլեգաների հասանելիություն.",
    "/kollegi_on — միացնել կոլեգաներին. բոտը ընդունում է հաղորդագրություններ հղումով։",
    "/kollegi_off — անջատել կոլեգաներին. բոտը լսում է միայն ադմինիստրատորին։",
    "/kollegi_status — ստուգել՝ կոլեգաները միացված են, թե ոչ։",
    "/reminder_12 — ձեռքով ուղարկել 14։00-ի հիշեցումը կոլեգաներին։",
    "/reminder_17 — ձեռքով ուղարկել 18։00-ի հիշեցումը կոլեգաներին։",
    "",
    "Աշխատանք բաժանմունքների հետ.",
    "SR-? — ցույց տալ բաժանմունքների SR կոդերի ցանկը։",
    "SR-7 կամ r7 — ուղարկել ընթացիկ տվյալների PDF-ը և Telegram ձևի կոճակը։",
    "/form SR-7 — ընթացիկ տվյալների PDF + Telegram ձևի կոճակ։",
    "/sheet SR-7 — ուղարկել բաժանմունքի XLSX ֆայլը։",
    "/departments — բաժանմունքների SR կոդերի ցանկը։",
    "",
    "Լուսանկարներ և ֆայլեր.",
    "Բլանկի լուսանկար — որոշել բաժանմունքը, OCR անել և խնդրել լրացնել ձևը։",
    "XLSX ֆայլ — ստուգել հին Excel տարբերակի բանաձևը։",
    "",
    "Վիճակ.",
    "/status — բաժանմունքների լրացման վիճակը։",
    "/pdf կամ /done — գլխավոր ֆայլի հղումը։",
    "/help — ցույց տալ այս ադմինիստրատորական օգնությունը։",
    "",
    "Կարևոր է. /help և կոլեգաների միացման հրամանները հասանելի են միայն ադմինիստրատորին։"
  ].join("\n");
}

function buildHelpText() {
  return [
    "SARSH_KKZH Telegram bot",
    "",
    "Ուղարկեք բլանկի լուսանկարը, և բոտը կփորձի.",
    "1. որոշել բաժանմունքը",
    "2. ճանաչել թվերը",
    "3. պահպանել տվյալները համակարգում",
    "",
    "Հրամաններ.",
    "/status — ամփոփագրի ընթացիկ վիճակը",
    "/departments — բաժանմունքների կոդերի ցանկը",
    "/pdf — գլխավոր ֆայլի հղումը",
    "/done — նույնն է, ինչ /pdf",
    "/form SR-4 — ստանալ ընթացիկ տվյալների PDF-ը և բացել Telegram Web App ձևը",
    "/sheet SR-4 — ստանալ հին XLSX ֆայլը",
    "",
    "Բաժանմունքի ձևը ստանալու համար առանձին հաղորդագրությամբ ուղարկեք կոդը կամ անունը՝ `r4`, `SR-4`։",
    "Հուշում. լուսանկարի ստորագրության մեջ կարելի է ավելացնել `r4` կամ `SR-4`, որպեսզի բաժանմունքը հստակ նշվի։"
  ].join("\n");
}

function buildDepartmentsText() {
  const lines = Object.entries(DEPARTMENTS).map(([id, meta]) => `${id} — ${meta.department} (${meta.marker})`);
  return ["Հասանելի բաժանմունքներ.", ...lines].join("\n");
}

function sanitizeSheetFileNamePart(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function getDepartmentBlankPdfUrl(departmentId: DepartmentId) {
  const pdfFile = DEPARTMENT_PDF_FILES[departmentId];
  const parts = ["Отделения", pdfFile.folder, pdfFile.file]
    .map((part) => encodeURIComponent(part));
  return `${getPublicSiteBaseUrl()}/${parts.join("/")}`;
}

async function fetchDepartmentBlankPdfBytes(departmentId: DepartmentId) {
  const url = getDepartmentBlankPdfUrl(departmentId);
  const response = await fetch(url, {
    headers: {
      Accept: "application/pdf,application/octet-stream,*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить PDF-бланк отделения (${response.status}) из ${url}.`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function buildDepartmentPdfValues(values: Record<string, number | null>) {
  const sanitized = sanitizeValues(values as Record<string, unknown>);
  const validation = validateDepartmentSheetValues(sanitized);
  const presentTotal = validation.actual;

  return PHOTO_FIELD_MAPPINGS.map((field) => {
    if (field.key === "presentTotal") {
      return presentTotal;
    }
    return getSheetNumber(sanitized, field.key);
  });
}

async function buildFilledDepartmentPdfBytes(
  departmentId: DepartmentId,
  values: Record<string, number | null>,
  reportDate: string
) {
  const blankBytes = await fetchDepartmentBlankPdfBytes(departmentId);
  const pdf = await PDFDocument.load(blankBytes);
  const page = pdf.getPage(0);
  const font = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);
  const dateFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 15;
  const valueColor = rgb(0.07, 0.08, 0.38);
  const pdfValues = buildDepartmentPdfValues(values);

  pdfValues.forEach((value, index) => {
    const text = String(value ?? 0);
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
      x: DEPARTMENT_PDF_VALUE_X[index] - (textWidth / 2),
      y: DEPARTMENT_PDF_VALUE_Y,
      size: fontSize,
      font,
      color: valueColor
    });
  });

  page.drawText(buildDepartmentSheetDateTimeText(reportDate), {
    x: DEPARTMENT_PDF_DATE_X,
    y: DEPARTMENT_PDF_DATE_Y,
    size: DEPARTMENT_PDF_DATE_FONT_SIZE,
    font: dateFont,
    color: rgb(0, 0, 0)
  });

  return await pdf.save();
}

function buildDepartmentPdfFileName(departmentId: DepartmentId, reportDate: string, suffix: string) {
  const meta = DEPARTMENTS[departmentId];
  const safeMarker = sanitizeSheetFileNamePart(meta.marker);
  const safeDate = sanitizeSheetFileNamePart(reportDate.replaceAll(".", ",").replaceAll("/", ","));
  return `${safeMarker}_${safeDate || DEFAULT_DATE}_${suffix}.pdf`;
}

function buildTelegramFormReplyMarkup(formUrl: string) {
  return {
    inline_keyboard: [
      [
        {
          text: "Открыть форму",
          web_app: { url: formUrl }
        }
      ]
    ]
  };
}

async function sendWorkingSheetForDepartment(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  departmentId: DepartmentId,
  text: string
) {
  const snapshot = await loadSnapshot(supabase);
  const reportDate = detectReportDateFromHint(text) || snapshot.reportDate || DEFAULT_DATE;
  const meta = DEPARTMENTS[departmentId];
  const templateBytes = await fetchDepartmentSheetTemplateBytes();
  const bytes = await buildDepartmentOnlySheetBytes(templateBytes, departmentId, reportDate);
  const safeDate = sanitizeSheetFileNamePart(reportDate.replaceAll(".", ",").replaceAll("/", ","));
  const fileName = `${sanitizeSheetFileNamePart(meta.marker)}_${safeDate || DEFAULT_DATE}_department.xlsx`;

  await sendTelegramDocument(
    chatId,
    fileName,
    bytes,
    [
      `Рабочая таблица для отделения: ${meta.department}`,
      `Дата отчёта: ${buildDepartmentSheetMessageDateTimeText(reportDate)}`,
      "Заполните нужные данные отделения и отправьте XLSX-файл обратно мне. Пожалуйста, не забудьте прислать и фото бланка документа.",
      "После возврата файла данные попадут на проверку перед общей таблицей. Спасибо."
    ].join("\n")
  );
}

async function sendTelegramWebFormForDepartment(
  supabase: unknown,
  chatId: number,
  departmentId: DepartmentId,
  text: string
) {
  const snapshot = await loadSnapshot(supabase as ReturnType<typeof createClient>);
  const reportDate = detectReportDateFromHint(text) || snapshot.reportDate || DEFAULT_DATE;
  const meta = DEPARTMENTS[departmentId];
  const carryoverValues = getTelegramWebFormCarryoverFromSnapshot(snapshot, departmentId);
  const formUrl = getTelegramWebFormUrl(departmentId, reportDate, carryoverValues);
  const row = snapshot.rows.find((item) => item.id === departmentId);
  const currentValues = row ? row.values : sanitizeValues(null);
  const caption = [
    `Текущие данные отделения: ${meta.department} (${meta.marker})`,
    `Дата отчёта: ${buildDepartmentSheetMessageDateTimeText(reportDate)}`,
    "PDF сформирован из главной таблицы. Сохраните его у себя.",
    "Кнопка ниже откроет Telegram форму для новых данных.",
    "После отправки формы пришлите сюда фото бланка этого отделения."
  ].join("\n");
  const replyMarkup = buildTelegramFormReplyMarkup(formUrl);

  try {
    const pdfBytes = await buildFilledDepartmentPdfBytes(departmentId, currentValues, reportDate);
    await sendTelegramDocument(
      chatId,
      buildDepartmentPdfFileName(departmentId, reportDate, "current"),
      pdfBytes,
      caption,
      "application/pdf",
      replyMarkup
    );
  } catch (error) {
    console.error("Failed to send current department PDF:", sanitizePublicErrorMessage(error));
    await sendTelegramMessageWithReplyMarkup(
      chatId,
      [
        `Форма ввода для отделения: ${meta.department} (${meta.marker})`,
        `Дата отчёта: ${buildDepartmentSheetMessageDateTimeText(reportDate)}`,
        "PDF с текущими данными сейчас не удалось создать, но форму можно открыть.",
        "После отправки формы пришлите сюда фото бланка этого отделения."
      ].join("\n"),
      replyMarkup
    );
  }
}

async function sendTelegramWebFormPromptAfterPhoto(
  supabase: unknown,
  chatId: number,
  departmentId: DepartmentId,
  reportDate: string,
  baseText: string
) {
  const snapshot = await loadSnapshot(supabase as ReturnType<typeof createClient>);
  const effectiveReportDate = reportDate || snapshot.reportDate || DEFAULT_DATE;
  const meta = DEPARTMENTS[departmentId];
  const carryoverValues = getTelegramWebFormCarryoverFromSnapshot(snapshot, departmentId);
  const formUrl = getTelegramWebFormUrl(departmentId, effectiveReportDate, carryoverValues);

  await sendTelegramMessageWithReplyMarkup(
    chatId,
    [
      baseText,
      "",
      "Теперь заполните Telegram форму по этому же отделению.",
      `Отделение: ${meta.department} (${meta.marker})`,
      "Если форму уже отправляли, повторно заполнять не нужно."
    ].join("\n"),
    buildTelegramFormReplyMarkup(formUrl)
  );
}

function rowHasAnyData(values: Record<string, number | null>) {
  return Object.values(values).some((value) => typeof value === "number" && value > 0);
}

function buildStatusText(snapshot: Awaited<ReturnType<typeof loadSnapshot>>) {
  const rowsWithData = snapshot.rows.filter((row) => rowHasAnyData(row.values));
  const updatedRows = rowsWithData
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 5)
    .map((row) => `- ${row.department}: ${row.updatedAt ? new Date(row.updatedAt).toLocaleString("ru-RU") : "нет даты"}`);

  return [
    `Дата отчёта: ${snapshot.reportDate}`,
    `Заполнено отделений: ${rowsWithData.length}/${snapshot.rows.length}`,
    snapshot.updatedAt ? `Последнее обновление сводки: ${new Date(snapshot.updatedAt).toLocaleString("ru-RU")}` : "",
    updatedRows.length ? "" : null,
    updatedRows.length ? "Последние обновления:" : null,
    ...updatedRows
  ].filter(Boolean).join("\n");
}

function buildTelegramWebFormValuesText(values: Record<string, number | null>) {
  return PHOTO_FIELD_MAPPINGS
    .map((item) => {
      if (item.key === "presentTotal") {
        return null;
      }
      return `${item.cell}=${values[item.key] ?? 0}`;
    })
    .filter(Boolean)
    .join(", ");
}

async function handleTelegramWebFormSubmit(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const verifiedUser = await verifyTelegramWebAppInitData(String(payload?.initData || ""));
    if (!verifiedUser) {
      return jsonResponse({ ok: false, error: "Telegram Web App authorization failed." }, 403);
    }

    const departmentId = typeof payload?.departmentId === "string" && Object.prototype.hasOwnProperty.call(DEPARTMENTS, payload.departmentId)
      ? payload.departmentId as DepartmentId
      : null;
    if (!departmentId) {
      return jsonResponse({ ok: false, error: "Не удалось определить отделение формы." }, 400);
    }

    const supabase = createSupabaseAdmin();
    if (!await isTelegramUserAllowedByRuntimeState(supabase, verifiedUser.userId)) {
      return jsonResponse({
        ok: false,
        error: "Бот временно отключён для коллег. Обратитесь к администратору."
      }, 403);
    }

    const snapshot = await loadSnapshot(supabase as ReturnType<typeof createClient>);
    const reportDate = sanitizeReportDate(payload?.reportDate) || snapshot.reportDate || DEFAULT_DATE;
    const values = applyTelegramWebFormCarryoverValues(
      sanitizeDepartmentFormValues(payload?.values),
      getTelegramWebFormCarryoverFromSnapshot(snapshot, departmentId)
    );
    const validation = validateDepartmentSheetValues(values);
    if (!validation.isValid) {
      return jsonResponse({
        ok: false,
        error: "Контроль формулы не пройден.",
        validation
      }, 400);
    }

    const userName = [
      verifiedUser.firstName,
      verifiedUser.lastName,
      verifiedUser.username ? `@${verifiedUser.username}` : ""
    ].filter(Boolean).join(" ");
    const feedbackId = await insertTelegramWebFormFeedback(
      supabase as ReturnType<typeof createClient>,
      departmentId,
      reportDate,
      values,
      verifiedUser.userId,
      userName
    );
    await markDepartmentPhotoPending(supabase as ReturnType<typeof createClient>, departmentId, feedbackId, "telegram-web-app-form");
    const meta = DEPARTMENTS[departmentId];
    const messageText = [
      "Спасибо. Отличная работа. 🙂",
      "Форма проверена: формула совпала.",
      `Отделение: ${meta.department} (${meta.marker})`,
      `Сумма 13-22 = ${validation.actual}.`,
      "Данные приняты на проверку. В общую таблицу пока не внесены автоматически.",
      "Пожалуйста, отправьте сюда фото бланка этого отделения, чтобы можно было сверить форму с документом.",
      "Прикрепляю PDF-бланк уже с новыми значениями из Telegram формы."
    ].join("\n");

    if (verifiedUser.userId) {
      try {
        const pdfBytes = await buildFilledDepartmentPdfBytes(departmentId, values, reportDate);
        await sendTelegramDocument(
          verifiedUser.userId,
          buildDepartmentPdfFileName(departmentId, reportDate, "telegram-form"),
          pdfBytes,
          messageText,
          "application/pdf"
        );
      } catch (error) {
        console.error("Failed to notify Telegram Web App user:", sanitizePublicErrorMessage(error));
        await sendTelegramMessage(verifiedUser.userId, messageText).catch((fallbackError) => {
          console.error("Failed to send fallback Telegram Web App message:", sanitizePublicErrorMessage(fallbackError));
        });
      }
    }

    const submitterChatId = verifiedUser.userId ? String(verifiedUser.userId) : "";
    const notifyChatIds = getTelegramNotifyChatIds(null)
      .filter((chatId) => String(chatId) !== submitterChatId);
    if (notifyChatIds.length) {
      await sendTelegramMessageToMany(notifyChatIds, [
        "Получена Telegram Web App форма.",
        `Отделение: ${meta.department} (${meta.marker})`,
        `Дата отчёта: ${reportDate}`,
        `Пользователь: ${userName || verifiedUser.userId || "неизвестно"}`,
        `OCR feedback: ${feedbackId || "без номера"}`,
        `Значения: ${buildTelegramWebFormValuesText(values)}`
      ].join("\n"));
    }

    return jsonResponse({
      ok: true,
      feedbackId,
      validation,
      message: messageText
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: sanitizePublicErrorMessage(error)
    }, 500);
  }
}

function buildPhotoSaveSummary(
  departmentId: DepartmentId,
  reportDate: string,
  recognized: Awaited<ReturnType<typeof recognizeDepartmentPhoto>>,
  departmentSource: string,
  feedbackId: string,
  didSaveSnapshot: boolean,
  validation?: { isValid: boolean; actual: number; expected: number } | null
) {
  const meta = DEPARTMENTS[departmentId];
  const cellSummaries = PHOTO_FIELD_MAPPINGS
    .map((item) => {
      const value = recognized.values[item.key];
      return value === null ? null : `${item.cell}=${value}`;
    })
    .filter(Boolean)
    .join(", ");

  return [
    didSaveSnapshot
      ? "Фото обработано и сохранено."
      : "Фото обработано. Значения не сохранены: контроль отделения не пройден.",
    `Отделение: ${meta.department} (${departmentId})`,
    `Источник отделения: ${departmentSource}`,
    `Дата отчёта: ${reportDate}`,
    recognized.reportDate ? `Дата на фото: ${recognized.reportDate}` : "Дата на фото: не распознана",
    `Страница отделения: ${getDepartmentPageUrl(departmentId, feedbackId)}`,
    `OCR feedback: ${feedbackId || "no id"}`,
    recognized.structure && (!recognized.structure.all22CellsVisible || recognized.structure.gridCellCount !== 22)
      ? `Структура строки не подтверждена: ${recognized.structure.gridCellCount}/22 ячеек.`
      : (cellSummaries ? `Распознано: ${cellSummaries}` : "Распознанных ячеек не найдено."),
    validation
      ? (validation.isValid
        ? `Контроль формулы: пройден, сумма 13-22 = ${validation.actual}.`
        : `Контроль формулы: не пройден, сумма 13-22 = ${validation.actual}, должно быть ${validation.expected}.`)
      : "",
    recognized.notes.length ? `Заметки OCR: ${recognized.notes.join("; ")}` : ""
  ].filter(Boolean).join("\n");
}

function buildPhotoSenderResponse(
  isControlPassed: boolean,
  validation: { isValid: boolean; actual: number; expected: number } | null,
  structureInvalid: boolean,
  hasRecognizedValues: boolean
) {
  if (isControlPassed) {
    return "Спасибо, контроль отделения пройден. 🙂";
  }

  const reason = !hasRecognizedValues
    ? "не удалось уверенно прочитать значения"
    : (structureInvalid
      ? "верхняя строка бланка распознана неуверенно"
      : (validation && !validation.isValid ? "формула отделения не совпала" : "контроль не пройден"));

  return buildPhotoRetakeResponse(reason);
}

function buildPhotoRetakeResponse(reason: string) {
  return [
    "Контроль отделения не пройден.",
    `Причина: ${reason}.`,
    "Пожалуйста, пришлите повторный качественный снимок бланка: ровно, без обрезанных краёв, чтобы SR-маркер и верхняя строка с ячейками были хорошо видны."
  ].join("\n");
}

function getMessageText(message: Record<string, unknown>) {
  if (typeof message.text === "string") {
    return message.text.trim();
  }
  if (typeof message.caption === "string") {
    return message.caption.trim();
  }
  return "";
}

function getMessageChatId(message: Record<string, unknown>) {
  const chat = message.chat as { id?: number } | undefined;
  return typeof chat?.id === "number" ? chat.id : null;
}

function getTelegramMessageId(message: Record<string, unknown>) {
  return typeof message.message_id === "number" ? message.message_id : null;
}

function getTelegramSenderLabel(message: Record<string, unknown>, fallbackChatId: number | string) {
  const from = message.from as {
    id?: unknown;
    first_name?: unknown;
    last_name?: unknown;
    username?: unknown;
  } | undefined;
  const name = [from?.first_name, from?.last_name]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .join(" ");
  const username = typeof from?.username === "string" && from.username.trim()
    ? `@${from.username.trim()}`
    : "";
  const senderId = typeof from?.id === "number" || typeof from?.id === "string"
    ? String(from.id)
    : String(fallbackChatId);
  return [
    name || username || "неизвестный пользователь",
    name && username ? username : "",
    senderId ? `id ${senderId}` : ""
  ].filter(Boolean).join(" ");
}

function buildIncomingPhotoAdminCaption(
  message: Record<string, unknown>,
  chatId: number | string,
  hintText: string
) {
  const shortHint = hintText.length > 300 ? `${hintText.slice(0, 300)}...` : hintText;
  return [
    "Фото бланка от коллеги.",
    `Отправитель: ${getTelegramSenderLabel(message, chatId)}`,
    shortHint ? `Подпись: ${shortHint}` : ""
  ].filter(Boolean).join("\n");
}

function extractPhotoFileId(message: Record<string, unknown>) {
  const photo = Array.isArray(message.photo) ? message.photo as Array<Record<string, unknown>> : [];
  if (photo.length) {
    const sorted = [...photo].sort((a, b) => {
      const aArea = Number(a.width || 0) * Number(a.height || 0);
      const bArea = Number(b.width || 0) * Number(b.height || 0);
      return bArea - aArea;
    });
    const largest = sorted[0];
    return typeof largest.file_id === "string" ? largest.file_id : null;
  }

  const document = message.document as { file_id?: unknown; mime_type?: unknown } | undefined;
  if (document && typeof document.file_id === "string" && typeof document.mime_type === "string" && document.mime_type.startsWith("image/")) {
    return document.file_id;
  }

  return null;
}

function extractSheetDocument(message: Record<string, unknown>) {
  const document = message.document as {
    file_id?: unknown;
    file_name?: unknown;
    mime_type?: unknown;
  } | undefined;
  if (!document || typeof document.file_id !== "string") {
    return null;
  }

  const fileName = typeof document.file_name === "string" ? document.file_name : "";
  const mimeType = typeof document.mime_type === "string" ? document.mime_type : "";
  const lowerFileName = fileName.toLowerCase();
  const lowerMimeType = mimeType.toLowerCase();
  const isXlsx = lowerFileName.endsWith(".xlsx")
    || lowerMimeType.includes("spreadsheetml.sheet")
    || lowerMimeType.includes("application/vnd.ms-excel");
  if (!isXlsx) {
    return null;
  }

  return {
    fileId: document.file_id,
    fileName: fileName || "department-sheet.xlsx",
    mimeType
  };
}

function isAllowedChat(chatId: number | null) {
  if (chatId === null) {
    return false;
  }
  if (!isTelegramChatAccessRestricted()) {
    return true;
  }
  const allowed = getTelegramAllowedChatIds();
  if (!allowed.length) {
    return true;
  }
  return allowed.includes(String(chatId));
}

function isTelegramSecretValid(request: Request) {
  const expected = getTelegramSecretToken();
  if (!expected) {
    return true;
  }
  const actual = request.headers.get("x-telegram-bot-api-secret-token") || "";
  const normalizedActual = actual.trim();
  if (!normalizedActual) {
    return true;
  }
  return normalizedActual === expected;
}

function isTelegramReminderRequestValid(request: Request) {
  const expected = (Deno.env.get("TELEGRAM_REMINDER_SECRET") || "").trim();
  if (!expected) {
    return true;
  }
  const currentUrl = new URL(request.url);
  const actual = request.headers.get("x-telegram-reminder-secret")
    || request.headers.get("x-telegram-bot-api-secret-token")
    || currentUrl.searchParams.get("secret")
    || "";
  return actual.trim() === expected;
}

async function handleTelegramCommand(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  text: string
) {
  const command = text.trim().split(/\s+/)[0].toLowerCase();

  if (["/kollegi_on", "/colleagues_on", "/access_on"].includes(command)) {
    if (!isTelegramAdminChat(chatId)) {
      await sendTelegramMessage(chatId, "Эта команда доступна только администратору бота.");
      return;
    }
    await setTelegramColleaguesEnabled(supabase, true);
    await sendTelegramMessage(chatId, "Коллеги подключены. Бот снова принимает сообщения от всех, кто откроет его по ссылке.");
    return;
  }

  if (["/kollegi_off", "/colleagues_off", "/access_off"].includes(command)) {
    if (!isTelegramAdminChat(chatId)) {
      await sendTelegramMessage(chatId, "Эта команда доступна только администратору бота.");
      return;
    }
    await setTelegramColleaguesEnabled(supabase, false);
    await sendTelegramMessage(chatId, "Коллеги отключены. Теперь бот принимает сообщения только от администратора.");
    return;
  }

  if (["/kollegi_status", "/colleagues_status", "/access_status"].includes(command)) {
    if (!isTelegramAdminChat(chatId)) {
      await sendTelegramMessage(chatId, "Эта команда доступна только администратору бота.");
      return;
    }
    const enabled = await areTelegramColleaguesEnabled(supabase);
    await sendTelegramMessage(
      chatId,
      enabled
        ? "Коллеги сейчас подключены: бот принимает сообщения по ссылке."
        : "Коллеги сейчас отключены: бот слушает только администратора."
    );
    return;
  }

  if (["/reminder_12", "/reminder12"].includes(command)) {
    if (!isTelegramAdminChat(chatId)) {
      await sendTelegramMessage(chatId, "Эта команда доступна только администратору бота.");
      return;
    }
    const result = await sendDailyReminderToColleagues(supabase, "midday", { force: true });
    await sendTelegramMessage(chatId, `Напоминание 12:00 отправлено: ${result.sent}.`);
    return;
  }

  if (["/reminder_17", "/reminder17"].includes(command)) {
    if (!isTelegramAdminChat(chatId)) {
      await sendTelegramMessage(chatId, "Эта команда доступна только администратору бота.");
      return;
    }
    const result = await sendDailyReminderToColleagues(supabase, "evening", { force: true });
    await sendTelegramMessage(chatId, `Напоминание 17:00 отправлено: ${result.sent}.`);
    return;
  }

  if (command === "/start") {
    await sendTelegramMessage(chatId, buildColleagueStartText());
    return;
  }

  if (command === "/help") {
    if (!isTelegramAdminChat(chatId)) {
      await sendTelegramMessage(chatId, "Команда /help доступна только администратору. Для списка SR-кодов используйте /start или /departments.");
      return;
    }
    await sendTelegramMessage(chatId, buildAdminHelpText());
    return;
  }

  if (command === "/departments") {
    await sendTelegramMessage(chatId, buildSrDepartmentsText());
    return;
  }

  if (command === "/sheet") {
    const departmentId = detectDepartmentFromHint(text);
    if (!departmentId) {
      await sendTelegramMessage(chatId, "Укажите отделение после команды: /sheet r4 или /sheet SR-4.");
      return;
    }
    await sendWorkingSheetForDepartment(supabase, chatId, departmentId, text);
    return;
  }

  if (command === "/form") {
    const departmentId = detectDepartmentFromHint(text);
    if (!departmentId) {
      await sendTelegramMessage(chatId, "Укажите отделение после команды: /form r4 или /form SR-4.");
      return;
    }
    await sendTelegramWebFormForDepartment(supabase, chatId, departmentId, text);
    return;
  }

  if (command === "/status") {
    const snapshot = await loadSnapshot(supabase);
    await sendTelegramMessage(chatId, buildStatusText(snapshot));
    return;
  }

  if (command === "/pdf" || command === "/done") {
    await sendTelegramMessage(
      chatId,
      [
        "Главный файл готов по этой ссылке:",
        getMainPageUrl(),
        "",
        "Откройте страницу и сохраните PDF через кнопку печати браузера."
      ].join("\n")
    );
    return;
  }

  await sendTelegramMessage(chatId, "Неизвестная команда. Используйте /help.");
}

async function handleTelegramPhoto(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  message: Record<string, unknown>
) {
  const fileId = extractPhotoFileId(message);
  if (!fileId) {
    await sendTelegramMessage(chatId, "Нужна фотография бланка. Отправьте фото или изображение как документ.");
    return;
  }

  const hintText = getMessageText(message);
  const hintedDepartmentId = detectDepartmentFromHint(hintText);
  const hintedReportDate = detectReportDateFromHint(hintText);

  await sendTelegramMessage(chatId, "Фото получено. Обрабатываю...");

  const sourceMessageId = getTelegramMessageId(message);
  const photoNotifyChatIds = getTelegramNotifyChatIds(chatId)
    .filter((targetChatId) => String(targetChatId) !== String(chatId));
  if (photoNotifyChatIds.length && sourceMessageId !== null) {
    await copyTelegramMessageToMany(
      photoNotifyChatIds,
      chatId,
      sourceMessageId,
      buildIncomingPhotoAdminCaption(message, chatId, hintText)
    );
  } else if (photoNotifyChatIds.length) {
    console.warn("Telegram photo copy was not sent: original message_id is missing.");
  }

  const { dataUrl, fileName } = await downloadTelegramImageAsDataUrl(fileId);

  let departmentId = hintedDepartmentId;
  const departmentSource = hintedDepartmentId ? "подсказка в сообщении" : "автоопределение по фото";

  if (!departmentId) {
    const detection = await detectDepartmentFromPhoto(dataUrl);
    departmentId = detection.departmentId;
    if (!departmentId) {
      const detectionSummary = [
        "Фото обработано. Отделение не определено.",
        "Источник отделения: автоопределение по фото",
        detection.notes.length ? `Заметки OCR: ${detection.notes.join("; ")}` : ""
      ].filter(Boolean).join("\n");
      const notifyChatIds = getTelegramNotifyChatIds(chatId);
      if (notifyChatIds.length) {
        await sendTelegramMessageToMany(notifyChatIds, detectionSummary);
      } else {
        console.warn("Telegram photo detection summary was not sent: TELEGRAM_NOTIFY_CHAT_IDS is not configured.");
      }
      await sendTelegramMessage(
        chatId,
        buildPhotoRetakeResponse("не удалось уверенно определить отделение по фото")
      );
      return;
    }
  }

  const recognized = await recognizeDepartmentPhoto(departmentId, dataUrl);
  const snapshot = await loadSnapshot(supabase);
  const reportDate = hintedReportDate || recognized.reportDate || snapshot.reportDate || DEFAULT_DATE;

  const structureInvalid = !!recognized.structure && (!recognized.structure.all22CellsVisible || recognized.structure.gridCellCount !== 22);
  const hasRecognizedValues = recognized.recognizedKeys.some((key) => {
    return VALUE_KEYS.includes(key as (typeof VALUE_KEYS)[number]);
  });
  const photoValidation = hasRecognizedValues ? validateDepartmentSheetValues(recognized.values) : null;
  const isPhotoControlPassed = !structureInvalid && hasRecognizedValues && !!photoValidation?.isValid;
  const shouldSaveSnapshot = isPhotoControlPassed;
  if (shouldSaveSnapshot) {
    await saveDepartmentSnapshot(supabase, departmentId, reportDate, recognized.values);
  }
  const feedbackId = await insertAcceptedFeedback(
    supabase,
    departmentId,
    reportDate,
    recognized.reportDate,
    fileName,
    dataUrl,
    recognized.values,
    recognized.recognizedKeys,
    recognized.notes
  );
  await markDepartmentPhotoPending(supabase, departmentId, feedbackId, fileName);

  const detailedPhotoSummary = buildPhotoSaveSummary(
    departmentId,
    reportDate,
    recognized,
    departmentSource,
    feedbackId,
    shouldSaveSnapshot,
    photoValidation
  );
  const notifyChatIds = getTelegramNotifyChatIds(chatId);
  if (notifyChatIds.length) {
    await sendTelegramMessageToMany(notifyChatIds, detailedPhotoSummary);
  } else {
    console.warn("Telegram photo OCR summary was not sent: TELEGRAM_NOTIFY_CHAT_IDS is not configured.");
  }

  await sendTelegramWebFormPromptAfterPhoto(
    supabase,
    chatId,
    departmentId,
    reportDate,
    buildPhotoSenderResponse(isPhotoControlPassed, photoValidation, structureInvalid, hasRecognizedValues)
  );
}

async function handleTelegramSheetDocument(
  chatId: number,
  sheetDocument: { fileId: string; fileName: string; mimeType: string }
) {
  await sendTelegramMessage(chatId, "XLSX-файл получен. Проверяю формулу...");

  const downloaded = await downloadTelegramFileBytes(sheetDocument.fileId);
  const bytes = downloaded.bytes;
  const fileName = sheetDocument.fileName || downloaded.fileName || "department-sheet.xlsx";
  const result = await parseReturnedDepartmentSheet(bytes, fileName);
  const meta = DEPARTMENTS[result.departmentId];

  if (!result.integrity.isValid) {
    await sendTelegramDocument(
      chatId,
      fileName,
      bytes,
      [
        "⚠️ Структура рабочей таблицы изменена.",
        "Файл возвращаю обратно: нужно взять свежий файл у бота и заполнить только ячейки ввода.",
        "",
        `Отделение: ${meta.department} (${meta.marker})`,
        `Что найдено: ${result.integrity.issues.join("; ")}.`,
        "",
        "На телефоне приложение может позволять нажимать на все ячейки, но менять нужно только ячейки ввода с нулями."
      ].join("\n")
    );
    return;
  }

  if (!result.validation.isValid) {
    const difference = result.validation.actual - result.validation.expected;
    const differenceText = difference > 0 ? `+${difference}` : String(difference);
    await sendTelegramDocument(
      chatId,
      fileName,
      bytes,
      [
        "⚠️ Контроль формулы не пройден.",
        "Файл возвращаю обратно: нужно чуть поправить данные и отправить его снова.",
        "",
        `Отделение: ${meta.department} (${meta.marker})`,
        `Сейчас сумма 13-22: ${result.validation.actual}`,
        `По формуле должно быть: ${result.validation.expected}`,
        `Разница: ${differenceText}`,
        "",
        "Проверьте ячейки ввода, особенно блок 13-22, а также 1, 4, 7, 10, 11."
      ].join("\n")
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    [
      "Спасибо. Отличная работа. 🙂",
      "Файл проверен: формула совпала.",
      `Отделение: ${meta.department} (${meta.marker})`,
      `Сумма 13-22 = ${result.validation.actual}.`,
      "Данные приняты на проверку. В общую таблицу пока не внесены автоматически."
    ].join("\n")
  );
}

async function processTelegramUpdate(update: Record<string, unknown>) {
  const message = (update.message || update.edited_message) as Record<string, unknown> | undefined;
  if (!message || typeof message !== "object") {
    return;
  }

  const chatId = getMessageChatId(message);
  if (chatId === null) {
    return;
  }

  const supabase = createSupabaseAdmin();
  const safeChatId = chatId as number;
  if (!await isTelegramUserAllowedByRuntimeState(supabase, safeChatId)) {
    await sendTelegramMessage(safeChatId, "Бот временно отключён для коллег. Обратитесь к администратору.");
    return;
  }

  try {
    await rememberTelegramColleagueChat(supabase, message, safeChatId);
  } catch (error) {
    console.error("Failed to remember Telegram colleague chat:", sanitizePublicErrorMessage(error));
  }

  const text = getMessageText(message);

  if (text.startsWith("/")) {
    await handleTelegramCommand(supabase, safeChatId, text);
    return;
  }

  const sheetDocument = extractSheetDocument(message);
  if (sheetDocument) {
    await handleTelegramSheetDocument(safeChatId, sheetDocument);
    return;
  }

  if (isSrDepartmentsListRequest(text)) {
    await sendTelegramMessage(safeChatId, buildSrDepartmentsText());
    return;
  }

  const requestedDepartmentId = detectDepartmentFromHint(text);
  if (requestedDepartmentId && !extractPhotoFileId(message)) {
    await sendTelegramWebFormForDepartment(supabase, safeChatId, requestedDepartmentId, text);
    return;
  }

  await handleTelegramPhoto(supabase, safeChatId, message);
}

declare const EdgeRuntime:
  | {
      waitUntil?: (promise: Promise<unknown>) => void;
    }
  | undefined;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method === "GET") {
    const currentUrl = new URL(request.url);
    const action = currentUrl.searchParams.get("action") || "";

    if (action === "webhook-info") {
      const info = await getTelegramWebhookInfo();
      return jsonResponse({
        ok: true,
        service: "Mainflow-telegram",
        status: "ready",
        webhook: info
      });
    }

    if (action === "repair-webhook") {
      try {
        const result = await repairTelegramWebhook(request);
        const info = await getTelegramWebhookInfo();
        return jsonResponse({
          ok: true,
          service: "Mainflow-telegram",
          status: "ready",
          repaired: result,
          webhook: info
        });
      } catch (error) {
        return jsonResponse({
          ok: false,
          service: "Mainflow-telegram",
          status: "repair_failed",
          error: error instanceof Error ? error.message : String(error)
        }, 500);
      }
    }

    if (action === "daily-reminder") {
      if (!isTelegramReminderRequestValid(request)) {
        return jsonResponse({ ok: false, error: "Invalid reminder secret." }, 403);
      }
      try {
        const slot = normalizeDailyReminderSlot(currentUrl.searchParams.get("slot"));
        const forceRaw = (currentUrl.searchParams.get("force") || "").trim().toLowerCase();
        const force = forceRaw === "1" || forceRaw === "true" || forceRaw === "yes";
        const supabase = createSupabaseAdmin();
        const result = await sendDailyReminderToColleagues(supabase, slot, { force });
        return jsonResponse({
          ok: true,
          service: "Mainflow-telegram",
          action,
          result
        });
      } catch (error) {
        return jsonResponse({
          ok: false,
          service: "Mainflow-telegram",
          status: "daily_reminder_failed",
          error: error instanceof Error ? error.message : String(error)
        }, 500);
      }
    }

    if (action === "send-main-pdfs") {
      if (!isTelegramReminderRequestValid(request)) {
        return jsonResponse({ ok: false, error: "Invalid reminder secret." }, 403);
      }
      try {
        const forceRaw = (currentUrl.searchParams.get("force") || "").trim().toLowerCase();
        const force = forceRaw === "1" || forceRaw === "true" || forceRaw === "yes";
        const source = currentUrl.searchParams.get("source") === "manual" ? "manual" : "morning";
        const supabase = createSupabaseAdmin();
        const result = await sendMainPdfsToTelegram(supabase, { force, source });
        return jsonResponse({
          ok: true,
          service: "Mainflow-telegram",
          action,
          result
        });
      } catch (error) {
        return jsonResponse({
          ok: false,
          service: "Mainflow-telegram",
          status: "main_pdfs_failed",
          error: error instanceof Error ? error.message : String(error)
        }, 500);
      }
    }

    if (action === "feedback-photo") {
      try {
        const currentUrl = new URL(request.url);
        const feedbackId = currentUrl.searchParams.get("id") || "";
        const departmentId = currentUrl.searchParams.get("departmentId") || "";
        const supabase = createSupabaseAdmin();
        const record = await loadAcceptedFeedbackPreview(
          supabase,
          feedbackId,
          Object.prototype.hasOwnProperty.call(DEPARTMENTS, departmentId) ? departmentId as DepartmentId : ""
        );
        if (!record) {
          return jsonResponse({ ok: false, error: "Feedback photo not found." }, 404);
        }
        return jsonResponse({ ok: true, record });
      } catch (error) {
        return jsonResponse({
          ok: false,
          service: "Mainflow-telegram",
          status: "feedback_photo_failed",
          error: error instanceof Error ? error.message : String(error)
        }, 500);
      }
    }

    return jsonResponse({
      ok: true,
      service: "Mainflow-telegram",
      status: "ready"
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const postUrl = new URL(request.url);
  if (postUrl.searchParams.get("action") === "web-form-submit") {
    return await handleTelegramWebFormSubmit(request);
  }

  if (!isTelegramSecretValid(request)) {
    return jsonResponse({ error: "Invalid Telegram secret token." }, 403);
  }

  const update = await request.json().catch(() => null);
  if (!update || typeof update !== "object") {
    return jsonResponse({ error: "Invalid Telegram update payload." }, 400);
  }

  const task = processTelegramUpdate(update as Record<string, unknown>).catch(async (error) => {
    const publicMessage = sanitizePublicErrorMessage(error);
    console.error("Telegram update processing failed:", publicMessage);
    const message = (update as Record<string, unknown>).message as Record<string, unknown> | undefined;
    const chatId = message ? getMessageChatId(message) : null;
    if (chatId !== null && isAllowedChat(chatId)) {
      try {
        await sendTelegramMessage(chatId, `Ошибка обработки запроса: ${publicMessage}`);
      } catch (_sendError) {
        console.error("Failed to notify Telegram chat about processing error.");
      }
    }
  });

  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(task);
    return jsonResponse({ ok: true });
  }

  await task;
  return jsonResponse({ ok: true });
});
