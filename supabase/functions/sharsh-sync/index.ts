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
  "qhBaseSoldier",
  "qhBaseOfficer",
  "qhBaseContract",
  "qhIncomingSoldier",
  "qhIncomingOfficer",
  "qhIncomingContract",
  "qhDischargedSoldier",
  "qhDischargedOfficer",
  "qhDischargedContract"
];

const PHOTO_RECOGNITION_MODEL = (Deno.env.get("OPENAI_PHOTO_MODEL") || "gpt-5.4-mini").trim();
const OCR_FEEDBACK_STATUSES = ["accepted_as_is", "corrected_by_operator"] as const;
const PHOTO_FEEDBACK_VALUE_KEYS = new Set<string>([...VALUE_KEYS, "presentTotal"]);
const NIGHT_SHIFT_VALUE_KEYS = ["shar", "spa", "paym", "zh", "family", "zp", "qi"] as const;
const MORNING_ROLLOVER_PRESENT_KEYS = [
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
const MORNING_ROLLOVER_ZERO_KEYS = [
  "admittedTotal",
  "admittedSoldier",
  "admittedSeries",
  "dgTotal",
  "dgSoldier",
  "dgSeries",
  "transferFromDepartment",
  "transferToDepartment"
] as const;
const MORNING_ROLLOVER_META_KEY = "main_morning_rollover";
const QH_CALC_DEPARTMENT_IDS = new Set(["r19", "r20", "r21"]);
const NIGHT_SHIFT_ROW_PREFIX = "night:";
const NIGHT_SHIFT_META_KEY = "night_shift";
const DAY_SHIFT_ROW_PREFIX = "day:";
const DAY_SHIFT_META_KEY = "day_shift";
const DISCHARGE_SHIFT_ROW_PREFIX = "discharge:";
const DISCHARGE_SHIFT_META_KEY = "discharge_shift";
const CIVIL_REFERRAL_ROW_PREFIX = "civil-referral:";
const CIVIL_REFERRAL_GROUP = "civil_referral";
const CIVIL_REFERRAL_DEFAULT_LIMIT = 80;
const CIVIL_REFERRAL_MAX_LIMIT = 1000;
const CIVIL_REFERRAL_DAY_MS = 24 * 60 * 60 * 1000;
const ARMENIA_UTC_OFFSET_MS = 4 * 60 * 60 * 1000;
const CIVIL_REFERRAL_VALUE_KEYS = [
  "patientName",
  "medicalCenter",
  "militaryUnit",
  "rank",
  "draftYear",
  "birthYear",
  "referralDate",
  "dischargeDate"
] as const;
const CIVIL_REFERRAL_HASH_KEYS = CIVIL_REFERRAL_VALUE_KEYS.filter((key) => key !== "dischargeDate");
const MAIN_ARCHIVE_SOURCE = "remote";

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
  { cell: 12, key: "presentTotal", label: "present calculated/control total; display only, never currentShar" },
  { cell: 13, key: "currentShar", label: "present / shar / first soldier column" },
  { cell: 14, key: "currentSpa", label: "present / spa / second soldier column" },
  { cell: 15, key: "currentPaym", label: "present / paym / third soldier column" },
  { cell: 16, key: "currentZh", label: "present / zh / single column immediately after the three soldier columns" },
  { cell: 17, key: "family", label: "present / zts-ent / single column immediately after currentZh" },
  { cell: 18, key: "officer", label: "present / z-p / single column immediately after family" },
  { cell: 19, key: "civil", label: "present / q-i / single column immediately after officer" },
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

const PHOTO_CELL_REVIEW_KEYS = PHOTO_FIELD_MAPPINGS
  .filter((item) => item.key !== "presentTotal")
  .map((item) => item.key);

const PHOTO_CELL_REVIEW_CELL_MAP = Object.fromEntries(
  PHOTO_FIELD_MAPPINGS
    .filter((item) => item.key !== "presentTotal")
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

function formatMainArchiveLabel(archiveKey: string) {
  const normalized = String(archiveKey || "").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return normalized;
  }
  return `${match[3]}.${match[2]}.${match[1]}`;
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

function safeNumber(value: unknown) {
  return sanitizeNumber(value) || 0;
}

function sanitizeNightShiftRows(rows: unknown) {
  const sourceRows = rows && typeof rows === "object"
    ? rows as Record<string, Record<string, unknown>>
    : {};
  return Object.fromEntries(Object.keys(DEPARTMENTS).map((departmentId) => {
    const source = sourceRows[departmentId] && typeof sourceRows[departmentId] === "object"
      ? sourceRows[departmentId]
      : {};
    return [
      departmentId,
      Object.fromEntries(NIGHT_SHIFT_VALUE_KEYS.map((key) => [key, safeNumber(source[key])]))
    ];
  })) as Record<string, Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number>>;
}

function getNightShiftRowId(departmentId: string) {
  return `${NIGHT_SHIFT_ROW_PREFIX}${departmentId}`;
}

function getDayShiftRowId(departmentId: string) {
  return `${DAY_SHIFT_ROW_PREFIX}${departmentId}`;
}

function getDischargeShiftRowId(departmentId: string) {
  return `${DISCHARGE_SHIFT_ROW_PREFIX}${departmentId}`;
}

function normalizeCivilReferralText(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function normalizeCivilReferralDateText(value: unknown) {
  const text = normalizeCivilReferralText(value)
    .replace(/[^\d.,/-]/g, "")
    .replace(/[,\-\/]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\./, "")
    .slice(0, 10);
  const compact = text.replace(/\D/g, "");
  const compactMatch = compact.length === 6
    ? compact.match(/^(\d{2})(\d{2})(\d{2})$/)
    : compact.length === 8
      ? compact.match(/^(\d{2})(\d{2})(\d{4})$/)
      : null;
  const match = compactMatch || text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!match) {
    return "";
  }
  const dayNumber = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (dayNumber < 1 || dayNumber > 31 || monthNumber < 1 || monthNumber > 12) {
    return "";
  }
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3].length === 4 ? match[3].slice(-2) : match[3].padStart(2, "0");
  return `${day}.${month}.${year}`;
}

function sanitizeCivilReferralListOptions(source: Record<string, unknown> = {}) {
  const limit = Math.min(
    CIVIL_REFERRAL_MAX_LIMIT,
    Math.max(1, Math.trunc(Number(source.limit) || CIVIL_REFERRAL_DEFAULT_LIMIT))
  );
  const offset = Math.max(0, Math.trunc(Number(source.offset) || 0));
  const query = normalizeCivilReferralText(source.query)
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 120);
  return { limit, offset, query };
}

function buildCivilReferralIlikePattern(query: string) {
  return `%${query.replace(/[%_]/g, "")}%`;
}

function buildCivilReferralSearchFilter(pattern: string) {
  return [
    `department_name.ilike.${pattern}`,
    `values->>patientName.ilike.${pattern}`,
    `values->>medicalCenter.ilike.${pattern}`,
    `values->>militaryUnit.ilike.${pattern}`,
    `values->>rank.ilike.${pattern}`,
    `values->>draftYear.ilike.${pattern}`,
    `values->>birthYear.ilike.${pattern}`,
    `values->>referralDate.ilike.${pattern}`,
    `values->>dischargeDate.ilike.${pattern}`,
    `values->>sourceFileName.ilike.${pattern}`
  ].join(",");
}

type CivilReferralSmartQuery =
  | { srMarker: string; mode: "sr" }
  | { srMarker: string; mode: "range"; days: number; dateField: "referralDate" | "dischargeDate" }
  | { srMarker: string; mode: "date"; date: string; dateField: "referralDate" | "dischargeDate" };

function normalizeCivilReferralSearchText(value: unknown) {
  return normalizeCivilReferralText(value).toLocaleLowerCase("hy-AM");
}

function normalizeCivilReferralCompactSearchText(value: unknown) {
  return normalizeCivilReferralSearchText(value).replace(/\s+/g, "");
}

function normalizeCivilReferralSmartQueryText(value: unknown) {
  return normalizeCivilReferralText(value)
    .replace(/[\s\u00a0]+/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-");
}

function parseCivilReferralSmartQuery(query: string): CivilReferralSmartQuery | null {
  const compact = normalizeCivilReferralSmartQueryText(query);
  const match = compact.match(/^SR[-_]?(\d{1,2})(?:-(out)-(.+)|-(.+))?$/i);
  if (!match) {
    return null;
  }

  const srMarker = `SR-${Number(match[1])}`;
  const isDischarge = Boolean(match[2]);
  const suffix = match[3] || match[4] || "";
  if (!suffix) {
    return { srMarker, mode: "sr" };
  }

  if (/^\d{1,4}$/.test(suffix)) {
    const days = Number(suffix);
    if (days >= 1 && days <= 3650) {
      return {
        srMarker,
        mode: "range",
        days,
        dateField: isDischarge ? "dischargeDate" : "referralDate"
      };
    }
  }

  const date = normalizeCivilReferralDateText(suffix);
  if (date) {
    return {
      srMarker,
      mode: "date",
      date,
      dateField: isDischarge ? "dischargeDate" : "referralDate"
    };
  }

  return null;
}

function normalizeCivilReferralSrText(value: unknown) {
  return normalizeCivilReferralSearchText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function rowMatchesCivilReferralSr(row: Record<string, unknown>, srMarker: string) {
  const marker = normalizeCivilReferralSrText(srMarker);
  if (!marker) {
    return true;
  }
  if (marker === "SR21") {
    return true;
  }
  return [
    row.sourceFileName,
    row.departmentId,
    row.departmentName,
    row.source,
    row.fileName
  ].some((value) => normalizeCivilReferralSrText(value).includes(marker));
}

function getCivilReferralTodayTime() {
  const armeniaNow = new Date(Date.now() + ARMENIA_UTC_OFFSET_MS);
  return Date.UTC(
    armeniaNow.getUTCFullYear(),
    armeniaNow.getUTCMonth(),
    armeniaNow.getUTCDate()
  );
}

function rowMatchesCivilReferralSmartQuery(row: Record<string, unknown>, smartQuery: CivilReferralSmartQuery) {
  if (!rowMatchesCivilReferralSr(row, smartQuery.srMarker)) {
    return false;
  }
  if (smartQuery.mode === "sr") {
    return true;
  }
  const dateValue = getCivilReferralDateSortValue(row[smartQuery.dateField]);
  if (!dateValue) {
    return false;
  }
  if (smartQuery.mode === "date") {
    return normalizeCivilReferralDateText(row[smartQuery.dateField]) === smartQuery.date;
  }
  const end = getCivilReferralTodayTime();
  const start = end - (smartQuery.days - 1) * CIVIL_REFERRAL_DAY_MS;
  return dateValue >= start && dateValue <= end;
}

function filterCivilReferralRows(rows: Array<Record<string, unknown>>, query: string) {
  const smartQuery = parseCivilReferralSmartQuery(query);
  if (smartQuery) {
    return rows.filter((row) => rowMatchesCivilReferralSmartQuery(row, smartQuery));
  }

  const normalizedQuery = normalizeCivilReferralSearchText(query);
  const compactQuery = normalizeCivilReferralCompactSearchText(query);
  if (!normalizedQuery) {
    return rows;
  }

  const fields = [...CIVIL_REFERRAL_VALUE_KEYS, "sourceFileName"];
  return rows.filter((row) => fields.some((key) => {
    const value = row[String(key)];
    return normalizeCivilReferralSearchText(value).includes(normalizedQuery)
      || normalizeCivilReferralCompactSearchText(value).includes(compactQuery);
  }));
}

const CIVIL_ARMENIAN_WORD_RE = /^[\u0531-\u0587]+$/;

function normalizeCivilReferralNameText(value: unknown, options: { medicalCenter?: boolean } = {}) {
  const tokens = normalizeCivilReferralText(value).split(" ").filter(Boolean);
  const merged: string[] = [];

  tokens.forEach((token) => {
    const previous = merged[merged.length - 1];
    const shouldMerge = options.medicalCenter
      ? (previous?.length ?? 0) <= 3 && token.length <= 3 && token !== "\u0532\u053F"
      : (previous?.length ?? 0) <= 2 || token.length <= 2;
    if (
      previous
      && CIVIL_ARMENIAN_WORD_RE.test(previous)
      && CIVIL_ARMENIAN_WORD_RE.test(token)
      && shouldMerge
    ) {
      merged[merged.length - 1] = `${previous}${token}`;
    } else {
      merged.push(token);
    }
  });

  return merged.join(" ");
}

function stableCivilReferralHash(record: Record<string, unknown>) {
  const source = CIVIL_REFERRAL_HASH_KEYS
    .map((key) => normalizeCivilReferralText(record[key]).toLowerCase())
    .join("|");
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

function sanitizeCivilReferralRecord(record: unknown, sourceFileName = "") {
  const source = record && typeof record === "object" ? record as Record<string, unknown> : {};
  const output: Record<string, string | number | null> = {};
  CIVIL_REFERRAL_VALUE_KEYS.forEach((key) => {
    output[key] = key === "patientName"
      ? normalizeCivilReferralNameText(source[key])
      : key === "medicalCenter"
        ? normalizeCivilReferralNameText(source[key], { medicalCenter: true })
        : key === "referralDate" || key === "dischargeDate"
          ? normalizeCivilReferralDateText(source[key])
          : normalizeCivilReferralText(source[key]);
  });
  output.sourceFileName = normalizeCivilReferralText(source.sourceFileName || sourceFileName);
  output.sourceRow = Number.isFinite(Number(source.sourceRow)) ? Math.max(0, Math.trunc(Number(source.sourceRow))) : null;
  output.id = normalizeCivilReferralText(source.id) || stableCivilReferralHash(output);
  output.importedAt = normalizeCivilReferralText(source.importedAt);
  output.updatedAt = normalizeCivilReferralText(source.updatedAt);
  return output;
}

function sanitizeCivilReferralRows(rows: unknown, sourceFileName = "") {
  if (!Array.isArray(rows)) {
    return [];
  }

  const byId = new Map<string, Record<string, string | number | null>>();
  rows
    .map((row) => sanitizeCivilReferralRecord(row, sourceFileName))
    .filter((row) => row.patientName && row.medicalCenter)
    .forEach((row) => {
      const id = String(row.id || "");
      if (id && !byId.has(id)) {
        byId.set(id, row);
      }
    });
  return [...byId.values()];
}

function sanitizeCivilReferralIds(ids: unknown) {
  if (!Array.isArray(ids)) {
    return [];
  }
  return [...new Set(ids.map((id) => normalizeCivilReferralText(id)).filter(Boolean))];
}

function getCivilReferralDateSortValue(value: unknown) {
  const text = normalizeCivilReferralDateText(value);
  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!match) {
    return 0;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = 2000 + Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  return Number.isFinite(time) ? time : 0;
}

function getCivilReferralRowSortValue(row: Record<string, unknown>) {
  const referralTime = getCivilReferralDateSortValue(row.referralDate);
  if (referralTime) {
    return referralTime;
  }
  const updatedTime = Date.parse(String(row.updatedAt || row.importedAt || ""));
  return Number.isFinite(updatedTime) ? updatedTime : 0;
}

function sortCivilReferralRows(rows: Array<Record<string, unknown>>) {
  return [...rows].sort((a, b) => {
    const byDate = getCivilReferralRowSortValue(b) - getCivilReferralRowSortValue(a);
    if (byDate) {
      return byDate;
    }
    return normalizeCivilReferralText(a.patientName).localeCompare(normalizeCivilReferralText(b.patientName), "hy-AM");
  });
}

function getServerErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === "object") {
    const source = error as Record<string, unknown>;
    for (const key of ["message", "details", "hint", "code"]) {
      if (typeof source[key] === "string" && source[key].trim()) {
        return source[key].trim();
      }
    }
    try {
      const serialized = JSON.stringify(source);
      if (serialized && serialized !== "{}") {
        return serialized.slice(0, 500);
      }
    } catch (_jsonError) {
    }
  }
  return "Unexpected server error.";
}

function addValue(values: Record<string, number | null>, key: string, amount: number) {
  values[key] = safeNumber(values[key]) + safeNumber(amount);
}

function applyNightShiftValues(
  departmentId: string,
  values: Record<string, unknown> | null | undefined,
  nightRow: Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number> | undefined
) {
  const n1 = safeNumber(nightRow?.shar);
  const n2 = safeNumber(nightRow?.spa);
  const n3 = safeNumber(nightRow?.paym);
  const n4 = safeNumber(nightRow?.zh);
  const n5 = safeNumber(nightRow?.family);
  const n6 = safeNumber(nightRow?.zp);
  const n7 = safeNumber(nightRow?.qi);
  // Night/day shift rows describe newly admitted patients by category,
  // so they must be added to both admission totals and current presence.
  const nightTotal = n1 + n2 + n3 + n4 + n5 + n6 + n7;
  const hasAnyNightValue = n1 + n2 + n3 + n4 + n5 + n6 + n7;

  if (!hasAnyNightValue) {
    return null;
  }

  const output = sanitizeValues(values);
  addValue(output, "admittedSeries", n1);
  if (QH_CALC_DEPARTMENT_IDS.has(departmentId)) {
    addValue(output, "qhIncomingSoldier", n1);
    addValue(output, "qhIncomingOfficer", n2);
    addValue(output, "qhIncomingContract", n3);
    syncQhMorningCalculatedValues(departmentId, output);
  } else {
    addValue(output, "currentShar", n1);
    addValue(output, "currentSpa", n2);
    addValue(output, "currentPaym", n3);
  }
  addValue(output, "currentZh", n4);
  addValue(output, "family", n5);
  addValue(output, "officer", n6);
  addValue(output, "civil", n7);
  addValue(output, "admittedTotal", nightTotal);
  addValue(output, "admittedSoldier", n1 + n2 + n3);
  return output;
}

function applyDayShiftValues(
  departmentId: string,
  values: Record<string, unknown> | null | undefined,
  dayRow: Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number> | undefined
) {
  // Day-shift admissions currently follow the same transfer formula as night shift.
  return applyNightShiftValues(departmentId, values, dayRow);
}

function primeQhMorningBaseValues(values: Record<string, number | null>) {
  const hasBaseValues =
    safeNumber(values.qhBaseSoldier) !== 0
    || safeNumber(values.qhBaseOfficer) !== 0
    || safeNumber(values.qhBaseContract) !== 0;
  const hasCurrentValues =
    safeNumber(values.currentShar) !== 0
    || safeNumber(values.currentSpa) !== 0
    || safeNumber(values.currentPaym) !== 0;

  if (!hasBaseValues && hasCurrentValues) {
    values.qhBaseSoldier = safeNumber(values.currentShar);
    values.qhBaseOfficer = safeNumber(values.currentSpa);
    values.qhBaseContract = safeNumber(values.currentPaym);
  }
}

function syncQhMorningCalculatedValues(departmentId: string, values: Record<string, number | null>) {
  if (!QH_CALC_DEPARTMENT_IDS.has(departmentId)) {
    return;
  }

  primeQhMorningBaseValues(values);
  values.currentShar = safeNumber(values.qhBaseSoldier)
    + safeNumber(values.qhIncomingSoldier)
    - safeNumber(values.qhDischargedSoldier);
  values.currentSpa = safeNumber(values.qhBaseOfficer)
    + safeNumber(values.qhIncomingOfficer)
    - safeNumber(values.qhDischargedOfficer);
  values.currentPaym = safeNumber(values.qhBaseContract)
    + safeNumber(values.qhIncomingContract)
    - safeNumber(values.qhDischargedContract);
}

function applyMorningRolloverValues(
  departmentId: string,
  values: Record<string, unknown> | null | undefined
) {
  const output = sanitizeValues(values);
  syncQhMorningCalculatedValues(departmentId, output);

  const currentShar = safeNumber(output.currentShar);
  const currentSpa = safeNumber(output.currentSpa);
  const currentPaym = safeNumber(output.currentPaym);
  const leaveSharq = safeNumber(output.leaveSharq);
  const leaveSpa = safeNumber(output.leaveSpa);
  const leavePaym = safeNumber(output.leavePaym);
  const presentTotal = MORNING_ROLLOVER_PRESENT_KEYS
    .reduce((sum, key) => sum + safeNumber(output[key]), 0);

  output.beenTotal = presentTotal;
  output.beenSoldier = currentShar + currentSpa + currentPaym + leaveSharq + leaveSpa + leavePaym;
  output.beenSeries = currentShar + leaveSharq;
  MORNING_ROLLOVER_ZERO_KEYS.forEach((key) => {
    output[key] = 0;
  });

  return output;
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

function sanitizePhotoValues(values: Record<string, unknown> | null | undefined) {
  const output = sanitizeValues(values);
  output.presentTotal = sanitizeNumber(values ? values.presentTotal : null);
  return output;
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
    if (!PHOTO_CELL_REVIEW_KEYS.includes(key as (typeof PHOTO_CELL_REVIEW_KEYS)[number])) {
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
    .filter((item): item is string => typeof item === "string" && PHOTO_FEEDBACK_VALUE_KEYS.has(item))
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeFeedbackNotes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
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
    ocrRaw: sanitizePhotoValues(payload.recognizedValues as Record<string, unknown> | undefined),
    finalValues: sanitizePhotoValues(payload.finalValues as Record<string, unknown> | undefined),
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
  const happenedAt = normalizeTelegramText(details?.happenedAt) || new Date().toISOString();

  const lines = [
    "Mainflow: site login",
    email ? `Email: ${email}` : "",
    pageTitle ? `Page: ${pageTitle}` : "",
    `Time: ${happenedAt}`
  ].filter(Boolean);

  for (const chatId of chatIds) {
    await sendTelegramMessage(chatId, lines.join("\n"));
  }

  return { ok: true, sent: chatIds.length };
}

function getMainflowTelegramFunctionUrl() {
  const explicit = (Deno.env.get("MAINFLOW_TELEGRAM_FUNCTION_URL") || "").trim();
  if (explicit) {
    return explicit;
  }

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not configured on the server.");
  }

  const host = new URL(supabaseUrl).hostname;
  const projectRef = host.split(".")[0];
  if (!projectRef) {
    throw new Error("Cannot resolve Supabase project ref for Telegram function.");
  }

  return `https://${projectRef}.functions.supabase.co/Mainflow-telegram`;
}

async function sendMainPdfsToTelegramFromSync() {
  const url = new URL(getMainflowTelegramFunctionUrl());
  url.searchParams.set("action", "send-main-pdfs");
  url.searchParams.set("force", "1");
  url.searchParams.set("source", "manual");

  const secret = (Deno.env.get("TELEGRAM_REMINDER_SECRET") || "").trim();
  const headers: Record<string, string> = {};
  if (secret) {
    headers["x-telegram-reminder-secret"] = secret;
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload && typeof payload.error === "string"
      ? payload.error
      : `Telegram PDF send failed (${response.status}).`;
    throw new Error(message);
  }

  return payload || { ok: true };
}

function normalizeShiftFormMode(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "day" || normalized === "day_shift") {
    return "day";
  }
  if (normalized === "discharge" || normalized === "morning" || normalized === "morning_discharge") {
    return "discharge";
  }
  return "night";
}

async function sendShiftFormToTelegramFromSync(mode: unknown) {
  const url = new URL(getMainflowTelegramFunctionUrl());
  url.searchParams.set("action", "send-shift-form");
  url.searchParams.set("mode", normalizeShiftFormMode(mode));

  const secret = (Deno.env.get("TELEGRAM_REMINDER_SECRET") || "").trim();
  const headers: Record<string, string> = {};
  if (secret) {
    headers["x-telegram-reminder-secret"] = secret;
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload && typeof payload.error === "string"
      ? payload.error
      : `Telegram form send failed (${response.status}).`;
    throw new Error(message);
  }

  return payload || { ok: true };
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
    required: ["reportDate", "values", "rightCellValues", "notes", "cellReviews", "structure"]
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
    .map((item) => `- cell ${item.cell}: ${item.key} (${item.label})`)
    .join("\n");

  const prompt = [
    "You extract handwritten numeric values from a standardized Armenian hospital department form.",
    `Department id: ${departmentId}. Department name: ${departmentMeta.department}.`,
    "The department is already fixed by the current page.",
    "You will receive images in this order: first a blank template reference of the same form, second the filled top-table crop, optionally one extra zoomed crop of the right-hand part of the same table, and optionally eleven single-cell crops for cells 12 through 22.",
    "Use the blank template image only to align the printed grid and cell borders. Extract handwritten values only from the filled form image.",
    "If an extra zoomed right-side crop is present, use it to resolve cells 12 through 22 more accurately than the wider crop.",
    "The extra zoomed crop and the single-cell crops may be geometrically aligned versions of the same table. Prefer them over the wider crop for exact cell borders.",
    "If eleven single-cell crops are present after the right-side zoom crop, they correspond exactly in this visual order: cell 12, cell 13, cell 14, cell 15, cell 16, cell 17, cell 18, cell 19, cell 20, cell 21, cell 22.",
    "When the single-cell crops are present, use them as the primary source for rightCellValues and use the larger crops only as context.",
    "Do not determine or change the department from SR markers, headers, or any other text in the image.",
    "If the photo is missing SR markers or the printed title is unclear, continue extracting values for the given department anyway.",
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
    "If the photo clearly shows a handwritten value under the single column between the three soldier columns and the family column, that value belongs to currentZh.",
    "The top table also contains derived totals. Do not return those derived totals unless they correspond to one of the listed fields above.",
    "Return reportDate in dd.mm.yy or dd.mm.yyyy when visible, otherwise null.",
    "Return cellReviews only for cells where you see handwritten content in the top numeric table.",
    "For cellReviews use status recognized when the handwritten value is read confidently, and status review when the cell has handwriting but the read is uncertain or may be wrong.",
    "For each cellReviews item return approximate bounding box coordinates relative to the full image: left, top, width, height in a 0..1000 scale.",
    "Do not add blank cells to cellReviews.",
    "Return the handwritten value in visual cell 12 as rightCellValues[0] when it is visibly written in the filled form.",
    "Do not calculate visual cell 12 from any other cells. Return only the raw handwritten value you see in visual cell 12.",
    "Do not include cell 12 in cellReviews.",
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
      .filter(([_key, value]) => value !== null)
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

function buildDepartmentFeedbackSourceMap(feedbackRows: Array<Record<string, unknown>>) {
  const feedbackMap = new Map<string, {
    hasTelegramFormFeedback: boolean;
    hasPhotoFeedback: boolean;
    latestFeedbackId: number | null;
    latestTelegramFormFeedbackId: number | null;
  }>();

  feedbackRows.forEach((row) => {
    const departmentId = typeof row.department_id === "string" ? row.department_id : "";
    if (!departmentId) {
      return;
    }

    const entry = feedbackMap.get(departmentId) || {
      hasTelegramFormFeedback: false,
      hasPhotoFeedback: false,
      latestFeedbackId: null,
      latestTelegramFormFeedbackId: null
    };
    const imageName = typeof row.image_name === "string" ? row.image_name : "";
    if (entry.latestFeedbackId === null && typeof row.id === "number") {
      entry.latestFeedbackId = row.id;
    }

    if (imageName === "telegram-web-app-form") {
      entry.hasTelegramFormFeedback = true;
      if (entry.latestTelegramFormFeedbackId === null && typeof row.id === "number") {
        entry.latestTelegramFormFeedbackId = row.id;
      }
    } else {
      entry.hasPhotoFeedback = true;
    }

    feedbackMap.set(departmentId, entry);
  });

  return feedbackMap;
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

  const reportDate = metaRow?.report_date || DEFAULT_DATE;
  const { data: feedbackRows, error: feedbackError } = await (supabase as any)
    .from("sharsh_ocr_feedback")
    .select("id, department_id, image_name, created_at")
    .eq("report_date", reportDate)
    .order("created_at", { ascending: false });

  if (feedbackError) {
    throw feedbackError;
  }

  const feedbackMap = buildDepartmentFeedbackSourceMap(
    Array.isArray(feedbackRows) ? feedbackRows as Array<Record<string, unknown>> : []
  );
  const map = new Map((departmentRows || []).map((row) => [row.department_id, row]));

  return {
    reportDate,
    updatedAt: metaRow?.updated_at || new Date().toISOString(),
    rows: Object.entries(DEPARTMENTS).map(([id]) => {
      const saved = map.get(id);
      const feedback = feedbackMap.get(id);
      return {
        id,
        values: sanitizeValues(saved?.values as Record<string, unknown> | undefined),
        updatedAt: saved?.updated_at || null,
        photoWorkflowStatus: typeof saved?.photo_workflow_status === "string" ? saved.photo_workflow_status : "idle",
        photoFeedbackId: typeof saved?.photo_feedback_id === "number" ? saved.photo_feedback_id : null,
        latestFeedbackId: typeof feedback?.latestFeedbackId === "number" ? feedback.latestFeedbackId : null,
        latestTelegramFormFeedbackId: typeof feedback?.latestTelegramFormFeedbackId === "number" ? feedback.latestTelegramFormFeedbackId : null,
        photoFeedbackUpdatedAt: saved?.photo_feedback_updated_at || null,
        photoName: typeof saved?.photo_name === "string" ? saved.photo_name : "",
        lastUpdateSource: typeof saved?.photo_workflow_status === "string" ? saved.photo_workflow_status : "",
        hasTelegramFormFeedback: Boolean(feedback?.hasTelegramFormFeedback),
        hasPhotoFeedback: Boolean(feedback?.hasPhotoFeedback)
      };
    })
  };
}

function buildSnapshotFromArchivePayload(snapshot: Record<string, unknown> | null | undefined) {
  const normalized = snapshot && typeof snapshot === "object" ? snapshot : {};
  const rows = Array.isArray(normalized.rows) ? normalized.rows : [];
  const rowMap = new Map(rows
    .filter((row) => row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string")
    .map((row) => [String((row as { id: string }).id), row as Record<string, unknown>]));

  return {
    reportDate: typeof normalized.reportDate === "string" && normalized.reportDate.trim()
      ? normalized.reportDate.trim()
      : DEFAULT_DATE,
    updatedAt: typeof normalized.updatedAt === "string" && normalized.updatedAt.trim()
      ? normalized.updatedAt
      : new Date().toISOString(),
    rows: Object.entries(DEPARTMENTS).map(([id]) => {
      const saved = rowMap.get(id);
      return {
        id,
        values: sanitizeValues(saved?.values as Record<string, unknown> | undefined),
        updatedAt: typeof saved?.updatedAt === "string" ? saved.updatedAt : null,
        photoWorkflowStatus: typeof saved?.photoWorkflowStatus === "string" ? saved.photoWorkflowStatus : "idle",
        photoFeedbackId: typeof saved?.photoFeedbackId === "number" ? saved.photoFeedbackId : null,
        latestFeedbackId: typeof saved?.latestFeedbackId === "number" ? saved.latestFeedbackId : null,
        latestTelegramFormFeedbackId: typeof saved?.latestTelegramFormFeedbackId === "number" ? saved.latestTelegramFormFeedbackId : null,
        photoFeedbackUpdatedAt: typeof saved?.photoFeedbackUpdatedAt === "string" ? saved.photoFeedbackUpdatedAt : null,
        photoName: typeof saved?.photoName === "string" ? saved.photoName : "",
        lastUpdateSource: typeof (saved?.lastUpdateSource || saved?.photoWorkflowStatus) === "string"
          ? String(saved.lastUpdateSource || saved.photoWorkflowStatus)
          : "",
        hasTelegramFormFeedback: Boolean(saved?.hasTelegramFormFeedback),
        hasPhotoFeedback: Boolean(saved?.hasPhotoFeedback)
      };
    })
  };
}

function normalizeMainArchiveRecord(row: Record<string, unknown> | null | undefined) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const archiveKey = typeof row.archive_key === "string" ? row.archive_key.trim() : "";
  if (!archiveKey) {
    return null;
  }

  return {
    archiveKey,
    archiveLabel: typeof row.archive_label === "string" && row.archive_label.trim()
      ? row.archive_label.trim()
      : formatMainArchiveLabel(archiveKey),
    capturedAt: typeof row.captured_at === "string" && row.captured_at.trim()
      ? row.captured_at
      : new Date().toISOString(),
    reportDate: typeof row.report_date === "string" && row.report_date.trim()
      ? row.report_date.trim()
      : DEFAULT_DATE,
    source: typeof row.source === "string" && row.source.trim()
      ? row.source.trim()
      : MAIN_ARCHIVE_SOURCE,
    snapshot: buildSnapshotFromArchivePayload(row.snapshot as Record<string, unknown> | null | undefined)
  };
}

async function loadMainArchiveRecord(
  supabase: ReturnType<typeof createClient>,
  archiveKey: string
) {
  const { data, error } = await supabase
    .from("sharsh_main_archives")
    .select("archive_key, archive_label, captured_at, report_date, source, snapshot")
    .eq("archive_key", archiveKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeMainArchiveRecord(data as Record<string, unknown> | null | undefined);
}

async function saveMainArchiveRecord(
  supabase: ReturnType<typeof createClient>,
  archiveKey: string,
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>
) {
  const now = new Date().toISOString();
  const row = {
    archive_key: archiveKey,
    archive_label: formatMainArchiveLabel(archiveKey),
    captured_at: now,
    report_date: snapshot.reportDate || DEFAULT_DATE,
    source: MAIN_ARCHIVE_SOURCE,
    snapshot,
    updated_at: now
  };

  const { error } = await supabase
    .from("sharsh_main_archives")
    .upsert([row]);

  if (error) {
    throw error;
  }

  return normalizeMainArchiveRecord(row);
}

async function loadNightShiftDraft(supabase: ReturnType<typeof createClient>) {
  const rowIds = Object.keys(DEPARTMENTS).map(getNightShiftRowId);
  const { data: nightRows, error: rowsError } = await supabase
    .from("sharsh_departments")
    .select("department_id, values, updated_at")
    .in("department_id", rowIds);

  if (rowsError) {
    throw rowsError;
  }

  const { data: metaRow, error: metaError } = await supabase
    .from("sharsh_report_meta")
    .select("report_date, updated_at")
    .eq("report_key", NIGHT_SHIFT_META_KEY)
    .maybeSingle();

  if (metaError) {
    throw metaError;
  }

  const map = new Map((nightRows || []).map((row) => [row.department_id, row]));
  const rows = Object.fromEntries(Object.keys(DEPARTMENTS).map((departmentId) => {
    const saved = map.get(getNightShiftRowId(departmentId));
    return [departmentId, sanitizeNightShiftRows({ [departmentId]: saved?.values })[departmentId]];
  }));

  return {
    reportDateTime: metaRow?.report_date || DEFAULT_DATE,
    savedAt: metaRow?.updated_at || null,
    rows
  };
}

async function saveNightShiftDraft(
  supabase: ReturnType<typeof createClient>,
  rows: unknown,
  reportDateTime: string
) {
  const nightRows = sanitizeNightShiftRows(rows);
  const now = new Date().toISOString();
  const updates = Object.entries(DEPARTMENTS).map(([departmentId, meta]) => ({
    department_id: getNightShiftRowId(departmentId),
    department_name: meta.department,
    department_group: "night_shift",
    values: nightRows[departmentId],
    updated_at: now
  }));

  const { error: rowsError } = await supabase
    .from("sharsh_departments")
    .upsert(updates);

  if (rowsError) {
    throw rowsError;
  }

  const { error: metaError } = await supabase
    .from("sharsh_report_meta")
    .upsert({
      report_key: NIGHT_SHIFT_META_KEY,
      report_date: reportDateTime || DEFAULT_DATE,
      updated_at: now
    });

  if (metaError) {
    throw metaError;
  }

  return await loadNightShiftDraft(supabase);
}

async function clearNightShiftDraft(
  supabase: ReturnType<typeof createClient>,
  reportDateTime: string
) {
  return await saveNightShiftDraft(supabase, {}, reportDateTime);
}

async function loadDayShiftDraft(supabase: ReturnType<typeof createClient>) {
  const rowIds = Object.keys(DEPARTMENTS).map(getDayShiftRowId);
  const { data: dayRows, error: rowsError } = await supabase
    .from("sharsh_departments")
    .select("department_id, values, updated_at")
    .in("department_id", rowIds);

  if (rowsError) {
    throw rowsError;
  }

  const { data: metaRow, error: metaError } = await supabase
    .from("sharsh_report_meta")
    .select("report_date, updated_at")
    .eq("report_key", DAY_SHIFT_META_KEY)
    .maybeSingle();

  if (metaError) {
    throw metaError;
  }

  const map = new Map((dayRows || []).map((row) => [row.department_id, row]));
  const rows = Object.fromEntries(Object.keys(DEPARTMENTS).map((departmentId) => {
    const saved = map.get(getDayShiftRowId(departmentId));
    return [departmentId, sanitizeNightShiftRows({ [departmentId]: saved?.values })[departmentId]];
  }));

  return {
    reportDateTime: metaRow?.report_date || DEFAULT_DATE,
    savedAt: metaRow?.updated_at || null,
    rows
  };
}

async function saveDayShiftDraft(
  supabase: ReturnType<typeof createClient>,
  rows: unknown,
  reportDateTime: string
) {
  const dayRows = sanitizeNightShiftRows(rows);
  const now = new Date().toISOString();
  const updates = Object.entries(DEPARTMENTS).map(([departmentId, meta]) => ({
    department_id: getDayShiftRowId(departmentId),
    department_name: meta.department,
    department_group: "day_shift",
    values: dayRows[departmentId],
    updated_at: now
  }));

  const { error: rowsError } = await supabase
    .from("sharsh_departments")
    .upsert(updates);

  if (rowsError) {
    throw rowsError;
  }

  const { error: metaError } = await supabase
    .from("sharsh_report_meta")
    .upsert({
      report_key: DAY_SHIFT_META_KEY,
      report_date: reportDateTime || DEFAULT_DATE,
      updated_at: now
    });

  if (metaError) {
    throw metaError;
  }

  return await loadDayShiftDraft(supabase);
}

async function clearDayShiftDraft(
  supabase: ReturnType<typeof createClient>,
  reportDateTime: string
) {
  return await saveDayShiftDraft(supabase, {}, reportDateTime);
}

async function loadDischargeShiftDraft(supabase: ReturnType<typeof createClient>) {
  const rowIds = Object.keys(DEPARTMENTS).map(getDischargeShiftRowId);
  const { data: dischargeRows, error: rowsError } = await supabase
    .from("sharsh_departments")
    .select("department_id, values, updated_at")
    .in("department_id", rowIds);

  if (rowsError) {
    throw rowsError;
  }

  const { data: metaRow, error: metaError } = await supabase
    .from("sharsh_report_meta")
    .select("report_date, updated_at")
    .eq("report_key", DISCHARGE_SHIFT_META_KEY)
    .maybeSingle();

  if (metaError) {
    throw metaError;
  }

  const map = new Map((dischargeRows || []).map((row) => [row.department_id, row]));
  const rows = Object.fromEntries(Object.keys(DEPARTMENTS).map((departmentId) => {
    const saved = map.get(getDischargeShiftRowId(departmentId));
    return [departmentId, sanitizeNightShiftRows({ [departmentId]: saved?.values })[departmentId]];
  }));

  return {
    reportDateTime: metaRow?.report_date || DEFAULT_DATE,
    savedAt: metaRow?.updated_at || null,
    rows
  };
}

async function saveDischargeShiftDraft(
  supabase: ReturnType<typeof createClient>,
  rows: unknown,
  reportDateTime: string
) {
  const dischargeRows = sanitizeNightShiftRows(rows);
  const now = new Date().toISOString();
  const updates = Object.entries(DEPARTMENTS).map(([departmentId, meta]) => ({
    department_id: getDischargeShiftRowId(departmentId),
    department_name: meta.department,
    department_group: "discharge_shift",
    values: dischargeRows[departmentId],
    updated_at: now
  }));

  const { error: rowsError } = await supabase
    .from("sharsh_departments")
    .upsert(updates);

  if (rowsError) {
    throw rowsError;
  }

  const { error: metaError } = await supabase
    .from("sharsh_report_meta")
    .upsert({
      report_key: DISCHARGE_SHIFT_META_KEY,
      report_date: reportDateTime || DEFAULT_DATE,
      updated_at: now
    });

  if (metaError) {
    throw metaError;
  }

  return await loadDischargeShiftDraft(supabase);
}

async function clearDischargeShiftDraft(
  supabase: ReturnType<typeof createClient>,
  reportDateTime: string
) {
  return await saveDischargeShiftDraft(supabase, {}, reportDateTime);
}

async function listCivilReferrals(
  supabase: ReturnType<typeof createClient>,
  options: Record<string, unknown> = {}
) {
  const { limit, offset, query } = sanitizeCivilReferralListOptions(options);
  const smartQuery = parseCivilReferralSmartQuery(query);
  const pattern = !smartQuery && query ? buildCivilReferralIlikePattern(query) : "";
  const searchFilter = pattern ? buildCivilReferralSearchFilter(pattern) : "";

  let request = supabase
    .from("sharsh_departments")
    .select("department_id, department_name, values, updated_at")
    .eq("department_group", CIVIL_REFERRAL_GROUP);

  if (searchFilter) {
    request = request.or(searchFilter);
  }

  const { data, error } = await request
    .limit(5000);

  if (error) {
    throw error;
  }

  const normalizedRows = ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    ...sanitizeCivilReferralRecord(row.values),
    id: String(row.department_id || "").replace(CIVIL_REFERRAL_ROW_PREFIX, ""),
    departmentId: String(row.department_id || ""),
    patientName: normalizeCivilReferralText(row.department_name) || normalizeCivilReferralText((row.values as Record<string, unknown> | null)?.patientName),
    updatedAt: row.updated_at || ""
  }));
  const sortedRows = sortCivilReferralRows(filterCivilReferralRows(normalizedRows, query));

  return {
    total: sortedRows.length,
    limit,
    offset,
    query,
    rows: sortedRows.slice(offset, offset + limit)
  };
}

async function saveCivilReferrals(
  supabase: ReturnType<typeof createClient>,
  rows: unknown,
  sourceFileName: string,
  options: Record<string, unknown> = {}
) {
  const now = new Date().toISOString();
  const cleanRows = sanitizeCivilReferralRows(rows, sourceFileName);
  const updates = cleanRows.map((row) => ({
    department_id: `${CIVIL_REFERRAL_ROW_PREFIX}${row.id}`,
    department_name: String(row.patientName || ""),
    department_group: CIVIL_REFERRAL_GROUP,
    values: {
      ...row,
      sourceFileName: row.sourceFileName || sourceFileName,
      importedAt: row.importedAt || now,
      updatedAt: now
    },
    updated_at: now
  }));

  if (updates.length) {
    const { error } = await supabase
      .from("sharsh_departments")
      .upsert(updates);

    if (error) {
      throw error;
    }
  }

  return {
    ...(await listCivilReferrals(supabase, options)),
    saved: updates.length
  };
}

async function deleteCivilReferrals(
  supabase: ReturnType<typeof createClient>,
  ids: unknown,
  options: Record<string, unknown> = {}
) {
  const cleanIds = sanitizeCivilReferralIds(ids);

  if (cleanIds.length) {
    const departmentIds = cleanIds.map((id) => `${CIVIL_REFERRAL_ROW_PREFIX}${id}`);
    const { error } = await supabase
      .from("sharsh_departments")
      .delete()
      .eq("department_group", CIVIL_REFERRAL_GROUP)
      .in("department_id", departmentIds);

    if (error) {
      throw error;
    }
  }

  return {
    ...(await listCivilReferrals(supabase, options)),
    deleted: cleanIds.length
  };
}

function mapOcrFeedbackRows(rows: Array<Record<string, unknown>> | null | undefined) {
  return (rows || []).map((row) => ({
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
    recognizedValues: sanitizePhotoValues(row.ocr_raw as Record<string, unknown> | undefined),
    finalValues: sanitizePhotoValues(row.final_values as Record<string, unknown> | undefined),
    notes: sanitizeFeedbackNotes(row.notes),
    cellReviews: sanitizePhotoCellReviews(row.cell_reviews)
  }));
}

async function listOcrFeedbackRecords(supabase: ReturnType<typeof createClient>, limit: number) {
  const safeLimit = Math.min(500, Math.max(1, Math.trunc(limit || 100)));
  const { data, error } = await supabase
    .from("sharsh_ocr_feedback")
    .select("id, created_at, department_id, department_name, report_date, photo_report_date, save_status, image_name, image_data_url, recognized_keys, changed_keys, ocr_raw, final_values, notes, cell_reviews")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw error;
  }

  return mapOcrFeedbackRows(data as Array<Record<string, unknown>> | null | undefined);
}

async function listOcrFeedbackRecordsByIds(
  supabase: ReturnType<typeof createClient>,
  feedbackIds: number[]
) {
  const safeIds = Array.from(
    new Set(
      feedbackIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.trunc(value))
    )
  ).slice(0, 50);

  if (!safeIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("sharsh_ocr_feedback")
    .select("id, created_at, department_id, department_name, report_date, photo_report_date, save_status, image_name, image_data_url, recognized_keys, changed_keys, ocr_raw, final_values, notes, cell_reviews")
    .in("id", safeIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return mapOcrFeedbackRows(data as Array<Record<string, unknown>> | null | undefined);
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

async function insertPendingPhotoFeedback(
  supabase: ReturnType<typeof createClient>,
  departmentId: keyof typeof DEPARTMENTS,
  reportDate: string,
  imageName: string,
  imageDataUrl: string,
  notes: string[]
) {
  const departmentMeta = DEPARTMENTS[departmentId];
  const emptyValues = sanitizePhotoValues(null);
  const { data, error } = await supabase
    .from("sharsh_ocr_feedback")
    .insert({
      department_id: departmentId,
      department_name: departmentMeta.department,
      report_date: reportDate,
      photo_report_date: null,
      save_status: "accepted_as_is",
      image_name: imageName,
      image_data_url: imageDataUrl,
      recognized_keys: [],
      changed_keys: [],
      ocr_raw: emptyValues,
      final_values: emptyValues,
      notes,
      cell_reviews: [],
      created_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data?.id ? Number(data.id) : null;
}

async function markDepartmentPhotoPending(
  supabase: ReturnType<typeof createClient>,
  departmentId: keyof typeof DEPARTMENTS,
  feedbackId: number | null,
  imageName: string
) {
  const departmentMeta = DEPARTMENTS[departmentId];
  const { data: saved, error: selectError } = await supabase
    .from("sharsh_departments")
    .select("values, updated_at")
    .eq("department_id", departmentId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  const { error } = await supabase
    .from("sharsh_departments")
    .upsert({
      department_id: departmentId,
      department_name: departmentMeta.department,
      department_group: departmentMeta.group,
      values: sanitizeValues(saved?.values as Record<string, unknown> | undefined),
      updated_at: saved?.updated_at || null,
      photo_workflow_status: "pending",
      photo_feedback_id: feedbackId,
      photo_feedback_updated_at: new Date().toISOString(),
      photo_name: imageName
    });

  if (error) {
    throw error;
  }
}

async function deleteDepartmentFeedback(
  supabase: ReturnType<typeof createClient>,
  departmentId: keyof typeof DEPARTMENTS,
  feedbackId: number
) {
  const { error: deleteError } = await supabase
    .from("sharsh_ocr_feedback")
    .delete()
    .eq("id", feedbackId)
    .eq("department_id", departmentId);

  if (deleteError) {
    throw deleteError;
  }

  const { error: updateError } = await supabase
    .from("sharsh_departments")
    .update({
      photo_workflow_status: "idle",
      photo_feedback_id: null,
      photo_feedback_updated_at: null,
      photo_name: null
    })
    .eq("department_id", departmentId);

  if (updateError) {
    throw updateError;
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

    if (type === "queue_department_photo") {
      const departmentId = typeof payload.departmentId === "string" ? payload.departmentId : "";
      if (!Object.prototype.hasOwnProperty.call(DEPARTMENTS, departmentId)) {
        return jsonResponse({ error: "Unknown department." }, 400);
      }

      const imageDataUrl = typeof payload.imageDataUrl === "string" ? payload.imageDataUrl.trim() : "";
      if (!imageDataUrl.startsWith("data:image/")) {
        return jsonResponse({ error: "A valid image is required." }, 400);
      }

      const imageName = typeof payload.imageName === "string" ? payload.imageName.trim() : "";
      const reportDate = typeof payload.reportDate === "string" && payload.reportDate.trim()
        ? payload.reportDate.trim()
        : DEFAULT_DATE;
      const notes = sanitizeFeedbackNotes(payload.notes);
      const feedbackId = await insertPendingPhotoFeedback(
        supabase,
        departmentId as keyof typeof DEPARTMENTS,
        reportDate,
        imageName,
        imageDataUrl,
        notes
      );
      await markDepartmentPhotoPending(
        supabase,
        departmentId as keyof typeof DEPARTMENTS,
        feedbackId,
        imageName
      );

      return jsonResponse(await loadSnapshot(supabase));
    }

    if (type === "list_ocr_feedback") {
      const limit = Number(payload?.limit);
      const feedbackIds = Array.isArray(payload?.feedbackIds)
        ? payload.feedbackIds
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isFinite(value))
        : [];
      return jsonResponse({
        records: feedbackIds.length
          ? await listOcrFeedbackRecordsByIds(supabase, feedbackIds)
          : await listOcrFeedbackRecords(supabase, Number.isFinite(limit) ? limit : 100)
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

    if (type === "delete_department_feedback") {
      const departmentId = typeof payload.departmentId === "string" ? payload.departmentId : "";
      const feedbackId = Number(payload.feedbackId);
      if (!Object.prototype.hasOwnProperty.call(DEPARTMENTS, departmentId)) {
        return jsonResponse({ error: "Unknown department." }, 400);
      }
      if (!Number.isInteger(feedbackId) || feedbackId <= 0) {
        return jsonResponse({ error: "A valid feedback id is required." }, 400);
      }

      await deleteDepartmentFeedback(supabase, departmentId as keyof typeof DEPARTMENTS, feedbackId);
      return jsonResponse(await loadSnapshot(supabase));
    }

    if (type === "notify_owner_login") {
      const details = payload && typeof payload.details === "object" ? payload.details as Record<string, unknown> : {};
      return jsonResponse(await notifyOwnerLogin(details));
    }

    if (type === "send_main_pdfs_to_telegram") {
      return jsonResponse(await sendMainPdfsToTelegramFromSync());
    }

    if (type === "send_shift_form_to_telegram") {
      return jsonResponse(await sendShiftFormToTelegramFromSync(payload.mode));
    }

    if (type === "load_night_shift") {
      return jsonResponse(await loadNightShiftDraft(supabase));
    }

    if (type === "save_night_shift") {
      const reportDateTime = typeof payload.reportDateTime === "string" && payload.reportDateTime.trim()
        ? payload.reportDateTime.trim()
        : DEFAULT_DATE;
      return jsonResponse(await saveNightShiftDraft(supabase, payload.rows, reportDateTime));
    }

    if (type === "clear_night_shift") {
      const reportDateTime = typeof payload.reportDateTime === "string" && payload.reportDateTime.trim()
        ? payload.reportDateTime.trim()
        : DEFAULT_DATE;
      return jsonResponse(await clearNightShiftDraft(supabase, reportDateTime));
    }

    if (type === "load_day_shift") {
      return jsonResponse(await loadDayShiftDraft(supabase));
    }

    if (type === "save_day_shift") {
      const reportDateTime = typeof payload.reportDateTime === "string" && payload.reportDateTime.trim()
        ? payload.reportDateTime.trim()
        : DEFAULT_DATE;
      return jsonResponse(await saveDayShiftDraft(supabase, payload.rows, reportDateTime));
    }

    if (type === "clear_day_shift") {
      const reportDateTime = typeof payload.reportDateTime === "string" && payload.reportDateTime.trim()
        ? payload.reportDateTime.trim()
        : DEFAULT_DATE;
      return jsonResponse(await clearDayShiftDraft(supabase, reportDateTime));
    }

    if (type === "load_discharge_shift") {
      return jsonResponse(await loadDischargeShiftDraft(supabase));
    }

    if (type === "save_discharge_shift") {
      const reportDateTime = typeof payload.reportDateTime === "string" && payload.reportDateTime.trim()
        ? payload.reportDateTime.trim()
        : DEFAULT_DATE;
      return jsonResponse(await saveDischargeShiftDraft(supabase, payload.rows, reportDateTime));
    }

    if (type === "clear_discharge_shift") {
      const reportDateTime = typeof payload.reportDateTime === "string" && payload.reportDateTime.trim()
        ? payload.reportDateTime.trim()
        : DEFAULT_DATE;
      return jsonResponse(await clearDischargeShiftDraft(supabase, reportDateTime));
    }

    if (type === "list_civil_referrals") {
      return jsonResponse(await listCivilReferrals(supabase, payload));
    }

    if (type === "save_civil_referrals") {
      const sourceFileName = typeof payload.sourceFileName === "string" ? payload.sourceFileName.trim() : "";
      return jsonResponse(await saveCivilReferrals(supabase, payload.rows, sourceFileName, payload));
    }

    if (type === "delete_civil_referrals") {
      return jsonResponse(await deleteCivilReferrals(supabase, payload.ids, payload));
    }

    if (type === "rollover_main_after_archive") {
      const archiveKey = typeof payload.archiveKey === "string" ? payload.archiveKey.trim() : "";
      if (!archiveKey) {
        return jsonResponse({ error: "Archive key is required." }, 400);
      }

      const reportDate = typeof payload.reportDate === "string" && payload.reportDate.trim()
        ? payload.reportDate.trim()
        : DEFAULT_DATE;

      const { data: rolloverMeta, error: rolloverMetaError } = await supabase
        .from("sharsh_report_meta")
        .select("report_date, updated_at")
        .eq("report_key", MORNING_ROLLOVER_META_KEY)
        .maybeSingle();

      if (rolloverMetaError) {
        throw rolloverMetaError;
      }

      const existingArchiveRecord = await loadMainArchiveRecord(supabase, archiveKey);

      if (rolloverMeta?.report_date === archiveKey) {
        return jsonResponse({
          ...await loadSnapshot(supabase),
          archiveRecord: existingArchiveRecord,
          rolloverApplied: false,
          rolloverAlreadyApplied: true
        });
      }

      const snapshot = await loadSnapshot(supabase);
      const archiveRecord = existingArchiveRecord || await saveMainArchiveRecord(supabase, archiveKey, snapshot);
      const now = new Date().toISOString();
      const updates = snapshot.rows.map((row) => {
        const departmentMeta = DEPARTMENTS[row.id as keyof typeof DEPARTMENTS];
        return {
          department_id: row.id,
          department_name: departmentMeta.department,
          department_group: departmentMeta.group,
          values: applyMorningRolloverValues(row.id, row.values),
          updated_at: now,
          photo_workflow_status: "processed_rollover"
        };
      });

      const { error: rowsError } = await supabase
        .from("sharsh_departments")
        .upsert(updates);

      if (rowsError) {
        throw rowsError;
      }

      const { error: metaError } = await supabase
        .from("sharsh_report_meta")
        .upsert([
          {
            report_key: "main",
            report_date: reportDate,
            updated_at: now
          },
          {
            report_key: MORNING_ROLLOVER_META_KEY,
            report_date: archiveKey,
            updated_at: now
          }
        ]);

      if (metaError) {
        throw metaError;
      }

      return jsonResponse({
        ...await loadSnapshot(supabase),
        archiveRecord,
        rolloverApplied: true,
        rolloverAlreadyApplied: false
      });
    }

    if (type === "apply_night_shift") {
      const reportDate = typeof payload.reportDate === "string" && payload.reportDate.trim()
        ? payload.reportDate.trim()
        : DEFAULT_DATE;
      const nightRows = sanitizeNightShiftRows(payload.rows);
      const snapshot = await loadSnapshot(supabase);
      const now = new Date().toISOString();
      const updates = snapshot.rows.flatMap((row) => {
        const values = applyNightShiftValues(row.id, row.values, nightRows[row.id]);
        if (!values) {
          return [];
        }
        const departmentMeta = DEPARTMENTS[row.id as keyof typeof DEPARTMENTS];
        return [{
          department_id: row.id,
          department_name: departmentMeta.department,
          department_group: departmentMeta.group,
          values,
          updated_at: now,
          photo_workflow_status: "processed_night_shift"
        }];
      });

      if (updates.length) {
        const { error } = await supabase
          .from("sharsh_departments")
          .upsert(updates);

        if (error) {
          throw error;
        }
      }

      const { error: metaError } = await supabase
        .from("sharsh_report_meta")
        .upsert({
          report_key: "main",
          report_date: reportDate,
          updated_at: now
        });

      if (metaError) {
        throw metaError;
      }

      await clearNightShiftDraft(supabase, reportDate);
      return jsonResponse(await loadSnapshot(supabase));
    }

    if (type === "apply_day_shift") {
      const reportDate = typeof payload.reportDate === "string" && payload.reportDate.trim()
        ? payload.reportDate.trim()
        : DEFAULT_DATE;
      const dayRows = sanitizeNightShiftRows(payload.rows);
      const snapshot = await loadSnapshot(supabase);
      const now = new Date().toISOString();
      const updates = snapshot.rows.flatMap((row) => {
        const values = applyDayShiftValues(row.id, row.values, dayRows[row.id]);
        if (!values) {
          return [];
        }
        const departmentMeta = DEPARTMENTS[row.id as keyof typeof DEPARTMENTS];
        return [{
          department_id: row.id,
          department_name: departmentMeta.department,
          department_group: departmentMeta.group,
          values,
          updated_at: now,
          photo_workflow_status: "processed_day_shift"
        }];
      });

      if (updates.length) {
        const { error } = await supabase
          .from("sharsh_departments")
          .upsert(updates);

        if (error) {
          throw error;
        }
      }

      const { error: metaError } = await supabase
        .from("sharsh_report_meta")
        .upsert({
          report_key: "main",
          report_date: reportDate,
          updated_at: now
        });

      if (metaError) {
        throw metaError;
      }

      await clearDayShiftDraft(supabase, reportDate);
      return jsonResponse(await loadSnapshot(supabase));
    }

    if (type !== "save_department" && type !== "save_department_from_main") {
      return jsonResponse({ error: "Unknown request type." }, 400);
    }

    const departmentId = typeof payload.departmentId === "string" ? payload.departmentId : "";
    if (!Object.prototype.hasOwnProperty.call(DEPARTMENTS, departmentId)) {
      return jsonResponse({ error: "Unknown department." }, 400);
    }

    if (type === "save_department") {
      const accessError = getDepartmentAccessError(departmentId, payload.accessCode);
      if (accessError) {
        return jsonResponse({ error: accessError }, 403);
      }
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
        updated_at: new Date().toISOString(),
        photo_workflow_status: "processed_site"
      });

    if (rowError) {
      throw rowError;
    }

    const { error: workflowError } = await supabase
      .from("sharsh_departments")
      .update({
        photo_workflow_status: "processed_site",
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
    return jsonResponse({ error: getServerErrorMessage(error) }, 500);
  }
});


