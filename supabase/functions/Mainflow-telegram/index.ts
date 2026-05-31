import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import { Jimp } from "npm:jimp";
import { Buffer } from "node:buffer";

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
const TELEGRAM_PENDING_COLLEAGUE_CHATS_META_KEY = "telegram_pending_colleague_chats";
const ANDROID_APPROVED_DEVICES_META_KEY = "android_approved_devices";
const ANDROID_PENDING_DEVICES_META_KEY = "android_pending_devices";
const ANDROID_BLOCKED_DEVICES_META_KEY = "android_blocked_devices";
const ANDROID_DEVICE_NOTIFICATIONS_META_KEY = "android_device_notifications";
const ANDROID_OCR_SUCCESS_NOTIFICATION_MESSAGE = "\u041A\u043E\u043D\u0442\u0440\u043E\u043B \u0441\u0443\u043C \u043F\u0440\u043E\u0439\u0434\u0435\u043D, \u0434\u0430\u043D\u043D\u044B\u0435 \u0432\u0432\u0435\u0434\u0435\u043D\u044B \u0432 \u043E\u0441\u043D\u043E\u0432\u043D\u0443\u044E \u0442\u0430\u0431\u043B\u0438\u0446\u0443.";
const ANDROID_OCR_FAILURE_NOTIFICATION_MESSAGE = "\u041A\u043E\u043D\u0442\u0440\u043E\u043B \u0441\u0443\u043C \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D, \u043E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E \u0432\u0430\u0448\u0435\u0439 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u043E\u0442\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u043D\u0430 MAINFORM.app.";
const TELEGRAM_WORKPLACE_LOCATION_META_KEY = "telegram_workplace_location";
const TELEGRAM_WORKPLACE_SETUP_PENDING_META_KEY = "telegram_workplace_setup_pending";
const TELEGRAM_COLLEAGUE_PRESENCE_META_KEY = "telegram_colleague_presence";
const TELEGRAM_NIGHT_DUTY_REMINDER_META_KEY = "telegram_night_duty_reminder_sent";
const TELEGRAM_NIGHT_SHIFT_SUMMARY_META_KEY = "telegram_night_shift_summary_sent";
const TELEGRAM_GPS_SCENARIO_META_KEY = "telegram_gps_scenario_enabled";
const TELEGRAM_DAILY_REMINDER_META_PREFIX = "telegram_daily_reminder_sent";
const TELEGRAM_MAIN_PDFS_META_KEY = "telegram_main_pdfs_sent";
const TELEGRAM_PENDING_PHOTO_APPROVALS_META_KEY = "telegram_pending_photo_approvals";
const TELEGRAM_PHOTO_AUTOROTATE_META_KEY = "pref:telegram_photo_auto_rotate";
const ANDROID_INTAKE_HUB_ID = "admission_hub";
const DEFAULT_WORKPLACE_RADIUS_METERS = 500;
const TELEGRAM_ADMIN_ONLY_TEXT = "Այս հրամանը հասանելի է միայն բոտի ադմինիստրատորին։";
const TELEGRAM_NIGHT_SHIFT_BUTTON_TEXT = "Գիշերային ընդունում";
const TELEGRAM_DAY_SHIFT_BUTTON_TEXT = "Ընդունում";
const TELEGRAM_DISCHARGE_SHIFT_BUTTON_TEXT = "Դուրսգրում";
const TELEGRAM_APPLY_NIGHT_SHIFT_CALLBACK = "apply_night_shift_to_main";
const MAIN_MOVEMENT_PDF_FILE_NAME = "MAINFLOW.pdf";
const REPORT_PDF_FILE_NAME = "Report.pdf";
const MAIN_ARCHIVE_PDF_FILE_NAME = "Main_archive.pdf";
const ARMENIAN_PDF_FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansarmenian/NotoSansArmenian%5Bwdth,wght%5D.ttf";
const YEREVAN_UTC_OFFSET_MS = 4 * 60 * 60 * 1000;
const FIREBASE_PUSH_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FIREBASE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
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

type FirebaseAndroidPublicConfig = {
  enabled: boolean;
  projectId: string;
  applicationId: string;
  senderId: string;
  apiKey: string;
  storageBucket: string;
};

type FirebasePushServiceConfig = FirebaseAndroidPublicConfig & {
  clientEmail: string;
  privateKey: string;
};

let firebasePushAccessTokenCache:
  | { accessToken: string; expiresAt: number }
  | null = null;

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

const DEPARTMENT_PDF_ROOT_SEGMENT = "%D0%9E%D1%82%D0%B4%D0%B5%D0%BB%D0%B5%D0%BD%D0%B8%D1%8F";
const DEPARTMENT_PDF_URL_SEGMENTS: Record<keyof typeof DEPARTMENTS, { folder: string; file: string }> = {
  r4: { folder: "%D5%8E%D5%AB%D6%80%D5%A1%D5%A2%D5%B8%D6%82%D5%AA%D5%A1%D5%AF%D5%A1%D5%B6", file: "%D5%8E%D5%AB%D6%80%D5%A1%D5%A2%D5%B8%D6%82%D5%AA%D5%A1%D5%AF%D5%A1%D5%B6.pdf" },
  r5: { folder: "%D4%B4%D5%AB%D5%B4%D5%A1%D5%AE%D5%B6%D5%B8%D5%BF%D5%A1%D5%B5%D5%AB%D5%B6%20%D5%BE%D5%AB%D6%80", file: "%D4%B4%D5%AB%D5%B4%D5%A1%D5%AE%D5%B6%D5%B8%D5%BF%D5%A1%D5%B5%D5%AB%D5%B6%20%D5%BE%D5%AB%D6%80.pdf" },
  r6: { folder: "%D5%94%D5%AB%D5%A9-%D5%AF%D5%B8%D5%AF%D5%B8%D6%80%D5%A4%20%D5%A2-%D6%84", file: "%D5%94%D5%AB%D5%A9-%D5%AF%D5%B8%D5%AF%D5%B8%D6%80%D5%A4%20%D5%A2-%D6%84.pdf" },
  r7: { folder: "%D4%B1%D5%AF%D5%B6%D5%A1%D5%A2%D5%B8%D6%82%D5%AA%D5%A1%D5%AF%D5%A1%D5%B6", file: "%D4%B1%D5%AF%D5%B6%D5%A1%D5%A2%D5%B8%D6%82%D5%AA%D5%A1%D5%AF%D5%A1%D5%B6.pdf" },
  r8: { folder: "%D5%8E%D5%B6%D5%A1%D5%BD%D5%BE%D5%A1%D5%AE%D6%84%D5%A1%D5%A2%D5%A1%D5%B6%D5%A1%D5%AF%D5%A1%D5%B6", file: "%D5%8E%D5%B6%D5%A1%D5%BD%D5%BE%D5%A1%D5%AE%D6%84%D5%A1%D5%A2%D5%A1%D5%B6%D5%A1%D5%AF%D5%A1%D5%B6.pdf" },
  r9: { folder: "%D4%BF%D6%80%D5%AE%D6%84%D5%A1%D5%B5%D5%AB%D5%B6%20%D5%B4-%D5%A2", file: "%D4%BF%D6%80%D5%AE%D6%84%D5%A1%D5%B5%D5%AB%D5%B6%20%D5%B4-%D5%A2.pdf" },
  r10: { folder: "%D5%88%D6%82%D5%BC%D5%B8%D5%AC%D5%B8%D5%A3%D5%AB%D5%A1%D5%AF%D5%A1%D5%B6", file: "%D5%88%D6%82%D5%BC%D5%B8%D5%AC%D5%B8%D5%A3%D5%AB%D5%A1%D5%AF%D5%A1%D5%B6.pdf" },
  r11: { folder: "%D5%86%D5%A5%D5%B5%D6%80%D5%B8%D5%BE%D5%AB%D6%80%D5%A1%D5%A2%D5%B8%D6%82%D5%AA%D5%A1%D5%AF%D5%A1%D5%B6", file: "%D5%86%D5%A5%D5%B5%D6%80%D5%B8%D5%BE%D5%AB%D6%80%D5%A1%D5%A2%D5%B8%D6%82%D5%AA%D5%A1%D5%AF%D5%A1%D5%B6.pdf" },
  r12: { folder: "%D4%B9%D5%BC%D5%AB%D5%B9%D6%84%D5%A1%D5%B5%D5%AB%D5%B6", file: "%D4%B9%D5%BC%D5%AB%D5%B9%D6%84%D5%A1%D5%B5%D5%AB%D5%B6.pdf" },
  r13: { folder: "%D4%B9%D5%A5%D6%80%D5%A1%D5%BA%D5%AB%D5%A1", file: "%D4%B9%D5%A5%D6%80%D5%A1%D5%BA%D5%AB%D5%A1.pdf" },
  r14: { folder: "%D5%8E%D5%A5%D6%80%D5%A1%D5%AF%D5%A5%D5%B6%D5%A4%D5%A1%D5%B6%D5%A1%D6%81%D5%B4%D5%A1%D5%B6", file: "%D5%8E%D5%A5%D6%80%D5%A1%D5%AF%D5%A5%D5%B6%D5%A4%D5%A1%D5%B6%D5%A1%D6%81%D5%B4%D5%A1%D5%B6.pdf" },
  r15: { folder: "%D5%86%D5%B5%D5%A1%D6%80%D5%A4%D5%A1%D5%A2%D5%A1%D5%B6%D5%A1%D5%AF%D5%A1%D5%B6", file: "%D5%86%D5%B5%D5%A1%D6%80%D5%A4%D5%A1%D5%A2%D5%A1%D5%B6%D5%A1%D5%AF%D5%A1%D5%B6.pdf" },
  r16: { folder: "%D4%B3%D5%AB%D5%B6%D5%A5%D5%AF%D5%B8%D5%AC%D5%B8%D5%A3%D5%AB%D5%A1%D5%AF%D5%A1%D5%B6", file: "%D4%B3%D5%AB%D5%B6%D5%A5%D5%AF%D5%B8%D5%AC%D5%B8%D5%A3%D5%AB%D5%A1%D5%AF%D5%A1%D5%B6.pdf" },
  r17: { folder: "%D4%B1%D5%86%D5%88%D4%B9%D4%B1%D5%85%D4%BB%D5%86", file: "%D4%B1%D5%86%D5%88%D4%B9%D4%B1%D5%85%D4%BB%D5%86.pdf" },
  r19: { folder: "%D4%BB%D5%86%D5%96", file: "%D4%BB%D5%86%D5%96.pdf" },
  r20: { folder: "%D4%B1%D5%8F%D4%B4", file: "%D4%B1%D5%8F%D4%B4.pdf" },
  r21: { folder: "%D5%94-%D5%80", file: "%D5%94-%D5%80.pdf" }
};

const DEPARTMENT_PDF_VALUE_X = [
  51, 85, 121, 156, 190, 224, 258, 292, 327, 361, 395,
  443, 477, 511, 545, 579, 614, 648, 682, 717, 752, 786
];
const DEPARTMENT_PDF_VALUE_Y = 367;
const DEPARTMENT_PDF_DATE_X = 82;
const DEPARTMENT_PDF_DATE_Y = 72;
const DEPARTMENT_PDF_DATE_FONT_SIZE = 11;
const DEPARTMENT_PDF_NOTE_FONT_SIZE = 7.4;
const DEPARTMENT_PDF_NOTE_MIN_FONT_SIZE = 5.4;
const DEPARTMENT_PATIENT_NOTE_SECTIONS = [
  { key: "admitted", title: "Ընդունված հիվանդներ", rows: 6 },
  { key: "discharged", title: "Դուրս գրված հիվանդներ", rows: 6 },
  { key: "transferred", title: "Տեղափոխված հիվանդներ", rows: 5 },
  { key: "dischargedNotTaken", title: "Դուրսգրված-չտարված", rows: 5 },
  { key: "returnedFromLeave", title: "Վերադարձել են արձակուրդից", rows: 5 },
  { key: "wentOnLeave", title: "Գնացել են արձակուրդ", rows: 5 }
] as const;
type DepartmentPatientNoteKey = typeof DEPARTMENT_PATIENT_NOTE_SECTIONS[number]["key"];
type DepartmentPatientNotes = Record<DepartmentPatientNoteKey, string[]>;
const DEPARTMENT_PDF_NOTE_LAYOUT: Record<DepartmentPatientNoteKey, {
  x: number;
  y: number;
  width: number;
  lineHeight: number;
  clearX: number;
  clearY: number;
  clearWidth: number;
  clearHeight: number;
  titleY: number;
}> = {
  admitted: {
    x: 56,
    y: 314,
    width: 350,
    lineHeight: 9.6,
    clearX: 30,
    clearY: 258,
    clearWidth: 385,
    clearHeight: 82,
    titleY: 329
  },
  transferred: {
    x: 56,
    y: 236,
    width: 350,
    lineHeight: 10.2,
    clearX: 30,
    clearY: 186,
    clearWidth: 385,
    clearHeight: 75,
    titleY: 250
  },
  dischargedNotTaken: {
    x: 56,
    y: 166,
    width: 350,
    lineHeight: 10.2,
    clearX: 30,
    clearY: 116,
    clearWidth: 385,
    clearHeight: 75,
    titleY: 180
  },
  discharged: {
    x: 432,
    y: 314,
    width: 350,
    lineHeight: 9.6,
    clearX: 410,
    clearY: 258,
    clearWidth: 385,
    clearHeight: 82,
    titleY: 329
  },
  returnedFromLeave: {
    x: 432,
    y: 236,
    width: 350,
    lineHeight: 10.2,
    clearX: 410,
    clearY: 186,
    clearWidth: 385,
    clearHeight: 75,
    titleY: 250
  },
  wentOnLeave: {
    x: 432,
    y: 166,
    width: 350,
    lineHeight: 10.2,
    clearX: 410,
    clearY: 116,
    clearWidth: 385,
    clearHeight: 75,
    titleY: 180
  }
};

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

const NIGHT_SHIFT_VALUE_KEYS = ["shar", "spa", "paym", "zh", "family", "zp", "qi"] as const;
const NIGHT_SHIFT_ROW_PREFIX = "night:";
const NIGHT_SHIFT_META_KEY = "night_shift";
const DAY_SHIFT_ROW_PREFIX = "day:";
const DAY_SHIFT_META_KEY = "day_shift";
const DISCHARGE_SHIFT_ROW_PREFIX = "discharge:";
const DISCHARGE_SHIFT_META_KEY = "discharge_shift";
const CIVIL_REFERRAL_ROW_PREFIX = "civil-referral:";
const CIVIL_REFERRAL_GROUP = "civil_referral";
const CIVIL_REFERRAL_DEFAULT_LIMIT = 40;
const CIVIL_REFERRAL_MAX_LIMIT = 1000;
const CIVIL_REFERRAL_DAY_MS = 24 * 60 * 60 * 1000;
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
const CIVIL_REFERRAL_FIELD_DEFINITIONS = [
  { key: "patientName", label: "Ա.Ա.Հ." },
  { key: "medicalCenter", label: "ԲԿ" },
  { key: "militaryUnit", label: "Զորամաս" },
  { key: "rank", label: "Կոչում" },
  { key: "draftYear", label: "Զորակ" },
  { key: "birthYear", label: "Ծնված" },
  { key: "referralDate", label: "Ուղեգրման" },
  { key: "dischargeDate", label: "Դուրսգրում" }
] as const;
const CIVIL_REFERRAL_HASH_KEYS = CIVIL_REFERRAL_VALUE_KEYS.filter((key) => key !== "dischargeDate");
const NIGHT_SHIFT_LABELS: Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], string> = {
  shar: "ՇԱՐ",
  spa: "ՍՊԱ",
  paym: "ՊԱՅՄ",
  zh: "Զ/Հ",
  family: "Զ/Ծ ԸՆՏ",
  zp: "Զ/Պ",
  qi: "ք-ի"
};

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

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object") {
    const details = [
      typeof (error as { message?: unknown }).message === "string" ? String((error as { message: string }).message) : "",
      typeof (error as { details?: unknown }).details === "string" ? String((error as { details: string }).details) : "",
      typeof (error as { hint?: unknown }).hint === "string" ? String((error as { hint: string }).hint) : "",
      typeof (error as { code?: unknown }).code === "string" ? `code=${String((error as { code: string }).code)}` : ""
    ].filter(Boolean);
    if (details.length) {
      return details.join(" | ");
    }
    try {
      return JSON.stringify(error);
    } catch (_error) {
    }
  }
  return String(error);
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
  const parts = getYerevanDateParts();
  return Date.UTC(parts.year, Number(parts.month) - 1, Number(parts.day));
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
      ? (previous?.length ?? 0) <= 3 && token.length <= 3 && token !== "ԲԿ"
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

function normalizeNightShiftSubmittedRows(payload: Record<string, unknown> | null) {
  const output = sanitizeNightShiftRows(payload?.rows);
  const filledRows = payload?.filledRows;

  if (Array.isArray(filledRows)) {
    filledRows.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }
      const row = item as Record<string, unknown>;
      const departmentId = typeof row.departmentId === "string" ? row.departmentId : "";
      if (!Object.prototype.hasOwnProperty.call(DEPARTMENTS, departmentId)) {
        return;
      }
      const values = row.values && typeof row.values === "object" ? row.values : {};
      output[departmentId] = sanitizeNightShiftRows({ [departmentId]: values })[departmentId];
    });
  } else if (filledRows && typeof filledRows === "object") {
    const normalizedFilledRows = sanitizeNightShiftRows(filledRows);
    Object.entries(normalizedFilledRows).forEach(([departmentId, values]) => {
      if (getNightShiftRowTotal(values) > 0) {
        output[departmentId] = values;
      }
    });
  }

  return output;
}

function normalizeTouchedDepartmentIds(payload: Record<string, unknown> | null) {
  const touchedRows = payload?.touchedRows;
  const output = new Set<string>();

  if (Array.isArray(touchedRows)) {
    touchedRows.forEach((departmentId) => {
      if (typeof departmentId === "string" && Object.prototype.hasOwnProperty.call(DEPARTMENTS, departmentId)) {
        output.add(departmentId);
      }
    });
  }

  return output;
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

function sanitizePatientNoteText(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function createEmptyDepartmentPatientNotes(): DepartmentPatientNotes {
  return DEPARTMENT_PATIENT_NOTE_SECTIONS.reduce((notes, section) => {
    notes[section.key] = Array.from({ length: section.rows }, () => "");
    return notes;
  }, {} as DepartmentPatientNotes);
}

function sanitizeDepartmentPatientNotes(source: unknown): DepartmentPatientNotes {
  const notes = createEmptyDepartmentPatientNotes();
  if (!source || typeof source !== "object") {
    return notes;
  }

  DEPARTMENT_PATIENT_NOTE_SECTIONS.forEach((section) => {
    const values = Array.isArray((source as Record<string, unknown>)[section.key])
      ? (source as Record<string, unknown[]>)[section.key]
      : [];
    notes[section.key] = Array.from({ length: section.rows }, (_item, index) => sanitizePatientNoteText(values[index]));
  });
  return notes;
}

function departmentPatientNotesHaveData(notes: DepartmentPatientNotes) {
  return DEPARTMENT_PATIENT_NOTE_SECTIONS.some((section) => (
    notes[section.key].some((value) => value.trim())
  ));
}

function getPatientNoteDisplayText(value: string) {
  return value.trim().replace(/^\d+\s*[\).\-\:]\s*/, "").trim();
}

function buildDepartmentPatientNotesTextLines(notes: DepartmentPatientNotes) {
  const lines: string[] = [];
  DEPARTMENT_PATIENT_NOTE_SECTIONS.forEach((section) => {
    const filled = notes[section.key]
      .map((value, index) => ({ value: getPatientNoteDisplayText(value), index }))
      .filter((item) => item.value)
      .map((item) => `${item.index + 1}. ${item.value}`);
    if (filled.length) {
      lines.push(`${section.title}: ${filled.join("; ")}`);
    }
  });
  return lines;
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
  carryoverValues?: Record<string, number | null>,
  androidAccess?: { deviceId?: string; deviceName?: string } | null,
  options: { autoRotateImages?: boolean | null } = {}
) {
  const params = new URLSearchParams();
  params.set("ui", "20260529androidhubcamera1");
  params.set("department", departmentId);
  params.set("date", reportDate);
  if (typeof options.autoRotateImages === "boolean") {
    params.set("ar", options.autoRotateImages ? "1" : "0");
  }
  const androidDeviceId = sanitizeAndroidDeviceId(androidAccess?.deviceId || "");
  const androidDeviceName = sanitizeAndroidDeviceName(androidAccess?.deviceName || "");
  if (androidDeviceId) {
    params.set("androidApp", "1");
    params.set("androidDeviceId", androidDeviceId);
    if (androidDeviceName) {
      params.set("androidDeviceName", androidDeviceName);
    }
  }
  if (carryoverValues) {
    params.set("c1", String(carryoverValues.beenTotal ?? 0));
    params.set("c2", String(carryoverValues.beenSoldier ?? 0));
    params.set("c3", String(carryoverValues.beenSeries ?? 0));
    params.set("c4", String(carryoverValues.admittedTotal ?? 0));
    params.set("c5", String(carryoverValues.admittedSoldier ?? 0));
    params.set("c6", String(carryoverValues.admittedSeries ?? 0));
    params.set("c7", String(carryoverValues.dgTotal ?? 0));
    params.set("c8", String(carryoverValues.dgSoldier ?? 0));
    params.set("c9", String(carryoverValues.dgSeries ?? 0));
    params.set("c10", String(carryoverValues.transferFromDepartment ?? 0));
    params.set("c11", String(carryoverValues.transferToDepartment ?? 0));
    params.set("c12", String(carryoverValues.presentTotal ?? 0));
    params.set("c13", String(carryoverValues.currentShar ?? 0));
    params.set("c14", String(carryoverValues.currentSpa ?? 0));
    params.set("c15", String(carryoverValues.currentPaym ?? 0));
    params.set("c16", String(carryoverValues.currentZh ?? 0));
    params.set("c17", String(carryoverValues.family ?? 0));
    params.set("c18", String(carryoverValues.officer ?? 0));
    params.set("c19", String(carryoverValues.civil ?? 0));
    params.set("c20", String(carryoverValues.leaveSharq ?? 0));
    params.set("c21", String(carryoverValues.leaveSpa ?? 0));
    params.set("c22", String(carryoverValues.leavePaym ?? 0));
    if (QH_CALC_DEPARTMENT_IDS.has(departmentId)) {
      params.set("qg", String(carryoverValues.qhBaseSoldier ?? carryoverValues.currentShar ?? 0));
      params.set("qh", String(carryoverValues.qhBaseOfficer ?? carryoverValues.currentSpa ?? 0));
      params.set("qi", String(carryoverValues.qhBaseContract ?? carryoverValues.currentPaym ?? 0));
      params.set("qj", String(carryoverValues.currentZh ?? 0));
      params.set("qk", String(carryoverValues.family ?? 0));
      params.set("ql", String(carryoverValues.officer ?? 0));
      params.set("qm", String(carryoverValues.civil ?? 0));
    }
  }
  const formPath = QH_CALC_DEPARTMENT_IDS.has(departmentId) ? "tg-qh-form.html" : "tg-form.html";
  return `${getPublicSiteBaseUrl()}/${formPath}?${params.toString()}`;
}

function getAndroidIntakeHubUrl(
  reportDate: string,
  androidAccess?: { deviceId?: string; deviceName?: string } | null
) {
  const params = new URLSearchParams();
  params.set("ui", "20260529androidhubcamera1");
  params.set("date", reportDate);
  const androidDeviceId = sanitizeAndroidDeviceId(androidAccess?.deviceId || "");
  const androidDeviceName = sanitizeAndroidDeviceName(androidAccess?.deviceName || "");
  if (androidDeviceId) {
    params.set("androidApp", "1");
    params.set("androidDeviceId", androidDeviceId);
    if (androidDeviceName) {
      params.set("androidDeviceName", androidDeviceName);
    }
  }
  return `${getPublicSiteBaseUrl()}/android-intake.html?${params.toString()}`;
}

function getTelegramNightFormUrl(reportDateTime: string) {
  const params = new URLSearchParams();
  params.set("date", normalizeShiftReportDateTime(reportDateTime));
  return `${getPublicSiteBaseUrl()}/tg-night-form.html?${params.toString()}`;
}

function getNightShiftBrowserUrl() {
  const params = new URLSearchParams();
  params.set("view", "day");
  return `${getPublicSiteBaseUrl()}/day.html?${params.toString()}`;
}

function getTelegramDayFormUrl(reportDateTime: string) {
  const params = new URLSearchParams();
  params.set("date", normalizeShiftReportDateTime(reportDateTime));
  return `${getPublicSiteBaseUrl()}/tg-day-form.html?${params.toString()}`;
}

function getTelegramDischargeFormUrl(reportDateTime: string) {
  const params = new URLSearchParams();
  params.set("date", normalizeShiftReportDateTime(reportDateTime));
  return `${getPublicSiteBaseUrl()}/tg-discharge-form.html?${params.toString()}`;
}

function getTelegramCivilReferralsFormUrl() {
  return `${getPublicSiteBaseUrl()}/tg-civil-referrals.html`;
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

function parseImageDataUrl(dataUrl: string) {
  const normalized = String(dataUrl || "").trim();
  const match = normalized.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) {
    throw new Error("Invalid image data URL.");
  }

  return {
    mimeType: match[1].toLowerCase(),
    bytes: Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0))
  };
}

function buildImageDataUrl(mimeType: string, bytes: Uint8Array) {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

function normalizeTelegramPhotoFileName(fileName: string, mimeType: string) {
  const fallbackBaseName = "telegram-photo";
  const normalizedName = String(fileName || "").trim();
  const baseName = normalizedName.replace(/\.[^.]+$/, "") || fallbackBaseName;
  const extension = mimeType === "image/png" ? ".png" : ".jpg";
  return `${baseName}${extension}`;
}

async function buildJimpRotatedImageBytes(
  sourceBytes: Uint8Array,
  rotationDegrees: number,
  options: { mimeType?: string } = {}
) {
  const image = await Jimp.read(Buffer.from(sourceBytes));
  if (rotationDegrees) {
    image.rotate(rotationDegrees);
  }

  const targetMimeType = options.mimeType === "image/png" ? "image/png" : "image/jpeg";
  const buffer = await image.getBuffer(targetMimeType);
  return new Uint8Array(buffer);
}

async function inspectTelegramPhotoOrientation(
  dataUrl: string,
  fileName: string,
  options: { requireAdvice?: boolean; enabled?: boolean } = {}
) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return {
      dataUrl,
      fileName,
      orientationAdvice: null as null | ReturnType<typeof sanitizePhotoOrientationAdvice>,
      orientationNotes: [] as string[]
    };
  }

  try {
    if (options.enabled === false) {
      return {
        dataUrl,
        fileName,
        orientationAdvice: null as null | ReturnType<typeof sanitizePhotoOrientationAdvice>,
        orientationNotes: [] as string[]
      };
    }

    const { bytes } = parseImageDataUrl(dataUrl);
    const image = await Jimp.read(Buffer.from(bytes));
    const width = Number(image.bitmap.width || 0);
    const height = Number(image.bitmap.height || 0);
    const isPortrait = height > width;
    const shouldAnalyze = Boolean(options.requireAdvice || isPortrait);

    if (!shouldAnalyze) {
      return {
        dataUrl,
        fileName,
        orientationAdvice: null as null | ReturnType<typeof sanitizePhotoOrientationAdvice>,
        orientationNotes: [] as string[]
      };
    }

    const orientationAdvice = await detectTelegramPhotoOrientationAdvice(dataUrl);
    const orientationNotes = [
      `Orientation OCR: rotation=${orientationAdvice.rotationDegrees}, confidence=${orientationAdvice.confidence}.`,
      ...orientationAdvice.notes.map((note) => `Orientation note: ${note}`)
    ];

    if (orientationAdvice.confidence !== "high" || !orientationAdvice.rotationDegrees) {
      return {
        dataUrl,
        fileName,
        orientationAdvice,
        orientationNotes
      };
    }

    const rotatedBytes = await buildJimpRotatedImageBytes(bytes, orientationAdvice.rotationDegrees, {
      mimeType: "image/jpeg"
    });

    return {
      dataUrl: buildImageDataUrl("image/jpeg", rotatedBytes),
      fileName: normalizeTelegramPhotoFileName(fileName, "image/jpeg"),
      orientationAdvice,
      orientationNotes: [
        `Photo auto-rotated by ${orientationAdvice.rotationDegrees}\u00b0 before OCR.`,
        ...orientationNotes
      ]
    };
  } catch (error) {
    console.warn("Telegram photo orientation inspection failed:", sanitizePublicErrorMessage(error));
    return {
      dataUrl,
      fileName,
      orientationAdvice: null as null | ReturnType<typeof sanitizePhotoOrientationAdvice>,
      orientationNotes: [] as string[]
    };
  }
}

function parseMetaBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

async function isTelegramPhotoAutoRotateEnabled(
  supabase: ReturnType<typeof createClient>
) {
  try {
    const { data, error } = await supabase
      .from("sharsh_report_meta")
      .select("report_date")
      .eq("report_key", TELEGRAM_PHOTO_AUTOROTATE_META_KEY)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return parseMetaBoolean(data?.report_date, false);
  } catch (error) {
    console.warn("Telegram photo auto-rotate preference load failed:", sanitizePublicErrorMessage(error));
    return false;
  }
}

function evaluateTelegramPhotoRecognitionCandidate(
  recognized: Awaited<ReturnType<typeof recognizeDepartmentPhoto>>,
  currentDepartmentValues?: Record<string, number | null> | null
) {
  const structureInvalid = !!recognized.structure && (!recognized.structure.all22CellsVisible || recognized.structure.gridCellCount !== 22);
  const hasRecognizedValues = recognized.recognizedKeys.some((key) => {
    return VALUE_KEYS.includes(key as (typeof VALUE_KEYS)[number]);
  });
  let validation = hasRecognizedValues ? validateDepartmentSheetValues(recognized.values) : null;
  if (validation) {
    validation = appendDepartmentValidationCheck(
      validation,
      buildDepartmentOcrTopCellsValidationCheck(recognized.values, currentDepartmentValues)
    );
  }

  const recognizedCount = recognized.recognizedKeys.filter((key) => {
    return VALUE_KEYS.includes(key as (typeof VALUE_KEYS)[number]);
  }).length;
  const isControlPassed = !structureInvalid && hasRecognizedValues && !!validation?.isValid;
  const score = (isControlPassed ? 2000 : 0)
    + (!structureInvalid ? 400 : 0)
    + (validation?.isValid ? 300 : 0)
    + (hasRecognizedValues ? 100 : 0)
    + recognizedCount;

  return {
    structureInvalid,
    hasRecognizedValues,
    validation,
    recognizedCount,
    isControlPassed,
    score
  };
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

function buildPhotoOrientationAdviceSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      rotationDegrees: {
        type: "integer",
        enum: [0, 90, 180, 270]
      },
      confidence: {
        type: "string",
        enum: ["low", "medium", "high"]
      },
      notes: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["rotationDegrees", "confidence", "notes"]
  };
}

function sanitizePhotoOrientationAdvice(value: unknown) {
  if (!value || typeof value !== "object") {
    return {
      rotationDegrees: 0,
      confidence: "low" as "low" | "medium" | "high",
      notes: [] as string[]
    };
  }

  const payload = value as Record<string, unknown>;
  const rawRotation = Number(payload.rotationDegrees);
  const rotationDegrees = [0, 90, 180, 270].includes(rawRotation)
    ? rawRotation
    : 0;
  const confidence = payload.confidence === "high" || payload.confidence === "medium" || payload.confidence === "low"
    ? payload.confidence
    : "low";
  const notes = Array.isArray(payload.notes)
    ? payload.notes
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => String(item).trim())
    : [];

  return {
    rotationDegrees,
    confidence,
    notes
  };
}

async function detectTelegramPhotoOrientationAdvice(imageDataUrl: string) {
  const prompt = [
    "You determine the correct upright orientation of an Armenian hospital department form photo.",
    "You will receive two images in order: first a blank template reference of the same form, then the filled form photo.",
    "Use only the printed page structure to judge orientation: the top header, the SR marker area, the top numeric table, the lower descriptive section, and the overall blank layout.",
    "Return rotationDegrees as how much the original filled photo should be rotated clockwise to become upright.",
    "Allowed values are exactly 0, 90, 180, or 270.",
    "If the current image is already upright, return 0.",
    "Set confidence to high only when the orientation is obvious from the template cues."
  ].join("\n");

  const parsed = await requestOpenAiStructuredVision(
    prompt,
    imageDataUrl,
    "telegram_department_photo_orientation_advice",
    buildPhotoOrientationAdviceSchema(),
    [getOcrTemplateBlankImageUrl()]
  );

  return sanitizePhotoOrientationAdvice(parsed);
}

function shouldSendTelegramPhotoOrientationAdvice(chatId: number | string, hintText: string) {
  if (isTelegramAdminChat(chatId)) {
    return true;
  }

  const normalizedHint = String(hintText || "").trim().toLowerCase();
  return normalizedHint.includes("#orientation-test") || normalizedHint.includes("#ocr-test");
}

function buildTelegramPhotoOrientationAdviceMessage(
  advice: ReturnType<typeof sanitizePhotoOrientationAdvice>,
  options: {
    departmentId?: DepartmentId | null;
    reportDate?: string | null;
  } = {}
) {
  const departmentMeta = options.departmentId ? DEPARTMENTS[options.departmentId] : null;
  const confidenceLabel = advice.confidence === "high"
    ? "высокая"
    : (advice.confidence === "medium" ? "средняя" : "низкая");
  const rotationLabel = advice.rotationDegrees === 0
    ? "0° (фото уже выглядит правильно)"
    : `${advice.rotationDegrees}° по часовой стрелке`;

  return [
    "Тест ориентации фото",
    "Это только подсказка. OCR и сохранённые данные сейчас не менялись.",
    departmentMeta ? `Отделение: ${departmentMeta.department} (${departmentMeta.marker})` : "",
    options.reportDate ? `Дата отчёта: ${options.reportDate}` : "",
    `Рекомендуемый поворот: ${rotationLabel}`,
    `Уверенность: ${confidenceLabel}`,
    ...(advice.notes.length ? ["Заметки:", ...advice.notes] : [])
  ].filter(Boolean).join("\n");
}

async function sendTelegramPhotoOrientationAdviceResult(
  chatId: number | string,
  advice: ReturnType<typeof sanitizePhotoOrientationAdvice>,
  options: {
    departmentId?: DepartmentId | null;
    reportDate?: string | null;
  } = {}
) {
  await sendTelegramMessage(
    chatId,
    buildTelegramPhotoOrientationAdviceMessage(advice, options)
  );
}

async function sendTelegramPhotoOrientationAdvice(
  chatId: number | string,
  imageDataUrl: string,
  options: {
    departmentId?: DepartmentId | null;
    reportDate?: string | null;
  } = {}
) {
  const advice = await detectTelegramPhotoOrientationAdvice(imageDataUrl);
  const departmentMeta = options.departmentId ? DEPARTMENTS[options.departmentId] : null;
  const confidenceLabel = advice.confidence === "high"
    ? "высокая"
    : (advice.confidence === "medium" ? "средняя" : "низкая");
  const rotationLabel = advice.rotationDegrees === 0
    ? "0° (фото уже выглядит правильно)"
    : `${advice.rotationDegrees}° по часовой стрелке`;

  await sendTelegramMessage(
    chatId,
    [
      "Тест ориентации фото",
      "Это только подсказка. OCR и сохранённые данные сейчас не менялись.",
      departmentMeta ? `Отделение: ${departmentMeta.department} (${departmentMeta.marker})` : "",
      options.reportDate ? `Дата отчёта: ${options.reportDate}` : "",
      `Рекомендуемый поворот: ${rotationLabel}`,
      `Уверенность: ${confidenceLabel}`,
      ...(advice.notes.length ? ["Заметки:", ...advice.notes] : [])
    ].filter(Boolean).join("\n")
  );
}

function buildTelegramPhotoOrientationAdviceMessageSafe(
  advice: ReturnType<typeof sanitizePhotoOrientationAdvice>,
  options: {
    departmentId?: DepartmentId | null;
    reportDate?: string | null;
  } = {}
) {
  const departmentMeta = options.departmentId ? DEPARTMENTS[options.departmentId] : null;
  const confidenceLabel = advice.confidence === "high"
    ? "\u0432\u044b\u0441\u043e\u043a\u0430\u044f"
    : (advice.confidence === "medium"
      ? "\u0441\u0440\u0435\u0434\u043d\u044f\u044f"
      : "\u043d\u0438\u0437\u043a\u0430\u044f");
  const rotationLabel = advice.rotationDegrees === 0
    ? "0\u00b0 (\u0444\u043e\u0442\u043e \u0443\u0436\u0435 \u0432\u044b\u0433\u043b\u044f\u0434\u0438\u0442 \u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u043e)"
    : `${advice.rotationDegrees}\u00b0 \u043f\u043e \u0447\u0430\u0441\u043e\u0432\u043e\u0439 \u0441\u0442\u0440\u0435\u043b\u043a\u0435`;

  return [
    "\u0422\u0435\u0441\u0442 \u043e\u0440\u0438\u0435\u043d\u0442\u0430\u0446\u0438\u0438 \u0444\u043e\u0442\u043e",
    "\u042d\u0442\u043e \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u043e\u0434\u0441\u043a\u0430\u0437\u043a\u0430. OCR \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435 \u043c\u0435\u043d\u044f\u043b\u0438\u0441\u044c.",
    departmentMeta ? `\u041e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u0435: ${departmentMeta.department} (${departmentMeta.marker})` : "",
    options.reportDate ? `\u0414\u0430\u0442\u0430 \u043e\u0442\u0447\u0451\u0442\u0430: ${options.reportDate}` : "",
    `\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c\u044b\u0439 \u043f\u043e\u0432\u043e\u0440\u043e\u0442: ${rotationLabel}`,
    `\u0423\u0432\u0435\u0440\u0435\u043d\u043d\u043e\u0441\u0442\u044c: ${confidenceLabel}`,
    ...(advice.notes.length ? ["\u0417\u0430\u043c\u0435\u0442\u043a\u0438:", ...advice.notes] : [])
  ].filter(Boolean).join("\n");
}

async function sendTelegramPhotoOrientationAdvicePrepared(
  chatId: number | string,
  advice: ReturnType<typeof sanitizePhotoOrientationAdvice>,
  options: {
    departmentId?: DepartmentId | null;
    reportDate?: string | null;
  } = {}
) {
  await sendTelegramMessage(
    chatId,
    buildTelegramPhotoOrientationAdviceMessageSafe(advice, options)
  );
}

async function sendTelegramPhotoOrientationAdviceSafe(
  chatId: number | string,
  imageDataUrl: string,
  options: {
    departmentId?: DepartmentId | null;
    reportDate?: string | null;
  } = {}
) {
  const advice = await detectTelegramPhotoOrientationAdvice(imageDataUrl);
  await sendTelegramPhotoOrientationAdvicePrepared(chatId, advice, options);
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

type TelegramWorkplaceLocation = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  label: string;
  updatedAt: string;
};

type TelegramColleaguePresence = TelegramColleagueChat & {
  status: "at_work" | "away";
  isDuty: boolean;
  arrivedAt: string;
  leftAt: string;
  lastLatitude: number | null;
  lastLongitude: number | null;
  distanceMeters: number | null;
};

type TelegramPendingPhotoApproval = {
  id: string;
  chatId: string;
  fileId: string;
  hintText: string;
  message: Record<string, unknown>;
  senderName: string;
  createdAt: string;
};

type AndroidDeviceAccessRecord = {
  deviceId: string;
  deviceName: string;
  requestedAt: string;
  updatedAt: string;
  approvedAt: string;
  blockedAt: string;
  lastSeenAt: string;
  lastDepartmentId: string;
  fcmToken: string;
  fcmTokenUpdatedAt: string;
};

type AndroidDeviceNotificationRecord = {
  id: string;
  deviceId: string;
  departmentId: string;
  title: string;
  message: string;
  createdAt: string;
  deliveredAt: string;
  level: "success" | "warning";
  source: string;
  feedbackId: string;
  reportDate: string;
};

type TelegramPhotoHandlingOptions = {
  approved?: boolean;
  skipAdminPhotoCopy?: boolean;
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

function sanitizeCoordinate(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function sanitizeRadiusMeters(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_WORKPLACE_RADIUS_METERS;
  }
  return Math.max(50, Math.min(5000, Math.round(parsed)));
}

function parseTelegramWorkplaceLocation(raw: unknown): TelegramWorkplaceLocation | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const latitude = sanitizeCoordinate(parsed.latitude, -90, 90);
    const longitude = sanitizeCoordinate(parsed.longitude, -180, 180);
    if (latitude === null || longitude === null) {
      return null;
    }
    return {
      latitude,
      longitude,
      radiusMeters: sanitizeRadiusMeters(parsed.radiusMeters),
      label: typeof parsed.label === "string" && parsed.label.trim() ? parsed.label.trim() : "հիվանդանոց",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : ""
    };
  } catch (_error) {
    return null;
  }
}

function getEnvTelegramWorkplaceLocation(): TelegramWorkplaceLocation | null {
  const latitude = sanitizeCoordinate(Deno.env.get("TELEGRAM_WORKPLACE_LAT"), -90, 90);
  const longitude = sanitizeCoordinate(Deno.env.get("TELEGRAM_WORKPLACE_LON"), -180, 180);
  if (latitude === null || longitude === null) {
    return null;
  }
  return {
    latitude,
    longitude,
    radiusMeters: sanitizeRadiusMeters(Deno.env.get("TELEGRAM_WORKPLACE_RADIUS_METERS")),
    label: (Deno.env.get("TELEGRAM_WORKPLACE_LABEL") || "հիվանդանոց").trim() || "հիվանդանոց",
    updatedAt: new Date().toISOString()
  };
}

function parseTelegramPresenceRecords(raw: unknown): TelegramColleaguePresence[] {
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
          updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
          status: record.status === "at_work" ? "at_work" : "away",
          isDuty: record.isDuty === true,
          arrivedAt: typeof record.arrivedAt === "string" ? record.arrivedAt : "",
          leftAt: typeof record.leftAt === "string" ? record.leftAt : "",
          lastLatitude: typeof record.lastLatitude === "number" ? record.lastLatitude : null,
          lastLongitude: typeof record.lastLongitude === "number" ? record.lastLongitude : null,
          distanceMeters: typeof record.distanceMeters === "number" ? record.distanceMeters : null
        };
      })
      .filter((item): item is TelegramColleaguePresence => item !== null);
  } catch (_error) {
    return [];
  }
}

function parseTelegramPendingPhotoApprovals(raw: unknown): TelegramPendingPhotoApproval[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const record = item as Record<string, unknown>;
        const id = typeof record.id === "string" ? record.id.trim() : "";
        const chatId = typeof record.chatId === "string" || typeof record.chatId === "number"
          ? String(record.chatId).trim()
          : "";
        const fileId = typeof record.fileId === "string" ? record.fileId.trim() : "";
        const message = record.message && typeof record.message === "object"
          ? record.message as Record<string, unknown>
          : {};
        if (!id || !chatId || !fileId) {
          return null;
        }
        const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
        const createdTime = Date.parse(createdAt);
        if (Number.isFinite(createdTime) && createdTime < cutoff) {
          return null;
        }
        return {
          id,
          chatId,
          fileId,
          hintText: typeof record.hintText === "string" ? record.hintText : "",
          message,
          senderName: typeof record.senderName === "string" ? record.senderName : "",
          createdAt
        };
      })
      .filter((item): item is TelegramPendingPhotoApproval => item !== null);
  } catch (_error) {
    return [];
  }
}

function sanitizeAndroidDeviceId(value: unknown) {
  const normalized = typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
  return normalized.slice(0, 128);
}

function sanitizeAndroidDeviceName(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.slice(0, 160);
}

function sanitizeAndroidDevicePushToken(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.slice(0, 4096);
}

function parseAndroidDeviceAccessRecords(raw: unknown): AndroidDeviceAccessRecord[] {
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
        const deviceId = sanitizeAndroidDeviceId(record.deviceId);
        if (!deviceId) {
          return null;
        }
        return {
          deviceId,
          deviceName: sanitizeAndroidDeviceName(record.deviceName),
          requestedAt: typeof record.requestedAt === "string" ? record.requestedAt : "",
          updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
          approvedAt: typeof record.approvedAt === "string" ? record.approvedAt : "",
          blockedAt: typeof record.blockedAt === "string" ? record.blockedAt : "",
          lastSeenAt: typeof record.lastSeenAt === "string" ? record.lastSeenAt : "",
          lastDepartmentId: typeof record.lastDepartmentId === "string" ? record.lastDepartmentId : "",
          fcmToken: sanitizeAndroidDevicePushToken(record.fcmToken),
          fcmTokenUpdatedAt: typeof record.fcmTokenUpdatedAt === "string" ? record.fcmTokenUpdatedAt : ""
        };
      })
      .filter((item): item is AndroidDeviceAccessRecord => item !== null);
  } catch (_error) {
    return [];
  }
}

function parseAndroidDeviceNotificationRecords(raw: unknown): AndroidDeviceNotificationRecord[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const notifications: AndroidDeviceNotificationRecord[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id.trim() : "";
      const deviceId = sanitizeAndroidDeviceId(record.deviceId);
      const departmentId = parseDepartmentId(record.departmentId);
      if (!id || !deviceId || !departmentId) {
        continue;
      }

      const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
      const createdTime = Date.parse(createdAt);
      if (Number.isFinite(createdTime) && createdTime < cutoff) {
        continue;
      }

      notifications.push({
        id,
        deviceId,
        departmentId,
        title: typeof record.title === "string" ? record.title.slice(0, 200) : "",
        message: typeof record.message === "string" ? record.message.slice(0, 1000) : "",
        createdAt,
        deliveredAt: typeof record.deliveredAt === "string" ? record.deliveredAt : "",
        level: record.level === "warning" ? "warning" : "success",
        source: typeof record.source === "string" ? record.source.slice(0, 100) : "",
        feedbackId: typeof record.feedbackId === "string" ? record.feedbackId : "",
        reportDate: typeof record.reportDate === "string" ? record.reportDate : ""
      });
    }

    return notifications.slice(0, 500);
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
  supabase: any,
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

async function loadTelegramPendingColleagueChats(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("sharsh_report_meta")
    .select("report_date")
    .eq("report_key", TELEGRAM_PENDING_COLLEAGUE_CHATS_META_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parseTelegramColleagueChats(data?.report_date);
}

async function saveTelegramPendingColleagueChats(
  supabase: ReturnType<typeof createClient>,
  chats: TelegramColleagueChat[]
) {
  const uniqueChats = Array.from(new Map(chats.map((item) => [item.chatId, item])).values());
  const { error } = await supabase
    .from("sharsh_report_meta")
    .upsert({
      report_key: TELEGRAM_PENDING_COLLEAGUE_CHATS_META_KEY,
      report_date: JSON.stringify(uniqueChats),
      updated_at: new Date().toISOString()
    });

  if (error) {
    throw error;
  }
}

async function loadAndroidDeviceAccessRecords(
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

  return parseAndroidDeviceAccessRecords(data?.report_date);
}

async function saveAndroidDeviceAccessRecords(
  supabase: ReturnType<typeof createClient>,
  reportKey: string,
  records: AndroidDeviceAccessRecord[]
) {
  const uniqueRecords = Array.from(new Map(records.map((item) => [item.deviceId, item])).values());
  const { error } = await supabase
    .from("sharsh_report_meta")
    .upsert({
      report_key: reportKey,
      report_date: JSON.stringify(uniqueRecords),
      updated_at: new Date().toISOString()
    });

  if (error) {
    throw error;
  }
}

async function loadApprovedAndroidDevices(supabase: ReturnType<typeof createClient>) {
  return await loadAndroidDeviceAccessRecords(supabase, ANDROID_APPROVED_DEVICES_META_KEY);
}

async function saveApprovedAndroidDevices(
  supabase: ReturnType<typeof createClient>,
  records: AndroidDeviceAccessRecord[]
) {
  await saveAndroidDeviceAccessRecords(supabase, ANDROID_APPROVED_DEVICES_META_KEY, records);
}

async function loadPendingAndroidDevices(supabase: ReturnType<typeof createClient>) {
  return await loadAndroidDeviceAccessRecords(supabase, ANDROID_PENDING_DEVICES_META_KEY);
}

async function savePendingAndroidDevices(
  supabase: ReturnType<typeof createClient>,
  records: AndroidDeviceAccessRecord[]
) {
  await saveAndroidDeviceAccessRecords(supabase, ANDROID_PENDING_DEVICES_META_KEY, records);
}

async function loadBlockedAndroidDevices(supabase: ReturnType<typeof createClient>) {
  return await loadAndroidDeviceAccessRecords(supabase, ANDROID_BLOCKED_DEVICES_META_KEY);
}

async function saveBlockedAndroidDevices(
  supabase: ReturnType<typeof createClient>,
  records: AndroidDeviceAccessRecord[]
) {
  await saveAndroidDeviceAccessRecords(supabase, ANDROID_BLOCKED_DEVICES_META_KEY, records);
}

async function loadAndroidDeviceNotifications(supabase: any) {
  const { data, error } = await supabase
    .from("sharsh_report_meta")
    .select("report_date")
    .eq("report_key", ANDROID_DEVICE_NOTIFICATIONS_META_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parseAndroidDeviceNotificationRecords(data?.report_date);
}

async function saveAndroidDeviceNotifications(
  supabase: any,
  notifications: AndroidDeviceNotificationRecord[]
) {
  const uniqueNotifications = Array.from(new Map(notifications.map((item) => [item.id, item])).values())
    .sort((left, right) => {
      return Date.parse(right.createdAt || "") - Date.parse(left.createdAt || "");
    })
    .slice(0, 500);
  const { error } = await supabase
    .from("sharsh_report_meta")
    .upsert({
      report_key: ANDROID_DEVICE_NOTIFICATIONS_META_KEY,
      report_date: JSON.stringify(uniqueNotifications),
      updated_at: new Date().toISOString()
    });

  if (error) {
    throw error;
  }
}

async function loadTelegramWorkplaceLocation(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("sharsh_report_meta")
    .select("report_date")
    .eq("report_key", TELEGRAM_WORKPLACE_LOCATION_META_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parseTelegramWorkplaceLocation(data?.report_date) || getEnvTelegramWorkplaceLocation();
}

async function saveTelegramWorkplaceLocation(
  supabase: ReturnType<typeof createClient>,
  location: TelegramWorkplaceLocation
) {
  const { error } = await supabase
    .from("sharsh_report_meta")
    .upsert({
      report_key: TELEGRAM_WORKPLACE_LOCATION_META_KEY,
      report_date: JSON.stringify(location),
      updated_at: new Date().toISOString()
    });

  if (error) {
    throw error;
  }
}

async function loadTelegramPresenceRecords(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("sharsh_report_meta")
    .select("report_date")
    .eq("report_key", TELEGRAM_COLLEAGUE_PRESENCE_META_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parseTelegramPresenceRecords(data?.report_date);
}

async function saveTelegramPresenceRecords(
  supabase: ReturnType<typeof createClient>,
  records: TelegramColleaguePresence[]
) {
  const uniqueRecords = Array.from(new Map(records.map((item) => [item.chatId, item])).values());
  const { error } = await supabase
    .from("sharsh_report_meta")
    .upsert({
      report_key: TELEGRAM_COLLEAGUE_PRESENCE_META_KEY,
      report_date: JSON.stringify(uniqueRecords),
      updated_at: new Date().toISOString()
    });

  if (error) {
    throw error;
  }
}

function buildPresenceRecord(
  person: TelegramColleagueChat,
  previous: TelegramColleaguePresence | undefined,
  patch: Partial<TelegramColleaguePresence>
): TelegramColleaguePresence {
  return {
    chatId: person.chatId,
    firstName: person.firstName || previous?.firstName || "",
    lastName: person.lastName || previous?.lastName || "",
    username: person.username || previous?.username || "",
    updatedAt: new Date().toISOString(),
    status: patch.status || previous?.status || "away",
    isDuty: typeof patch.isDuty === "boolean" ? patch.isDuty : previous?.isDuty === true,
    arrivedAt: patch.arrivedAt || previous?.arrivedAt || "",
    leftAt: patch.leftAt || previous?.leftAt || "",
    lastLatitude: typeof patch.lastLatitude === "number" ? patch.lastLatitude : previous?.lastLatitude ?? null,
    lastLongitude: typeof patch.lastLongitude === "number" ? patch.lastLongitude : previous?.lastLongitude ?? null,
    distanceMeters: typeof patch.distanceMeters === "number" ? patch.distanceMeters : previous?.distanceMeters ?? null
  };
}

async function updateTelegramPresenceRecord(
  supabase: ReturnType<typeof createClient>,
  person: TelegramColleagueChat,
  patch: Partial<TelegramColleaguePresence>
) {
  const records = await loadTelegramPresenceRecords(supabase);
  const previous = records.find((item) => item.chatId === person.chatId);
  const next = buildPresenceRecord(person, previous, patch);
  await saveTelegramPresenceRecords(
    supabase,
    [next, ...records.filter((item) => item.chatId !== next.chatId)]
  );
  return { previous, current: next };
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function getDistanceMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
) {
  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(toLatitude - fromLatitude);
  const deltaLongitude = toRadians(toLongitude - fromLongitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(fromLatitude)) * Math.cos(toRadians(toLatitude))
    * Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getTelegramPersonFromMessage(
  message: Record<string, unknown>,
  fallbackChatId: number | string
): TelegramColleagueChat {
  const from = message.from as {
    id?: unknown;
    first_name?: unknown;
    last_name?: unknown;
    username?: unknown;
  } | undefined;
  const chatId = typeof from?.id === "number" || typeof from?.id === "string"
    ? String(from.id)
    : String(fallbackChatId);
  return {
    chatId,
    firstName: typeof from?.first_name === "string" ? from.first_name.trim() : "",
    lastName: typeof from?.last_name === "string" ? from.last_name.trim() : "",
    username: typeof from?.username === "string" ? from.username.trim() : "",
    updatedAt: new Date().toISOString()
  };
}

function getTelegramColleagueDisplayName(record: TelegramColleagueChat) {
  const fullName = [record.firstName, record.lastName].filter(Boolean).join(" ").trim();
  return fullName || (record.username ? `@${record.username}` : `id ${record.chatId}`);
}

function getTelegramColleagueFirstName(record: TelegramColleagueChat) {
  return record.firstName || (record.username ? `@${record.username}` : "հարգելի կոլեգա");
}

function buildColleagueApprovalReplyMarkup(chatId: string) {
  return {
    inline_keyboard: [
      [
        { text: "Հաստատել", callback_data: `approve_colleague:${chatId}` },
        { text: "Մերժել", callback_data: `reject_colleague:${chatId}` }
      ]
    ]
  };
}

function buildAndroidDeviceApprovalReplyMarkup(deviceId: string) {
  return {
    inline_keyboard: [
      [
        { text: "Հաստատել", callback_data: `approve_android_device:${deviceId}` },
        { text: "Մերժել", callback_data: `reject_android_device:${deviceId}` }
      ]
    ]
  };
}

function getAndroidDeviceDisplayName(record: AndroidDeviceAccessRecord) {
  return record.deviceName || `MAINFORM ${record.deviceId.slice(0, 8)}`;
}

function buildWorkplaceLocationReplyMarkup(gpsEnabled = false) {
  const keyboard = gpsEnabled
    ? [
      [{ text: "Ես աշխատանքի եմ", request_location: true }],
      [{ text: TELEGRAM_DAY_SHIFT_BUTTON_TEXT }, { text: TELEGRAM_DISCHARGE_SHIFT_BUTTON_TEXT }]
    ]
    : [
      [{ text: TELEGRAM_DAY_SHIFT_BUTTON_TEXT }, { text: TELEGRAM_DISCHARGE_SHIFT_BUTTON_TEXT }]
    ];
  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: gpsEnabled ? "Ուղարկեք Ձեր գտնվելու վայրը" : "Ընտրեք գործողությունը"
  };
}

function buildWorkplaceSetupLocationReplyMarkup() {
  return {
    keyboard: [
      [{ text: "Սահմանել հիվանդանոցի կետը", request_location: true }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
    input_field_placeholder: "Կանգնեք հիվանդանոցում եւ ուղարկեք կետը"
  };
}

async function isTelegramColleagueApproved(
  supabase: ReturnType<typeof createClient>,
  chatId: number | string
) {
  const normalizedChatId = String(chatId);
  if (getTelegramAllowedChatIds().includes(normalizedChatId)) {
    return true;
  }
  const storedChats = await loadTelegramColleagueChats(supabase);
  return storedChats.some((item) => item.chatId === normalizedChatId);
}

async function requestTelegramColleagueApproval(
  supabase: ReturnType<typeof createClient>,
  message: Record<string, unknown>,
  chatId: number | string,
  responseChatId: number | string = chatId
) {
  const candidate = getTelegramPersonFromMessage(message, chatId);
  const pendingChats = await loadTelegramPendingColleagueChats(supabase);
  const alreadyPending = pendingChats.some((item) => item.chatId === candidate.chatId);

  if (!alreadyPending) {
    await saveTelegramPendingColleagueChats(
      supabase,
      [candidate, ...pendingChats.filter((item) => item.chatId !== candidate.chatId)]
    );

    const adminChatIds = getTelegramAdminChatIds();
    if (adminChatIds.length) {
      const adminText = [
        "Новая заявка на подключение к Mainflow боту.",
        `Пользователь: ${getTelegramColleagueDisplayName(candidate)}`,
        candidate.username ? `Username: @${candidate.username}` : "",
        `Chat ID: ${candidate.chatId}`,
        `Время: ${getYerevanDateTimeText()}`,
        "",
        "Разрешить этому коллеге работать с ботом?"
      ].filter(Boolean).join("\n");
      for (const adminChatId of adminChatIds) {
        await sendTelegramMessageWithReplyMarkup(
          adminChatId,
          adminText,
          buildColleagueApprovalReplyMarkup(candidate.chatId)
        ).catch((error) => {
          console.error("Failed to send Telegram access request:", sanitizePublicErrorMessage(error));
        });
      }
    }
  }

  const firstName = getTelegramColleagueFirstName(candidate);
  await sendTelegramMessage(
    responseChatId,
    [
      `${firstName}, Ձեր միացման հայտը ուղարկել եմ Վադիմ Աշոտիչին։`,
      "Մինչեւ նա սեղմի «Հաստատել», աշխատանքային հրամանները փակ են։",
      "Մի փոքր պահակություն մուտքի մոտ. տվյալները սիրում են կարգուկանոն, իսկ ես՝ հանգիստ ու գեղեցիկ ընթացք։"
    ].join("\n")
  );
}

async function requestAndroidDeviceApproval(
  supabase: ReturnType<typeof createClient>,
  deviceId: string,
  deviceName: string,
  departmentId: DepartmentId
) {
  const pendingDevices = await loadPendingAndroidDevices(supabase);
  const alreadyPending = pendingDevices.some((item) => item.deviceId === deviceId);
  const now = new Date().toISOString();
  const nextRecord: AndroidDeviceAccessRecord = {
    deviceId,
    deviceName,
    requestedAt: pendingDevices.find((item) => item.deviceId === deviceId)?.requestedAt || now,
    updatedAt: now,
    approvedAt: "",
    blockedAt: "",
    lastSeenAt: now,
    lastDepartmentId: departmentId,
    fcmToken: pendingDevices.find((item) => item.deviceId === deviceId)?.fcmToken || "",
    fcmTokenUpdatedAt: pendingDevices.find((item) => item.deviceId === deviceId)?.fcmTokenUpdatedAt || ""
  };

  await savePendingAndroidDevices(
    supabase,
    [nextRecord, ...pendingDevices.filter((item) => item.deviceId !== deviceId)]
  );

  if (alreadyPending) {
    return nextRecord;
  }

  const department = DEPARTMENTS[departmentId];
  const messageText = [
    "MAINFORM Android հավելվածը խնդրում է մուտքի թույլտվություն։",
    `Սարք: ${getAndroidDeviceDisplayName(nextRecord)}`,
    `ID: ${deviceId}`,
    `Բաժանմունք: ${department.marker} ${department.department}`,
    "",
    "Եթե հաստատեք, այս սարքը հաջորդ անգամ նույն MAINFORM.apk-ից կաշխատի առանց նոր հարցման։"
  ].join("\n");

  const adminChatIds = getTelegramAdminChatIds();
  if (!adminChatIds.length) {
    throw new Error("Telegram admin chats are not configured.");
  }

  for (const adminChatId of adminChatIds) {
    await sendTelegramMessageWithReplyMarkup(
      adminChatId,
      messageText,
      buildAndroidDeviceApprovalReplyMarkup(deviceId)
    ).catch((error) => {
      console.error("Failed to send Android device access request:", sanitizePublicErrorMessage(error));
    });
  }

  return nextRecord;
}

async function approveAndroidDevice(
  supabase: ReturnType<typeof createClient>,
  deviceId: string
) {
  const normalizedDeviceId = sanitizeAndroidDeviceId(deviceId);
  if (!normalizedDeviceId) {
    throw new Error("Android device id is missing.");
  }

  const [pendingDevices, approvedDevices, blockedDevices] = await Promise.all([
    loadPendingAndroidDevices(supabase),
    loadApprovedAndroidDevices(supabase),
    loadBlockedAndroidDevices(supabase)
  ]);
  const sourceRecord = pendingDevices.find((item) => item.deviceId === normalizedDeviceId)
    || approvedDevices.find((item) => item.deviceId === normalizedDeviceId)
    || blockedDevices.find((item) => item.deviceId === normalizedDeviceId);

  if (!sourceRecord) {
    throw new Error("Android device request not found.");
  }

  const now = new Date().toISOString();
  const approvedRecord: AndroidDeviceAccessRecord = {
    ...sourceRecord,
    updatedAt: now,
    approvedAt: sourceRecord.approvedAt || now,
    blockedAt: "",
    lastSeenAt: sourceRecord.lastSeenAt || now
  };

  await Promise.all([
    saveApprovedAndroidDevices(
      supabase,
      [approvedRecord, ...approvedDevices.filter((item) => item.deviceId !== normalizedDeviceId)]
    ),
    savePendingAndroidDevices(
      supabase,
      pendingDevices.filter((item) => item.deviceId !== normalizedDeviceId)
    ),
    saveBlockedAndroidDevices(
      supabase,
      blockedDevices.filter((item) => item.deviceId !== normalizedDeviceId)
    )
  ]);

  return approvedRecord;
}

async function rejectAndroidDevice(
  supabase: ReturnType<typeof createClient>,
  deviceId: string
) {
  const normalizedDeviceId = sanitizeAndroidDeviceId(deviceId);
  if (!normalizedDeviceId) {
    throw new Error("Android device id is missing.");
  }

  const [pendingDevices, blockedDevices] = await Promise.all([
    loadPendingAndroidDevices(supabase),
    loadBlockedAndroidDevices(supabase)
  ]);
  const sourceRecord = pendingDevices.find((item) => item.deviceId === normalizedDeviceId)
    || blockedDevices.find((item) => item.deviceId === normalizedDeviceId);

  if (!sourceRecord) {
    throw new Error("Android device request not found.");
  }

  const now = new Date().toISOString();
  const blockedRecord: AndroidDeviceAccessRecord = {
    ...sourceRecord,
    updatedAt: now,
    approvedAt: "",
    blockedAt: now
  };

  await Promise.all([
    savePendingAndroidDevices(
      supabase,
      pendingDevices.filter((item) => item.deviceId !== normalizedDeviceId)
    ),
    saveBlockedAndroidDevices(
      supabase,
      [blockedRecord, ...blockedDevices.filter((item) => item.deviceId !== normalizedDeviceId)]
    )
  ]);

  return blockedRecord;
}

async function getAndroidDeviceAccessState(
  supabase: ReturnType<typeof createClient>,
  deviceId: string,
  deviceName: string,
  departmentId: DepartmentId
) {
  const normalizedDeviceId = sanitizeAndroidDeviceId(deviceId);
  const normalizedDeviceName = sanitizeAndroidDeviceName(deviceName) || "Android MAINFORM";
  if (!normalizedDeviceId) {
    return { status: "missing" as const, record: null };
  }

  const [approvedDevices, pendingDevices, blockedDevices] = await Promise.all([
    loadApprovedAndroidDevices(supabase),
    loadPendingAndroidDevices(supabase),
    loadBlockedAndroidDevices(supabase)
  ]);

  const approvedRecord = approvedDevices.find((item) => item.deviceId === normalizedDeviceId);
  if (approvedRecord) {
    const now = new Date().toISOString();
    const nextApprovedRecord: AndroidDeviceAccessRecord = {
      ...approvedRecord,
      deviceName: normalizedDeviceName,
      updatedAt: now,
      lastSeenAt: now,
      lastDepartmentId: departmentId
    };
    await saveApprovedAndroidDevices(
      supabase,
      [nextApprovedRecord, ...approvedDevices.filter((item) => item.deviceId !== normalizedDeviceId)]
    );
    return { status: "approved" as const, record: nextApprovedRecord };
  }

  const blockedRecord = blockedDevices.find((item) => item.deviceId === normalizedDeviceId);
  if (blockedRecord) {
    return { status: "blocked" as const, record: blockedRecord };
  }

  const pendingRecord = pendingDevices.find((item) => item.deviceId === normalizedDeviceId);
  if (pendingRecord) {
    const now = new Date().toISOString();
    const nextPendingRecord: AndroidDeviceAccessRecord = {
      ...pendingRecord,
      deviceName: normalizedDeviceName,
      updatedAt: now,
      lastSeenAt: now,
      lastDepartmentId: departmentId
    };
    await savePendingAndroidDevices(
      supabase,
      [nextPendingRecord, ...pendingDevices.filter((item) => item.deviceId !== normalizedDeviceId)]
    );
    return { status: "pending" as const, record: nextPendingRecord };
  }

  const createdPendingRecord = await requestAndroidDeviceApproval(
    supabase,
    normalizedDeviceId,
    normalizedDeviceName,
    departmentId
  );
  return { status: "pending" as const, record: createdPendingRecord };
}

async function saveAndroidDevicePushToken(
  supabase: ReturnType<typeof createClient>,
  deviceId: string,
  deviceName: string,
  departmentId: DepartmentId,
  fcmToken: string
) {
  const normalizedDeviceId = sanitizeAndroidDeviceId(deviceId);
  if (!normalizedDeviceId) {
    throw new Error("Android device id is missing.");
  }

  const normalizedDeviceName = sanitizeAndroidDeviceName(deviceName) || "Android MAINFORM";
  const normalizedToken = sanitizeAndroidDevicePushToken(fcmToken);
  const now = new Date().toISOString();
  const [approvedDevices, pendingDevices, blockedDevices] = await Promise.all([
    loadApprovedAndroidDevices(supabase),
    loadPendingAndroidDevices(supabase),
    loadBlockedAndroidDevices(supabase)
  ]);

  const patchRecord = (record: AndroidDeviceAccessRecord): AndroidDeviceAccessRecord => ({
    ...record,
    deviceName: normalizedDeviceName,
    updatedAt: now,
    lastSeenAt: now,
    lastDepartmentId: departmentId,
    fcmToken: normalizedToken,
    fcmTokenUpdatedAt: now
  });

  const approvedRecord = approvedDevices.find((item) => item.deviceId === normalizedDeviceId);
  if (approvedRecord) {
    const nextRecord = patchRecord(approvedRecord);
    await saveApprovedAndroidDevices(
      supabase,
      [nextRecord, ...approvedDevices.filter((item) => item.deviceId !== normalizedDeviceId)]
    );
    return nextRecord;
  }

  const pendingRecord = pendingDevices.find((item) => item.deviceId === normalizedDeviceId);
  if (pendingRecord) {
    const nextRecord = patchRecord(pendingRecord);
    await savePendingAndroidDevices(
      supabase,
      [nextRecord, ...pendingDevices.filter((item) => item.deviceId !== normalizedDeviceId)]
    );
    return nextRecord;
  }

  const blockedRecord = blockedDevices.find((item) => item.deviceId === normalizedDeviceId);
  if (blockedRecord) {
    const nextRecord = patchRecord(blockedRecord);
    await saveBlockedAndroidDevices(
      supabase,
      [nextRecord, ...blockedDevices.filter((item) => item.deviceId !== normalizedDeviceId)]
    );
    return nextRecord;
  }

  const createdPendingRecord = await requestAndroidDeviceApproval(
    supabase,
    normalizedDeviceId,
    normalizedDeviceName,
    departmentId
  );
  const nextRecord = patchRecord(createdPendingRecord);
  await savePendingAndroidDevices(
    supabase,
    [nextRecord, ...pendingDevices.filter((item) => item.deviceId !== normalizedDeviceId)]
  );
  return nextRecord;
}

async function clearAndroidDevicePushToken(
  supabase: ReturnType<typeof createClient>,
  deviceId: string
) {
  const normalizedDeviceId = sanitizeAndroidDeviceId(deviceId);
  if (!normalizedDeviceId) {
    return;
  }

  const [approvedDevices, pendingDevices, blockedDevices] = await Promise.all([
    loadApprovedAndroidDevices(supabase),
    loadPendingAndroidDevices(supabase),
    loadBlockedAndroidDevices(supabase)
  ]);

  const now = new Date().toISOString();
  const clearRecord = (record: AndroidDeviceAccessRecord): AndroidDeviceAccessRecord => ({
    ...record,
    updatedAt: now,
    fcmToken: "",
    fcmTokenUpdatedAt: now
  });

  const nextApproved = approvedDevices.map((item) =>
    item.deviceId === normalizedDeviceId ? clearRecord(item) : item
  );
  const nextPending = pendingDevices.map((item) =>
    item.deviceId === normalizedDeviceId ? clearRecord(item) : item
  );
  const nextBlocked = blockedDevices.map((item) =>
    item.deviceId === normalizedDeviceId ? clearRecord(item) : item
  );

  await Promise.all([
    saveApprovedAndroidDevices(supabase, nextApproved),
    savePendingAndroidDevices(supabase, nextPending),
    saveBlockedAndroidDevices(supabase, nextBlocked)
  ]);
}

async function sendAndroidDevicePushNotification(
  supabase: ReturnType<typeof createClient>,
  device: AndroidDeviceAccessRecord,
  notification: AndroidDeviceNotificationRecord
) {
  const config = getFirebasePushServiceConfig();
  if (!config || !device.fcmToken) {
    return false;
  }

  try {
    const accessToken = await getFirebasePushAccessToken(config);
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          message: {
            token: device.fcmToken,
            notification: {
              title: notification.title,
              body: notification.message
            },
            android: {
              priority: "high",
              notification: {
                channel_id: "mainform_ocr_results",
                sound: "default"
              }
            },
            data: {
              id: notification.id,
              departmentId: notification.departmentId,
              title: notification.title,
              message: notification.message,
              level: notification.level,
              feedbackId: notification.feedbackId || "",
              reportDate: notification.reportDate || "",
              source: notification.source || ""
            }
          }
        })
      }
    );

    if (response.ok) {
      return true;
    }

    const errorText = await response.text();
    console.error("Android Firebase push send failed:", errorText);
    if (/UNREGISTERED|registration-token-not-registered|Requested entity was not found/i.test(errorText)) {
      await clearAndroidDevicePushToken(supabase, device.deviceId);
    }
  } catch (error) {
    console.error("Android Firebase push send failed:", sanitizePublicErrorMessage(error));
  }

  return false;
}

function buildAndroidDepartmentNotificationTitle(departmentId: DepartmentId, level: "success" | "warning") {
  const department = DEPARTMENTS[departmentId];
  const prefix = level === "success" ? "OCR сохранен" : "OCR требует проверки";
  return `${prefix}: ${department.marker} ${department.department}`;
}

function buildAndroidDepartmentNotificationTitleFixed(departmentId: DepartmentId, level: "success" | "warning") {
  const department = DEPARTMENTS[departmentId];
  const prefix = level === "success"
    ? "\u041A\u043E\u043D\u0442\u0440\u043E\u043B \u0441\u0443\u043C \u043F\u0440\u043E\u0439\u0434\u0435\u043D"
    : "\u041A\u043E\u043D\u0442\u0440\u043E\u043B \u0441\u0443\u043C \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D";
  return `${prefix}: ${department.marker} ${department.department}`;
}

async function queueAndroidDepartmentNotifications(
  supabase: any,
  departmentId: DepartmentId,
  payload: {
    level: "success" | "warning";
    message: string;
    feedbackId?: string;
    reportDate?: string;
    source?: string;
  }
) {
  const approvedDevices = await loadApprovedAndroidDevices(supabase);
  const targetDevices = approvedDevices.filter((item) => item.lastDepartmentId === departmentId);
  if (!targetDevices.length) {
    return [];
  }

  const existing = await loadAndroidDeviceNotifications(supabase);
  const createdAt = new Date().toISOString();
  const newEvents = targetDevices.map((item) => ({
    id: crypto.randomUUID(),
    deviceId: item.deviceId,
    departmentId,
    title: buildAndroidDepartmentNotificationTitleFixed(departmentId, payload.level),
    message: payload.message,
    createdAt,
    deliveredAt: "",
    level: payload.level,
    source: payload.source || "android-intake-ocr",
    feedbackId: payload.feedbackId || "",
    reportDate: payload.reportDate || ""
  } satisfies AndroidDeviceNotificationRecord));

  await saveAndroidDeviceNotifications(supabase, [...newEvents, ...existing]);
  await Promise.all(
    newEvents.map((event) => {
      const targetDevice = targetDevices.find((item) => item.deviceId === event.deviceId);
      return targetDevice
        ? sendAndroidDevicePushNotification(supabase, targetDevice, event)
        : Promise.resolve(false);
    })
  );
  return newEvents;
}

async function listPendingAndroidDeviceNotifications(
  supabase: any,
  deviceId: string
) {
  const normalizedDeviceId = sanitizeAndroidDeviceId(deviceId);
  if (!normalizedDeviceId) {
    return [];
  }

  const notifications = await loadAndroidDeviceNotifications(supabase);
  return notifications
    .filter((item) => item.deviceId === normalizedDeviceId && !item.deliveredAt)
    .sort((left, right) => Date.parse(left.createdAt || "") - Date.parse(right.createdAt || ""));
}

async function acknowledgeAndroidDeviceNotifications(
  supabase: any,
  deviceId: string,
  notificationIds: string[]
) {
  const normalizedDeviceId = sanitizeAndroidDeviceId(deviceId);
  if (!normalizedDeviceId || !notificationIds.length) {
    return 0;
  }

  const notifications = await loadAndroidDeviceNotifications(supabase);
  const notificationIdsSet = new Set(notificationIds);
  const deliveredAt = new Date().toISOString();
  let updated = 0;
  const nextNotifications = notifications.map((item) => {
    if (item.deviceId !== normalizedDeviceId || !notificationIdsSet.has(item.id) || item.deliveredAt) {
      return item;
    }
    updated += 1;
    return {
      ...item,
      deliveredAt
    };
  });

  if (updated > 0) {
    await saveAndroidDeviceNotifications(supabase, nextNotifications);
  }

  return updated;
}

type DepartmentFormAccessContext = {
  mode: "telegram" | "android";
  telegramUser: Awaited<ReturnType<typeof verifyTelegramWebAppInitData>> | null;
  userId: number | null;
  userName: string;
};

async function verifyDepartmentFormAccess(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown> | null,
  departmentId: DepartmentId
): Promise<{ ok: true; context: DepartmentFormAccessContext } | { ok: false; status: number; error: string }> {
  const initData = String(payload?.initData || "");
  if (initData) {
    const verifiedUser = await verifyTelegramWebAppInitData(initData);
    if (!verifiedUser) {
      return { ok: false, status: 403, error: "Telegram Web App authorization failed." };
    }
    if (!await isTelegramUserAllowedByRuntimeState(supabase, verifiedUser.userId)) {
      return {
        ok: false,
        status: 403,
        error: "Բոտը ժամանակավորապես անջատված է կոլեգաների համար։ Խնդրում ենք դիմել ադմինիստրատորին։"
      };
    }
    return {
      ok: true,
      context: {
        mode: "telegram",
        telegramUser: verifiedUser,
        userId: verifiedUser.userId,
        userName: [
          verifiedUser.firstName,
          verifiedUser.lastName,
          verifiedUser.username ? `@${verifiedUser.username}` : ""
        ].filter(Boolean).join(" ")
      }
    };
  }

  const deviceId = sanitizeAndroidDeviceId(
    typeof payload?.androidDeviceId === "string" ? payload.androidDeviceId : ""
  );
  const deviceName = sanitizeAndroidDeviceName(
    typeof payload?.androidDeviceName === "string" ? payload.androidDeviceName : ""
  ) || "Android MAINFORM";
  if (!deviceId) {
    return {
      ok: false,
      status: 403,
      error: "Բացեք ձևը Telegram բոտի կամ հաստատված Android հավելվածի միջոցով։"
    };
  }

  const accessState = await getAndroidDeviceAccessState(supabase, deviceId, deviceName, departmentId);
  if (accessState.status === "blocked") {
    return {
      ok: false,
      status: 403,
      error: "Այս Android սարքի հասանելիությունը արգելափակված է Telegram բոտի միջոցով։"
    };
  }
  if (accessState.status !== "approved") {
    return {
      ok: false,
      status: 403,
      error: "Android սարքի մուտքը դեռ չի հաստատվել։ Հաստատեք այն Telegram բոտում և նորից փորձեք։"
    };
  }

  return {
    ok: true,
    context: {
      mode: "android",
      telegramUser: null,
      userId: null,
      userName: `Android MAINFORM: ${accessState.record?.deviceName || deviceName}`
    }
  };
}

function sanitizeAndroidPhotoDataUrl(value: unknown): string {
  return typeof value === "string" && value.startsWith("data:image/") ? value : "";
}

function sanitizeAndroidPhotoName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 255) : "";
}

function sanitizeAndroidPhotoDetectedDepartmentId(value: unknown): DepartmentId | null {
  if (typeof value !== "string") {
    return null;
  }
  return parseDepartmentId(value);
}

async function handleAndroidPhotoCheck(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const departmentId = parseDepartmentId(typeof payload?.departmentId === "string" ? payload.departmentId : "");
    if (!departmentId) {
      return jsonResponse({ ok: false, error: "Department is required." }, 400);
    }

    const supabase = createSupabaseAdmin();
    const access = await verifyDepartmentFormAccess(supabase, payload, departmentId);
    if (!access.ok) {
      return jsonResponse({ ok: false, error: access.error }, access.status);
    }

    const imageDataUrl = sanitizeAndroidPhotoDataUrl(payload?.imageDataUrl);
    const imageName = sanitizeAndroidPhotoName(payload?.imageName) || "android-photo.jpg";
    if (!imageDataUrl) {
      return jsonResponse({ ok: false, error: "Photo is required." }, 400);
    }

    const shouldAutoRotatePhoto = await isTelegramPhotoAutoRotateEnabled(supabase);
    const preparedPhoto = await inspectTelegramPhotoOrientation(
      imageDataUrl,
      imageName,
      {
        requireAdvice: false,
        enabled: shouldAutoRotatePhoto
      }
    );
    const detection = await detectDepartmentFromPhoto(preparedPhoto.dataUrl);
    const detectedDepartmentId = detection.departmentId || "";
    const matched = detectedDepartmentId === departmentId;
    const message = matched
      ? "Фото готово к отправке."
      : detectedDepartmentId
        ? "Фото не соответствует выбранному отделению."
        : "Отделение не опознано, сделайте повторное фото.";

    return jsonResponse({
      ok: true,
      matched,
      detectedDepartmentId,
      normalizedImageDataUrl: preparedPhoto.dataUrl,
      normalizedImageName: preparedPhoto.fileName,
      message
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      service: "Mainflow-telegram",
      status: "android_photo_check_failed",
      error: getErrorText(error)
    }, 500);
  }
}

async function verifyAndroidIntakeHubAccess(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown> | null
) {
  const deviceId = sanitizeAndroidDeviceId(
    typeof payload?.androidDeviceId === "string" ? payload.androidDeviceId : ""
  );
  const deviceName = sanitizeAndroidDeviceName(
    typeof payload?.androidDeviceName === "string" ? payload.androidDeviceName : ""
  ) || "Android MAINFORM";

  if (!deviceId) {
    return {
      ok: false as const,
      status: 403,
      error: "Բացեք էջը հաստատված Android հավելվածից։"
    };
  }

  const accessState = await getAndroidDeviceAccessState(supabase, deviceId, deviceName, "r4");
  if (accessState.status === "blocked") {
    return {
      ok: false as const,
      status: 403,
      error: "Այս Android սարքի հասանելիությունը արգելափակված է։"
    };
  }
  if (accessState.status !== "approved") {
    return {
      ok: false as const,
      status: 403,
      error: "Android սարքի մուտքը դեռ չի հաստատվել։"
    };
  }

  return {
    ok: true as const,
    deviceId,
    deviceName
  };
}

async function handleAndroidIntakeState(request: Request) {
  try {
    const currentUrl = new URL(request.url);
    const payload = {
      androidDeviceId: currentUrl.searchParams.get("deviceId") || "",
      androidDeviceName: currentUrl.searchParams.get("deviceName") || ""
    };
    const supabase = createSupabaseAdmin();
    const access = await verifyAndroidIntakeHubAccess(supabase, payload);
    if (!access.ok) {
      return jsonResponse({ ok: false, error: access.error }, access.status);
    }

    const snapshot = await loadSnapshot(supabase);
    const reportDate = snapshot.reportDate || getYerevanReportDateText();
    const session = getAndroidIntakeSessionContext();
    const latestPhotos = await listAndroidIntakeSessionPhotoRecords(
      supabase,
      session.sessionStartIso,
      session.sessionEndIso
    );
    const latestByDepartment = new Map(latestPhotos.map((item) => [item.departmentId, item]));

    return jsonResponse({
      ok: true,
      reportDate,
      sessionKey: session.sessionKey,
      sessionLabel: session.sessionLabel,
      sessionStartIso: session.sessionStartIso,
      sessionEndIso: session.sessionEndIso,
      departments: Object.entries(DEPARTMENTS).map(([departmentId, meta]) => ({
        departmentId,
        marker: meta.marker,
        departmentName: meta.department,
        latestPhoto: latestByDepartment.get(departmentId as DepartmentId) || null
      }))
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      service: "Mainflow-telegram",
      status: "android_intake_state_failed",
      error: getErrorText(error)
    }, 500);
  }
}

async function handleAndroidIntakePhotoSubmit(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const departmentId = parseDepartmentId(typeof payload?.departmentId === "string" ? payload.departmentId : "");
    if (!departmentId) {
      return jsonResponse({ ok: false, error: "Department is required." }, 400);
    }

    const supabase = createSupabaseAdmin();
    const access = await verifyAndroidIntakeHubAccess(supabase, payload);
    if (!access.ok) {
      return jsonResponse({ ok: false, error: access.error }, access.status);
    }

    const snapshot = await loadSnapshot(supabase);
    const reportDate = sanitizeReportDate(payload?.reportDate) || snapshot.reportDate || getYerevanReportDateText();
    const imageDataUrl = sanitizeAndroidPhotoDataUrl(payload?.imageDataUrl);
    const imageName = sanitizeAndroidPhotoName(payload?.imageName) || "admission-hub-photo.jpg";
    if (!imageDataUrl) {
      return jsonResponse({ ok: false, error: "Photo is required." }, 400);
    }

    const shouldAutoRotatePhoto = await isTelegramPhotoAutoRotateEnabled(supabase);
    const preparedPhoto = await inspectTelegramPhotoOrientation(
      imageDataUrl,
      imageName,
      {
        requireAdvice: false,
        enabled: shouldAutoRotatePhoto
      }
    );
    const liveDepartmentRow = snapshot?.rows.find((item) => item.id === departmentId) || null;
    const recognized = await recognizeDepartmentPhoto(departmentId, preparedPhoto.dataUrl);
    const evaluation = evaluateTelegramPhotoRecognitionCandidate(
      recognized,
      liveDepartmentRow?.values
    );
    const outcomeNote = evaluation.isControlPassed
      ? "\u041A\u043E\u043D\u0442\u0440\u043E\u043B \u0441\u0443\u043C \u043F\u0440\u043E\u0439\u0434\u0435\u043D. \u0414\u0430\u043D\u043D\u044B\u0435 OCR \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u0432 \u043E\u0441\u043D\u043E\u0432\u043D\u0443\u044E \u0442\u0430\u0431\u043B\u0438\u0446\u0443."
      : "\u041A\u043E\u043D\u0442\u0440\u043E\u043B \u0441\u0443\u043C \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D. \u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0440\u0443\u0447\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0438 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0430 \u0438\u0437 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u043E\u0442\u0434\u0435\u043B\u0435\u043D\u0438\u044F.";
    const responseMessage = evaluation.isControlPassed
      ? ANDROID_OCR_SUCCESS_NOTIFICATION_MESSAGE
      : ANDROID_OCR_FAILURE_NOTIFICATION_MESSAGE;
    const feedbackId = await insertAcceptedFeedback(
      supabase,
      departmentId,
      reportDate,
      recognized.reportDate,
      preparedPhoto.fileName,
      preparedPhoto.dataUrl,
      recognized.values,
      recognized.recognizedKeys,
      [
        "Admission hub Android photo.",
        `Device: ${access.deviceName}`,
        "OCR review required before manual save to the main table.",
        outcomeNote,
        ...preparedPhoto.orientationNotes,
        ...recognized.notes
      ]
    );
    let autoPdfSent = false;
    if (evaluation.isControlPassed) {
      await saveDepartmentSnapshot(supabase, departmentId, reportDate, recognized.values, "photo");
      await markDepartmentPhotoProcessed(supabase, departmentId, feedbackId, preparedPhoto.fileName, "processed_photo");
      const savedSnapshot = await loadSnapshot(supabase);
      if (savedSnapshot) {
        try {
          const autoPdfResult = await maybeAutoSendMainPdfsWhenSnapshotReady(supabase, savedSnapshot);
          autoPdfSent = Boolean(autoPdfResult?.sent);
        } catch (error) {
          console.error("Failed to auto-send main PDFs after Android intake OCR save:", sanitizePublicErrorMessage(error));
        }
      }
      await queueAndroidDepartmentNotifications(supabase, departmentId, {
        level: "success",
        message: ANDROID_OCR_SUCCESS_NOTIFICATION_MESSAGE,
        feedbackId,
        reportDate,
        source: "android-intake-ocr"
      });
    } else {
      await markDepartmentPhotoPending(supabase, departmentId, feedbackId, preparedPhoto.fileName);
      await queueAndroidDepartmentNotifications(supabase, departmentId, {
        level: "warning",
        message: ANDROID_OCR_FAILURE_NOTIFICATION_MESSAGE,
        feedbackId,
        reportDate,
        source: "android-intake-ocr"
      });
    }
    const preview = await loadAcceptedFeedbackPreview(supabase, feedbackId, departmentId);

    return jsonResponse({
      ok: true,
      departmentId,
      reportDate,
      feedbackId,
      record: preview,
      controlPassed: Boolean(evaluation.isControlPassed),
      hasRecognizedValues: Boolean(evaluation.hasRecognizedValues),
      message: evaluation.isControlPassed
        ? "Լուսանկարը ուղարկվել է։ OCR-ը մշակել է այն, բայց մինչ պահպանումը ստուգեք տվյալները վեբ էջում։"
        : "Լուսանկարը ուղարկվել է։ OCR-ը մշակել է այն, բայց տվյալները պետք է ձեռքով ստուգել և ուղղել վեբ էջում։"
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      service: "Mainflow-telegram",
      status: "android_intake_photo_submit_failed",
      error: getErrorText(error)
    }, 500);
  }
}

async function handleAndroidDeviceNotifications(request: Request) {
  try {
    const currentUrl = new URL(request.url);
    const deviceId = sanitizeAndroidDeviceId(currentUrl.searchParams.get("deviceId"));
    const deviceName = sanitizeAndroidDeviceName(currentUrl.searchParams.get("deviceName")) || "Android MAINFORM";
    const departmentId = parseDepartmentId(currentUrl.searchParams.get("departmentId"));
    if (!deviceId || !departmentId) {
      return jsonResponse({ ok: false, error: "Device and department are required." }, 400);
    }

    const supabase = createSupabaseAdmin();
    const accessState = await getAndroidDeviceAccessState(supabase, deviceId, deviceName, departmentId);
    if (accessState.status !== "approved") {
      return jsonResponse({ ok: false, error: "access_denied" }, 403);
    }

    const notifications = await listPendingAndroidDeviceNotifications(supabase, deviceId);
    return jsonResponse({
      ok: true,
      notifications
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      service: "Mainflow-telegram",
      status: "android_device_notifications_failed",
      error: getErrorText(error)
    }, 500);
  }
}

async function handleAndroidDeviceNotificationsAck(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const deviceId = sanitizeAndroidDeviceId(payload?.deviceId);
    const deviceName = sanitizeAndroidDeviceName(payload?.deviceName) || "Android MAINFORM";
    const departmentId = parseDepartmentId(payload?.departmentId);
    const notificationIds = Array.isArray(payload?.notificationIds)
      ? payload.notificationIds
        .map((item) => typeof item === "string" ? item.trim() : "")
        .filter(Boolean)
      : [];
    if (!deviceId || !departmentId || !notificationIds.length) {
      return jsonResponse({ ok: false, error: "Device, department and notification ids are required." }, 400);
    }

    const supabase = createSupabaseAdmin();
    const accessState = await getAndroidDeviceAccessState(supabase, deviceId, deviceName, departmentId);
    if (accessState.status !== "approved") {
      return jsonResponse({ ok: false, error: "access_denied" }, 403);
    }

    const updated = await acknowledgeAndroidDeviceNotifications(supabase, deviceId, notificationIds);
    return jsonResponse({
      ok: true,
      updated
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      service: "Mainflow-telegram",
      status: "android_device_notifications_ack_failed",
      error: getErrorText(error)
    }, 500);
  }
}

async function handleAndroidFirebaseConfig(_request: Request) {
  try {
    return jsonResponse(buildAndroidFirebaseConfigResponse());
  } catch (error) {
    return jsonResponse({
      ok: false,
      service: "Mainflow-telegram",
      status: "android_firebase_config_failed",
      error: getErrorText(error)
    }, 500);
  }
}

async function handleAndroidDeviceFcmRegister(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const deviceId = sanitizeAndroidDeviceId(payload?.deviceId);
    const deviceName = sanitizeAndroidDeviceName(payload?.deviceName) || "Android MAINFORM";
    const departmentId = parseDepartmentId(payload?.departmentId);
    const fcmToken = sanitizeAndroidDevicePushToken(payload?.fcmToken);
    if (!deviceId || !departmentId || !fcmToken) {
      return jsonResponse({ ok: false, error: "Device, department and fcmToken are required." }, 400);
    }

    const supabase = createSupabaseAdmin();
    const accessState = await getAndroidDeviceAccessState(supabase, deviceId, deviceName, departmentId);
    if (accessState.status === "blocked") {
      return jsonResponse({ ok: false, error: "access_denied" }, 403);
    }

    const updatedRecord = await saveAndroidDevicePushToken(
      supabase,
      deviceId,
      deviceName,
      departmentId,
      fcmToken
    );
    return jsonResponse({
      ok: true,
      approved: accessState.status === "approved",
      deviceId: updatedRecord.deviceId,
      departmentId: updatedRecord.lastDepartmentId,
      pushEnabled: Boolean(updatedRecord.fcmToken),
      fcmTokenUpdatedAt: updatedRecord.fcmTokenUpdatedAt
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      service: "Mainflow-telegram",
      status: "android_device_fcm_register_failed",
      error: getErrorText(error)
    }, 500);
  }
}

async function approveTelegramColleague(
  supabase: ReturnType<typeof createClient>,
  targetChatId: string
) {
  const pendingChats = await loadTelegramPendingColleagueChats(supabase);
  const approvedChats = await loadTelegramColleagueChats(supabase);
  const pending = pendingChats.find((item) => item.chatId === targetChatId);
  const existing = approvedChats.find((item) => item.chatId === targetChatId);
  const record = {
    ...(pending || existing || {
      chatId: targetChatId,
      firstName: "",
      lastName: "",
      username: "",
      updatedAt: ""
    }),
    updatedAt: new Date().toISOString()
  };

  await saveTelegramColleagueChats(
    supabase,
    [record, ...approvedChats.filter((item) => item.chatId !== targetChatId)]
  );
  await saveTelegramPendingColleagueChats(
    supabase,
    pendingChats.filter((item) => item.chatId !== targetChatId)
  );
  return record;
}

async function rejectTelegramColleague(
  supabase: ReturnType<typeof createClient>,
  targetChatId: string
) {
  const pendingChats = await loadTelegramPendingColleagueChats(supabase);
  const pending = pendingChats.find((item) => item.chatId === targetChatId);
  await saveTelegramPendingColleagueChats(
    supabase,
    pendingChats.filter((item) => item.chatId !== targetChatId)
  );
  return pending || {
    chatId: targetChatId,
    firstName: "",
    lastName: "",
    username: "",
    updatedAt: new Date().toISOString()
  };
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

function padYerevanTimePart(value: number) {
  return String(value).padStart(2, "0");
}

function getShiftedYerevanDate(date = new Date()) {
  return new Date(date.getTime() + YEREVAN_UTC_OFFSET_MS);
}

function getYerevanDateParts(date = new Date()) {
  const shifted = getShiftedYerevanDate(date);
  const year = shifted.getUTCFullYear();
  return {
    year,
    shortYear: padYerevanTimePart(year % 100),
    month: padYerevanTimePart(shifted.getUTCMonth() + 1),
    day: padYerevanTimePart(shifted.getUTCDate()),
    hour: padYerevanTimePart(shifted.getUTCHours()),
    minute: padYerevanTimePart(shifted.getUTCMinutes()),
    weekday: shifted.getUTCDay()
  };
}

function getYerevanDateKey(date = new Date()) {
  const parts = getYerevanDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getYerevanDateTimeText(date = new Date()) {
  const parts = getYerevanDateParts(date);
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

function getYerevanHyDateTimeText(date: Date) {
  return getYerevanDateTimeText(date);
}

function normalizeShiftReportDateTime(value: unknown, fallback = getYerevanDateTimeText()) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw) {
    return fallback;
  }

  const dateTimeMatch = raw.match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{2,4})[\s,]+(\d{1,2}):(\d{2})$/);
  const dateOnlyMatch = raw.match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{2,4})$/);
  const match = dateTimeMatch || dateOnlyMatch;
  if (!match) {
    return /\d{1,2}:\d{2}/.test(raw) ? raw : fallback;
  }

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  if (day === "05" && month === "05" && year === "2026") {
    return fallback;
  }
  if (!dateTimeMatch) {
    return fallback;
  }

  return `${day}.${month}.${year} ${match[4].padStart(2, "0")}:${match[5]}`;
}

function getYerevanReportDateText(date = new Date()) {
  const parts = getYerevanDateParts(date);
  return `${parts.day}.${parts.month}.${parts.year}`;
}

function getYerevanHour(date = new Date()) {
  const parsed = Number(getYerevanDateParts(date).hour);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAndroidIntakeSessionContext(date = new Date()) {
  const shifted = getShiftedYerevanDate(date);
  let year = shifted.getUTCFullYear();
  let month = shifted.getUTCMonth();
  let day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const minutesOfDay = (hour * 60) + minute;
  const morningStartMinutes = (10 * 60) + 5;
  const eveningStartMinutes = 19 * 60;

  if (minutesOfDay >= eveningStartMinutes) {
    const sessionStartShiftedMs = Date.UTC(year, month, day, 19, 0, 0);
    const sessionEndShiftedMs = Date.UTC(year, month, day + 1, 10, 5, 0);
    const sessionStartUtcMs = sessionStartShiftedMs - YEREVAN_UTC_OFFSET_MS;
    const sessionEndUtcMs = sessionEndShiftedMs - YEREVAN_UTC_OFFSET_MS;
    const sessionDate = new Date(sessionStartUtcMs);
    const parts = getYerevanDateParts(sessionDate);

    return {
      sessionKey: `${parts.year}-${parts.month}-${parts.day}-evening`,
      sessionStartIso: new Date(sessionStartUtcMs).toISOString(),
      sessionEndIso: new Date(sessionEndUtcMs).toISOString(),
      sessionLabel: `${parts.day}.${parts.month}.${parts.year} 19:00`
    };
  }

  if (minutesOfDay >= morningStartMinutes) {
    const sessionStartShiftedMs = Date.UTC(year, month, day, 10, 5, 0);
    const sessionEndShiftedMs = Date.UTC(year, month, day, 19, 0, 0);
    const sessionStartUtcMs = sessionStartShiftedMs - YEREVAN_UTC_OFFSET_MS;
    const sessionEndUtcMs = sessionEndShiftedMs - YEREVAN_UTC_OFFSET_MS;
    const sessionDate = new Date(sessionStartUtcMs);
    const parts = getYerevanDateParts(sessionDate);

    return {
      sessionKey: `${parts.year}-${parts.month}-${parts.day}-morning`,
      sessionStartIso: new Date(sessionStartUtcMs).toISOString(),
      sessionEndIso: new Date(sessionEndUtcMs).toISOString(),
      sessionLabel: `${parts.day}.${parts.month}.${parts.year} 10:05`
    };
  }

  {
    const previousShifted = new Date(Date.UTC(year, month, day) - (24 * 60 * 60 * 1000));
    year = previousShifted.getUTCFullYear();
    month = previousShifted.getUTCMonth();
    day = previousShifted.getUTCDate();
    const sessionStartShiftedMs = Date.UTC(year, month, day, 19, 0, 0);
    const sessionEndShiftedMs = Date.UTC(year + 0, month, day + 1, 10, 5, 0);
    const sessionStartUtcMs = sessionStartShiftedMs - YEREVAN_UTC_OFFSET_MS;
    const sessionEndUtcMs = sessionEndShiftedMs - YEREVAN_UTC_OFFSET_MS;
    const sessionDate = new Date(sessionStartUtcMs);
    const parts = getYerevanDateParts(sessionDate);

    return {
      sessionKey: `${parts.year}-${parts.month}-${parts.day}-evening`,
      sessionStartIso: new Date(sessionStartUtcMs).toISOString(),
      sessionEndIso: new Date(sessionEndUtcMs).toISOString(),
      sessionLabel: `${parts.day}.${parts.month}.${parts.year} 19:00`
    };
  }
}

function isYerevanNightDutyTime(date = new Date()) {
  const hour = getYerevanHour(date);
  return hour >= 20 || hour < 8;
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

async function loadTelegramPendingPhotoApprovals(supabase: ReturnType<typeof createClient>) {
  return parseTelegramPendingPhotoApprovals(
    await loadMetaValue(supabase, TELEGRAM_PENDING_PHOTO_APPROVALS_META_KEY)
  );
}

async function saveTelegramPendingPhotoApprovals(
  supabase: ReturnType<typeof createClient>,
  records: TelegramPendingPhotoApproval[]
) {
  const uniqueRecords = Array.from(new Map(records.map((item) => [item.id, item])).values())
    .slice(0, 80);
  await saveMetaValue(supabase, TELEGRAM_PENDING_PHOTO_APPROVALS_META_KEY, JSON.stringify(uniqueRecords));
}

async function addTelegramPendingPhotoApproval(
  supabase: ReturnType<typeof createClient>,
  record: TelegramPendingPhotoApproval
) {
  const records = await loadTelegramPendingPhotoApprovals(supabase);
  await saveTelegramPendingPhotoApprovals(supabase, [record, ...records.filter((item) => item.id !== record.id)]);
}

async function takeTelegramPendingPhotoApproval(
  supabase: ReturnType<typeof createClient>,
  id: string
) {
  const records = await loadTelegramPendingPhotoApprovals(supabase);
  const found = records.find((item) => item.id === id) || null;
  if (found) {
    await saveTelegramPendingPhotoApprovals(supabase, records.filter((item) => item.id !== id));
  }
  return found;
}

function parseTelegramBooleanFlag(value: string) {
  return ["1", "true", "yes", "on", "enabled"].includes(value.trim().toLowerCase());
}

async function isTelegramGpsScenarioEnabled(supabase: ReturnType<typeof createClient>) {
  return parseTelegramBooleanFlag(await loadMetaValue(supabase, TELEGRAM_GPS_SCENARIO_META_KEY));
}

async function setTelegramGpsScenarioEnabled(
  supabase: ReturnType<typeof createClient>,
  enabled: boolean
) {
  await saveMetaValue(supabase, TELEGRAM_GPS_SCENARIO_META_KEY, enabled ? "true" : "false");
}

async function setTelegramWorkplaceSetupPending(
  supabase: ReturnType<typeof createClient>,
  chatId: number | string
) {
  await saveMetaValue(supabase, TELEGRAM_WORKPLACE_SETUP_PENDING_META_KEY, String(chatId));
}

async function getTelegramWorkplaceSetupPending(supabase: ReturnType<typeof createClient>) {
  return (await loadMetaValue(supabase, TELEGRAM_WORKPLACE_SETUP_PENDING_META_KEY)).trim();
}

async function clearTelegramWorkplaceSetupPending(supabase: ReturnType<typeof createClient>) {
  await saveMetaValue(supabase, TELEGRAM_WORKPLACE_SETUP_PENDING_META_KEY, "");
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

async function sendNightDutyReminderToColleagues(
  supabase: ReturnType<typeof createClient>,
  options: { force?: boolean } = {}
) {
  const dateKey = getYerevanDateKey();
  if (!await isTelegramGpsScenarioEnabled(supabase)) {
    return { sent: 0, skipped: "gps_disabled", dateKey };
  }
  if (!options.force) {
    const lastSentDate = await loadMetaValue(supabase, TELEGRAM_NIGHT_DUTY_REMINDER_META_KEY);
    if (lastSentDate === dateKey) {
      return { sent: 0, skipped: "already_sent", dateKey };
    }
    if (!await areTelegramColleaguesEnabled(supabase)) {
      return { sent: 0, skipped: "colleagues_disabled", dateKey };
    }
  }

  const records = await loadTelegramPresenceRecords(supabase);
  const dutyRecords = records.filter((item) => item.status === "at_work" && !isTelegramAdminChat(item.chatId));
  if (!dutyRecords.length) {
    if (!options.force) {
      await saveMetaValue(supabase, TELEGRAM_NIGHT_DUTY_REMINDER_META_KEY, dateKey);
    }
    return { sent: 0, skipped: "no_duty_colleagues", dateKey };
  }

  const reportDateTime = getYerevanDateTimeText();
  const formUrl = getTelegramNightFormUrl(reportDateTime);
  const replyMarkup = buildTelegramNightFormReplyMarkup(formUrl);
  let sent = 0;
  for (const record of dutyRecords) {
    const firstName = getTelegramColleagueFirstName(record);
    try {
      await sendTelegramMessageWithReplyMarkup(
        record.chatId,
        [
          `Բարի լույս, ${firstName}։`,
          "Շնորհակալություն գիշերային հերթափոխի համար։ Խնդրում եմ մինչեւ ժամը 08։00 լրացնել գիշերվա ընթացքում ընդունված հիվանդների տվյալները։",
          "Եթե ընդունումներ չեն եղել, թողեք զրոները եւ ուղարկեք ձեւը։",
          "",
          "Ես այստեղ եմ, հանգիստ կպահեմ հերթը եւ կօգնեմ, որ առավոտը սկսվի առանց խառնաշփոթի։"
        ].join("\n"),
        replyMarkup
      );
      sent += 1;
    } catch (error) {
      console.error("Failed to send night duty reminder:", sanitizePublicErrorMessage(error));
    }
  }

  if (!options.force) {
    await saveMetaValue(supabase, TELEGRAM_NIGHT_DUTY_REMINDER_META_KEY, dateKey);
  }
  return { sent, skipped: "", dateKey };
}

async function sendMorningNightShiftSummaryToAdmins(
  supabase: ReturnType<typeof createClient>,
  options: { force?: boolean } = {}
) {
  const dateKey = getYerevanDateKey();
  if (!options.force) {
    const lastSentDate = await loadMetaValue(supabase, TELEGRAM_NIGHT_SHIFT_SUMMARY_META_KEY);
    if (lastSentDate === dateKey) {
      return { sent: 0, skipped: "already_sent", dateKey };
    }
  }

  const [rows, meta] = await Promise.all([
    loadNightShiftDraftRows(supabase),
    loadShiftDraftMeta(supabase, NIGHT_SHIFT_META_KEY)
  ]);
  const reportDateTime = meta.reportDateTime || getYerevanDateTimeText();
  const text = buildNightShiftSummaryText(rows, reportDateTime, "07:00 ավտոմատ ամփոփում");
  const replyMarkup = buildApplyNightShiftToMainReplyMarkup();
  const chatIds = getTelegramNotifyChatIds(null);

  if (!chatIds.length) {
    return { sent: 0, skipped: "no_chat_ids", dateKey };
  }

  let sent = 0;
  for (const chatId of chatIds) {
    try {
      await sendTelegramMessageWithReplyMarkup(chatId, text, replyMarkup);
      sent += 1;
    } catch (error) {
      console.error("Failed to send morning night-shift summary:", sanitizePublicErrorMessage(error));
    }
  }

  if (!options.force) {
    await saveMetaValue(supabase, TELEGRAM_NIGHT_SHIFT_SUMMARY_META_KEY, dateKey);
  }

  return { sent, skipped: "", dateKey };
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
  return await isTelegramColleagueApproved(supabase, chatId);
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

async function loadMainArchiveSnapshotByDateKey(
  supabase: ReturnType<typeof createClient>,
  dateKey: string
) {
  const normalizedDateKey = normalizeTelegramFormArchiveDateKey(dateKey);
  if (!normalizedDateKey) {
    return null;
  }

  const { data, error } = await (supabase as any)
    .from("sharsh_main_archives")
    .select("archive_key, report_date, snapshot")
    .eq("archive_key", normalizedDateKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const snapshot = data && typeof data.snapshot === "object" && data.snapshot
    ? data.snapshot as Record<string, unknown>
    : null;
  if (!snapshot || !Array.isArray(snapshot.rows)) {
    return null;
  }

  const rowMap = new Map<string, Record<string, unknown>>();
  for (const row of snapshot.rows as Array<Record<string, unknown>>) {
    const rowId = typeof row?.id === "string" && row.id.trim()
      ? row.id.trim()
      : (typeof row?.department_id === "string" ? row.department_id.trim() : "");
    if (!rowId) {
      continue;
    }
    rowMap.set(rowId, row);
  }

  const normalizedRows = Object.entries(DEPARTMENTS).map(([id, meta]) => {
    const saved = rowMap.get(id);
    return {
      id,
      marker: typeof saved?.marker === "string" && saved.marker.trim()
        ? saved.marker.trim()
        : meta.marker,
      department: typeof saved?.department === "string" && saved.department.trim()
        ? saved.department.trim()
        : meta.department,
      group: meta.group,
      values: sanitizeValues(saved?.values as Record<string, unknown> | undefined),
      updatedAt: typeof saved?.updatedAt === "string" && saved.updatedAt.trim()
        ? saved.updatedAt
        : (typeof saved?.updated_at === "string" && saved.updated_at.trim()
          ? saved.updated_at
          : null),
      photoWorkflowStatus: typeof saved?.photoWorkflowStatus === "string" && saved.photoWorkflowStatus.trim()
        ? saved.photoWorkflowStatus
        : (typeof saved?.photo_workflow_status === "string" && saved.photo_workflow_status.trim()
          ? saved.photo_workflow_status
          : "idle"),
      photoFeedbackId: typeof saved?.photoFeedbackId === "number"
        ? saved.photoFeedbackId
        : (typeof saved?.photo_feedback_id === "number" ? saved.photo_feedback_id : null),
      photoFeedbackUpdatedAt: typeof saved?.photoFeedbackUpdatedAt === "string" && saved.photoFeedbackUpdatedAt.trim()
        ? saved.photoFeedbackUpdatedAt
        : (typeof saved?.photo_feedback_updated_at === "string" && saved.photo_feedback_updated_at.trim()
          ? saved.photo_feedback_updated_at
          : null),
      photoName: typeof saved?.photoName === "string" && saved.photoName.trim()
        ? saved.photoName
        : (typeof saved?.photo_name === "string" ? saved.photo_name : "")
    };
  });

  return {
    ...snapshot,
    reportDate: typeof data.report_date === "string" && data.report_date.trim()
      ? data.report_date.trim()
      : (typeof snapshot.reportDate === "string" && snapshot.reportDate.trim()
        ? snapshot.reportDate.trim()
        : DEFAULT_DATE),
    rows: syncQhCalculatedSnapshotRows(normalizedRows)
  };
}

async function saveNightShiftDraft(
  supabase: ReturnType<typeof createClient>,
  rows: unknown,
  reportDateTime: string,
  options: { mergeExisting?: boolean; touchedDepartmentIds?: Set<string> } = {}
) {
  const submittedRows = sanitizeNightShiftRows(rows);
  const nightRows = options.mergeExisting
    ? await loadNightShiftDraftRows(supabase)
    : submittedRows;
  const touchedDepartmentIds = options.touchedDepartmentIds || new Set<string>();
  const departmentIdsToSave = options.mergeExisting
    ? Object.keys(DEPARTMENTS).filter((departmentId) =>
      getNightShiftRowTotal(submittedRows[departmentId]) > 0 || touchedDepartmentIds.has(departmentId)
    )
    : Object.keys(DEPARTMENTS);

  departmentIdsToSave.forEach((departmentId) => {
    nightRows[departmentId] = submittedRows[departmentId];
  });

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
      report_date: normalizeShiftReportDateTime(reportDateTime),
      updated_at: now
    });

  if (metaError) {
    throw metaError;
  }

  return nightRows;
}

async function loadNightShiftDraftRows(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("sharsh_departments")
    .select("department_id, values")
    .eq("department_group", "night_shift");

  if (error) {
    throw error;
  }

  const savedRows = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
  const map = new Map(savedRows.map((row) => [String(row.department_id || ""), row]));
  return Object.fromEntries(Object.keys(DEPARTMENTS).map((departmentId) => {
    const saved = map.get(getNightShiftRowId(departmentId));
    return [departmentId, sanitizeNightShiftRows({ [departmentId]: saved?.values })[departmentId]];
  })) as Record<string, Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number>>;
}

async function saveDayShiftDraft(
  supabase: ReturnType<typeof createClient>,
  rows: unknown,
  reportDateTime: string,
  options: { mergeExisting?: boolean; touchedDepartmentIds?: Set<string> } = {}
) {
  const submittedRows = sanitizeNightShiftRows(rows);
  const dayRows = options.mergeExisting
    ? await loadDayShiftDraftRows(supabase)
    : submittedRows;
  const touchedDepartmentIds = options.touchedDepartmentIds || new Set<string>();
  const departmentIdsToSave = options.mergeExisting
    ? Object.keys(DEPARTMENTS).filter((departmentId) =>
      getNightShiftRowTotal(submittedRows[departmentId]) > 0 || touchedDepartmentIds.has(departmentId)
    )
    : Object.keys(DEPARTMENTS);

  departmentIdsToSave.forEach((departmentId) => {
    dayRows[departmentId] = submittedRows[departmentId];
  });

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
      report_date: normalizeShiftReportDateTime(reportDateTime),
      updated_at: now
    });

  if (metaError) {
    throw metaError;
  }

  return dayRows;
}

async function loadDayShiftDraftRows(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("sharsh_departments")
    .select("department_id, values")
    .eq("department_group", "day_shift");

  if (error) {
    throw error;
  }

  const savedRows = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
  const map = new Map(savedRows.map((row) => [String(row.department_id || ""), row]));
  return Object.fromEntries(Object.keys(DEPARTMENTS).map((departmentId) => {
    const saved = map.get(getDayShiftRowId(departmentId));
    return [departmentId, sanitizeNightShiftRows({ [departmentId]: saved?.values })[departmentId]];
  })) as Record<string, Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number>>;
}

async function saveDischargeShiftDraft(
  supabase: ReturnType<typeof createClient>,
  rows: unknown,
  reportDateTime: string,
  options: { mergeExisting?: boolean; touchedDepartmentIds?: Set<string> } = {}
) {
  const submittedRows = sanitizeNightShiftRows(rows);
  const dischargeRows = options.mergeExisting
    ? await loadDischargeShiftDraftRows(supabase)
    : submittedRows;
  const touchedDepartmentIds = options.touchedDepartmentIds || new Set<string>();
  const departmentIdsToSave = options.mergeExisting
    ? Object.keys(DEPARTMENTS).filter((departmentId) =>
      getNightShiftRowTotal(submittedRows[departmentId]) > 0 || touchedDepartmentIds.has(departmentId)
    )
    : Object.keys(DEPARTMENTS);

  departmentIdsToSave.forEach((departmentId) => {
    dischargeRows[departmentId] = submittedRows[departmentId];
  });

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
      report_date: normalizeShiftReportDateTime(reportDateTime),
      updated_at: now
    });

  if (metaError) {
    throw metaError;
  }

  return dischargeRows;
}

async function loadDischargeShiftDraftRows(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("sharsh_departments")
    .select("department_id, values")
    .eq("department_group", "discharge_shift");

  if (error) {
    throw error;
  }

  const savedRows = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
  const map = new Map(savedRows.map((row) => [String(row.department_id || ""), row]));
  return Object.fromEntries(Object.keys(DEPARTMENTS).map((departmentId) => {
    const saved = map.get(getDischargeShiftRowId(departmentId));
    return [departmentId, sanitizeNightShiftRows({ [departmentId]: saved?.values })[departmentId]];
  })) as Record<string, Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number>>;
}

async function loadShiftDraftMeta(
  supabase: ReturnType<typeof createClient>,
  reportKey: string
) {
  const { data, error } = await supabase
    .from("sharsh_report_meta")
    .select("report_date, updated_at")
    .eq("report_key", reportKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    reportDateTime: normalizeShiftReportDateTime(data?.report_date),
    updatedAt: typeof data?.updated_at === "string" ? data.updated_at : ""
  };
}

async function loadShiftDraftByMode(
  supabase: ReturnType<typeof createClient>,
  mode: "night" | "day" | "discharge"
) {
  if (mode === "day") {
    const [rows, meta] = await Promise.all([
      loadDayShiftDraftRows(supabase),
      loadShiftDraftMeta(supabase, DAY_SHIFT_META_KEY)
    ]);
    return { mode, rows, ...meta };
  }

  if (mode === "discharge") {
    const [rows, meta] = await Promise.all([
      loadDischargeShiftDraftRows(supabase),
      loadShiftDraftMeta(supabase, DISCHARGE_SHIFT_META_KEY)
    ]);
    return { mode, rows, ...meta };
  }

  const [rows, meta] = await Promise.all([
    loadNightShiftDraftRows(supabase),
    loadShiftDraftMeta(supabase, NIGHT_SHIFT_META_KEY)
  ]);
  return { mode, rows, ...meta };
}

function addMainTableValue(values: Record<string, number | null>, key: string, amount: number) {
  values[key] = safeNumber(values[key]) + safeNumber(amount);
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
  if (!QH_CALC_DEPARTMENT_IDS.has(departmentId as DepartmentId)) {
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

function applyNightShiftDraftValuesToMain(
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
  const hasAnyNightValue = n1 + n2 + n3 + n4 + n5 + n6 + n7;

  if (!hasAnyNightValue) {
    return null;
  }

  // Night/day shift rows describe newly admitted patients by category,
  // so they must be added to both admission totals and current presence.
  const nightTotal = n1 + n2 + n3 + n4 + n5 + n6 + n7;
  const output = sanitizeValues(values);
  addMainTableValue(output, "admittedSeries", n1);
  if (QH_CALC_DEPARTMENT_IDS.has(departmentId as DepartmentId)) {
    addMainTableValue(output, "qhIncomingSoldier", n1);
    addMainTableValue(output, "qhIncomingOfficer", n2);
    addMainTableValue(output, "qhIncomingContract", n3);
    syncQhMorningCalculatedValues(departmentId, output);
  } else {
    addMainTableValue(output, "currentShar", n1);
    addMainTableValue(output, "currentSpa", n2);
    addMainTableValue(output, "currentPaym", n3);
  }
  addMainTableValue(output, "currentZh", n4);
  addMainTableValue(output, "family", n5);
  addMainTableValue(output, "officer", n6);
  addMainTableValue(output, "civil", n7);
  addMainTableValue(output, "admittedTotal", nightTotal);
  addMainTableValue(output, "admittedSoldier", n1 + n2 + n3);
  return output;
}

async function applyNightShiftDraftToMainFromTelegram(
  supabase: ReturnType<typeof createClient>
) {
  const [nightRows, meta, snapshot] = await Promise.all([
    loadNightShiftDraftRows(supabase),
    loadShiftDraftMeta(supabase, NIGHT_SHIFT_META_KEY),
    loadSnapshot(supabase)
  ]);
  const now = new Date().toISOString();
  const appliedDepartments: Array<{ marker: string; department: string; total: number }> = [];
  const updates = snapshot.rows.flatMap((row) => {
    const values = applyNightShiftDraftValuesToMain(row.id, row.values, nightRows[row.id]);
    if (!values) {
      return [];
    }
    const departmentMeta = DEPARTMENTS[row.id as DepartmentId];
    if (!departmentMeta) {
      return [];
    }
    appliedDepartments.push({
      marker: departmentMeta.marker,
      department: departmentMeta.department,
      total: getNightShiftRowTotal(nightRows[row.id])
    });
    return [{
      department_id: row.id,
      department_name: departmentMeta.department,
      department_group: departmentMeta.group,
      values,
      updated_at: now
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

  const reportDateTime = meta.reportDateTime || getYerevanDateTimeText();
  const { error: metaError } = await supabase
    .from("sharsh_report_meta")
    .upsert({
      report_key: "main",
      report_date: reportDateTime,
      updated_at: now
    });

  if (metaError) {
    throw metaError;
  }

  await saveNightShiftDraft(supabase, {}, reportDateTime, { mergeExisting: false });

  return {
    applied: appliedDepartments.length,
    appliedDepartments,
    reportDateTime
  };
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

  const normalizedRows = ((data || []) as Array<Record<string, unknown>>).map((row) => {
    const values = row.values && typeof row.values === "object"
      ? row.values as Record<string, unknown>
      : {};
    return {
      ...sanitizeCivilReferralRecord(values),
      id: String(row.department_id || "").replace(CIVIL_REFERRAL_ROW_PREFIX, ""),
      departmentId: String(row.department_id || ""),
      patientName: normalizeCivilReferralText(row.department_name) || normalizeCivilReferralText(values.patientName),
      updatedAt: row.updated_at || ""
    };
  });
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
      .upsert(updates as never[]);

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

function escapeCivilReferralHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCivilReferralTelegramSearchQuery(text: string) {
  const firstToken = normalizeCivilReferralText(text)
    .split(/\s+/)[0]
    .replace(/^\/+/, "")
    .replace(/@[\w_]+$/, "");
  const smartQuery = parseCivilReferralSmartQuery(firstToken);
  return smartQuery && smartQuery.mode !== "sr" ? firstToken : "";
}

function getCivilReferralDocumentFields(rows: Array<Record<string, unknown>>) {
  const hasDischargeDate = rows.some((row) => normalizeCivilReferralText(row.dischargeDate));
  return CIVIL_REFERRAL_FIELD_DEFINITIONS.filter((field) => {
    return hasDischargeDate
      ? field.key !== "referralDate"
      : field.key !== "dischargeDate";
  });
}

function getCivilReferralDocumentColumnClass(field: typeof CIVIL_REFERRAL_FIELD_DEFINITIONS[number]) {
  if (field.key === "patientName") {
    return "patient";
  }
  if (field.key === "medicalCenter") {
    return "center";
  }
  if (field.key === "militaryUnit") {
    return "unit";
  }
  if (field.key === "rank") {
    return "rank";
  }
  if (field.key === "referralDate" || field.key === "dischargeDate") {
    return "date";
  }
  return "short";
}

function buildCivilReferralSearchDocumentHtml(rows: Array<Record<string, unknown>>, query: string, total: number) {
  const generatedAt = getYerevanDateTimeText();
  const documentFields = getCivilReferralDocumentFields(rows);
  const metaText = query
    ? `Որոնում՝ ${query}`
    : "Բոլոր ցուցադրված տողերը";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Քաղ. ԲԿ բազա</title>
  <style>
    @page { size: 29.7cm 21cm; margin: 1.1cm; }
    body { font-family: "Times New Roman", "Sylfaen", serif; color: #000; font-size: 11pt; }
    h1 { margin: 0 0 8px; text-align: center; font-size: 18pt; }
    .meta { width: 100%; margin: 0 0 10px; border-collapse: collapse; }
    .meta td { border: 0; padding: 0 0 6px; font-size: 10pt; }
    .meta .right { text-align: right; }
    table.referrals { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.referrals th, table.referrals td { border: 1px solid #000; padding: 4px 5px; vertical-align: middle; }
    table.referrals th { background: #f6c894; text-align: center; font-weight: 700; }
    table.referrals td { background: #fff; }
    table.referrals td:nth-child(2) { font-weight: 700; }
    col.num { width: 0.8cm; }
    col.patient { width: 6.3cm; }
    col.center { width: 3.9cm; }
    col.unit { width: 3.2cm; }
    col.rank { width: 2.7cm; }
    col.short { width: 1.6cm; }
    col.date { width: 2.3cm; }
  </style>
</head>
<body>
  <h1>Քաղաքացիական հիվանդանոցներ</h1>
  <table class="meta">
    <tr>
      <td>${escapeCivilReferralHtml(metaText)} · ${escapeCivilReferralHtml(`Գտնվել է՝ ${total}`)}</td>
      <td class="right">Ստեղծվել է՝ ${escapeCivilReferralHtml(generatedAt)}</td>
    </tr>
  </table>
  <table class="referrals">
    <colgroup>
      <col class="num">
      ${documentFields.map((field) => `<col class="${getCivilReferralDocumentColumnClass(field)}">`).join("")}
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        ${documentFields.map((field) => `<th>${escapeCivilReferralHtml(field.label)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows.map((row, index) => `
        <tr>
          <td style="text-align:center;">${index + 1}</td>
          ${documentFields.map((field) => `<td>${escapeCivilReferralHtml(row[field.key] || "")}</td>`).join("")}
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
}

function buildCivilReferralSearchDocumentBytes(rows: Array<Record<string, unknown>>, query: string, total: number) {
  return new TextEncoder().encode(`\ufeff${buildCivilReferralSearchDocumentHtml(rows, query, total)}`);
}

function buildCivilReferralSearchDocumentFileName(query: string) {
  const safeQuery = sanitizeSheetFileNamePart(query || "search") || "search";
  const safeDate = sanitizeSheetFileNamePart(getYerevanDateTimeText().replace(/[.:]/g, "-")) || "now";
  return `Qagh_BK_${safeQuery}_${safeDate}.doc`;
}

async function sendCivilReferralSearchWordDocument(
  supabase: ReturnType<typeof createClient>,
  chatId: number | string,
  query: string
) {
  const payload = await listCivilReferrals(supabase, {
    limit: CIVIL_REFERRAL_MAX_LIMIT,
    offset: 0,
    query
  });
  const rows = Array.isArray(payload.rows) ? payload.rows as Array<Record<string, unknown>> : [];
  const total = Number(payload.total) || rows.length;
  const clippedText = total > rows.length
    ? `\nՖայլում՝ ${rows.length} տող։ Եթե պետք է ամբողջը, նեղացրեք որոնումը։`
    : "";
  const caption = [
    "Քաղ. ԲԿ բազա",
    `Հարցում՝ ${query}`,
    `Գտնվել է՝ ${total}${clippedText}`
  ].join("\n");

  await sendTelegramDocument(
    chatId,
    buildCivilReferralSearchDocumentFileName(query),
    buildCivilReferralSearchDocumentBytes(rows, query, total),
    caption,
    "application/msword;charset=utf-8"
  );
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

function getFittedDepartmentNoteText(
  rawText: string,
  font: any,
  fonts: { hasArmenian: boolean },
  maxWidth: number
) {
  const ellipsis = fonts.hasArmenian ? "…" : "...";
  const text = getPdfText(rawText, fonts, "").trim();
  if (!text) {
    return null;
  }

  let size = DEPARTMENT_PDF_NOTE_FONT_SIZE;
  while (size > DEPARTMENT_PDF_NOTE_MIN_FONT_SIZE && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.25;
  }

  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return { text, size };
  }

  let clipped = text;
  while (clipped.length > 1 && font.widthOfTextAtSize(`${clipped}${ellipsis}`, size) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }

  return {
    text: `${clipped.trimEnd()}${ellipsis}`,
    size
  };
}

function drawDepartmentPatientNotes(
  page: any,
  fonts: { regular: any; bold: any; hasArmenian: boolean },
  notes: DepartmentPatientNotes
) {
  const font = fonts.regular;
  const boldFont = fonts.bold;
  const color = rgb(0, 0, 0);
  const titleColor = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);

  page.drawRectangle({
    x: 18,
    y: 96,
    width: 800,
    height: 262,
    color: white
  });

  DEPARTMENT_PATIENT_NOTE_SECTIONS.forEach((section) => {
    const layout = DEPARTMENT_PDF_NOTE_LAYOUT[section.key];
    const title = getPdfText(section.title, fonts, "");
    if (title) {
      page.drawText(title, {
        x: layout.x,
        y: layout.titleY,
        size: 9,
        font: boldFont,
        color: titleColor
      });
    }

    const values = notes[section.key] || [];
    Array.from({ length: section.rows }).forEach((_item, index) => {
      const value = getPatientNoteDisplayText(String(values[index] || ""));
      if (!value) {
        return;
      }
      const fitted = getFittedDepartmentNoteText(`${index + 1}. ${value}`, font, fonts, layout.width);
      if (!fitted) {
        return;
      }
      page.drawText(fitted.text, {
        x: layout.x,
        y: layout.y - (index * layout.lineHeight),
        size: fitted.size,
        font,
        color
      });
    });
  });
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
  const lines = safeText.split(/\r?\n/);
  const lineHeight = size + 1.5;
  const textBlockHeight = (lines.length * size) + ((lines.length - 1) * 1.5);
  const firstLineY = y + Math.max(2, (height - textBlockHeight) / 2) + ((lines.length - 1) * lineHeight);

  lines.forEach((line, index) => {
    const textWidth = options.font.widthOfTextAtSize(line, size);
    let textX = x + padding;
    if (options.align === "center") {
      textX = x + Math.max(padding, (width - textWidth) / 2);
    } else if (options.align === "right") {
      textX = x + Math.max(padding, width - textWidth - padding);
    }
    page.drawText(line, {
      x: textX,
      y: firstLineY - (index * lineHeight),
      size,
      font: options.font,
      color: options.color || rgb(0, 0, 0)
    });
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

function drawPdfCenteredText(
  page: any,
  text: string,
  centerX: number,
  y: number,
  options: {
    font: any;
    size?: number;
    color?: ReturnType<typeof rgb>;
  }
) {
  const safeText = String(text ?? "");
  const size = options.size || 10;
  const textWidth = options.font.widthOfTextAtSize(safeText, size);
  drawPdfText(page, safeText, centerX - (textWidth / 2), y, options);
}

function drawPdfMultilineText(
  page: any,
  text: string,
  x: number,
  firstLineY: number,
  lineHeight: number,
  options: {
    font: any;
    size?: number;
    color?: ReturnType<typeof rgb>;
  }
) {
  const lines = String(text ?? "").split(/\r?\n/);
  lines.forEach((line, index) => {
    drawPdfText(page, line, x, firstLineY - (index * lineHeight), options);
  });
}

function getMainPdfPrintedAtText(date = new Date()) {
  const weekdays: Record<string, string> = {
    Sunday: "Կիրակի",
    Monday: "Երկուշաբթի",
    Tuesday: "Երեքշաբթի",
    Wednesday: "Չորեքշաբթի",
    Thursday: "Հինգշաբթի",
    Friday: "Ուրբաթ",
    Saturday: "Շաբաթ"
  };
  const parts = getYerevanDateParts(date);
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][parts.weekday] || "";
  return `${weekdays[weekday] || weekday} ${parts.day}.${parts.month}.${parts.shortYear},${parts.hour}:${parts.minute}`;
}

function getPdfFileTimestampText(date = new Date()) {
  const parts = getYerevanDateParts(date);
  return `${parts.day}.${parts.month}.${parts.shortYear},${parts.hour}-${parts.minute}`;
}

function buildTimestampedPdfFileName(fileName: string, date = new Date()) {
  const name = fileName.replace(/\.pdf$/i, "");
  return `${name}_${getPdfFileTimestampText(date)}.pdf`;
}

async function buildMainMovementPdfBytes(snapshot: Awaited<ReturnType<typeof loadSnapshot>>) {
  const pdf = await PDFDocument.create();
  const fonts = await buildPdfFonts(pdf);
  const page = pdf.addPage([841.92, 595.32]);
  const primaryRows = snapshot.rows.filter((row) => row.group === "primary");
  const extraRows = snapshot.rows.filter((row) => row.group === "extra");
  const allRows = [
    ...primaryRows,
    { id: "subtotal", marker: "", department: "Ընդամենը", group: "summary", values: {}, summaryRows: primaryRows },
    ...extraRows,
    { id: "grand", marker: "", department: "Ընդամենը", group: "summary", values: {}, summaryRows: snapshot.rows }
  ] as Array<{
    id: string;
    marker: string;
    department: string;
    group: string;
    values: Record<string, number | null>;
    summaryRows?: Array<{ values: Record<string, number | null> }>;
  }>;
  const title = getPdfText("ԿԿԶՀ-Շարժ․", fonts, "KKZH-Sharzh.");

  drawPdfText(page, getMainPdfPrintedAtText(), 24, 572, { font: fonts.regular, size: 8 });
  drawPdfCenteredText(page, title, 421, 571, { font: fonts.regular, size: 8 });
  drawPdfCenteredText(page, title, 421, 556, { font: fonts.bold, size: 12 });

  const startX = 28;
  const tableTopY = 546;
  const nameWidth = 94.4;
  const valueWidth = 29.85;
  const rowHeight = 18.5;
  const headerHeight = 23;
  const headerFill = rgb(1, 1, 1);
  const headerFillDark = rgb(1, 1, 1);
  const totalFill = rgb(1, 1, 1);
  const calcFill = rgb(1, 1, 1);
  const nameFill = rgb(1, 1, 1);
  const border = rgb(0, 0, 0);
  const labelSize = 6.3;
  const valueSize = 6.4;
  const valueX = (index: number) => startX + nameWidth + (index * valueWidth);
  const valueWidthFor = (count: number) => valueWidth * count;
  const headerY1 = tableTopY - headerHeight;
  const headerY2 = headerY1 - headerHeight;
  const headerY3 = headerY2 - headerHeight;
  const firstBodyY = headerY3 - rowHeight;
  const dateText = buildDepartmentSheetMessageDateTimeText(snapshot.reportDate);
  const headerDateText = dateText.replace(/\s+(\d{1,2}:\d{2})$/, "\n$1");
  const valueKeys = MAIN_PDF_COLUMNS.map((column) => column.key);
  const rowValue = (row: typeof allRows[number], key: string) => row.summaryRows
    ? getRowsPdfValue(row.summaryRows, key)
    : getRowPdfValue(row, key);
  const cellLabel = (text: string, fallback = text) => getPdfText(text, fonts, fallback);

  drawPdfCell(page, cellLabel("Բաժանմունք", "Department"), startX, headerY2, nameWidth, headerHeight * 2, {
    font: fonts.bold,
    size: 7,
    align: "center",
    fill: headerFill,
    border
  });

  drawPdfCell(page, cellLabel("Եղել է", "Been"), valueX(0), headerY2, valueWidthFor(3), headerHeight * 2, {
    font: fonts.bold,
    size: 7,
    align: "center",
    fill: headerFill,
    border
  });
  drawPdfCell(page, cellLabel("Ընդունվել է", "Admitted"), valueX(3), headerY2, valueWidthFor(3), headerHeight * 2, {
    font: fonts.bold,
    size: 7,
    align: "center",
    fill: headerFill,
    border
  });
  drawPdfCell(page, cellLabel("Դ/Գ", "D/G"), valueX(6), headerY2, valueWidthFor(3), headerHeight * 2, {
    font: fonts.bold,
    size: 7,
    align: "center",
    fill: headerFill,
    border
  });
  drawPdfCell(page, cellLabel("Տեղափոխ", "Transfer"), valueX(9), headerY2, valueWidthFor(2), headerHeight * 2, {
    font: fonts.bold,
    size: 7,
    align: "center",
    fill: headerFill,
    border
  });
  drawPdfCell(page, "", valueX(11), headerY1, valueWidthFor(8), headerHeight, {
    font: fonts.bold,
    size: 6.3,
    align: "center",
    fill: headerFill,
    border
  });
  drawPdfCenteredText(page, cellLabel("Առկա է", "Present"), valueX(11) + (valueWidthFor(8) / 2) - 5, headerY1 + 8.2, {
    font: fonts.bold,
    size: 6.3
  });
  drawPdfCell(page, cellLabel("որոնցից բուժական", "Medical leave"), valueX(19), headerY1, valueWidthFor(3), headerHeight, {
    font: fonts.bold,
    size: 6.4,
    align: "center",
    fill: headerFill,
    border
  });
  drawPdfCell(page, "", valueX(22), headerY1, valueWidth, headerHeight, {
    font: fonts.bold,
    size: 7,
    align: "center",
    fill: totalFill,
    border
  });

  drawPdfCell(page, cellLabel("Ընդամ", "Total"), valueX(11), headerY3, valueWidth, headerHeight * 2, {
    font: fonts.bold,
    size: labelSize,
    align: "center",
    fill: totalFill,
    border
  });
  drawPdfCell(page, cellLabel("Զինծառայող", "Soldier"), valueX(12), headerY2, valueWidthFor(3), headerHeight, {
    font: fonts.bold,
    size: labelSize,
    align: "center",
    fill: headerFill,
    border
  });
  [
    ["Զ/Հ", 15],
    ["Զ/Ծ\nԸՆՏ", 16],
    ["Զ/Պ", 17],
    ["Ք-ի", 18]
  ].forEach(([label, index]) => {
    drawPdfCell(page, cellLabel(String(label), String(label)), valueX(Number(index)), headerY3, valueWidth, headerHeight * 2, {
      font: fonts.bold,
      size: labelSize,
      align: "center",
      fill: headerFill,
      border
    });
  });
  drawPdfCell(page, cellLabel("արձակուրդում", "Leave"), valueX(19), headerY2, valueWidthFor(3), headerHeight, {
    font: fonts.bold,
    size: labelSize,
    align: "center",
    fill: headerFill,
    border
  });
  drawPdfCell(page, cellLabel("Ընդհ", "Total"), valueX(22), headerY3, valueWidth, headerHeight * 2, {
    font: fonts.bold,
    size: labelSize,
    align: "center",
    fill: totalFill,
    border
  });

  drawPdfCell(page, headerDateText, startX, headerY3, nameWidth, headerHeight, {
    font: fonts.bold,
    size: 6.2,
    align: "center",
    fill: headerFill,
    border
  });

  const row3Labels = [
    "ԸՆԴ", "Զ/Ծ", "ՇԱՐ",
    "ԸՆԴ", "Զ/Ծ", "ՇԱՐ",
    "ԸՆԴ", "Զ/Ծ", "ՇԱՐ",
    "Տեղափ\nբաժնից", "Տեղափ\nբաժին",
    "",
    "ՇԱՐ", "ՍՊԱ", "ՊԱՅՄ",
    "", "", "", "",
    "ՇԱՐ", "ՍՊԱ", "ՊԱՅՄ",
    ""
  ];
  row3Labels.forEach((label, index) => {
    if (index === 11 || index === 15 || index === 16 || index === 17 || index === 18 || index === 22) {
      return;
    }
    drawPdfCell(page, cellLabel(label, label), valueX(index), headerY3, valueWidth, headerHeight, {
      font: fonts.bold,
      size: labelSize,
      align: "center",
      fill: index === 1 || index === 4 || index === 7 ? headerFillDark : headerFill,
      border
    });
  });

  allRows.forEach((row, rowIndex) => {
    const y = firstBodyY - (rowIndex * rowHeight);
    const isSummary = Boolean(row.summaryRows);
    const rowFill = isSummary ? totalFill : undefined;
    const departmentLabel = row.summaryRows ? row.department : Array.from(row.department).slice(0, 8).join("");
    drawPdfCell(page, getPdfText(departmentLabel, fonts, row.id), startX, y, nameWidth, rowHeight, {
      font: isSummary ? fonts.bold : fonts.regular,
      size: isSummary ? 6.4 : 5.8,
      align: isSummary ? "center" : "left",
      fill: rowFill || nameFill,
      border
    });
    valueKeys.forEach((key, columnIndex) => {
      const isAccent = key === "presentTotal" || key === "leaveTotal" || (isSummary && (
        key === "beenSoldier" || key === "presentTotal" || key === "currentShar" || key === "leaveTotal"
      ));
      drawPdfCell(page, String(rowValue(row, key)), valueX(columnIndex), y, valueWidth, rowHeight, {
        font: fonts.bold,
        size: valueSize,
        align: "center",
        fill: isAccent ? calcFill : rowFill,
        border
      });
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
  const headerFill = rgb(1, 1, 1);
  const sectionFill = rgb(1, 1, 1);
  const border = rgb(0, 0, 0);

  drawPdfText(page, title, 34, 555, { font: fonts.bold, size: 20, color: rgb(0, 0, 0) });
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
  const fileNameDate = new Date();
  const reportPdfFileName = buildTimestampedPdfFileName(REPORT_PDF_FILE_NAME, fileNameDate);
  const mainPdfFileName = buildTimestampedPdfFileName(MAIN_MOVEMENT_PDF_FILE_NAME, fileNameDate);
  const captionPrefix = options.source === "morning"
    ? "Առավոտյան ավտոմատ PDF ֆայլեր"
    : "PDF ֆայլերը պատրաստ են";
  const captionDate = `Ամսաթիվ՝ ${snapshot.reportDate}`;

  for (const chatId of chatIds) {
    await sendTelegramDocument(
      chatId,
      reportPdfFileName,
      reportPdfBytes,
      `${captionPrefix}\n${captionDate}`,
      "application/pdf"
    );
    await sendTelegramDocument(
      chatId,
      mainPdfFileName,
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
    files: [reportPdfFileName, mainPdfFileName]
  };
}

function isSnapshotReadyForMainPdfAutoSend(
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>
) {
  const staleRows = snapshot.rows.filter((row) => rowNeedsFreshTelegramUpdate(snapshot, row));
  if (staleRows.length) {
    return {
      isReady: false,
      reason: "stale_rows",
      markers: staleRows.map((row) => row.marker)
    };
  }

  const invalidRows = snapshot.rows.filter((row) => !validateDepartmentSheetValues(row.values).isValid);
  if (invalidRows.length) {
    return {
      isReady: false,
      reason: "validation_failed",
      markers: invalidRows.map((row) => row.marker)
    };
  }

  return {
    isReady: true,
    reason: "",
    markers: [] as string[]
  };
}

async function maybeAutoSendMainPdfsWhenSnapshotReady(
  supabase: ReturnType<typeof createClient>,
  snapshot: Awaited<ReturnType<typeof loadSnapshot>> | null | undefined
) {
  if (!snapshot) {
    return { sent: 0, skipped: "no_snapshot", dateKey: getYerevanDateKey() };
  }

  const readiness = isSnapshotReadyForMainPdfAutoSend(snapshot);
  if (!readiness.isReady) {
    return {
      sent: 0,
      skipped: readiness.reason,
      dateKey: getYerevanDateKey(),
      markers: readiness.markers
    };
  }

  return await sendMainPdfsToTelegram(supabase, { source: "auto_ready" });
}

function buildMainPdfsAutoSentNoticeHy(sentCount: number) {
  return sentCount > 0
    ? `Բոլոր բաժանմունքները թարմացվել են։ Report.pdf և ԿԿԶՀ-Շարժ․pdf ֆայլերը ավտոմատ ուղարկվել են (${sentCount} հասցեատեր)։`
    : "";
}

async function saveDepartmentSnapshot(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  reportDate: string,
  values: Record<string, number | null>,
  source: "telegram-form" | "photo" | "site" | "rollover" | "night-shift" | "day-shift" = "telegram-form"
) {
  const departmentMeta = DEPARTMENTS[departmentId];
  const workflowStatus = source === "telegram-form"
    ? "processed_telegram"
    : (source === "photo"
      ? "processed_photo"
      : (source === "night-shift"
        ? "processed_night_shift"
        : (source === "day-shift"
          ? "processed_day_shift"
          : (source === "rollover" ? "processed_rollover" : "processed_site"))));

  const { error: rowError } = await supabase
    .from("sharsh_departments")
    .upsert({
      department_id: departmentId,
      department_name: departmentMeta.department,
      department_group: departmentMeta.group,
      values: sanitizeValues(values),
      updated_at: new Date().toISOString(),
      photo_workflow_status: workflowStatus
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

async function markDepartmentPhotoProcessed(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  feedbackId: string | number | null,
  imageName: string | null,
  workflowStatus = "processed"
) {
  const updatePayload: Record<string, unknown> = {
    photo_workflow_status: workflowStatus,
    photo_feedback_updated_at: new Date().toISOString()
  };
  if (feedbackId !== null && String(feedbackId).trim()) {
    updatePayload.photo_feedback_id = Number(feedbackId);
  }
  if (imageName) {
    updatePayload.photo_name = imageName;
  }

  const { error } = await (supabase as any)
    .from("sharsh_departments")
    .update(updatePayload)
    .eq("department_id", departmentId);

  if (error) {
    throw error;
  }
}

async function hasTelegramWebFormFeedback(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  reportDate: string
) {
  const { data, error } = await (supabase as any)
    .from("sharsh_ocr_feedback")
    .select("id")
    .eq("department_id", departmentId)
    .eq("report_date", reportDate)
    .eq("image_name", "telegram-web-app-form")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ? String(data.id) : "";
}

function extractTelegramUserNameFromFeedbackNotes(notes: unknown) {
  if (!Array.isArray(notes)) {
    return "";
  }
  for (const note of notes) {
    const text = String(note || "");
    const match = text.match(/^Telegram user:\s*(.+)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function buildDepartmentSubmissionSourceLabel(
  imageName: string,
  notes: unknown
) {
  const normalizedNotes = Array.isArray(notes)
    ? notes.map((item) => String(item || ""))
    : [];
  if (normalizedNotes.some((note) => /Submitted via Android MAINFORM/i.test(note))) {
    return "Android MAINFORM";
  }
  if (imageName === "telegram-qh-form") {
    return "Telegram QH form";
  }
  return "Telegram Web App";
}

function isAndroidMainformFeedbackNotes(notes: unknown) {
  const normalizedNotes = Array.isArray(notes)
    ? notes.map((item) => String(item || ""))
    : [];
  return normalizedNotes.some((note) => /Submitted via Android MAINFORM/i.test(note));
}

function getUtcIsoRangeForYerevanDateKey(dateKey: string) {
  const match = String(dateKey || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - YEREVAN_UTC_OFFSET_MS;
  const endUtcMs = startUtcMs + (24 * 60 * 60 * 1000);
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString()
  };
}

function buildAndroidMainformFeedbackRecord(row: Record<string, unknown>) {
  const id = Number(row.id);
  const departmentId = parseDepartmentId(row.department_id);
  const imageDataUrl = typeof row.image_data_url === "string" ? row.image_data_url.trim() : "";
  if (!Number.isFinite(id) || !departmentId || !imageDataUrl.startsWith("data:image/")) {
    return null;
  }

  return {
    id,
    departmentId,
    departmentName: typeof row.department_name === "string" && row.department_name.trim()
      ? row.department_name.trim()
      : DEPARTMENTS[departmentId].department,
    reportDate: typeof row.report_date === "string" ? row.report_date : "",
    photoReportDate: typeof row.photo_report_date === "string" ? row.photo_report_date : "",
    imageName: typeof row.image_name === "string" ? row.image_name : "",
    imageDataUrl,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    saveStatus: typeof row.save_status === "string" ? row.save_status : "",
    notes: Array.isArray(row.notes) ? row.notes.map((item) => String(item || "")) : [],
    recognizedKeys: Array.isArray(row.recognized_keys) ? row.recognized_keys.map((item) => String(item || "")) : [],
    changedKeys: [],
    recognizedValues: row.ocr_raw && typeof row.ocr_raw === "object" ? row.ocr_raw : {},
    finalValues: row.final_values && typeof row.final_values === "object" ? row.final_values : {},
    cellReviews: Array.isArray(row.cell_reviews) ? row.cell_reviews : []
  };
}

async function listAndroidMainformFeedbackRecords(
  supabase: ReturnType<typeof createClient>,
  createdDateKey: string,
  limit = 80
) {
  const normalizedLimit = Math.min(300, Math.max(1, Number.isFinite(Number(limit)) ? Number(limit) : 80));
  const range = getUtcIsoRangeForYerevanDateKey(createdDateKey || getYerevanDateKey());

  let query = (supabase as any)
    .from("sharsh_ocr_feedback")
    .select("id, department_id, department_name, report_date, photo_report_date, image_name, image_data_url, recognized_keys, ocr_raw, final_values, notes, cell_reviews, save_status, created_at")
    .order("created_at", { ascending: false })
    .limit(normalizedLimit);

  if (range) {
    query = query
      .gte("created_at", range.startIso)
      .lt("created_at", range.endIso);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => row as Record<string, unknown>)
    .filter((row) => isAndroidMainformFeedbackNotes(row.notes))
    .map(buildAndroidMainformFeedbackRecord)
    .filter(Boolean);
}

async function loadLatestDepartmentSubmissionRecord(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  reportDate: string
) {
  const { data, error } = await (supabase as any)
    .from("sharsh_ocr_feedback")
    .select("id, image_name, final_values, notes, created_at")
    .eq("department_id", departmentId)
    .eq("report_date", reportDate)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }
  const rows = Array.isArray(data) ? data : [];
  const record = rows.find((row) => {
    const imageName = typeof row?.image_name === "string" ? row.image_name : "";
    const normalizedNotes = Array.isArray(row?.notes)
      ? row.notes.map((item: unknown) => String(item || ""))
      : [];
    return imageName === "telegram-web-app-form"
      || imageName === "telegram-qh-form"
      || normalizedNotes.some((note) => /Telegram Web App form submission\./i.test(note));
  });

  if (!record?.id) {
    return null;
  }

  const imageName = typeof record.image_name === "string" ? record.image_name : "";
  return {
    id: String(record.id),
    imageName,
    values: sanitizeDepartmentFormValues(record.final_values),
    userName: extractTelegramUserNameFromFeedbackNotes(record.notes),
    createdAt: typeof record.created_at === "string" ? record.created_at : "",
    sourceLabel: buildDepartmentSubmissionSourceLabel(imageName, record.notes)
  };
}

async function loadLatestTelegramWebFormFeedback(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  reportDate: string
) {
  const { data, error } = await (supabase as any)
    .from("sharsh_ocr_feedback")
    .select("id, final_values, notes, created_at")
    .eq("department_id", departmentId)
    .eq("report_date", reportDate)
    .eq("image_name", "telegram-web-app-form")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data?.id) {
    return null;
  }

  return {
    id: String(data.id),
    values: sanitizeDepartmentFormValues(data.final_values),
    userName: extractTelegramUserNameFromFeedbackNotes(data.notes),
    createdAt: typeof data.created_at === "string" ? data.created_at : ""
  };
}

async function loadLatestDepartmentPhotoFeedback(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  reportDate: string
) {
  const { data, error } = await (supabase as any)
    .from("sharsh_ocr_feedback")
    .select("id, image_name, created_at")
    .eq("department_id", departmentId)
    .eq("report_date", reportDate)
    .neq("image_name", "telegram-web-app-form")
    .not("image_data_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data?.id) {
    return null;
  }

  return {
    id: String(data.id),
    imageName: typeof data.image_name === "string" ? data.image_name : "",
    createdAt: typeof data.created_at === "string" ? data.created_at : ""
  };
}

async function loadLatestDepartmentPhotoFeedbackByPhotoReportDate(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  photoReportDate: string
) {
  const { data, error } = await (supabase as any)
    .from("sharsh_ocr_feedback")
    .select("id, image_name, created_at")
    .eq("department_id", departmentId)
    .eq("photo_report_date", photoReportDate)
    .neq("image_name", "telegram-web-app-form")
    .not("image_data_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data?.id) {
    return null;
  }

  return {
    id: String(data.id),
    imageName: typeof data.image_name === "string" ? data.image_name : "",
    createdAt: typeof data.created_at === "string" ? data.created_at : ""
  };
}

async function loadLatestDepartmentPhotoFeedbackForSession(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  sessionStartIso: string,
  sessionEndIso: string
) {
  const { data, error } = await (supabase as any)
    .from("sharsh_ocr_feedback")
    .select("id, image_name, created_at")
    .eq("department_id", departmentId)
    .gte("created_at", sessionStartIso)
    .lt("created_at", sessionEndIso)
    .neq("image_name", "telegram-web-app-form")
    .neq("image_name", "telegram-qh-form")
    .not("image_data_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data?.id) {
    return null;
  }

  return {
    id: String(data.id),
    imageName: typeof data.image_name === "string" ? data.image_name : "",
    createdAt: typeof data.created_at === "string" ? data.created_at : ""
  };
}

async function loadLatestDepartmentPhotoPreview(
  supabase: ReturnType<typeof createClient>,
  departmentId: DepartmentId,
  reportDate: string
) {
  let latestFeedback = await loadLatestDepartmentPhotoFeedback(supabase, departmentId, reportDate);
  if (!latestFeedback?.id) {
    latestFeedback = await loadLatestDepartmentPhotoFeedbackByPhotoReportDate(
      supabase,
      departmentId,
      reportDate
    );
  }
  if (!latestFeedback?.id) {
    const session = getAndroidIntakeSessionContext();
    latestFeedback = await loadLatestDepartmentPhotoFeedbackForSession(
      supabase,
      departmentId,
      session.sessionStartIso,
      session.sessionEndIso
    );
  }
  if (!latestFeedback?.id) {
    return null;
  }

  const preview = await loadAcceptedFeedbackPreview(supabase, latestFeedback.id, departmentId);
  if (!preview || typeof preview.imageDataUrl !== "string" || !preview.imageDataUrl.startsWith("data:image/")) {
    return null;
  }

  return {
    ...preview,
    imageName: latestFeedback.imageName || preview.imageName,
    createdAt: latestFeedback.createdAt || preview.createdAt
  };
}

function buildAndroidIntakePhotoSourceLabel(notes: string[]) {
  if (notes.some((note) => /Submitted via Android MAINFORM/i.test(note))) {
    return "Android MAINFORM";
  }
  if (notes.some((note) => /Admission hub Android photo/i.test(note))) {
    return "Ընդունարան";
  }
  if (notes.some((note) => /Telegram Web App form submission\./i.test(note))) {
    return "Telegram Web App";
  }
  return "Լուսանկար";
}

function normalizeAndroidIntakeFeedbackNotes(notes: unknown) {
  return Array.isArray(notes)
    ? notes.map((item) => String(item || ""))
    : [];
}

async function listAndroidIntakeSessionPhotoRecords(
  supabase: ReturnType<typeof createClient>,
  sessionStartIso: string,
  sessionEndIso: string
) {
  const { data, error } = await (supabase as any)
    .from("sharsh_ocr_feedback")
    .select("id, department_id, department_name, report_date, photo_report_date, image_name, image_data_url, notes, created_at")
    .gte("created_at", sessionStartIso)
    .lt("created_at", sessionEndIso)
    .neq("image_name", "telegram-web-app-form")
    .neq("image_name", "telegram-qh-form")
    .not("image_data_url", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const departmentIds = new Set(Object.keys(DEPARTMENTS));
  const latestByDepartment = new Map<string, Record<string, unknown>>();

  for (const rawRow of Array.isArray(data) ? data : []) {
    const row = rawRow as Record<string, unknown>;
    const departmentId = parseDepartmentId(row.department_id);
    const imageDataUrl = typeof row.image_data_url === "string" ? row.image_data_url : "";
    if (!departmentId || !departmentIds.has(departmentId) || !imageDataUrl.startsWith("data:image/")) {
      continue;
    }
    if (!latestByDepartment.has(departmentId)) {
      latestByDepartment.set(departmentId, row);
    }
  }

  return Array.from(latestByDepartment.values()).map((row) => {
    const departmentId = parseDepartmentId(row.department_id) as DepartmentId;
    const notes = normalizeAndroidIntakeFeedbackNotes(row.notes);
    return {
      departmentId,
      departmentName: typeof row.department_name === "string" ? row.department_name : DEPARTMENTS[departmentId].department,
      feedbackId: String(row.id || ""),
      reportDate: typeof row.report_date === "string" ? row.report_date : "",
      photoReportDate: typeof row.photo_report_date === "string" ? row.photo_report_date : "",
      imageName: typeof row.image_name === "string" ? row.image_name : "",
      imageDataUrl: typeof row.image_data_url === "string" ? row.image_data_url : "",
      createdAt: typeof row.created_at === "string" ? row.created_at : "",
      sourceLabel: buildAndroidIntakePhotoSourceLabel(notes)
    };
  });
}

function getFirebaseAndroidPublicConfig(): FirebaseAndroidPublicConfig {
  return {
    enabled: true,
    projectId: (Deno.env.get("FIREBASE_PROJECT_ID") || "").trim(),
    applicationId: (Deno.env.get("FIREBASE_ANDROID_APP_ID") || "").trim(),
    senderId: (Deno.env.get("FIREBASE_ANDROID_SENDER_ID") || "").trim(),
    apiKey: (Deno.env.get("FIREBASE_ANDROID_API_KEY") || "").trim(),
    storageBucket: (Deno.env.get("FIREBASE_ANDROID_STORAGE_BUCKET") || "").trim()
  };
}

function getFirebasePushServiceConfig(): FirebasePushServiceConfig | null {
  const publicConfig = getFirebaseAndroidPublicConfig();
  const clientEmail = (Deno.env.get("FIREBASE_CLIENT_EMAIL") || "").trim();
  const privateKey = (Deno.env.get("FIREBASE_PRIVATE_KEY") || "").replace(/\\n/g, "\n").trim();
  if (!publicConfig.projectId || !publicConfig.applicationId || !publicConfig.senderId || !publicConfig.apiKey || !clientEmail || !privateKey) {
    return null;
  }

  return {
    ...publicConfig,
    enabled: true,
    clientEmail,
    privateKey
  };
}

function buildAndroidFirebaseConfigResponse() {
  const config = getFirebaseAndroidPublicConfig();
  const enabled = Boolean(config.projectId && config.applicationId && config.senderId && config.apiKey);
  return {
    ok: true,
    enabled,
    projectId: enabled ? config.projectId : "",
    applicationId: enabled ? config.applicationId : "",
    senderId: enabled ? config.senderId : "",
    apiKey: enabled ? config.apiKey : "",
    storageBucket: enabled ? config.storageBucket : ""
  };
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlEncodeText(text: string) {
  return base64UrlEncodeBytes(new TextEncoder().encode(text));
}

function decodePemPrivateKey(privateKey: string) {
  const normalized = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function signFirebaseJwtAssertion(clientEmail: string, privateKey: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: FIREBASE_PUSH_SCOPE,
    aud: FIREBASE_TOKEN_ENDPOINT,
    iat: issuedAt,
    exp: expiresAt
  };
  const signingInput = `${base64UrlEncodeText(JSON.stringify(header))}.${base64UrlEncodeText(JSON.stringify(payload))}`;
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    decodePemPrivateKey(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function getFirebasePushAccessToken(config: FirebasePushServiceConfig) {
  if (firebasePushAccessTokenCache && firebasePushAccessTokenCache.expiresAt > Date.now() + 60_000) {
    return firebasePushAccessTokenCache.accessToken;
  }

  const assertion = await signFirebaseJwtAssertion(config.clientEmail, config.privateKey);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });
  const response = await fetch(FIREBASE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    throw new Error(`Firebase token exchange failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error("Firebase token exchange returned no access token.");
  }

  firebasePushAccessTokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(300, Number(payload.expires_in || 3600) - 120) * 1000
  };
  return payload.access_token;
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
  userName: string,
  patientNotes?: DepartmentPatientNotes,
  photoOptions?: {
    imageName?: string;
    imageDataUrl?: string | null;
    notes?: string[] | string;
  } | null
) {
  const photoNotes = Array.isArray(photoOptions?.notes)
    ? photoOptions.notes.filter(Boolean)
    : (typeof photoOptions?.notes === "string" && photoOptions.notes.trim()
      ? [photoOptions.notes.trim()]
      : []);
  const notes = [
    "Telegram Web App form submission.",
    userId ? `Telegram user id: ${userId}` : "",
    userName ? `Telegram user: ${userName}` : "",
    ...(patientNotes ? buildDepartmentPatientNotesTextLines(patientNotes) : []).map((line) => `Patient note: ${line}`),
    ...photoNotes
  ].filter(Boolean);

  return await insertAcceptedFeedback(
    supabase,
    departmentId,
    reportDate,
    null,
    String(photoOptions?.imageName || "telegram-web-app-form"),
    typeof photoOptions?.imageDataUrl === "string" && photoOptions.imageDataUrl.startsWith("data:image/")
      ? photoOptions.imageDataUrl
      : null,
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
      : "անհայտ սխալ";

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

type TelegramMessageOptions = {
  parseMode?: "HTML" | "MarkdownV2";
  disableWebPagePreview?: boolean;
};

async function sendTelegramMessage(chatId: number | string, text: string, options: TelegramMessageOptions = {}) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: options.disableWebPagePreview !== false
  };
  if (options.parseMode) {
    body.parse_mode = options.parseMode;
  }
  await callTelegramApi("sendMessage", body);
}

async function sendTelegramMessageWithReplyMarkup(
  chatId: number | string,
  text: string,
  replyMarkup: Record<string, unknown>,
  options: TelegramMessageOptions = {}
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: options.disableWebPagePreview !== false,
    reply_markup: replyMarkup
  };
  if (options.parseMode) {
    body.parse_mode = options.parseMode;
  }
  await callTelegramApi("sendMessage", body);
}

async function answerTelegramCallbackQuery(callbackQueryId: string, text: string) {
  await callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text
  });
}

async function clearTelegramInlineKeyboard(chatId: number | string, messageId: number | null) {
  if (messageId === null) {
    return;
  }
  await callTelegramApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] }
  });
}

async function sendTelegramMessageToMany(chatIds: Array<number | string>, text: string, options: TelegramMessageOptions = {}) {
  for (const chatId of chatIds) {
    try {
      await sendTelegramMessage(chatId, text, options);
    } catch (error) {
      console.error("Failed to send Telegram notification:", sanitizePublicErrorMessage(error));
    }
  }
}

async function copyTelegramMessage(
  chatId: number | string,
  fromChatId: number | string,
  messageId: number,
  caption?: string,
  replyMarkup?: Record<string, unknown>
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId
  };
  if (caption) {
    body.caption = caption;
  }
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  await callTelegramApi("copyMessage", body);
}

async function copyTelegramMessageToMany(
  chatIds: Array<number | string>,
  fromChatId: number | string,
  messageId: number,
  caption?: string,
  replyMarkup?: Record<string, unknown>
) {
  for (const chatId of chatIds) {
    try {
      await copyTelegramMessage(chatId, fromChatId, messageId, caption, replyMarkup);
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
  const parts = getYerevanDateParts(date);
  return `${parts.hour}:${parts.minute}`;
}

function buildDepartmentSheetDateTimeText(reportDate: string) {
  return `${normalizeDepartmentSheetReportDate(reportDate)} ${getYerevanTimeText()}`;
}

function buildDepartmentSheetMessageDateTimeText(reportDate: string) {
  const dateTimeMatch = String(reportDate || "").trim().match(/^(\d{2})[.,/](\d{2})[.,/](\d{2,4})\s+(\d{2}):(\d{2})$/);
  if (dateTimeMatch) {
    const year = dateTimeMatch[3].length === 2 ? `20${dateTimeMatch[3]}` : dateTimeMatch[3];
    return `${dateTimeMatch[1]}.${dateTimeMatch[2]}.${year} ${dateTimeMatch[4]}:${dateTimeMatch[5]}`;
  }

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
    issues.push("վերնագրում բաժանմունքի անունը փոխվել կամ ջնջվել է");
  }
  if (visibleDepartmentId !== departmentId) {
    issues.push("բաժանմունքի տեսանելի տողը փոխվել է");
  }

  const brokenFormulaCells = DEPARTMENT_SHEET_FORMULA_COLUMNS
    .map((column) => `${column}${targetRow}`)
    .filter((cellRef) => !/<f\b/.test(getWorksheetCellXml(worksheetXml, cellRef)));
  if (brokenFormulaCells.length) {
    issues.push(`բանաձևային բջիջները փոխվել են: ${brokenFormulaCells.join(", ")}`);
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

    primeQhMorningBaseValues(row.values);
    syncQhMorningCalculatedValues(row.id, row.values);
  });
  return rows;
}

function getTelegramWebFormCarryoverValues(values: Record<string, number | null>) {
  const currentShar = getSheetNumber(values, "currentShar");
  const currentSpa = getSheetNumber(values, "currentSpa");
  const currentPaym = getSheetNumber(values, "currentPaym");
  const currentZh = getSheetNumber(values, "currentZh");
  const family = getSheetNumber(values, "family");
  const officer = getSheetNumber(values, "officer");
  const civil = getSheetNumber(values, "civil");
  const leaveSharq = getSheetNumber(values, "leaveSharq");
  const leaveSpa = getSheetNumber(values, "leaveSpa");
  const leavePaym = getSheetNumber(values, "leavePaym");
  const presentTotal = DEPARTMENT_SHEET_PRESENT_SUM_KEYS
    .reduce((sum, key) => sum + getSheetNumber(values, key), 0);

  return {
    beenTotal: getSheetNumber(values, "beenTotal"),
    beenSoldier: getSheetNumber(values, "beenSoldier"),
    beenSeries: getSheetNumber(values, "beenSeries"),
    admittedTotal: getSheetNumber(values, "admittedTotal"),
    admittedSoldier: getSheetNumber(values, "admittedSoldier"),
    admittedSeries: getSheetNumber(values, "admittedSeries"),
    dgTotal: getSheetNumber(values, "dgTotal"),
    dgSoldier: getSheetNumber(values, "dgSoldier"),
    dgSeries: getSheetNumber(values, "dgSeries"),
    transferFromDepartment: getSheetNumber(values, "transferFromDepartment"),
    transferToDepartment: getSheetNumber(values, "transferToDepartment"),
    presentTotal,
    currentShar,
    currentSpa,
    currentPaym,
    currentZh,
    family,
    officer,
    civil,
    leaveSharq,
    leaveSpa,
    leavePaym,
    qhBaseSoldier: safeNumber(values.qhBaseSoldier) || currentShar,
    qhBaseOfficer: safeNumber(values.qhBaseOfficer) || currentSpa,
    qhBaseContract: safeNumber(values.qhBaseContract) || currentPaym
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

function sanitizeQhTelegramFormValues(values: unknown) {
  const source = values && typeof values === "object" && !Array.isArray(values)
    ? values as Record<string, unknown>
    : {};
  return {
    qhIncomingSoldier: safeNumber(source.qhIncomingSoldier),
    qhIncomingOfficer: safeNumber(source.qhIncomingOfficer),
    qhIncomingContract: safeNumber(source.qhIncomingContract),
    qhIncomingZh: safeNumber(source.qhIncomingZh),
    qhIncomingFamily: safeNumber(source.qhIncomingFamily),
    qhIncomingReserve: safeNumber(source.qhIncomingReserve),
    qhIncomingCivil: safeNumber(source.qhIncomingCivil),
    qhDischargedSoldier: safeNumber(source.qhDischargedSoldier),
    qhDischargedOfficer: safeNumber(source.qhDischargedOfficer),
    qhDischargedContract: safeNumber(source.qhDischargedContract),
    qhDischargedZh: safeNumber(source.qhDischargedZh),
    qhDischargedFamily: safeNumber(source.qhDischargedFamily),
    qhDischargedReserve: safeNumber(source.qhDischargedReserve),
    qhDischargedCivil: safeNumber(source.qhDischargedCivil),
    qhBaseSoldier: safeNumber(source.qhBaseSoldier),
    qhBaseOfficer: safeNumber(source.qhBaseOfficer),
    qhBaseContract: safeNumber(source.qhBaseContract),
    qhBaseZh: safeNumber(source.qhBaseZh),
    qhBaseFamily: safeNumber(source.qhBaseFamily),
    qhBaseReserve: safeNumber(source.qhBaseReserve),
    qhBaseCivil: safeNumber(source.qhBaseCivil)
  };
}

function sanitizeQhTelegramPreservedValues(values: unknown) {
  const source = values && typeof values === "object" && !Array.isArray(values)
    ? values as Record<string, unknown>
    : {};
  return {
    transferFromDepartment: safeNumber(source.transferFromDepartment),
    transferToDepartment: safeNumber(source.transferToDepartment),
    currentZh: safeNumber(source.currentZh),
    family: safeNumber(source.family),
    officer: safeNumber(source.officer),
    civil: safeNumber(source.civil),
    leaveSharq: safeNumber(source.leaveSharq),
    leaveSpa: safeNumber(source.leaveSpa),
    leavePaym: safeNumber(source.leavePaym)
  };
}

function buildQhTelegramFormDepartmentValues(
  qhValues: ReturnType<typeof sanitizeQhTelegramFormValues>,
  preserved: ReturnType<typeof sanitizeQhTelegramPreservedValues>
) {
  const output = sanitizeValues(null);
  const remainingSoldier = qhValues.qhBaseSoldier + qhValues.qhIncomingSoldier - qhValues.qhDischargedSoldier;
  const remainingOfficer = qhValues.qhBaseOfficer + qhValues.qhIncomingOfficer - qhValues.qhDischargedOfficer;
  const remainingContract = qhValues.qhBaseContract + qhValues.qhIncomingContract - qhValues.qhDischargedContract;
  const remainingZh = qhValues.qhBaseZh + qhValues.qhIncomingZh - qhValues.qhDischargedZh;
  const remainingFamily = qhValues.qhBaseFamily + qhValues.qhIncomingFamily - qhValues.qhDischargedFamily;
  const remainingReserve = qhValues.qhBaseReserve + qhValues.qhIncomingReserve - qhValues.qhDischargedReserve;
  const remainingCivil = qhValues.qhBaseCivil + qhValues.qhIncomingCivil - qhValues.qhDischargedCivil;
  const admittedTotal = qhValues.qhIncomingSoldier
    + qhValues.qhIncomingOfficer
    + qhValues.qhIncomingContract
    + qhValues.qhIncomingZh
    + qhValues.qhIncomingFamily
    + qhValues.qhIncomingReserve
    + qhValues.qhIncomingCivil;
  const admittedMilitary = qhValues.qhIncomingSoldier + qhValues.qhIncomingOfficer + qhValues.qhIncomingContract;
  const dischargedTotal = qhValues.qhDischargedSoldier
    + qhValues.qhDischargedOfficer
    + qhValues.qhDischargedContract
    + qhValues.qhDischargedZh
    + qhValues.qhDischargedFamily
    + qhValues.qhDischargedReserve
    + qhValues.qhDischargedCivil;
  const dischargedMilitary = qhValues.qhDischargedSoldier + qhValues.qhDischargedOfficer + qhValues.qhDischargedContract;

  output.beenTotal = qhValues.qhBaseSoldier
    + qhValues.qhBaseOfficer
    + qhValues.qhBaseContract
    + qhValues.qhBaseZh
    + qhValues.qhBaseFamily
    + qhValues.qhBaseReserve
    + qhValues.qhBaseCivil
    + preserved.leaveSharq
    + preserved.leaveSpa
    + preserved.leavePaym;
  output.beenSoldier = qhValues.qhBaseSoldier + qhValues.qhBaseOfficer + qhValues.qhBaseContract;
  output.beenSeries = qhValues.qhBaseSoldier;
  output.admittedTotal = admittedTotal;
  output.admittedSoldier = admittedMilitary;
  output.admittedSeries = qhValues.qhIncomingSoldier;
  output.dgTotal = dischargedTotal;
  output.dgSoldier = dischargedMilitary;
  output.dgSeries = qhValues.qhDischargedSoldier;
  output.transferFromDepartment = preserved.transferFromDepartment;
  output.transferToDepartment = preserved.transferToDepartment;
  output.currentShar = remainingSoldier;
  output.currentSpa = remainingOfficer;
  output.currentPaym = remainingContract;
  output.currentZh = remainingZh;
  output.family = remainingFamily;
  output.officer = remainingReserve;
  output.civil = remainingCivil;
  output.leaveSharq = preserved.leaveSharq;
  output.leaveSpa = preserved.leaveSpa;
  output.leavePaym = preserved.leavePaym;
  output.qhBaseSoldier = remainingSoldier;
  output.qhBaseOfficer = remainingOfficer;
  output.qhBaseContract = remainingContract;
  output.qhIncomingSoldier = 0;
  output.qhIncomingOfficer = 0;
  output.qhIncomingContract = 0;
  output.qhDischargedSoldier = 0;
  output.qhDischargedOfficer = 0;
  output.qhDischargedContract = 0;
  return output;
}

type DepartmentValidationCheck = {
  id: string;
  name: string;
  nameHy?: string;
  ruleText: string;
  isValid: boolean;
  actual: number;
  expected: number;
  difference: number;
  successTextRu?: string;
  failureTextRu?: string;
  successTextHy?: string;
  failureTextHy?: string;
};

type DepartmentValidationResult = {
  isValid: boolean;
  actual: number;
  expected: number;
  checks: DepartmentValidationCheck[];
  failedChecks: DepartmentValidationCheck[];
};

const DEPARTMENT_OCR_TOP_CELLS_RULE_NAME = "Контроль OCR 1-3";
const DEPARTMENT_OCR_TOP_CELLS_RULE_NAME_HY = "OCR 1-3 հսկիչ";
const DEPARTMENT_OCR_TOP_CELLS_RULE_TEXT = "OCR 1 = таблица 1; OCR 2 = таблица 2; OCR 3 = таблица 3";
const DEPARTMENT_OCR_TOP_CELLS_KEYS = ["beenTotal", "beenSoldier", "beenSeries"] as const;

function getDepartmentPhotoCellLabel(key: string) {
  const field = PHOTO_FIELD_MAPPINGS.find((item) => item.key === key);
  return field ? String(field.cell) : key;
}

function buildDepartmentOcrTopCellsValidationCheck(
  recognizedValues: Record<string, number | null>,
  currentValues: Record<string, number | null> | null | undefined
): DepartmentValidationCheck | null {
  if (!currentValues) {
    return null;
  }

  const mismatches: Array<{ key: string; ocrValue: number; tableValue: number }> = [];
  let comparedCount = 0;

  DEPARTMENT_OCR_TOP_CELLS_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(recognizedValues, key)) {
      return;
    }
    const ocrValue = recognizedValues[key];
    if (typeof ocrValue !== "number" || !Number.isFinite(ocrValue)) {
      return;
    }

    comparedCount += 1;
    const tableValue = getSheetNumber(currentValues, key);
    if (ocrValue !== tableValue) {
      mismatches.push({ key, ocrValue, tableValue });
    }
  });

  if (!comparedCount) {
    return null;
  }

  const matchedCount = comparedCount - mismatches.length;
  const mismatchTextRu = mismatches
    .map((item) => {
      const cellLabel = getDepartmentPhotoCellLabel(item.key);
      return `OCR ${cellLabel} = ${item.ocrValue}, а в таблице ${cellLabel} = ${item.tableValue}`;
    })
    .join("; ");
  const mismatchTextHy = mismatches
    .map((item) => {
      const cellLabel = getDepartmentPhotoCellLabel(item.key);
      return `OCR ${cellLabel} = ${item.ocrValue}, իսկ աղյուսակում ${cellLabel} = ${item.tableValue}`;
    })
    .join("; ");

  return {
    id: "ocr-top-cells",
    name: DEPARTMENT_OCR_TOP_CELLS_RULE_NAME,
    nameHy: DEPARTMENT_OCR_TOP_CELLS_RULE_NAME_HY,
    ruleText: DEPARTMENT_OCR_TOP_CELLS_RULE_TEXT,
    isValid: mismatches.length === 0,
    actual: matchedCount,
    expected: comparedCount,
    difference: mismatches.length,
    successTextRu: "OCR 1-3 совпадают с таблицей отделения",
    failureTextRu: mismatchTextRu,
    successTextHy: "OCR 1-3-ը համընկնում են բաժանմունքի աղյուսակի հետ",
    failureTextHy: mismatchTextHy
  };
}

function appendDepartmentValidationCheck(
  validation: DepartmentValidationResult,
  extraCheck: DepartmentValidationCheck | null
) {
  if (!extraCheck) {
    return validation;
  }
  const checks = [...validation.checks, extraCheck];
  const failedChecks = checks.filter((check) => !check.isValid);
  return {
    ...validation,
    isValid: failedChecks.length === 0,
    checks,
    failedChecks
  };
}

function validateDepartmentSheetValues(values: Record<string, number | null>) {
  const presentActual = DEPARTMENT_SHEET_PRESENT_SUM_KEYS
    .reduce((sum, key) => sum + getSheetNumber(values, key), 0);
  const presentExpected = (
    getSheetNumber(values, "beenTotal")
    + getSheetNumber(values, "admittedTotal")
    + getSheetNumber(values, "transferToDepartment")
  ) - (
    getSheetNumber(values, "dgTotal")
    + getSheetNumber(values, "transferFromDepartment")
  );
  const checks: DepartmentValidationCheck[] = [
    {
      id: "present-balance",
      name: "Контроль 13-22",
      nameHy: "Հսկիչ 13-22",
      ruleText: "13-22 = (1 + 4 + 11) - (7 + 10)",
      isValid: presentActual === presentExpected,
      actual: presentActual,
      expected: presentExpected,
      difference: presentActual - presentExpected
    }
  ];

  const transferFromDepartment = getSheetNumber(values, "transferFromDepartment");
  const transferToDepartment = getSheetNumber(values, "transferToDepartment");
  if (transferFromDepartment === 0 && transferToDepartment === 0) {
    const soldierActual = (
      getSheetNumber(values, "beenSeries")
      + getSheetNumber(values, "admittedSeries")
    ) - getSheetNumber(values, "dgSeries");
    const soldierExpected = (
      getSheetNumber(values, "currentShar")
      + getSheetNumber(values, "leaveSharq")
    );
    checks.push({
      id: "soldier-count",
      name: "Количество срочников",
      nameHy: "Ժամկետայինների քանակ",
      ruleText: "(3 + 6) - 9 = 13 + 20",
      isValid: soldierActual === soldierExpected,
      actual: soldierActual,
      expected: soldierExpected,
      difference: soldierActual - soldierExpected
    });

    const militaryActual = (
      getSheetNumber(values, "beenSoldier")
      + getSheetNumber(values, "admittedSoldier")
    ) - getSheetNumber(values, "dgSoldier");
    const militaryExpected = (
      getSheetNumber(values, "currentShar")
      + getSheetNumber(values, "currentSpa")
      + getSheetNumber(values, "currentPaym")
      + getSheetNumber(values, "leaveSharq")
      + getSheetNumber(values, "leaveSpa")
      + getSheetNumber(values, "leavePaym")
    );
    checks.push({
      id: "military-count",
      name: "Количество военнослужащих",
      nameHy: "Զինծառայողների քանակ",
      ruleText: "(2 + 5) - 8 = 13 + 14 + 15 + 20 + 21 + 22",
      isValid: militaryActual === militaryExpected,
      actual: militaryActual,
      expected: militaryExpected,
      difference: militaryActual - militaryExpected
    });
  }

  const failedChecks = checks.filter((check) => !check.isValid);
  const primaryCheck = checks[0];
  return {
    isValid: failedChecks.length === 0,
    actual: primaryCheck ? primaryCheck.actual : 0,
    expected: primaryCheck ? primaryCheck.expected : 0,
    checks,
    failedChecks
  };
}

function formatDepartmentValidationLinesRu(validation: DepartmentValidationResult | null | undefined) {
  if (!validation || !Array.isArray(validation.checks) || !validation.checks.length) {
    return [];
  }
  return validation.checks.map((check) => (
    check.isValid
      ? `- ${check.name}: ${check.successTextRu || `${check.actual} = ${check.expected}`} (${check.ruleText})`
      : `- ${check.name}: ${check.failureTextRu || `${check.actual}, должно быть ${check.expected}`} (${check.ruleText})`
  ));
}

function formatDepartmentValidationLinesHy(validation: DepartmentValidationResult | null | undefined) {
  if (!validation || !Array.isArray(validation.checks) || !validation.checks.length) {
    return [];
  }
  return validation.checks.map((check) => (
    check.isValid
      ? `- ${check.nameHy || check.name}: ${check.successTextHy || `${check.actual} = ${check.expected}`} (${check.ruleText})`
      : `- ${check.nameHy || check.name}: ${check.failureTextHy || `${check.actual}, պետք է լինի ${check.expected}`} (${check.ruleText})`
  ));
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
    allowed_updates: ["message", "edited_message", "callback_query"]
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

function isTelegramNightShiftButtonRequest(text: string) {
  return text.trim() === TELEGRAM_NIGHT_SHIFT_BUTTON_TEXT;
}

function isTelegramDayShiftButtonRequest(text: string) {
  const normalized = text.trim();
  return normalized === TELEGRAM_DAY_SHIFT_BUTTON_TEXT || normalized === "Ցերեկային ընդունում";
}

function isTelegramDischargeShiftButtonRequest(text: string) {
  const normalized = text.trim();
  return normalized === TELEGRAM_DISCHARGE_SHIFT_BUTTON_TEXT || normalized === "Ցերեկային դուրսգրում";
}

function buildColleagueStartText(firstName = "") {
  const greeting = firstName
    ? `Բարև, ${firstName}։ Սա Mainflow բոտն է բաժանմունքների տվյալները ուղարկելու համար։`
    : "Բարև Ձեզ։ Սա Mainflow բոտն է բաժանմունքների տվյալները ուղարկելու համար։";
  return [
    greeting,
    "Ուրախ եմ օգնել. եթե լուսանկարը մի քիչ կամակոր լինի, միասին կհաղթենք։",
    "",
    "Ինչպես աշխատել.",
    "1. Ուղարկեք բաժանմունքի կոդը, օրինակ՝ SR-7։",
    "2. Բոտը կուղարկի ընթացիկ PDF-ը և Telegram ձևը բացելու կոճակը։",
    "3. Լրացրեք ձևը և ուղարկեք բլանկի լուսանկարը։",
    `Ընտրեք «${TELEGRAM_DAY_SHIFT_BUTTON_TEXT}» կամ «${TELEGRAM_DISCHARGE_SHIFT_BUTTON_TEXT}» կոճակը։`,
    "",
    "SR-? հրամանը ցույց կտա բաժանմունքների ցանկը։",
    "",
    buildSrDepartmentsText()
  ].join("\n");
}

function buildAdminHelpText() {
  return [
    "/allcurrent կամ SR-all — մեկ PDF ֆայլով ուղարկել բոլոր բաժանմունքների ընթացիկ տվյալները։",
    "Mainflow Telegram բոտի հրամանները",
    "",
    "Կոլեգաների հասանելիություն.",
    "/kollegi_on — միացնել հաստատված կոլեգաներին. նոր օգտվողները նախ գալիս են Ձեր հաստատմանը։",
    "/kollegi_off — անջատել կոլեգաների աշխատանքը. բոտը լսում է միայն ադմինիստրատորին։",
    "/kollegi_status — ստուգել միացված/անջատված վիճակը և սպասող հայտերի քանակը։",
    "/reminder_12 — ձեռքով ուղարկել 14։00-ի հիշեցումը կոլեգաներին։",
    "/reminder_17 — ձեռքով ուղարկել 18։00-ի հիշեցումը կոլեգաներին։",
    "/night_reminder — ձեռքով ուղարկել առավոտյան հիշեցումը գիշերային հերթապահներին։",
    "/gps_on — միացնել GPS սցենարը եւ աշխատանքի վայրի կոճակը։",
    "/gps_off — անջատել GPS սցենարը եւ մաքրել ներկայության հին նշումները։",
    "/gps_status — տեսնել GPS սցենարի վիճակը։",
    "/set_workplace_here — սահմանել հիվանդանոցի GPS կետը Ձեր ընթացիկ տեղից։",
    "/set_workplace LAT LON 500 — սահմանել GPS կետը ձեռքով։",
    "/workplace_status — տեսնել GPS կետը եւ ով է նշված աշխատանքի վայրում։",
    "",
    "Աշխատանք բաժանմունքների հետ.",
    "SR-? — ցույց տալ բաժանմունքների SR կոդերի ցանկը։",
    "SR-7 կամ r7 — ուղարկել ընթացիկ տվյալների PDF-ը և Telegram ձևի կոճակը։",
    "/form SR-7 — ընթացիկ տվյալների PDF + Telegram ձևի կոճակ։",
    `«${TELEGRAM_DAY_SHIFT_BUTTON_TEXT}» — բացել ընդունման Telegram ձևը։`,
    `«${TELEGRAM_DISCHARGE_SHIFT_BUTTON_TEXT}» — բացել դուրսգրման Telegram ձևը։`,
    "/night — հին համատեղելի հրաման է, որը պահպանված է միայն համատեղելիության համար։",
    "/civil — բացել Քաղ. ԲԿ բազայի Telegram ձևը։",
    "/geo — ուղարկել աշխատանքի վայրի geolocation կոճակը։",
    "/duty — նշել, որ կոլեգան գիշերային հերթապահ է։",
    "/not_duty — անջատել գիշերային հերթապահության նշումը։",
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
    "/allcurrent կամ SR-all — մեկ PDF ֆայլով ուղարկել բոլոր բաժանմունքների ընթացիկ տվյալները։",
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
    `«${TELEGRAM_DAY_SHIFT_BUTTON_TEXT}» — բացել ընդունման Telegram Web App ձևը`,
    `«${TELEGRAM_DISCHARGE_SHIFT_BUTTON_TEXT}» — բացել դուրսգրման Telegram Web App ձևը`,
    "/night — հին համատեղելի հրաման է, որը պահպանված է միայն համատեղելիության համար",
    "/civil — բացել Քաղ. ԲԿ բազայի Telegram Web App ձևը",
    "/geo — ուղարկել աշխատանքի վայրի geolocation կոճակը",
    "/duty — նշել գիշերային հերթապահությունը",
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

function getDepartmentBlankPdfUrlSafe(departmentId: DepartmentId) {
  const pdfFile = DEPARTMENT_PDF_URL_SEGMENTS[departmentId];
  return `${getPublicSiteBaseUrl()}/${DEPARTMENT_PDF_ROOT_SEGMENT}/${pdfFile.folder}/${pdfFile.file}`;
}

async function fetchDepartmentBlankPdfBytes(departmentId: DepartmentId) {
  const url = getDepartmentBlankPdfUrlSafe(departmentId);
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
  reportDate: string,
  patientNotes?: unknown
) {
  const blankBytes = await fetchDepartmentBlankPdfBytes(departmentId);
  const pdf = await PDFDocument.load(blankBytes);
  const page = pdf.getPage(0);
  const font = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);
  const dateFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 15;
  const valueColor = rgb(0, 0, 0);
  const pdfValues = buildDepartmentPdfValues(values);
  const sanitizedPatientNotes = sanitizeDepartmentPatientNotes(patientNotes);

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

  const noteFonts = await buildPdfFonts(pdf);
  drawDepartmentPatientNotes(page, noteFonts, sanitizedPatientNotes);

  return await pdf.save();
}

function buildDepartmentPdfFileName(departmentId: DepartmentId, reportDate: string, suffix: string) {
  const meta = DEPARTMENTS[departmentId];
  const safeMarker = sanitizeSheetFileNamePart(meta.marker);
  const safeDate = sanitizeSheetFileNamePart(reportDate.replaceAll(".", ",").replaceAll("/", ","));
  return `${safeMarker}_${safeDate || DEFAULT_DATE}_${suffix}.pdf`;
}

function parseDepartmentId(value: unknown): DepartmentId | null {
  const id = String(value || "").trim();
  return Object.prototype.hasOwnProperty.call(DEPARTMENTS, id) ? id as DepartmentId : null;
}

function normalizeTelegramFormArchiveDateKey(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const localMatch = raw.match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{2,4})/);
  if (localMatch) {
    const day = localMatch[1].padStart(2, "0");
    const month = localMatch[2].padStart(2, "0");
    const year = localMatch[3].length === 2 ? `20${localMatch[3]}` : localMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
}

function formatTelegramFormArchiveDateLabel(dateKey: string) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return dateKey;
  }
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function extractDepartmentPatientNotesFromFeedbackNotes(notes: unknown): DepartmentPatientNotes {
  const output = createEmptyDepartmentPatientNotes();
  if (!Array.isArray(notes)) {
    return output;
  }

  for (const note of notes) {
    const text = String(note || "").replace(/^Patient note:\s*/i, "").trim();
    if (!text) {
      continue;
    }

    const section = DEPARTMENT_PATIENT_NOTE_SECTIONS.find((candidate) => (
      text.startsWith(`${candidate.title}:`)
    ));
    if (!section) {
      continue;
    }

    const body = text.slice(section.title.length + 1).trim();
    output[section.key] = body
      .split(";")
      .map((part) => getPatientNoteDisplayText(part))
      .filter(Boolean)
      .slice(0, section.rows);
  }

  return sanitizeDepartmentPatientNotes(output);
}

type TelegramWebFormArchiveRecord = {
  id: string;
  departmentId: DepartmentId;
  departmentName: string;
  reportDate: string;
  archiveDateKey: string;
  values: Record<string, number | null>;
  patientNotes: DepartmentPatientNotes;
  createdAt: string;
};

function buildTelegramWebFormArchiveRecord(row: Record<string, unknown> | null | undefined): TelegramWebFormArchiveRecord | null {
  if (!row || row.image_name !== "telegram-web-app-form") {
    return null;
  }

  const departmentId = parseDepartmentId(row.department_id);
  const id = String(row.id || "").trim();
  if (!departmentId || !id) {
    return null;
  }

  const createdAt = String(row.created_at || new Date().toISOString());
  const reportDateRaw = String(row.report_date || "").trim();
  const archiveDateKey = normalizeTelegramFormArchiveDateKey(reportDateRaw || createdAt);
  if (!archiveDateKey) {
    return null;
  }

  return {
    id,
    departmentId,
    departmentName: String(row.department_name || DEPARTMENTS[departmentId].department),
    reportDate: reportDateRaw || formatTelegramFormArchiveDateLabel(archiveDateKey),
    archiveDateKey,
    values: sanitizeValues((row.final_values || row.ocr_raw || {}) as Record<string, unknown>),
    patientNotes: extractDepartmentPatientNotesFromFeedbackNotes(row.notes),
    createdAt
  };
}

async function loadTelegramWebFormArchiveRecord(
  supabase: any,
  feedbackId: string,
  departmentId?: DepartmentId
) {
  const normalizedId = String(feedbackId || "").trim();
  if (!normalizedId) {
    return null;
  }

  let query = (supabase as any)
    .from("sharsh_ocr_feedback")
    .select("id, created_at, department_id, department_name, report_date, image_name, final_values, ocr_raw, notes")
    .eq("id", normalizedId)
    .eq("image_name", "telegram-web-app-form");

  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    throw error;
  }
  return buildTelegramWebFormArchiveRecord(data as Record<string, unknown> | null);
}

async function loadTelegramWebFormArchiveRecordsForDate(
  supabase: any,
  dateKey: string
) {
  const { data, error } = await (supabase as any)
    .from("sharsh_ocr_feedback")
    .select("id, created_at, department_id, department_name, report_date, image_name, final_values, ocr_raw, notes")
    .eq("image_name", "telegram-web-app-form")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw error;
  }

  const latestByDepartment = new Map<DepartmentId, TelegramWebFormArchiveRecord>();
  for (const row of data || []) {
    const record = buildTelegramWebFormArchiveRecord(row as Record<string, unknown>);
    if (record && record.archiveDateKey === dateKey && !latestByDepartment.has(record.departmentId)) {
      latestByDepartment.set(record.departmentId, record);
    }
  }

  const departmentOrder = Object.keys(DEPARTMENTS) as DepartmentId[];
  return Array.from(latestByDepartment.values())
    .sort((left, right) => departmentOrder.indexOf(left.departmentId) - departmentOrder.indexOf(right.departmentId));
}

async function buildTelegramWebFormArchiveDatePdfBytes(records: TelegramWebFormArchiveRecord[]) {
  const output = await PDFDocument.create();
  for (const record of records) {
    try {
      const bytes = await buildFilledDepartmentPdfBytes(
        record.departmentId,
        record.values,
        record.reportDate,
        record.patientNotes
      );
      const source = await PDFDocument.load(bytes);
      const pages = await output.copyPages(source, source.getPageIndices());
      pages.forEach((page) => output.addPage(page));
    } catch (error) {
      throw new Error(`Failed to build archive PDF for ${record.departmentName} (${record.departmentId}) on ${record.reportDate}: ${getErrorText(error)}`);
    }
  }
  return await output.save();
}

function buildPdfBytesResponse(bytes: Uint8Array, fileName: string) {
  const safeFileName = fileName.replace(/["\r\n]/g, "_");
  const body = new Blob([bytes], { type: "application/pdf" });
  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeFileName}"`
    }
  });
}

function isAllCurrentDepartmentsPdfRequest(text: string) {
  const normalized = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/@[\w_]+(?=\s|$)/g, "")
    .replace(/\s+/g, " ");
  return [
    "/allcurrent",
    "/all_current",
    "/allforms",
    "/current_all",
    "/departments_pdf",
    "allcurrent",
    "all current",
    "sr-all",
    "sr all",
    "all-sr",
    "all sr"
  ].includes(normalized);
}

async function buildAllCurrentDepartmentsPdfBytes(
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>,
  reportDate: string
) {
  const output = await PDFDocument.create();
  const rowsById = new Map(snapshot.rows.map((row) => [String(row.id), row]));
  const departmentIds = Object.keys(DEPARTMENTS) as DepartmentId[];
  const sourcePdfs = await Promise.all(departmentIds.map(async (departmentId) => {
    const row = rowsById.get(departmentId);
    const values = row ? row.values : sanitizeValues(null);
    return await buildFilledDepartmentPdfBytes(departmentId, values, reportDate);
  }));

  for (const bytes of sourcePdfs) {
    const source = await PDFDocument.load(bytes);
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }

  return await output.save();
}

type MainArchivePhotoRecord = {
  id: string;
  departmentId: DepartmentId;
  departmentName: string;
  reportDate: string;
  photoReportDate: string;
  imageName: string;
  imageDataUrl: string;
  createdAt: string;
  sourceLabel: string;
};

function buildMainArchivePdfFileName(dateKey: string) {
  const baseName = MAIN_ARCHIVE_PDF_FILE_NAME.replace(/\.pdf$/i, "");
  const label = formatTelegramFormArchiveDateLabel(dateKey || getYerevanDateKey());
  const safeLabel = sanitizeSheetFileNamePart(label.replaceAll(".", ",").replaceAll("/", ",")) || dateKey || getYerevanDateKey();
  return buildTimestampedPdfFileName(`${baseName}_${safeLabel}.pdf`);
}

function rowMatchesArchiveDateKey(row: Record<string, unknown>, dateKey: string) {
  const reportDateKey = normalizeTelegramFormArchiveDateKey(row.report_date);
  const photoReportDateKey = normalizeTelegramFormArchiveDateKey(row.photo_report_date);
  const createdAtKey = normalizeTelegramFormArchiveDateKey(row.created_at);
  return reportDateKey === dateKey || photoReportDateKey === dateKey || createdAtKey === dateKey;
}

function buildMainArchivePhotoSourceLabel(imageName: string, notes: unknown) {
  const normalizedNotes = Array.isArray(notes)
    ? notes.map((item) => String(item || ""))
    : [];
  if (normalizedNotes.some((note) => /Submitted via Android MAINFORM/i.test(note))) {
    return "Android MAINFORM";
  }
  if (normalizedNotes.some((note) => /Admission hub Android photo/i.test(note))) {
    return "Ընդունարան";
  }
  if (
    imageName === "telegram-web-app-form"
    || imageName === "telegram-qh-form"
    || normalizedNotes.some((note) => /Telegram Web App form submission\./i.test(note))
  ) {
    return "Telegram Web App";
  }
  return "Բլանկի լուսանկար";
}

async function listMainArchivePhotoRecordsForDate(
  supabase: ReturnType<typeof createClient>,
  dateKey: string
) {
  const dateLabel = formatTelegramFormArchiveDateLabel(dateKey || getYerevanDateKey());
  const yerevanStart = new Date(`${dateKey || getYerevanDateKey()}T00:00:00+04:00`);
  const yerevanEnd = new Date(yerevanStart.getTime() + (24 * 60 * 60 * 1000));
  const metadataColumns = "id, department_id, department_name, report_date, photo_report_date, image_name, notes, created_at";
  const resultMap = new Map<string, Record<string, unknown>>();

  const queries = [
    (supabase as any)
      .from("sharsh_ocr_feedback")
      .select(metadataColumns)
      .eq("report_date", dateLabel)
      .order("created_at", { ascending: true })
      .limit(1000),
    (supabase as any)
      .from("sharsh_ocr_feedback")
      .select(metadataColumns)
      .eq("photo_report_date", dateLabel)
      .order("created_at", { ascending: true })
      .limit(1000),
    (supabase as any)
      .from("sharsh_ocr_feedback")
      .select(metadataColumns)
      .gte("created_at", yerevanStart.toISOString())
      .lt("created_at", yerevanEnd.toISOString())
      .order("created_at", { ascending: true })
      .limit(1000)
  ];

  const settled = await Promise.all(queries);
  for (const { data, error } of settled) {
    if (error) {
      throw error;
    }
    for (const item of Array.isArray(data) ? data : []) {
      const row = item as Record<string, unknown>;
      const id = String(row.id || "");
      if (!id) {
        continue;
      }
      resultMap.set(id, row);
    }
  }

  const imageDataById = new Map<string, string>();
  for (const id of resultMap.keys()) {
    const { data, error } = await (supabase as any)
      .from("sharsh_ocr_feedback")
      .select("id, image_data_url")
      .eq("id", id)
      .limit(1)
      .maybeSingle();
    if (error) {
      throw error;
    }
    const imageDataUrl = typeof data?.image_data_url === "string" ? data.image_data_url.trim() : "";
    if (imageDataUrl.startsWith("data:image/")) {
      imageDataById.set(id, imageDataUrl);
    }
  }

  const departmentOrder = Object.keys(DEPARTMENTS) as DepartmentId[];
  const rows = Array.from(resultMap.values())
    .filter((row) => rowMatchesArchiveDateKey(row, dateKey))
    .map((row) => {
      const departmentId = parseDepartmentId(row.department_id);
      const id = String(row.id || "");
      const imageDataUrl = imageDataById.get(id) || "";
      if (!departmentId || !imageDataUrl.startsWith("data:image/")) {
        return null;
      }
      const imageName = typeof row.image_name === "string" ? row.image_name : "";
      return {
        id,
        departmentId,
        departmentName: typeof row.department_name === "string" && row.department_name.trim()
          ? row.department_name.trim()
          : DEPARTMENTS[departmentId].department,
        reportDate: typeof row.report_date === "string" ? row.report_date : "",
        photoReportDate: typeof row.photo_report_date === "string" ? row.photo_report_date : "",
        imageName,
        imageDataUrl,
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
        sourceLabel: buildMainArchivePhotoSourceLabel(imageName, row.notes)
      } satisfies MainArchivePhotoRecord;
    })
    .filter(Boolean) as MainArchivePhotoRecord[];

  return rows.sort((left, right) => {
    const departmentDiff = departmentOrder.indexOf(left.departmentId) - departmentOrder.indexOf(right.departmentId);
    if (departmentDiff !== 0) {
      return departmentDiff;
    }
    return Date.parse(left.createdAt || "") - Date.parse(right.createdAt || "");
  });
}

function appendPdfBytesToDocument(
  output: PDFDocument,
  bytes: Uint8Array
) {
  return PDFDocument.load(bytes)
    .then(async (source) => {
      const pages = await output.copyPages(source, source.getPageIndices());
      pages.forEach((page) => output.addPage(page));
    });
}

function addMainArchiveSectionPage(
  output: PDFDocument,
  fonts: Awaited<ReturnType<typeof buildPdfFonts>>,
  title: string,
  lines: string[]
) {
  const page = output.addPage([595.32, 841.92]);
  drawPdfText(page, title, 42, 790, { font: fonts.bold, size: 24 });
  drawPdfText(page, getMainPdfPrintedAtText(), 42, 765, { font: fonts.regular, size: 10 });
  drawPdfMultilineText(page, lines.join("\n"), 42, 720, 20, {
    font: fonts.regular,
    size: 12
  });
}

async function addMainArchivePhotoPage(
  output: PDFDocument,
  fonts: Awaited<ReturnType<typeof buildPdfFonts>>,
  record: MainArchivePhotoRecord
) {
  const { mimeType, bytes } = parseImageDataUrl(record.imageDataUrl);
  const isPng = mimeType === "image/png";
  const embeddedImage = isPng
    ? await output.embedPng(bytes)
    : await output.embedJpg(bytes);
  const imageWidth = embeddedImage.width;
  const imageHeight = embeddedImage.height;
  const isLandscape = imageWidth >= imageHeight;
  const pageWidth = isLandscape ? 841.92 : 595.32;
  const pageHeight = isLandscape ? 595.32 : 841.92;
  const page = output.addPage([pageWidth, pageHeight]);
  const margin = 32;
  const headerLines = [
    `${record.departmentName} (${DEPARTMENTS[record.departmentId].marker})`,
    `Աղբյուր՝ ${record.sourceLabel}`,
    `Ուղարկման ժամը՝ ${Number.isFinite(Date.parse(record.createdAt || "")) ? getYerevanHyDateTimeText(new Date(record.createdAt)) : (record.createdAt || "նշված չէ")}`,
    record.reportDate ? `Հաշվետվության ամսաթիվը՝ ${record.reportDate}` : "",
    record.photoReportDate ? `Լուսանկարի ամսաթիվը՝ ${record.photoReportDate}` : ""
  ].filter(Boolean);

  drawPdfText(page, "Բլանկի լուսանկար", margin, pageHeight - 34, {
    font: fonts.bold,
    size: 18
  });
  drawPdfMultilineText(page, headerLines.join("\n"), margin, pageHeight - 58, 14, {
    font: fonts.regular,
    size: 10
  });

  const headerHeight = 82;
  const availableWidth = pageWidth - (margin * 2);
  const availableHeight = pageHeight - headerHeight - (margin * 2);
  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const x = (pageWidth - drawWidth) / 2;
  const y = margin + ((availableHeight - drawHeight) / 2);
  page.drawImage(embeddedImage, {
    x,
    y,
    width: drawWidth,
    height: drawHeight
  });
}

async function buildMainArchivePdfBytes(
  supabase: ReturnType<typeof createClient>,
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>,
  reportDate: string,
  dateKey: string
) {
  const output = await PDFDocument.create();
  const fonts = await buildPdfFonts(output);
  const archivePhotoRecords = await listMainArchivePhotoRecordsForDate(supabase, dateKey);
  const normalizedDateLabel = formatTelegramFormArchiveDateLabel(dateKey);

  addMainArchiveSectionPage(
    output,
    fonts,
    "MAINFLOW արխիվային փաթեթ",
    [
      `Արխիվի ամսաթիվը՝ ${normalizedDateLabel}`,
      `Ամփոփագրի ամսաթիվը՝ ${reportDate}`,
      "Ստորև միավորված են Report.pdf, MAINFLOW.pdf, All_departments_current_<date>.pdf և բոլոր կապված բլանկների լուսանկարները։"
    ]
  );

  await appendPdfBytesToDocument(output, await buildReportPdfBytes(snapshot));
  await appendPdfBytesToDocument(output, await buildMainMovementPdfBytes(snapshot));
  await appendPdfBytesToDocument(output, await buildAllCurrentDepartmentsPdfBytes(snapshot, reportDate));

  if (archivePhotoRecords.length) {
    addMainArchiveSectionPage(
      output,
      fonts,
      "Օրվա բլանկների լուսանկարներ",
      [
        `Կապված լուսանկարներ՝ ${archivePhotoRecords.length}։`,
        "Յուրաքանչյուր լուսանկար ավելացվել է առանձին էջում՝ բաժանմունքի և ուղարկման ժամանակի նշումով։"
      ]
    );
    for (const record of archivePhotoRecords) {
      await addMainArchivePhotoPage(output, fonts, record);
    }
  }

  return await output.save();
}

async function sendAllCurrentDepartmentsPdf(
  supabase: unknown,
  chatId: number | string,
  text: string
) {
  const snapshot = await loadSnapshot(supabase as ReturnType<typeof createClient>);
  const reportDate = detectReportDateFromHint(text) || getYerevanReportDateText();
  const pdfBytes = await buildAllCurrentDepartmentsPdfBytes(snapshot, reportDate);
  const safeDate = sanitizeSheetFileNamePart(reportDate.replaceAll(".", ",").replaceAll("/", ","));
  await sendTelegramDocument(
    chatId,
    `All_departments_current_${safeDate || DEFAULT_DATE}.pdf`,
    pdfBytes,
    [
      "Բոլոր բաժանմունքների ընթացիկ տվյալներ",
      `Հաշվետվության ամսաթիվ: ${buildDepartmentSheetMessageDateTimeText(reportDate)}`,
      "Յուրաքանչյուր բաժանմունք PDF ֆայլում առանձին էջ է։"
    ].join("\n"),
    "application/pdf"
  );
}

function buildTelegramFormReplyMarkup(formUrl: string) {
  return {
    inline_keyboard: [
      [
        {
          text: "Բացել ձևը",
          web_app: { url: formUrl }
        }
      ]
    ]
  };
}

function buildTelegramNightFormReplyMarkup(formUrl: string) {
  return {
    inline_keyboard: [
      [
        {
          text: "Բացել ընդունման ձևը",
          web_app: { url: formUrl }
        }
      ]
    ]
  };
}

function buildApplyNightShiftToMainReplyMarkup() {
  return {
    inline_keyboard: [
      [
        {
          text: "Տեղափոխել հիմնական աղյուսակ",
          callback_data: TELEGRAM_APPLY_NIGHT_SHIFT_CALLBACK
        }
      ]
    ]
  };
}

function buildTelegramDayFormReplyMarkup(formUrl: string) {
  return {
    inline_keyboard: [
      [
        {
          text: "Բացել ընդունման ձևը",
          web_app: { url: formUrl }
        }
      ]
    ]
  };
}

function buildTelegramDischargeFormReplyMarkup(formUrl: string) {
  return {
    inline_keyboard: [
      [
        {
          text: "Բացել Դուրսգրում ձևը",
          web_app: { url: formUrl }
        }
      ]
    ]
  };
}

function buildTelegramCivilReferralsReplyMarkup(formUrl: string) {
  return {
    inline_keyboard: [
      [
        {
          text: "Բացել Քաղ. ԲԿ բազան",
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
  const reportDate = detectReportDateFromHint(text) || getYerevanReportDateText();
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
      `Բաժանմունքի աշխատանքային աղյուսակ: ${meta.department}`,
      `Հաշվետվության ամսաթիվ: ${buildDepartmentSheetMessageDateTimeText(reportDate)}`,
      "Լրացրեք բաժանմունքի անհրաժեշտ տվյալները եւ XLSX ֆայլը ուղարկեք ինձ հետ։ Խնդրում եմ չմոռանալ ուղարկել նաեւ բլանկի լուսանկարը։",
      "Ֆայլը վերադարձնելուց հետո տվյալները կանցնեն ստուգման՝ մինչ ընդհանուր աղյուսակ մտնելը։ Շնորհակալություն։"
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
  const reportDate = detectReportDateFromHint(text) || getYerevanReportDateText();
  const meta = DEPARTMENTS[departmentId];
  const carryoverValues = getTelegramWebFormCarryoverFromSnapshot(snapshot, departmentId);
  const autoRotateImages = await isTelegramPhotoAutoRotateEnabled(supabase as ReturnType<typeof createClient>);
  const formUrl = getTelegramWebFormUrl(
    departmentId,
    reportDate,
    carryoverValues,
    null,
    { autoRotateImages }
  );
  const row = snapshot.rows.find((item) => item.id === departmentId);
  const currentValues = row ? row.values : sanitizeValues(null);
  const caption = [
    `Բաժանմունքի ընթացիկ տվյալներ: ${meta.department} (${meta.marker})`,
    `Հաշվետվության ամսաթիվ: ${buildDepartmentSheetMessageDateTimeText(reportDate)}`,
    "PDF-ը ստեղծված է գլխավոր աղյուսակից։ Պահպանեք այն Ձեզ մոտ։",
    "Ստորեւ կոճակը կբացի Telegram ձևը նոր տվյալների համար։",
    "Ձևը ուղարկելուց հետո խնդրում եմ այստեղ ուղարկել նաեւ այս բաժանմունքի բլանկի լուսանկարը։"
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
        `Մուտքագրման ձև բաժանմունքի համար: ${meta.department} (${meta.marker})`,
        `Հաշվետվության ամսաթիվ: ${buildDepartmentSheetMessageDateTimeText(reportDate)}`,
        "Ընթացիկ տվյալների PDF-ը հիմա չստացվեց ստեղծել, բայց ձևը կարելի է բացել։",
        "Ձևը ուղարկելուց հետո խնդրում եմ այստեղ ուղարկել նաեւ այս բաժանմունքի բլանկի լուսանկարը։"
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
  const autoRotateImages = await isTelegramPhotoAutoRotateEnabled(supabase as ReturnType<typeof createClient>);
  const formUrl = getTelegramWebFormUrl(
    departmentId,
    effectiveReportDate,
    carryoverValues,
    null,
    { autoRotateImages }
  );

  await sendTelegramMessageWithReplyMarkup(
    chatId,
    [
      baseText,
      "",
      "Այժմ լրացրեք նույն բաժանմունքի Telegram ձևը։",
      `Բաժանմունք: ${meta.department} (${meta.marker})`,
      "Եթե ձևը արդեն ուղարկել եք, կրկին լրացնել պետք չէ։"
    ].join("\n"),
    buildTelegramFormReplyMarkup(formUrl)
  );
}

async function sendTelegramNightShiftForm(chatId: number | string) {
  const reportDateTime = getYerevanDateTimeText();
  const formUrl = getTelegramNightFormUrl(reportDateTime);
  await sendTelegramMessageWithReplyMarkup(
    chatId,
    [
      "Ընդունման ձևը պատրաստ է։",
      "Լրացրեք միայն այն բաժանմունքները, որտեղ ընդունում է եղել։",
      "Ուղարկելուց հետո տվյալները կպահպանվեն կայքի «Ընդունում» էջում և Վադիմ Աշոտիչին կուղարկվի ամփոփում։",
      "",
      `Ժամանակ: ${reportDateTime}`
    ].join("\n"),
    buildTelegramNightFormReplyMarkup(formUrl)
  );
}

async function sendTelegramDayShiftForm(chatId: number | string) {
  const reportDateTime = getYerevanDateTimeText();
  const formUrl = getTelegramDayFormUrl(reportDateTime);
  await sendTelegramMessageWithReplyMarkup(
    chatId,
    [
      "Ընդունման ձևը պատրաստ է։",
      "Լրացրեք միայն այն բաժանմունքները, որտեղ ընդունում է եղել։",
      "Ուղարկելուց հետո տվյալները կպահպանվեն կայքի «Ընդունում» էջում և Վադիմ Աշոտիչին կուղարկվի ամփոփում։",
      "",
      `Ժամանակ: ${reportDateTime}`
    ].join("\n"),
    buildTelegramDayFormReplyMarkup(formUrl)
  );
}

async function sendTelegramDischargeShiftForm(chatId: number | string) {
  const reportDateTime = getYerevanDateTimeText();
  const formUrl = getTelegramDischargeFormUrl(reportDateTime);
  await sendTelegramMessageWithReplyMarkup(
    chatId,
    [
      "Դուրսգրման ձևը պատրաստ է։",
      "Լրացրեք միայն այն բաժանմունքները, որտեղ ստացիոնարից դուրսգրում է եղել։",
      "Ուղարկելուց հետո տվյալները կպահպանվեն կայքի «Դուրսգրում» էջում և Վադիմ Աշոտիչին կուղարկվի ամփոփում։",
      "",
      `Ժամանակ: ${reportDateTime}`
    ].join("\n"),
    buildTelegramDischargeFormReplyMarkup(formUrl)
  );
}

async function sendTelegramCivilReferralsForm(chatId: number | string) {
  const formUrl = getTelegramCivilReferralsFormUrl();
  await sendTelegramMessageWithReplyMarkup(
    chatId,
    [
      "Քաղ. ԲԿ բազայի Telegram ձևը պատրաստ է։",
      "Այստեղ կարող եք որոնել, դիտել և խմբագրել արդեն պահպանված տողերը հեռախոսից։",
      "Սա հասանելի է միայն ադմինիստրատորին, որպեսզի անձնական տվյալները պատահաբար չբացվեն։"
    ].join("\n"),
    buildTelegramCivilReferralsReplyMarkup(formUrl)
  );
}

function normalizeShiftFormMode(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "day" || normalized === "day_shift") {
    return "day";
  }
  if (normalized === "discharge" || normalized === "morning" || normalized === "morning_discharge") {
    return "discharge";
  }
  return "night";
}

async function sendShiftFormToTelegram(mode: string) {
  const normalizedMode = normalizeShiftFormMode(mode);
  const chatIds = getTelegramNotifyChatIds(null);
  for (const chatId of chatIds) {
    if (normalizedMode === "day") {
      await sendTelegramDayShiftForm(chatId);
    } else if (normalizedMode === "discharge") {
      await sendTelegramDischargeShiftForm(chatId);
    } else {
      await sendTelegramNightShiftForm(chatId);
    }
  }
  return { mode: normalizedMode, sent: chatIds.length };
}

function rowHasAnyData(values: Record<string, number | null>) {
  return Object.values(values).some((value) => typeof value === "number" && value > 0);
}

function getRowEffectiveUpdatedAt(
  row: Awaited<ReturnType<typeof loadSnapshot>>["rows"][number]
) {
  const source = String(row.photoWorkflowStatus || "");
  if (source === "processed_rollover" || source === "processed_night_shift" || source === "processed_day_shift") {
    return String(row.photoFeedbackUpdatedAt || "");
  }
  return String(row.updatedAt || row.photoFeedbackUpdatedAt || "");
}

function getStatusTimestampMs(value: string) {
  const raw = String(value || "").trim();
  if (!raw) {
    return Number.NaN;
  }

  const localMatch = raw.match(/^(\d{2})[.,/](\d{2})[.,/](\d{2,4})\s+(\d{2}):(\d{2})$/);
  if (localMatch) {
    const year = localMatch[3].length === 2 ? Number(`20${localMatch[3]}`) : Number(localMatch[3]);
    const utcMs = Date.UTC(
      year,
      Number(localMatch[2]) - 1,
      Number(localMatch[1]),
      Number(localMatch[4]),
      Number(localMatch[5])
    ) - YEREVAN_UTC_OFFSET_MS;
    return utcMs;
  }

  return Date.parse(raw);
}

function formatStatusDateTime(value: string) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "ամսաթիվ չկա";
  }

  const localMatch = raw.match(/^(\d{2})[.,/](\d{2})[.,/](\d{2,4})\s+(\d{2}):(\d{2})$/);
  if (localMatch) {
    const year = localMatch[3].length === 2 ? `20${localMatch[3]}` : localMatch[3];
    return `${localMatch[1]}.${localMatch[2]}.${year} ${localMatch[4]}:${localMatch[5]}`;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? getYerevanHyDateTimeText(new Date(parsed)) : raw;
}

function getStatusRowUpdatedAt(
  row: Awaited<ReturnType<typeof loadSnapshot>>["rows"][number]
) {
  return getRowEffectiveUpdatedAt(row);
}

function getStatusRowText(
  row: Awaited<ReturnType<typeof loadSnapshot>>["rows"][number]
) {
  const updatedAt = getStatusRowUpdatedAt(row);
  if (updatedAt) {
    return formatStatusDateTime(updatedAt);
  }

  if (QH_CALC_DEPARTMENT_IDS.has(row.id as DepartmentId) && rowHasAnyData(row.values)) {
    return "առանձին չի թարմացվել";
  }

  return "ամսաթիվ չկա";
}

function buildStatusText(snapshot: Awaited<ReturnType<typeof loadSnapshot>>) {
  const rowsWithData = snapshot.rows.filter((row) => rowHasAnyData(row.values));
  const nowText = getYerevanDateTimeText();
  const newestUpdatedAt = rowsWithData
    .map((row) => getStatusRowUpdatedAt(row))
    .filter((value) => Number.isFinite(getStatusTimestampMs(value)))
    .sort((a, b) => getStatusTimestampMs(b) - getStatusTimestampMs(a))[0] || "";
  const updatedRows = rowsWithData
    .sort((a, b) => getStatusTimestampMs(getStatusRowUpdatedAt(b)) - getStatusTimestampMs(getStatusRowUpdatedAt(a)))
    .map((row) => {
      return `- ${row.department}: ${getStatusRowText(row)}`;
    });

  return [
    `Ժամը հիմա: ${nowText}`,
    `Հաշվետվության կազմման ժամը: ${snapshot.reportDate}`,
    `Լրացված բաժանմունքներ: ${rowsWithData.length}/${snapshot.rows.length}`,
    newestUpdatedAt ? `Վերջին թարմացումը: ${formatStatusDateTime(newestUpdatedAt)}` : "",
    updatedRows.length ? "" : null,
    updatedRows.length ? "Վերջին թարմացումներ:" : null,
    ...updatedRows
  ].filter(Boolean).join("\n");
}

function rowNeedsFreshTelegramUpdate(
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>,
  row: Awaited<ReturnType<typeof loadSnapshot>>["rows"][number]
) {
  const updatedAtText = getStatusRowUpdatedAt(row);
  if (!updatedAtText && QH_CALC_DEPARTMENT_IDS.has(row.id as DepartmentId) && rowHasAnyData(row.values)) {
    return false;
  }

  const updatedAt = getStatusTimestampMs(updatedAtText);
  if (!Number.isFinite(updatedAt)) {
    return true;
  }
  const twoHoursMs = 2 * 60 * 60 * 1000;
  return Date.now() - updatedAt > twoHoursMs;
}

function buildTelegramWebAutoSaveAdminText(
  departmentId: DepartmentId,
  reportDate: string,
  userName: string,
  didAutoSave: boolean
) {
  const meta = DEPARTMENTS[departmentId];
  return [
    "Получена Telegram Web App форма.",
    `Отделение: ${meta.department} (${meta.marker})`,
    `Дата отчёта: ${reportDate}`,
    userName ? `Пользователь: ${userName}` : "",
    didAutoSave
      ? "Данные автоматически внесены в основную таблицу."
      : "Основная таблица пока не обновлена: ждем фото бланка этого же отделения."
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

function escapeTelegramHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getPhotoCellValueByNumber(values: Record<string, number | null>, cell: number) {
  const field = PHOTO_FIELD_MAPPINGS.find((item) => item.cell === cell);
  return field ? getSheetNumber(values, field.key) : 0;
}

function formatPhotoTableToken(value: number) {
  return String(Math.max(0, Math.trunc(value))).padStart(3, " ");
}

type PhotoTableCellDescriptor = {
  cell: number;
  label: string;
};

function buildPhotoTableColumnWidths(
  items: PhotoTableCellDescriptor[],
  values: Record<string, number | null>
) {
  return items.map((item) => Math.max(
    3,
    item.label.length,
    String(Math.max(0, Math.trunc(getPhotoCellValueByNumber(values, item.cell)))).length
  ));
}

function buildPhotoTableLabelsLine(items: PhotoTableCellDescriptor[], widths: number[]) {
  return items
    .map((item, index) => item.label.padEnd(widths[index], " "))
    .join(" ");
}

function buildPhotoTableValuesLine(
  items: PhotoTableCellDescriptor[],
  widths: number[],
  values: Record<string, number | null>
) {
  return items
    .map((item, index) => formatPhotoTableToken(getPhotoCellValueByNumber(values, item.cell)).trimStart().padStart(widths[index], " "))
    .join(" ");
}

function buildPhotoTableBlockLines(
  title: string,
  items: PhotoTableCellDescriptor[],
  values: Record<string, number | null>
) {
  const widths = buildPhotoTableColumnWidths(items, values);
  const lines = [
    buildPhotoTableLabelsLine(items, widths),
    buildPhotoTableValuesLine(items, widths, values)
  ];
  return title ? [title, ...lines] : lines;
}

function buildPhotoTwoColumnBlock(
  leftTitle: string,
  leftLines: string[],
  rightTitle: string,
  rightLines: string[],
  gap = 4
) {
  const leftAllLines = leftTitle ? [leftTitle, ...leftLines] : [...leftLines];
  const rightAllLines = rightTitle ? [rightTitle, ...rightLines] : [...rightLines];
  const leftWidth = leftAllLines.reduce((max, line) => Math.max(max, line.length), 0);
  const lineCount = Math.max(leftAllLines.length, rightAllLines.length);
  const mergedLines: string[] = [];

  for (let index = 0; index < lineCount; index += 1) {
    const left = leftAllLines[index] || "";
    const right = rightAllLines[index] || "";
    mergedLines.push(right ? `${left.padEnd(leftWidth, " ")}${" ".repeat(gap)}${right}` : left);
  }

  return mergedLines.join("\n");
}

function buildPhotoRecognizedTableText(values: Record<string, number | null>) {
  const beenBlock = buildPhotoTableBlockLines("ԵՂԵԼ Է", [
    { cell: 1, label: "ընդ." },
    { cell: 2, label: "զ/ծ" },
    { cell: 3, label: "շարք" }
  ], values);
  const admittedBlock = buildPhotoTableBlockLines("ԸՆԴՈՒՆՎԵԼ Է", [
    { cell: 4, label: "ընդ." },
    { cell: 5, label: "զ/ծ" },
    { cell: 6, label: "շարք" }
  ], values);
  const dischargedBlock = buildPhotoTableBlockLines("Դ/Գ", [
    { cell: 7, label: "ընդ." },
    { cell: 8, label: "զ/ծ" },
    { cell: 9, label: "շարք" }
  ], values);
  const transferBlock = buildPhotoTableBlockLines("ՏԵՂԱՓՈԽ / ՀՍԿԻՉ", [
    { cell: 10, label: "գնաց" },
    { cell: 11, label: "եկավ" },
    { cell: 12, label: "հաշվ." }
  ], values);
  const currentPrimaryBlock = buildPhotoTableBlockLines("ԱՌԿԱ Է", [
    { cell: 13, label: "շարք" },
    { cell: 14, label: "սպա" },
    { cell: 15, label: "պայմ." },
    { cell: 16, label: "զ/հ" }
  ], values);
  const currentSecondaryBlock = buildPhotoTableBlockLines("", [
    { cell: 17, label: "զ/ծ ընտ" },
    { cell: 18, label: "զ/պ" },
    { cell: 19, label: "քաղ." }
  ], values);
  const leaveBlock = buildPhotoTableBlockLines("ԱՐՁԱԿՈՒՐԴ", [
    { cell: 20, label: "շարք" },
    { cell: 21, label: "սպա" },
    { cell: 22, label: "պայմ." }
  ], values);

  return [
    buildPhotoTwoColumnBlock("", beenBlock, "", admittedBlock),
    buildPhotoTwoColumnBlock("", dischargedBlock, "", transferBlock),
    buildPhotoTwoColumnBlock("", [...currentPrimaryBlock, ...currentSecondaryBlock], "", leaveBlock)
  ].join("\n\n");
}

function getNightShiftRowTotal(row: Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number>) {
  return NIGHT_SHIFT_VALUE_KEYS.reduce((sum, key) => sum + safeNumber(row[key]), 0);
}

function buildNightShiftValuesText(row: Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number>) {
  return NIGHT_SHIFT_VALUE_KEYS
    .filter((key) => safeNumber(row[key]) > 0)
    .map((key) => `${NIGHT_SHIFT_LABELS[key]}=${safeNumber(row[key])}`)
    .join(", ");
}

function buildNightShiftSummaryText(
  rows: Record<string, Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number>>,
  reportDateTime: string,
  userName: string
) {
  const filledDepartments = Object.entries(DEPARTMENTS)
    .map(([departmentId, meta]) => {
      const row = rows[departmentId] || sanitizeNightShiftRows({})[departmentId];
      const total = getNightShiftRowTotal(row);
      return { departmentId, meta, row, total };
    })
    .filter((item) => item.total > 0);

  const columnTotals = Object.fromEntries(
    NIGHT_SHIFT_VALUE_KEYS.map((key) => [
      key,
      filledDepartments.reduce((sum, item) => sum + safeNumber(item.row[key]), 0)
    ])
  ) as Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number>;
  const grandTotal = filledDepartments.reduce((sum, item) => sum + item.total, 0);

  const departmentLines = filledDepartments.length
    ? filledDepartments.map((item) => {
      const details = buildNightShiftValuesText(item.row);
      return `- ${item.meta.marker} ${item.meta.department}: ${item.total}${details ? ` (${details})` : ""}`;
    })
    : ["- Նոր ընդունվածներ նշված չեն։"];
  const totalLines = NIGHT_SHIFT_VALUE_KEYS
    .filter((key) => safeNumber(columnTotals[key]) > 0)
    .map((key) => `- ${NIGHT_SHIFT_LABELS[key]}: ${safeNumber(columnTotals[key])}`);
  const nightPageUrl = getNightShiftBrowserUrl();

  return [
    "Ընդունման տվյալներ են ստացվել։",
    `Ժամանակ: ${reportDateTime}`,
    userName ? `Ուղարկող: ${userName}` : "",
    `Լրացված բաժանմունքներ: ${filledDepartments.length}`,
    "",
    "Ըստ բաժանմունքների.",
    ...departmentLines,
    "",
    "Ըստ կոնտինգենտի.",
    ...(totalLines.length ? totalLines : ["- Չկա"]),
    "",
    `Ընդամենը: ${grandTotal}`,
    `Ընդունման էջը: ${nightPageUrl}`,
    "Տվյալները պահպանվել են միայն «Ընդունում» էջում։ Հիմնական աղյուսակ տեղափոխումը կատարեք կայքի էջից։"
  ].filter((line) => line !== "").join("\n");
}

function buildDayShiftSummaryText(
  rows: Record<string, Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number>>,
  reportDateTime: string,
  userName: string
) {
  const filledDepartments = Object.entries(DEPARTMENTS)
    .map(([departmentId, meta]) => {
      const row = rows[departmentId] || sanitizeNightShiftRows({})[departmentId];
      const total = getNightShiftRowTotal(row);
      return { departmentId, meta, row, total };
    })
    .filter((item) => item.total > 0);

  const columnTotals = Object.fromEntries(
    NIGHT_SHIFT_VALUE_KEYS.map((key) => [
      key,
      filledDepartments.reduce((sum, item) => sum + safeNumber(item.row[key]), 0)
    ])
  ) as Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number>;
  const grandTotal = filledDepartments.reduce((sum, item) => sum + item.total, 0);

  const departmentLines = filledDepartments.length
    ? filledDepartments.map((item) => {
      const details = buildNightShiftValuesText(item.row);
      return `- ${item.meta.marker} ${item.meta.department}: ${item.total}${details ? ` (${details})` : ""}`;
    })
    : ["- Նոր ընդունվածներ նշված չեն։"];
  const totalLines = NIGHT_SHIFT_VALUE_KEYS
    .filter((key) => safeNumber(columnTotals[key]) > 0)
    .map((key) => `- ${NIGHT_SHIFT_LABELS[key]}: ${safeNumber(columnTotals[key])}`);

  return [
    "Ընդունման տվյալներ են ստացվել։",
    `Ժամանակ: ${reportDateTime}`,
    userName ? `Ուղարկող: ${userName}` : "",
    `Լրացված բաժանմունքներ: ${filledDepartments.length}`,
    "",
    "Ըստ բաժանմունքների.",
    ...departmentLines,
    "",
    "Ըստ կոնտինգենտի.",
    ...(totalLines.length ? totalLines : ["- Չկա"]),
    "",
    `Ընդամենը: ${grandTotal}`,
    "Տվյալները պահպանվել են միայն «Ընդունում» էջում։ Հիմնական աղյուսակ տեղափոխումը կատարեք կայքի էջից։"
  ].filter((line) => line !== "").join("\n");
}

function buildDischargeShiftSummaryText(
  rows: Record<string, Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number>>,
  reportDateTime: string,
  userName: string
) {
  const filledDepartments = Object.entries(DEPARTMENTS)
    .map(([departmentId, meta]) => {
      const row = rows[departmentId] || sanitizeNightShiftRows({})[departmentId];
      const total = getNightShiftRowTotal(row);
      return { departmentId, meta, row, total };
    })
    .filter((item) => item.total > 0);

  const columnTotals = Object.fromEntries(
    NIGHT_SHIFT_VALUE_KEYS.map((key) => [
      key,
      filledDepartments.reduce((sum, item) => sum + safeNumber(item.row[key]), 0)
    ])
  ) as Record<typeof NIGHT_SHIFT_VALUE_KEYS[number], number>;
  const grandTotal = filledDepartments.reduce((sum, item) => sum + item.total, 0);

  const departmentLines = filledDepartments.length
    ? filledDepartments.map((item) => {
      const details = buildNightShiftValuesText(item.row);
      return `- ${item.meta.marker} ${item.meta.department}: ${item.total}${details ? ` (${details})` : ""}`;
    })
    : ["- Դուրսգրում նշված չէ։"];
  const totalLines = NIGHT_SHIFT_VALUE_KEYS
    .filter((key) => safeNumber(columnTotals[key]) > 0)
    .map((key) => `- ${NIGHT_SHIFT_LABELS[key]}: ${safeNumber(columnTotals[key])}`);

  return [
    "Դուրսգրման տվյալներ են ստացվել։",
    `Ժամանակ: ${reportDateTime}`,
    userName ? `Ուղարկող: ${userName}` : "",
    `Լրացված բաժանմունքներ: ${filledDepartments.length}`,
    "",
    "Ըստ բաժանմունքների.",
    ...departmentLines,
    "",
    "Ըստ կոնտինգենտի.",
    ...(totalLines.length ? totalLines : ["- Չկա"]),
    "",
    `Ընդամենը: ${grandTotal}`,
    "Տվյալները պահպանվել են միայն «Դուրսգրում» էջում։ Հիմնական աղյուսակ տեղափոխումը կատարեք կայքի էջից։"
  ].filter((line) => line !== "").join("\n");
}

async function handleTelegramWebFormSubmit(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const departmentId = typeof payload?.departmentId === "string" && Object.prototype.hasOwnProperty.call(DEPARTMENTS, payload.departmentId)
      ? payload.departmentId as DepartmentId
      : null;
    if (!departmentId) {
      return jsonResponse({ ok: false, error: "Ձևի բաժանմունքը որոշել չհաջողվեց։" }, 400);
    }

    const supabase = createSupabaseAdmin();
    const access = await verifyDepartmentFormAccess(supabase, payload, departmentId);
    if (!access.ok) {
      return jsonResponse({ ok: false, error: access.error }, access.status);
    }
    const accessContext = access.context;
    const photoImageDataUrl = sanitizeAndroidPhotoDataUrl(payload?.photoImageDataUrl);
    const photoImageName = sanitizeAndroidPhotoName(payload?.photoImageName) || "android-photo.jpg";
    const photoDetectedDepartmentId = sanitizeAndroidPhotoDetectedDepartmentId(payload?.photoDetectedDepartmentId);
    if (accessContext.mode === "android") {
      if (!photoImageDataUrl) {
        return jsonResponse({ ok: false, error: "Для отправки нужен снимок бланка этого отделения." }, 400);
      }
      if (!photoDetectedDepartmentId || photoDetectedDepartmentId !== departmentId) {
        return jsonResponse({ ok: false, error: "Отделение не опознано, сделайте повторное фото." }, 400);
      }
    }

    const snapshot = await loadSnapshot(supabase as ReturnType<typeof createClient>);
    const reportDate = sanitizeReportDate(payload?.reportDate) || snapshot.reportDate || DEFAULT_DATE;
    const values = applyTelegramWebFormCarryoverValues(
      sanitizeDepartmentFormValues(payload?.values),
      getTelegramWebFormCarryoverFromSnapshot(snapshot, departmentId)
    );
    const patientNotes = sanitizeDepartmentPatientNotes(payload?.patientNotes);
    const validation = validateDepartmentSheetValues(values);
    const validationLinesHy = formatDepartmentValidationLinesHy(validation);
    if (!validation.isValid) {
      return jsonResponse({
        ok: false,
        error: "Բանաձևի վերահսկումը չի անցել։",
        validation
      }, 400);
    }

    const feedbackId = await insertTelegramWebFormFeedback(
      supabase as ReturnType<typeof createClient>,
      departmentId,
      reportDate,
      values,
      accessContext.userId,
      accessContext.userName,
      patientNotes,
      accessContext.mode === "android"
        ? {
          imageName: photoImageName,
          imageDataUrl: photoImageDataUrl,
          notes: ["Submitted via Android MAINFORM"]
        }
        : undefined
    );
    const pairedPhotoFeedback = await loadLatestDepartmentPhotoFeedback(
      supabase as ReturnType<typeof createClient>,
      departmentId,
      reportDate
    );
    await saveDepartmentSnapshot(supabase as ReturnType<typeof createClient>, departmentId, reportDate, values, "telegram-form");
    await markDepartmentPhotoProcessed(
      supabase as ReturnType<typeof createClient>,
      departmentId,
      pairedPhotoFeedback ? pairedPhotoFeedback.id : feedbackId,
      pairedPhotoFeedback ? (pairedPhotoFeedback.imageName || "telegram-photo") : "telegram-web-app-form",
      "processed_telegram"
    );
    const didAutoSave = true;
    const savedSnapshot = await loadSnapshot(supabase as ReturnType<typeof createClient>);
    let autoPdfResult:
      | Awaited<ReturnType<typeof maybeAutoSendMainPdfsWhenSnapshotReady>>
      | null = null;
    try {
      autoPdfResult = await maybeAutoSendMainPdfsWhenSnapshotReady(
        supabase as ReturnType<typeof createClient>,
        savedSnapshot
      );
    } catch (error) {
      console.error("Failed to auto-send main PDFs after Telegram Web App save:", sanitizePublicErrorMessage(error));
    }
    const meta = DEPARTMENTS[departmentId];
    const messageText = didAutoSave
      ? [
        "Ձևը և լուսանկարը ստացվել են։ Շնորհակալություն, գերազանց աշխատանք է։ 🙂",
        `Բաժանմունք: ${meta.department} (${meta.marker})`,
        ...(validationLinesHy.length ? ["Վերահսկիչ գումարներ:", ...validationLinesHy] : []),
        "Տվյալները ավտոմատ գրանցվել են ընդհանուր աղյուսակում։",
        ...(autoPdfResult?.sent ? [buildMainPdfsAutoSentNoticeHy(autoPdfResult.sent)] : []),
        "Կցում եմ PDF բլանկը՝ Telegram ձևից ստացված նոր արժեքներով։"
      ].join("\n")
      : [
        "Ձևը ստացվել և ստուգվել է։ Շնորհակալություն։ 🙂",
        `Բաժանմունք: ${meta.department} (${meta.marker})`,
        ...(validationLinesHy.length ? ["Վերահսկիչ գումարներ:", ...validationLinesHy] : []),
        "Ընդհանուր աղյուսակը դեռ չի թարմացվել․ ավտոմատ գրանցման համար պետք է նաև նույն բաժանմունքի բլանկի լուսանկարը։",
        "Կցում եմ PDF բլանկը՝ Telegram ձևից ստացված արժեքներով։"
      ].join("\n");

    if (accessContext.telegramUser?.userId) {
      try {
        const pdfBytes = await buildFilledDepartmentPdfBytes(departmentId, values, reportDate, patientNotes);
        await sendTelegramDocument(
          accessContext.telegramUser.userId,
          buildDepartmentPdfFileName(departmentId, reportDate, "telegram-form"),
          pdfBytes,
          messageText,
          "application/pdf"
        );
      } catch (error) {
        console.error("Failed to notify Telegram Web App user:", sanitizePublicErrorMessage(error));
        await sendTelegramMessage(accessContext.telegramUser.userId, messageText).catch((fallbackError) => {
          console.error("Failed to send fallback Telegram Web App message:", sanitizePublicErrorMessage(fallbackError));
        });
      }
    }

    const notifyChatIds = getTelegramNotifyChatIds(null);
    if (notifyChatIds.length) {
      const adminIntro = buildTelegramWebAutoSaveAdminText(
        departmentId,
        reportDate,
        accessContext.userName || String(accessContext.userId || ""),
        didAutoSave
      );

      await sendTelegramMessageToMany(notifyChatIds, [
        adminIntro,
        "",
        `OCR feedback: ${feedbackId || "без номера"}`,
        `Значения Web App: ${buildTelegramWebFormValuesText(values)}`,
        `Источник: ${accessContext.mode === "android" ? accessContext.userName : (accessContext.userName || "Telegram Web App")}`
      ].join("\n"));
    }
    return jsonResponse({
      ok: true,
      autoSaved: didAutoSave,
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

async function handleTelegramQhFormSubmit(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const departmentId = typeof payload?.departmentId === "string" && Object.prototype.hasOwnProperty.call(DEPARTMENTS, payload.departmentId)
      ? payload.departmentId as DepartmentId
      : null;
    if (!departmentId || !QH_CALC_DEPARTMENT_IDS.has(departmentId)) {
      return jsonResponse({ ok: false, error: "Հաշվարկային ձևի բաժանմունքը որոշել չհաջողվեց։" }, 400);
    }

    const supabase = createSupabaseAdmin();
    const access = await verifyDepartmentFormAccess(supabase, payload, departmentId);
    if (!access.ok) {
      return jsonResponse({ ok: false, error: access.error }, access.status);
    }
    const accessContext = access.context;
    const photoImageDataUrl = sanitizeAndroidPhotoDataUrl(payload?.photoImageDataUrl);
    const photoImageName = sanitizeAndroidPhotoName(payload?.photoImageName) || "android-photo.jpg";
    const photoDetectedDepartmentId = sanitizeAndroidPhotoDetectedDepartmentId(payload?.photoDetectedDepartmentId);
    if (accessContext.mode === "android") {
      if (!photoImageDataUrl) {
        return jsonResponse({ ok: false, error: "Для отправки нужен снимок бланка этого отделения." }, 400);
      }
      if (!photoDetectedDepartmentId || photoDetectedDepartmentId !== departmentId) {
        return jsonResponse({ ok: false, error: "Отделение не опознано, сделайте повторное фото." }, 400);
      }
    }

    const reportDate = sanitizeReportDate(payload?.reportDate) || DEFAULT_DATE;
    const directValuesPayload = payload?.values && typeof payload.values === "object" && !Array.isArray(payload.values)
      ? sanitizeValues(payload.values)
      : null;
    const qhValues = sanitizeQhTelegramFormValues(payload?.qhValues);
    const preservedValues = sanitizeQhTelegramPreservedValues(payload?.preservedValues);
    const values = directValuesPayload || buildQhTelegramFormDepartmentValues(qhValues, preservedValues);

    if (
      Number(values.currentShar) < 0
      || Number(values.currentSpa) < 0
      || Number(values.currentPaym) < 0
      || Number(values.currentZh) < 0
      || Number(values.family) < 0
      || Number(values.officer) < 0
      || Number(values.civil) < 0
    ) {
      return jsonResponse({
        ok: false,
        error: "V-AB սյունակներում չի կարող բացասական արժեք լինել։ Ստուգեք A-N և O-U արժեքները։"
      }, 400);
    }

    const validation = validateDepartmentSheetValues(values);
    const validationLinesHy = formatDepartmentValidationLinesHy(validation);
    if (!validation.isValid) {
      return jsonResponse({
        ok: false,
        error: "Հաշվարկային ձևի վերահսկումը չի անցել։",
        validation
      }, 400);
    }

    const feedbackId = await insertTelegramWebFormFeedback(
      supabase as ReturnType<typeof createClient>,
      departmentId,
      reportDate,
      values,
      accessContext.userId,
      accessContext.userName,
      createEmptyDepartmentPatientNotes(),
      accessContext.mode === "android"
        ? {
          imageName: photoImageName,
          imageDataUrl: photoImageDataUrl,
          notes: ["Submitted via Android MAINFORM"]
        }
        : undefined
    );
    const pairedPhotoFeedback = await loadLatestDepartmentPhotoFeedback(
      supabase as ReturnType<typeof createClient>,
      departmentId,
      reportDate
    );
    await saveDepartmentSnapshot(supabase as ReturnType<typeof createClient>, departmentId, reportDate, values, "telegram-form");
    await markDepartmentPhotoProcessed(
      supabase as ReturnType<typeof createClient>,
      departmentId,
      pairedPhotoFeedback ? pairedPhotoFeedback.id : feedbackId,
      pairedPhotoFeedback ? (pairedPhotoFeedback.imageName || "telegram-photo") : "telegram-qh-form",
      "processed_telegram"
    );

    const savedSnapshot = await loadSnapshot(supabase as ReturnType<typeof createClient>);
    let autoPdfResult:
      | Awaited<ReturnType<typeof maybeAutoSendMainPdfsWhenSnapshotReady>>
      | null = null;
    try {
      autoPdfResult = await maybeAutoSendMainPdfsWhenSnapshotReady(
        supabase as ReturnType<typeof createClient>,
        savedSnapshot
      );
    } catch (error) {
      console.error("Failed to auto-send main PDFs after Telegram QH form save:", sanitizePublicErrorMessage(error));
    }

    const meta = DEPARTMENTS[departmentId];
    const messageText = [
      "Հաշվարկային աղյուսակի տվյալները ստացվել են։ Շնորհակալություն։",
      `Բաժանմունք: ${meta.department} (${meta.marker})`,
      ...(validationLinesHy.length ? ["Վերահսկիչ գումարներ:", ...validationLinesHy] : []),
      "Տվյալները ավտոմատ գրանցվել են ընդհանուր աղյուսակում։",
      ...(autoPdfResult?.sent ? [buildMainPdfsAutoSentNoticeHy(autoPdfResult.sent)] : []),
      "Կցում եմ PDF բլանկը՝ հաշվարկային ձևից ստացված նոր արժեքներով։"
    ].join("\n");

    if (accessContext.telegramUser?.userId) {
      try {
        const pdfBytes = await buildFilledDepartmentPdfBytes(
          departmentId,
          values,
          reportDate,
          createEmptyDepartmentPatientNotes()
        );
        await sendTelegramDocument(
          accessContext.telegramUser.userId,
          buildDepartmentPdfFileName(departmentId, reportDate, "telegram-qh-form"),
          pdfBytes,
          messageText,
          "application/pdf"
        );
      } catch (error) {
        console.error("Failed to notify Telegram QH form user:", sanitizePublicErrorMessage(error));
        await sendTelegramMessage(accessContext.telegramUser.userId, messageText).catch((fallbackError) => {
          console.error("Failed to send fallback Telegram QH form message:", sanitizePublicErrorMessage(fallbackError));
        });
      }
    }

    const notifyChatIds = getTelegramNotifyChatIds(null);
    if (notifyChatIds.length) {
      const adminIntro = buildTelegramWebAutoSaveAdminText(
        departmentId,
        reportDate,
        accessContext.userName || String(accessContext.userId || ""),
        true
      );

      await sendTelegramMessageToMany(notifyChatIds, [
        adminIntro,
        "",
        `OCR feedback: ${feedbackId || "без номера"}`,
        `QH Web App: ${buildTelegramWebFormValuesText(values)}`,
        `Источник: ${accessContext.mode === "android" ? accessContext.userName : (accessContext.userName || "Telegram Web App")}`
      ].join("\n"));
    }

    return jsonResponse({
      ok: true,
      autoSaved: true,
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

function runTelegramBackgroundTask(task: Promise<unknown>, label: string) {
  const guardedTask = task.catch((error) => {
    console.error(`${label} failed:`, sanitizePublicErrorMessage(error));
  });

  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(guardedTask);
    return;
  }

  void guardedTask;
}

async function handleTelegramNightFormSubmit(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const verifiedUser = await verifyTelegramWebAppInitData(String(payload?.initData || ""));
    if (!verifiedUser) {
      return jsonResponse({ ok: false, error: "Telegram Web App authorization failed." }, 403);
    }

    const supabase = createSupabaseAdmin();
    if (!await isTelegramUserAllowedByRuntimeState(supabase, verifiedUser.userId)) {
      return jsonResponse({
        ok: false,
        error: "Բոտը ժամանակավորապես անջատված է կոլլեգաների համար։ Խնդրում ենք դիմել ադմինիստրատորին։"
      }, 403);
    }

    const reportDateTime = normalizeShiftReportDateTime(payload?.reportDateTime);
    const submittedRows = normalizeNightShiftSubmittedRows(payload);
    const touchedDepartmentIds = normalizeTouchedDepartmentIds(payload);
    const rows = await saveNightShiftDraft(
      supabase as ReturnType<typeof createClient>,
      submittedRows,
      reportDateTime,
      { mergeExisting: true, touchedDepartmentIds }
    );
    const userName = [
      verifiedUser.firstName,
      verifiedUser.lastName,
      verifiedUser.username ? `@${verifiedUser.username}` : ""
    ].filter(Boolean).join(" ");
    const summaryText = buildNightShiftSummaryText(rows, reportDateTime, userName);
    const notifyChatIds = getTelegramNotifyChatIds(null);

    runTelegramBackgroundTask((async () => {
      if (notifyChatIds.length) {
        await sendTelegramMessageToMany(notifyChatIds, summaryText);
      }
      if (verifiedUser.userId) {
        await updateTelegramPresenceRecord(
          supabase as ReturnType<typeof createClient>,
          {
            chatId: String(verifiedUser.userId),
            firstName: verifiedUser.firstName,
            lastName: verifiedUser.lastName,
            username: verifiedUser.username,
            updatedAt: new Date().toISOString()
          },
          { isDuty: false }
        ).catch((error) => {
          console.error("Failed to clear Telegram night duty mark:", sanitizePublicErrorMessage(error));
        });
        await sendTelegramMessage(
          verifiedUser.userId,
          [
            `Շնորհակալություն, ${verifiedUser.firstName || "հարգելի կոլեգա"}։ Ընդունման տվյալները պահպանվել են։`,
            "Շատ լավ աշխատանք է։ Եթե անհրաժեշտ է, կարող եք նորից բացել ձևը և ուղարկել ճշգրտված տարբերակը։"
          ].join("\n")
        );
      }
    })(), "Telegram night form notifications");

    return jsonResponse({
      ok: true,
      message: "Ընդունման տվյալները պահպանվել են։",
      filledDepartments: Object.values(rows).filter((row) => getNightShiftRowTotal(row) > 0).length,
      summary: summaryText
    });

    if (notifyChatIds.length) {
      await sendTelegramMessageToMany(notifyChatIds, summaryText);
    }
    if (verifiedUser.userId) {
      await updateTelegramPresenceRecord(
        supabase as ReturnType<typeof createClient>,
        {
          chatId: String(verifiedUser.userId),
          firstName: verifiedUser.firstName,
          lastName: verifiedUser.lastName,
          username: verifiedUser.username,
          updatedAt: new Date().toISOString()
        },
        { isDuty: false }
      ).catch((error) => {
        console.error("Failed to clear Telegram night duty mark:", sanitizePublicErrorMessage(error));
      });
      await sendTelegramMessage(
        verifiedUser.userId,
        [
          `Շնորհակալություն, ${verifiedUser.firstName || "հարգելի կոլեգա"}։ Ընդունման տվյալները պահպանվել են։`,
          "Շատ լավ աշխատանք է։ Առավոտյան ամենակարեւոր բաներից մեկը կարգավորված տվյալներն են, եւ Դուք դա արդեն արեցիք։",
          "Թող հերթափոխի ավարտը լինի հանգիստ, իսկ սուրճը՝ արժանիորեն տաք։",
          "Եթե անհրաժեշտ է, կարող եք նորից բացել ձևը և ուղարկել ճշգրտված տարբերակը։"
        ].join("\n")
      ).catch((error) => {
        console.error("Failed to notify Telegram night form user:", sanitizePublicErrorMessage(error));
      });
    }

    return jsonResponse({
      ok: true,
      message: "Ընդունման տվյալները պահպանվել են։",
      filledDepartments: Object.values(rows).filter((row) => getNightShiftRowTotal(row) > 0).length,
      summary: summaryText
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: sanitizePublicErrorMessage(error)
    }, 500);
  }
}

async function handleTelegramShiftFormLoad(
  request: Request,
  mode: "night" | "day" | "discharge"
) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const verifiedUser = await verifyTelegramWebAppInitData(String(payload?.initData || ""));
    if (!verifiedUser) {
      return jsonResponse({ ok: false, error: "Telegram Web App authorization failed." }, 403);
    }

    const supabase = createSupabaseAdmin();
    if (!await isTelegramUserAllowedByRuntimeState(supabase, verifiedUser.userId)) {
      return jsonResponse({
        ok: false,
        error: "Բոտը ժամանակավորապես անջատված է կոլլեգաների համար։ Խնդրում ենք դիմել ադմինիստրատորին։"
      }, 403);
    }

    const draft = await loadShiftDraftByMode(supabase as ReturnType<typeof createClient>, mode);
    return jsonResponse({
      ok: true,
      ...draft,
      filledDepartments: Object.values(draft.rows).filter((row) => getNightShiftRowTotal(row) > 0).length
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: sanitizePublicErrorMessage(error)
    }, 500);
  }
}

async function handleTelegramCivilReferralsLoad(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const verifiedUser = await verifyTelegramWebAppInitData(String(payload?.initData || ""));
    if (!verifiedUser) {
      return jsonResponse({ ok: false, error: "Telegram Web App authorization failed." }, 403);
    }

    if (!isTelegramAdminChat(verifiedUser.userId)) {
      return jsonResponse({
        ok: false,
        error: "Այս բաժինը հասանելի է միայն ադմինիստրատորին։"
      }, 403);
    }

    const supabase = createSupabaseAdmin();
    return jsonResponse({
      ok: true,
      ...(await listCivilReferrals(supabase as ReturnType<typeof createClient>, payload || {}))
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: sanitizePublicErrorMessage(error)
    }, 500);
  }
}

async function handleTelegramCivilReferralsSave(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const verifiedUser = await verifyTelegramWebAppInitData(String(payload?.initData || ""));
    if (!verifiedUser) {
      return jsonResponse({ ok: false, error: "Telegram Web App authorization failed." }, 403);
    }

    if (!isTelegramAdminChat(verifiedUser.userId)) {
      return jsonResponse({
        ok: false,
        error: "Այս բաժինը հասանելի է միայն ադմինիստրատորին։"
      }, 403);
    }

    const supabase = createSupabaseAdmin();
    const result = await saveCivilReferrals(
      supabase as ReturnType<typeof createClient>,
      payload?.rows,
      "telegram-civil-referrals",
      payload || {}
    );
    return jsonResponse({
      ok: true,
      ...result,
      message: "Փոփոխությունները պահպանված են։"
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: sanitizePublicErrorMessage(error)
    }, 500);
  }
}

async function handleTelegramCivilReferralsDelete(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const verifiedUser = await verifyTelegramWebAppInitData(String(payload?.initData || ""));
    if (!verifiedUser) {
      return jsonResponse({ ok: false, error: "Telegram Web App authorization failed." }, 403);
    }

    if (!isTelegramAdminChat(verifiedUser.userId)) {
      return jsonResponse({
        ok: false,
        error: "Այս բաժինը հասանելի է միայն ադմինիստրատորին։"
      }, 403);
    }

    const supabase = createSupabaseAdmin();
    const result = await deleteCivilReferrals(
      supabase as ReturnType<typeof createClient>,
      payload?.ids,
      payload || {}
    );
    return jsonResponse({
      ok: true,
      ...result,
      message: `Ջնջված է՝ ${result.deleted || 0} տող։`
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: sanitizePublicErrorMessage(error)
    }, 500);
  }
}

async function handleTelegramDayFormSubmit(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const verifiedUser = await verifyTelegramWebAppInitData(String(payload?.initData || ""));
    if (!verifiedUser) {
      return jsonResponse({ ok: false, error: "Telegram Web App authorization failed." }, 403);
    }

    const supabase = createSupabaseAdmin();
    if (!await isTelegramUserAllowedByRuntimeState(supabase, verifiedUser.userId)) {
      return jsonResponse({
        ok: false,
        error: "Բոտը ժամանակավորապես անջատված է կոլլեգաների համար։ Խնդրում ենք դիմել ադմինիստրատորին։"
      }, 403);
    }

    const reportDateTime = normalizeShiftReportDateTime(payload?.reportDateTime);
    const submittedRows = normalizeNightShiftSubmittedRows(payload);
    const touchedDepartmentIds = normalizeTouchedDepartmentIds(payload);
    const rows = await saveDayShiftDraft(
      supabase as ReturnType<typeof createClient>,
      submittedRows,
      reportDateTime,
      { mergeExisting: true, touchedDepartmentIds }
    );
    const userName = [
      verifiedUser.firstName,
      verifiedUser.lastName,
      verifiedUser.username ? `@${verifiedUser.username}` : ""
    ].filter(Boolean).join(" ");
    const summaryText = buildDayShiftSummaryText(rows, reportDateTime, userName);
    const notifyChatIds = getTelegramNotifyChatIds(null);

    runTelegramBackgroundTask((async () => {
      if (notifyChatIds.length) {
        await sendTelegramMessageToMany(notifyChatIds, summaryText);
      }
      if (verifiedUser.userId) {
        await sendTelegramMessage(
          verifiedUser.userId,
          [
            `Շնորհակալություն, ${verifiedUser.firstName || "հարգելի կոլեգա"}։ Ընդունման տվյալները պահպանվել են։`,
            "Տվյալները արդեն հասանելի են կայքում։ Եթե անհրաժեշտ է, կարող եք նորից բացել ձևը և ուղարկել ճշգրտված տարբերակը։"
          ].join("\n")
        );
      }
    })(), "Telegram day form notifications");

    return jsonResponse({
      ok: true,
      message: "Ընդունման տվյալները պահպանվել են։",
      filledDepartments: Object.values(rows).filter((row) => getNightShiftRowTotal(row) > 0).length,
      summary: summaryText
    });

    if (notifyChatIds.length) {
      await sendTelegramMessageToMany(notifyChatIds, summaryText);
    }
    if (verifiedUser.userId) {
      await sendTelegramMessage(
        verifiedUser.userId,
        [
          `Շնորհակալություն, ${verifiedUser.firstName || "հարգելի կոլեգա"}։ Ընդունման տվյալները պահպանվել են։`,
          "Շատ լավ է։ Տվյալները արդեն հասանելի են կայքի «Ընդունում» էջում։",
          "Եթե անհրաժեշտ է, կարող եք նորից բացել ձևը և ուղարկել ճշգրտված տարբերակը։"
        ].join("\n")
      ).catch((error) => {
        console.error("Failed to notify Telegram day form user:", sanitizePublicErrorMessage(error));
      });
    }

    return jsonResponse({
      ok: true,
      message: "Ընդունման տվյալները պահպանվել են։",
      filledDepartments: Object.values(rows).filter((row) => getNightShiftRowTotal(row) > 0).length,
      summary: summaryText
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: sanitizePublicErrorMessage(error)
    }, 500);
  }
}

async function handleTelegramDischargeFormSubmit(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    const verifiedUser = await verifyTelegramWebAppInitData(String(payload?.initData || ""));
    if (!verifiedUser) {
      return jsonResponse({ ok: false, error: "Telegram Web App authorization failed." }, 403);
    }

    const supabase = createSupabaseAdmin();
    if (!await isTelegramUserAllowedByRuntimeState(supabase, verifiedUser.userId)) {
      return jsonResponse({
        ok: false,
        error: "Բոտը ժամանակավորապես անջատված է կոլլեգաների համար։ Խնդրում ենք դիմել ադմինիստրատորին։"
      }, 403);
    }

    const reportDateTime = normalizeShiftReportDateTime(payload?.reportDateTime);
    const submittedRows = normalizeNightShiftSubmittedRows(payload);
    const touchedDepartmentIds = normalizeTouchedDepartmentIds(payload);
    const rows = await saveDischargeShiftDraft(
      supabase as ReturnType<typeof createClient>,
      submittedRows,
      reportDateTime,
      { mergeExisting: true, touchedDepartmentIds }
    );
    const userName = [
      verifiedUser.firstName,
      verifiedUser.lastName,
      verifiedUser.username ? `@${verifiedUser.username}` : ""
    ].filter(Boolean).join(" ");
    const summaryText = buildDischargeShiftSummaryText(rows, reportDateTime, userName);
    const notifyChatIds = getTelegramNotifyChatIds(null);

    runTelegramBackgroundTask((async () => {
      if (notifyChatIds.length) {
        await sendTelegramMessageToMany(notifyChatIds, summaryText);
      }
      if (verifiedUser.userId) {
        await sendTelegramMessage(
          verifiedUser.userId,
          [
            `Շնորհակալություն, ${verifiedUser.firstName || "հարգելի կոլեգա"}։ Դուրսգրման տվյալները պահպանվել են։`,
            "Տվյալները արդեն հասանելի են կայքում։ Եթե անհրաժեշտ է, կարող եք նորից բացել ձևը և ուղարկել ճշգրտված տարբերակը։"
          ].join("\n")
        );
      }
    })(), "Telegram discharge form notifications");

    return jsonResponse({
      ok: true,
      message: "Դուրսգրման տվյալները պահպանվել են։",
      filledDepartments: Object.values(rows).filter((row) => getNightShiftRowTotal(row) > 0).length,
      summary: summaryText
    });

    if (notifyChatIds.length) {
      await sendTelegramMessageToMany(notifyChatIds, summaryText);
    }
    if (verifiedUser.userId) {
      await sendTelegramMessage(
        verifiedUser.userId,
        [
          `Շնորհակալություն, ${verifiedUser.firstName || "հարգելի կոլեգա"}։ Դուրսգրման տվյալները պահպանվել են։`,
          "Շատ լավ աշխատանք է։ Տվյալները արդեն հասանելի են կայքի «Դուրսգրում» էջում։",
          "Եթե անհրաժեշտ է, կարող եք նորից բացել ձևը և ուղարկել ճշգրտված տարբերակը։"
        ].join("\n")
      ).catch((error) => {
        console.error("Failed to notify Telegram discharge form user:", sanitizePublicErrorMessage(error));
      });
    }

    return jsonResponse({
      ok: true,
      message: "Դուրսգրման տվյալները պահպանվել են։",
      filledDepartments: Object.values(rows).filter((row) => getNightShiftRowTotal(row) > 0).length,
      summary: summaryText
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
  validation?: DepartmentValidationResult | null,
  saveSource: "telegram-form" | "photo" | null = null
) {
  const meta = DEPARTMENTS[departmentId];
  const recognizedTableText = buildPhotoRecognizedTableText(recognized.values);
  const validationLinesHy = formatDepartmentValidationLinesHy(validation);
  const safeLines = [
    `Отделение: ${meta.department} (${departmentId})`,
    `Источник отделения: ${departmentSource}`,
    `Дата отчёта: ${reportDate}`,
    recognized.reportDate ? `Дата на фото: ${recognized.reportDate}` : "Дата на фото: не распознана",
    `Страница отделения: ${getDepartmentPageUrl(departmentId, feedbackId)}`,
    `OCR feedback: ${feedbackId || "no id"}`
  ].map(escapeTelegramHtml);

  if (recognized.structure && (!recognized.structure.all22CellsVisible || recognized.structure.gridCellCount !== 22)) {
    safeLines.push(escapeTelegramHtml(`Структура строки не подтверждена: ${recognized.structure.gridCellCount}/22 ячеек.`));
  } else {
    safeLines.push("<b>Распознано по ячейкам:</b>");
    safeLines.push(`<pre>${escapeTelegramHtml(recognizedTableText)}</pre>`);
  }

  if (validationLinesHy.length) {
    safeLines.push("<b>Վերահսկիչ գումարներ:</b>");
    safeLines.push(...validationLinesHy.map(escapeTelegramHtml));
  }

  safeLines.push(escapeTelegramHtml(
    didSaveSnapshot
      ? `Տվյալները պահպանվել են ընդհանուր աղյուսակում։${saveSource === "telegram-form" ? " Պահպանման աղբյուր՝ Telegram Web App։" : (saveSource === "photo" ? " Պահպանման աղբյուր՝ լուսանկար։" : "")}`
      : "Տվյալները չեն պահպանվել։"
  ));

  return safeLines.filter(Boolean).join("\n");
}

function buildPhotoSenderResponse(
  isControlPassed: boolean,
  validation: DepartmentValidationResult | null,
  structureInvalid: boolean,
  hasRecognizedValues: boolean,
  firstName = ""
) {
  const validationLinesHy = formatDepartmentValidationLinesHy(validation);
  if (isControlPassed) {
    const address = firstName ? `${firstName}, ` : "";
    return [
      `${address}շնորհակալություն, բաժանմունքի վերահսկումը անցավ։ Գերազանց աշխատանք է։ 🙂`,
      ...(validationLinesHy.length ? ["Վերահսկիչ գումարներ:", ...validationLinesHy] : []),
      "Տվյալները պահպանված չեն հիմնական աղյուսակում։ Սպասվում է Telegram ձևը կամ ավտոսահմանումը այլ աղբյուրից։"
    ].join("\n");
  }

  const reason = !hasRecognizedValues
    ? "արժեքները վստահ կարդալ չհաջողվեց"
    : (structureInvalid
      ? "բլանկի վերին տողը վստահ չի ճանաչվել"
      : (validation && !validation.isValid ? "բաժանմունքի բանաձևը չի համընկել" : "վերահսկումը չի անցել"));

  return [
    buildPhotoRetakeResponse(reason, firstName),
    ...(validationLinesHy.length ? ["", "Վերահսկիչ գումարներ:", ...validationLinesHy] : []),
    "",
    "Տվյալները չեն պահպանվել հիմնական աղյուսակում։"
  ].join("\n");
}

function buildPhotoRetakeResponse(reason: string, firstName = "") {
  const address = firstName ? `${firstName}, ` : "";
  return [
    `${address}բաժանմունքի վերահսկումը չի անցել, բայց դա հեշտ ուղղելի է։`,
    `Պատճառը: ${reason}.`,
    "Խնդրում եմ ուղարկել բլանկի նոր, որակյալ լուսանկար՝ ուղիղ, առանց կտրված եզրերի, որպեսզի SR նշանը եւ վերին տողի բջիջները լավ երեւան։",
    "Փոքրիկ հնարք. ավելի լավ է նկարել մի քիչ հեռվից եւ ուղիղ, քան շատ մոտիկից եւ անկյան տակ։ Այդպես OCR-ը քիչ է բողոքում եւ ավելի շատ օգնում։"
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

function extractTelegramLocation(message: Record<string, unknown>) {
  const location = message.location as { latitude?: unknown; longitude?: unknown } | undefined;
  if (!location || typeof location !== "object") {
    return null;
  }
  const latitude = sanitizeCoordinate(location?.latitude, -90, 90);
  const longitude = sanitizeCoordinate(location?.longitude, -180, 180);
  if (latitude === null || longitude === null) {
    return null;
  }
  return { latitude, longitude };
}

function getMessageChatType(message: Record<string, unknown>) {
  const chat = message.chat as { type?: unknown } | undefined;
  return typeof chat?.type === "string" ? chat.type : "";
}

function isTelegramGroupMessage(message: Record<string, unknown>) {
  const type = getMessageChatType(message);
  return type === "group" || type === "supergroup";
}

function getMessageSenderChatId(message: Record<string, unknown>) {
  const from = message.from as { id?: unknown } | undefined;
  if (typeof from?.id === "number" || typeof from?.id === "string") {
    return String(from.id);
  }
  return "";
}

function getTelegramAccessChatId(message: Record<string, unknown>, fallbackChatId: number | string) {
  const senderId = getMessageSenderChatId(message);
  return isTelegramGroupMessage(message) && senderId ? senderId : String(fallbackChatId);
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

function buildPhotoApprovalReplyMarkup(approvalId: string) {
  return {
    inline_keyboard: [
      [
        { text: "Принять", callback_data: `approve_photo:${approvalId}` },
        { text: "Отклонить", callback_data: `reject_photo:${approvalId}` }
      ]
    ]
  };
}

function getPrivateTelegramAdminChatIds(excludeChatId?: number | string | null) {
  const excluded = excludeChatId === null || typeof excludeChatId === "undefined" ? "" : String(excludeChatId);
  return getTelegramAdminChatIds()
    .filter((chatId) => chatId && chatId !== excluded && !chatId.startsWith("-"));
}

function buildPendingPhotoMessage(record: TelegramPendingPhotoApproval) {
  if (record.message && typeof record.message === "object" && Object.keys(record.message).length) {
    return record.message;
  }
  return {
    chat: { id: Number(record.chatId), type: "private" },
    from: { id: Number(record.chatId), first_name: record.senderName },
    caption: record.hintText,
    photo: [{ file_id: record.fileId, width: 1, height: 1 }]
  } as Record<string, unknown>;
}

function formatDistanceMeters(distanceMeters: number) {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1).replace(".", ",")} կմ`;
  }
  return `${distanceMeters} մ`;
}

function buildWorkplaceStatusText(location: TelegramWorkplaceLocation | null) {
  if (!location) {
    return "Հիվանդանոցի GPS կետը դեռ սահմանված չէ։";
  }
  return [
    `GPS կետ: ${location.label}`,
    `Լայնություն: ${location.latitude}`,
    `Երկայնություն: ${location.longitude}`,
    `Ռադիուս: ${location.radiusMeters} մ`,
    location.updatedAt ? `Թարմացվել է: ${location.updatedAt}` : ""
  ].filter(Boolean).join("\n");
}

function buildWorkplaceArrivalText(
  firstName: string,
  location: TelegramWorkplaceLocation,
  distanceMeters: number,
  isDuty: boolean,
  alreadyAtWork: boolean
) {
  if (alreadyAtWork) {
    return [
      `${firstName}, Դուք արդեն նշված եք աշխատանքի վայրում։`,
      `Հեռավորությունը ${location.label}-ից՝ ${formatDistanceMeters(distanceMeters)}։`,
      "Ես պահում եմ փոքրիկ հերթապահությունը այստեղ՝ հանգիստ եւ ուշադիր։"
    ].join("\n");
  }

  if (isDuty) {
    return [
      `Բարի գիշերային հերթապահություն, ${firstName}։`,
      `Դուք գտնվում եք ${location.label}-ի տարածքում՝ մոտ ${formatDistanceMeters(distanceMeters)} հեռավորությամբ։`,
      "Թող հերթափոխը լինի խաղաղ։ Եթե ինչ-որ բան խառնվի, ես այստեղ եմ՝ առանց ավելորդ աղմուկի օգնելու համար։"
    ].join("\n");
  }

  return [
    `Բարի գալուստ աշխատանքի, ${firstName}։`,
    `Դուք գտնվում եք ${location.label}-ի տարածքում՝ մոտ ${formatDistanceMeters(distanceMeters)} հեռավորությամբ։`,
    "Թող օրը լինի հանգիստ, արդյունավետ եւ մի քիչ էլ բարի անակնկալներով։"
  ].join("\n");
}

function buildWorkplaceAwayText(
  firstName: string,
  location: TelegramWorkplaceLocation,
  distanceMeters: number,
  wasAtWork: boolean
) {
  if (wasAtWork) {
    return [
      `${firstName}, կարծես արդեն դուրս եք եկել ${location.label}-ի տարածքից։`,
      `Հեռավորությունը՝ ${formatDistanceMeters(distanceMeters)}։`,
      "Շնորհակալություն աշխատանքի համար։ Հանգիստ եւ խաղաղ երեկո Ձեզ։"
    ].join("\n");
  }
  return [
    `${firstName}, այս պահին Դուք ${location.label}-ի տարածքից դուրս եք։`,
    `Հեռավորությունը՝ ${formatDistanceMeters(distanceMeters)}։`,
    "Երբ հասնեք հիվանդանոց, կրկին սեղմեք «Ես աշխատանքի եմ» կոճակը։ Ես չեմ նեղանում, պարզապես քարտեզի հետ եմ խորհրդակցում։"
  ].join("\n");
}

function buildWorkplaceSetupHelpText() {
  return [
    "Հիվանդանոցի GPS կետը դեռ սահմանված չէ։",
    "Ադմինը կարող է կանգնել հիվանդանոցում եւ ուղարկել /set_workplace_here հրամանը, հետո սեղմել կետի կոճակը։",
    "Կարելի է նաեւ գրել՝ /set_workplace LAT LON 500"
  ].join("\n");
}

async function notifyTelegramWorkplaceEvent(
  chatId: number | string,
  person: TelegramColleagueChat,
  text: string
) {
  const notifyChatIds = getTelegramNotifyChatIds(chatId)
    .filter((targetChatId) => String(targetChatId) !== person.chatId);
  if (!notifyChatIds.length) {
    return;
  }
  await sendTelegramMessageToMany(notifyChatIds, text);
}

async function handleTelegramLocation(
  supabase: ReturnType<typeof createClient>,
  responseChatId: number,
  message: Record<string, unknown>,
  accessChatId: number | string,
  locationPoint: { latitude: number; longitude: number }
) {
  const person = getTelegramPersonFromMessage(message, accessChatId);
  const firstName = getTelegramColleagueFirstName(person);
  const pendingSetupChatId = await getTelegramWorkplaceSetupPending(supabase);
  const gpsEnabled = await isTelegramGpsScenarioEnabled(supabase);

  if (isTelegramAdminChat(accessChatId) && pendingSetupChatId === String(accessChatId)) {
    const location: TelegramWorkplaceLocation = {
      latitude: locationPoint.latitude,
      longitude: locationPoint.longitude,
      radiusMeters: DEFAULT_WORKPLACE_RADIUS_METERS,
      label: "հիվանդանոց",
      updatedAt: new Date().toISOString()
    };
    await saveTelegramWorkplaceLocation(supabase, location);
    await clearTelegramWorkplaceSetupPending(supabase);
    await sendTelegramMessage(
      responseChatId,
      [
        "Հիվանդանոցի GPS կետը պահպանված է։",
        buildWorkplaceStatusText(location),
        gpsEnabled
          ? "Այժմ գործընկերները կարող են սեղմել «Ես աշխատանքի եմ» կոճակը։"
          : "GPS սցենարը դեռ անջատված է։ Միացնելու համար գրեք /gps_on։"
      ].join("\n")
    );
    return;
  }

  if (!gpsEnabled) {
    await sendTelegramMessageWithReplyMarkup(
      responseChatId,
      isTelegramAdminChat(accessChatId)
        ? "GPS սցենարը հիմա անջատված է։ Միացնելու համար գրեք /gps_on։"
        : `GPS սցենարը հիմա անջատված է։ Ընդունման ձևի համար սեղմեք «${TELEGRAM_DAY_SHIFT_BUTTON_TEXT}» կոճակը։`,
      buildWorkplaceLocationReplyMarkup(false)
    );
    return;
  }

  const workplace = await loadTelegramWorkplaceLocation(supabase);
  if (!workplace) {
    await sendTelegramMessageWithReplyMarkup(
      responseChatId,
      isTelegramAdminChat(accessChatId)
        ? buildWorkplaceSetupHelpText()
        : "GPS կետը դեռ կարգավորված չէ։ Երբ Վադիմ Աշոտիչը սահմանի հիվանդանոցի կետը, կկարողանամ ճանաչել Ձեր ներկայությունը։",
      isTelegramAdminChat(accessChatId) ? buildWorkplaceSetupLocationReplyMarkup() : buildWorkplaceLocationReplyMarkup(true)
    );
    return;
  }

  const distanceMeters = getDistanceMeters(
    workplace.latitude,
    workplace.longitude,
    locationPoint.latitude,
    locationPoint.longitude
  );
  const isAtWork = distanceMeters <= workplace.radiusMeters;
  const records = await loadTelegramPresenceRecords(supabase);
  const previous = records.find((item) => item.chatId === person.chatId);
  const nowText = getYerevanDateTimeText();

  if (isAtWork) {
    const isDuty = previous?.isDuty === true || isYerevanNightDutyTime();
    const alreadyAtWork = previous?.status === "at_work";
    const result = await updateTelegramPresenceRecord(supabase, person, {
      status: "at_work",
      isDuty,
      arrivedAt: alreadyAtWork ? previous?.arrivedAt || nowText : nowText,
      lastLatitude: locationPoint.latitude,
      lastLongitude: locationPoint.longitude,
      distanceMeters
    });
    await sendTelegramMessageWithReplyMarkup(
      responseChatId,
      buildWorkplaceArrivalText(firstName, workplace, distanceMeters, result.previous?.status === "at_work" ? result.current.isDuty : isDuty, alreadyAtWork),
      buildWorkplaceLocationReplyMarkup(true)
    );
    if (!alreadyAtWork) {
      await notifyTelegramWorkplaceEvent(
        responseChatId,
        person,
        [
          "Կոլեգան աշխատանքի վայրում է։",
          `Ով: ${getTelegramColleagueDisplayName(person)}`,
          `Կարգավիճակ: ${isDuty ? "գիշերային հերթապահություն" : "աշխատանքի ժամ"}`,
          `Հեռավորություն: ${formatDistanceMeters(distanceMeters)}`,
          `Ժամանակ: ${nowText}`
        ].join("\n")
      );
    }
    return;
  }

  const wasAtWork = previous?.status === "at_work";
  await updateTelegramPresenceRecord(supabase, person, {
    status: "away",
    isDuty: false,
    leftAt: nowText,
    lastLatitude: locationPoint.latitude,
    lastLongitude: locationPoint.longitude,
    distanceMeters
  });
  await sendTelegramMessageWithReplyMarkup(
    responseChatId,
    buildWorkplaceAwayText(firstName, workplace, distanceMeters, wasAtWork),
    buildWorkplaceLocationReplyMarkup(true)
  );
  if (wasAtWork) {
    await notifyTelegramWorkplaceEvent(
      responseChatId,
      person,
      [
        "Կոլեգան դուրս է եկել հիվանդանոցի տարածքից։",
        `Ով: ${getTelegramColleagueDisplayName(person)}`,
        `Հեռավորություն: ${formatDistanceMeters(distanceMeters)}`,
        `Ժամանակ: ${nowText}`
      ].join("\n")
    );
  }
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

async function handleTelegramCallbackQuery(
  supabase: ReturnType<typeof createClient>,
  callbackQuery: Record<string, unknown>
) {
  const callbackQueryId = typeof callbackQuery.id === "string" ? callbackQuery.id : "";
  const data = typeof callbackQuery.data === "string" ? callbackQuery.data : "";
  const from = callbackQuery.from as { id?: unknown } | undefined;
  const adminChatId = typeof from?.id === "number" || typeof from?.id === "string" ? String(from.id) : "";
  const callbackMessage = callbackQuery.message as Record<string, unknown> | undefined;
  const callbackMessageChatId = callbackMessage ? getMessageChatId(callbackMessage) : null;
  const callbackMessageId = callbackMessage ? getTelegramMessageId(callbackMessage) : null;

  if (callbackMessage && isTelegramGroupMessage(callbackMessage)) {
    return;
  }

  if (!callbackQueryId || !data) {
    return;
  }

  if (!isTelegramAdminChat(adminChatId)) {
    await answerTelegramCallbackQuery(callbackQueryId, "Այս կոճակը հասանելի է միայն ադմինիստրատորին։").catch(() => null);
    return;
  }

  const photoApprovalMatch = data.match(/^(approve_photo|reject_photo):(.+)$/);
  if (photoApprovalMatch) {
    const action = photoApprovalMatch[1];
    const approvalId = photoApprovalMatch[2].trim();
    const pendingPhoto = approvalId ? await takeTelegramPendingPhotoApproval(supabase, approvalId) : null;
    if (!pendingPhoto) {
      await answerTelegramCallbackQuery(callbackQueryId, "Фото уже обработано или заявка устарела.").catch(() => null);
      if (callbackMessageChatId !== null) {
        await clearTelegramInlineKeyboard(callbackMessageChatId, callbackMessageId).catch(() => null);
      }
      return;
    }

    if (callbackMessageChatId !== null) {
      await clearTelegramInlineKeyboard(callbackMessageChatId, callbackMessageId).catch(() => null);
    }

    if (action === "reject_photo") {
      await answerTelegramCallbackQuery(callbackQueryId, "Фото отклонено.").catch(() => null);
      if (callbackMessageChatId !== null) {
        await sendTelegramMessage(callbackMessageChatId, `Отклонено: ${pendingPhoto.senderName || pendingPhoto.chatId}.`);
      }
      await sendTelegramMessage(
        pendingPhoto.chatId,
        "Լուսանկարը դեռ մշակման չի ընդունվել։ Խնդրում եմ ուղարկել բլանկի ավելի հստակ և ճիշտ լուսանկար։"
      ).catch((error) => {
        console.error("Failed to notify rejected photo sender:", sanitizePublicErrorMessage(error));
      });
      return;
    }

    await answerTelegramCallbackQuery(callbackQueryId, "Принято. Запускаю обработку фото.").catch(() => null);
    if (callbackMessageChatId !== null) {
      await sendTelegramMessage(
        callbackMessageChatId,
        `Принято: ${pendingPhoto.senderName || pendingPhoto.chatId}. Запускаю OCR.`
      ).catch(() => null);
    }
    try {
      const senderChatId = Number(pendingPhoto.chatId);
      if (!Number.isFinite(senderChatId)) {
        throw new Error(`Invalid pending photo chat id: ${pendingPhoto.chatId}`);
      }
      await handleTelegramPhoto(
        supabase,
        senderChatId,
        buildPendingPhotoMessage(pendingPhoto),
        { approved: true, skipAdminPhotoCopy: true }
      );
    } catch (error) {
      if (callbackMessageChatId !== null) {
        await sendTelegramMessage(
          callbackMessageChatId,
          `Не удалось обработать принятое фото: ${sanitizePublicErrorMessage(error)}`
        ).catch(() => null);
      }
      console.error("Failed to process approved Telegram photo:", sanitizePublicErrorMessage(error));
    }
    return;
  }

  if (data === TELEGRAM_APPLY_NIGHT_SHIFT_CALLBACK) {
    await answerTelegramCallbackQuery(callbackQueryId, "Տեղափոխում եմ ընդունման տվյալները…").catch(() => null);
    try {
      const result = await applyNightShiftDraftToMainFromTelegram(supabase);
      const pdfResult = await sendMainPdfsToTelegram(supabase, { force: true, source: "night_shift_apply" });
      if (callbackMessageChatId !== null) {
        await clearTelegramInlineKeyboard(callbackMessageChatId, callbackMessageId).catch(() => null);
        const departmentLines = result.appliedDepartments.length
          ? result.appliedDepartments.map((item) =>
            `- ${item.marker} ${item.department}: ${item.total}`
          )
          : ["- Նոր տվյալներ չկային։"];
        await sendTelegramMessage(
          callbackMessageChatId,
          [
            "Ընդունման տվյալների տեղափոխումն ավարտված է։",
            `Ժամանակ: ${result.reportDateTime}`,
            `Թարմացված բաժանմունքներ: ${result.applied}`,
            "",
            ...departmentLines,
            "",
            pdfResult.sent > 0
              ? `PDF ֆայլերը ուղարկվել են Telegram ալիք/խումբ (${pdfResult.sent} հասցեատեր)։`
              : `PDF ֆայլերը չեն ուղարկվել: ${pdfResult.skipped || "պատճառը չի նշվել"}`
          ].join("\n")
        );
      }
    } catch (error) {
      if (callbackMessageChatId !== null) {
        await sendTelegramMessage(
          callbackMessageChatId,
          `Չհաջողվեց տեղափոխել ընդունման տվյալները: ${sanitizePublicErrorMessage(error)}`
        ).catch(() => null);
      }
      console.error("Failed to apply night shift from Telegram callback:", sanitizePublicErrorMessage(error));
    }
    return;
  }

  const androidDeviceMatch = data.match(/^(approve_android_device|reject_android_device):(.+)$/);
  if (androidDeviceMatch) {
    const action = androidDeviceMatch[1];
    const targetDeviceId = sanitizeAndroidDeviceId(androidDeviceMatch[2]);
    if (!targetDeviceId) {
      await answerTelegramCallbackQuery(callbackQueryId, "Սարքի նույնականացուցիչը չի գտնվել։").catch(() => null);
      return;
    }

    if (action === "approve_android_device") {
      const device = await approveAndroidDevice(supabase, targetDeviceId);
      await answerTelegramCallbackQuery(callbackQueryId, "MAINFORM սարքը հաստատված է։").catch(() => null);
      if (callbackMessageChatId !== null) {
        await clearTelegramInlineKeyboard(callbackMessageChatId, callbackMessageId).catch(() => null);
        await sendTelegramMessage(
          callbackMessageChatId,
          `MAINFORM սարքը հաստատված է: ${getAndroidDeviceDisplayName(device)}.`
        ).catch(() => null);
      }
      return;
    }

    const device = await rejectAndroidDevice(supabase, targetDeviceId);
    await answerTelegramCallbackQuery(callbackQueryId, "MAINFORM սարքի մուտքը մերժվեց։").catch(() => null);
    if (callbackMessageChatId !== null) {
      await clearTelegramInlineKeyboard(callbackMessageChatId, callbackMessageId).catch(() => null);
      await sendTelegramMessage(
        callbackMessageChatId,
        `MAINFORM սարքի մուտքը մերժվեց: ${getAndroidDeviceDisplayName(device)}.`
      ).catch(() => null);
    }
    return;
  }

  const match = data.match(/^(approve_colleague|reject_colleague):(.+)$/);
  if (!match) {
    await answerTelegramCallbackQuery(callbackQueryId, "Գործողությունը չճանաչվեց։").catch(() => null);
    return;
  }

  const action = match[1];
  const targetChatId = match[2].trim();
  if (!targetChatId) {
    await answerTelegramCallbackQuery(callbackQueryId, "Օգտվողի chat id-ն չի գտնվել։").catch(() => null);
    return;
  }

  if (action === "approve_colleague") {
    const colleague = await approveTelegramColleague(supabase, targetChatId);
    const enabled = await areTelegramColleaguesEnabled(supabase);
    await answerTelegramCallbackQuery(callbackQueryId, "Կոլեգան հաստատված է։").catch(() => null);
    if (callbackMessageChatId !== null) {
      await clearTelegramInlineKeyboard(callbackMessageChatId, callbackMessageId).catch(() => null);
      await sendTelegramMessage(
        callbackMessageChatId,
        [
          `Одобрено: ${getTelegramColleagueDisplayName(colleague)}.`,
          enabled
            ? "Доступ открыт, бот примет его рабочие сообщения."
            : "Коллега добавлен в список, но общий доступ сейчас выключен. Для работы коллег включите /kollegi_on."
        ].join("\n")
      );
    }
    const gpsEnabled = await isTelegramGpsScenarioEnabled(supabase);
    await sendTelegramMessageWithReplyMarkup(
      targetChatId,
      [
        `${getTelegramColleagueFirstName(colleague)}, Mainflow բոտի հասանելիությունը բացված է։`,
        "Բարի գալուստ։ Ես արդեն իմ փոքրիկ պոստում եմ՝ ընդունում եմ բլանկների լուսանկարներ, ձևեր, ընդունման և դուրսգրման տվյալներ։",
        "Եթե առաջին լուսանկարը կատարյալ չստացվի, մի անհանգստացեք. ես կհուշեմ, ինչպես նկարել ավելի լավ։ Սա լուսանկարչության քննություն չէ, այլ թիմային աշխատանք։",
        "",
        gpsEnabled
          ? "Եթե արդեն հիվանդանոցում եք, սեղմեք «Ես աշխատանքի եմ» կոճակը եւ ուղարկեք geolocation-ը։"
          : `Ընդունման ձևի համար սեղմեք «${TELEGRAM_DAY_SHIFT_BUTTON_TEXT}» կոճակը։`
      ].join("\n"),
      buildWorkplaceLocationReplyMarkup(gpsEnabled)
    ).catch((error) => {
      console.error("Failed to notify approved Telegram colleague:", sanitizePublicErrorMessage(error));
    });
    return;
  }

  const colleague = await rejectTelegramColleague(supabase, targetChatId);
  await answerTelegramCallbackQuery(callbackQueryId, "Հայտը մերժված է։").catch(() => null);
  if (callbackMessageChatId !== null) {
    await clearTelegramInlineKeyboard(callbackMessageChatId, callbackMessageId).catch(() => null);
    await sendTelegramMessage(
      callbackMessageChatId,
      `Отклонено: ${getTelegramColleagueDisplayName(colleague)}.`
    );
  }
  await sendTelegramMessage(
    targetChatId,
    [
      `${getTelegramColleagueFirstName(colleague)}, Mainflow բոտի հասանելիությունը հիմա հաստատված չէ։`,
      "Եթե հասանելիությունը իսկապես անհրաժեշտ է, խնդրում եմ դիմեք Վադիմ Աշոտիչին։"
    ].join("\n")
  ).catch((error) => {
    console.error("Failed to notify rejected Telegram colleague:", sanitizePublicErrorMessage(error));
  });
}

async function handleTelegramCommand(
  supabase: ReturnType<typeof createClient>,
  chatId: number | string,
  text: string,
  message?: Record<string, unknown>,
  accessChatId: number | string = chatId
) {
  const command = text.trim().split(/\s+/)[0].toLowerCase().replace(/@[\w_]+$/, "");

  if (["/kollegi_on", "/colleagues_on", "/access_on"].includes(command)) {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    await setTelegramColleaguesEnabled(supabase, true);
    await sendTelegramMessage(chatId, "Коллеги подключены. Бот принимает сообщения только от одобренных коллег; новые люди по ссылке сначала попадут к вам на одобрение.");
    return;
  }

  if (["/kollegi_off", "/colleagues_off", "/access_off"].includes(command)) {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    await setTelegramColleaguesEnabled(supabase, false);
    await sendTelegramMessage(chatId, "Коллеги отключены. Теперь бот принимает рабочие сообщения только от администратора. Заявки можно одобрять, но коллеги начнут работать после /kollegi_on.");
    return;
  }

  if (["/kollegi_status", "/colleagues_status", "/access_status"].includes(command)) {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    const enabled = await areTelegramColleaguesEnabled(supabase);
    const approvedCount = (await loadTelegramColleagueChats(supabase)).length;
    const pendingCount = (await loadTelegramPendingColleagueChats(supabase)).length;
    await sendTelegramMessage(
      chatId,
      [
        enabled
          ? "Коллеги сейчас подключены: бот принимает сообщения от одобренных коллег."
          : "Коллеги сейчас отключены: бот слушает только администратора.",
        `Одобрено коллег: ${approvedCount}.`,
        `Ожидают вашего решения: ${pendingCount}.`
      ].join("\n")
    );
    return;
  }

  if (["/gps_on", "/geo_on", "/location_on"].includes(command)) {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    await setTelegramGpsScenarioEnabled(supabase, true);
    const workplace = await loadTelegramWorkplaceLocation(supabase);
    await sendTelegramMessageWithReplyMarkup(
      chatId,
      [
        "GPS սցենարը միացված է։",
        "Կոլեգաները կարող են օգտագործել «Ես աշխատանքի եմ» կոճակը։",
        workplace
          ? buildWorkplaceStatusText(workplace)
          : "Հիվանդանոցի GPS կետը դեռ չկա։ Սահմանեք /set_workplace_here կամ /set_workplace LAT LON 500 հրամանով։"
      ].join("\n"),
      buildWorkplaceLocationReplyMarkup(true)
    );
    return;
  }

  if (["/gps_off", "/geo_off", "/location_off"].includes(command)) {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    await setTelegramGpsScenarioEnabled(supabase, false);
    await clearTelegramWorkplaceSetupPending(supabase);
    await saveTelegramPresenceRecords(supabase, []);
    await sendTelegramMessageWithReplyMarkup(
      chatId,
      [
        "GPS սցենարը անջատված է։",
        "Հին ներկայության նշումները մաքրված են։",
        `Բոտը հիմա կթողնի «${TELEGRAM_DAY_SHIFT_BUTTON_TEXT}» և «${TELEGRAM_DISCHARGE_SHIFT_BUTTON_TEXT}» կոճակները։`
      ].join("\n"),
      buildWorkplaceLocationReplyMarkup(false)
    );
    return;
  }

  if (["/gps_status", "/geo_status", "/location_status"].includes(command)) {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    const gpsEnabled = await isTelegramGpsScenarioEnabled(supabase);
    const workplace = await loadTelegramWorkplaceLocation(supabase);
    const records = await loadTelegramPresenceRecords(supabase);
    const activeCount = records.filter((item) => item.status === "at_work").length;
    await sendTelegramMessage(
      chatId,
      [
        `GPS սցենար: ${gpsEnabled ? "միացված է" : "անջատված է"}։`,
        buildWorkplaceStatusText(workplace),
        `Ներկայության ակտիվ նշումներ: ${activeCount}.`,
        gpsEnabled
          ? "Անջատելու համար գրեք /gps_off։"
          : "Միացնելու համար գրեք /gps_on։"
      ].join("\n")
    );
    return;
  }

  if (["/reminder_12", "/reminder12"].includes(command)) {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    const result = await sendDailyReminderToColleagues(supabase, "midday", { force: true });
    await sendTelegramMessage(chatId, `Напоминание 12:00 отправлено: ${result.sent}.`);
    return;
  }

  if (["/reminder_17", "/reminder17"].includes(command)) {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    const result = await sendDailyReminderToColleagues(supabase, "evening", { force: true });
    await sendTelegramMessage(chatId, `Напоминание 17:00 отправлено: ${result.sent}.`);
    return;
  }

  if (["/night_reminder", "/night_duty_reminder"].includes(command)) {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    const result = await sendNightDutyReminderToColleagues(supabase, { force: true });
    await sendTelegramMessage(
      chatId,
      result.skipped === "gps_disabled"
        ? "GPS-сценарий выключен, утреннее напоминание дежурным не отправлялось. Для включения используйте /gps_on."
        : `Утреннее напоминание дежурным отправлено: ${result.sent}.`
    );
    return;
  }

  if (["/geo", "/location", "/work", "/at_work"].includes(command)) {
    const gpsEnabled = await isTelegramGpsScenarioEnabled(supabase);
    if (!gpsEnabled) {
      await sendTelegramMessageWithReplyMarkup(
        chatId,
        `GPS սցենարը հիմա անջատված է։ Ընդունման ձևի համար սեղմեք «${TELEGRAM_DAY_SHIFT_BUTTON_TEXT}» կոճակը։`,
        buildWorkplaceLocationReplyMarkup(false)
      );
      return;
    }
    await sendTelegramMessageWithReplyMarkup(
      chatId,
      [
        "Սեղմեք կոճակը եւ ուղարկեք Ձեր գտնվելու վայրը։",
        "Եթե Դուք հիվանդանոցում եք, ես կնշեմ, որ աշխատանքի եք։ Եթե գիշերային ժամ է, կհասկանամ, որ հերթապահություն է։"
      ].join("\n"),
      buildWorkplaceLocationReplyMarkup(true)
    );
    return;
  }

  if (["/duty", "/дежурю"].includes(command)) {
    const gpsEnabled = await isTelegramGpsScenarioEnabled(supabase);
    if (!gpsEnabled) {
      await sendTelegramMessageWithReplyMarkup(
        chatId,
        `GPS սցենարը հիմա անջատված է։ Ընդունման ձևի համար սեղմեք «${TELEGRAM_DAY_SHIFT_BUTTON_TEXT}» կոճակը։`,
        buildWorkplaceLocationReplyMarkup(false)
      );
      return;
    }
    const person = message ? getTelegramPersonFromMessage(message, accessChatId) : {
      chatId: String(accessChatId),
      firstName: "",
      lastName: "",
      username: "",
      updatedAt: new Date().toISOString()
    };
    await updateTelegramPresenceRecord(supabase, person, { isDuty: true });
    await sendTelegramMessageWithReplyMarkup(
      chatId,
      [
        `${getTelegramColleagueFirstName(person)}, գիշերային հերթապահության նշումը միացված է։`,
        "Երբ հիվանդանոցում լինեք, սեղմեք «Ես աշխատանքի եմ», որ առավոտյան հիշեցումը ճիշտ հասնի Ձեզ։"
      ].join("\n"),
      buildWorkplaceLocationReplyMarkup(true)
    );
    return;
  }

  if (["/not_duty", "/no_duty", "/не_дежурю"].includes(command)) {
    const person = message ? getTelegramPersonFromMessage(message, accessChatId) : {
      chatId: String(accessChatId),
      firstName: "",
      lastName: "",
      username: "",
      updatedAt: new Date().toISOString()
    };
    await updateTelegramPresenceRecord(supabase, person, { isDuty: false });
    await sendTelegramMessage(chatId, `${getTelegramColleagueFirstName(person)}, գիշերային հերթապահության նշումը անջատված է։`);
    return;
  }

  if (command === "/set_workplace_here") {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    await setTelegramWorkplaceSetupPending(supabase, accessChatId);
    await sendTelegramMessageWithReplyMarkup(
      chatId,
      [
        "Կանգնեք հիվանդանոցի այն կետում, որը ուզում եք ընդունել որպես կենտրոն։",
        "Հետո սեղմեք կոճակը եւ ուղարկեք Ձեր GPS կետը։ Նախնական ռադիուսը կլինի 500 մետր։"
      ].join("\n"),
      buildWorkplaceSetupLocationReplyMarkup()
    );
    return;
  }

  if (command === "/set_workplace") {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    const parts = text.trim().split(/\s+/).slice(1);
    const latitude = sanitizeCoordinate(parts[0], -90, 90);
    const longitude = sanitizeCoordinate(parts[1], -180, 180);
    if (latitude === null || longitude === null) {
      await sendTelegramMessage(chatId, "Օրինակ՝ /set_workplace 40.12345 44.12345 500");
      return;
    }
    const location: TelegramWorkplaceLocation = {
      latitude,
      longitude,
      radiusMeters: sanitizeRadiusMeters(parts[2]),
      label: "հիվանդանոց",
      updatedAt: new Date().toISOString()
    };
    await saveTelegramWorkplaceLocation(supabase, location);
    await clearTelegramWorkplaceSetupPending(supabase);
    const gpsEnabled = await isTelegramGpsScenarioEnabled(supabase);
    await sendTelegramMessage(
      chatId,
      [
        "GPS կետը պահպանված է։",
        buildWorkplaceStatusText(location),
        gpsEnabled ? "GPS սցենարը միացված է։" : "GPS սցենարը դեռ անջատված է։ Միացնելու համար գրեք /gps_on։"
      ].join("\n")
    );
    return;
  }

  if (command === "/workplace_status") {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    const location = await loadTelegramWorkplaceLocation(supabase);
    const gpsEnabled = await isTelegramGpsScenarioEnabled(supabase);
    const records = await loadTelegramPresenceRecords(supabase);
    const activeRecords = records.filter((item) => item.status === "at_work");
    const activeLines = activeRecords.length
      ? activeRecords.map((item) => {
        const distance = typeof item.distanceMeters === "number" ? `, ${formatDistanceMeters(item.distanceMeters)}` : "";
        return `- ${getTelegramColleagueDisplayName(item)}${item.isDuty ? " (հերթապահ)" : ""}${distance}`;
      })
      : ["- Հիմա ոչ ոք նշված չէ որպես հիվանդանոցում գտնվող։"];
    await sendTelegramMessage(
      chatId,
      [
        `GPS սցենար: ${gpsEnabled ? "միացված է" : "անջատված է"}։`,
        "",
        buildWorkplaceStatusText(location),
        "",
        "Ներկա նշված գործընկերներ.",
        ...activeLines
      ].join("\n")
    );
    return;
  }

  if (command === "/start") {
    const person = message ? getTelegramPersonFromMessage(message, chatId) : null;
    const gpsEnabled = await isTelegramGpsScenarioEnabled(supabase);
    await sendTelegramMessageWithReplyMarkup(
      chatId,
      [
        buildColleagueStartText(person ? getTelegramColleagueFirstName(person) : ""),
        "",
        gpsEnabled
          ? "Եթե արդեն հիվանդանոցում եք, սեղմեք «Ես աշխատանքի եմ» կոճակը։"
          : `Ընդունման ձևի համար սեղմեք «${TELEGRAM_DAY_SHIFT_BUTTON_TEXT}» կոճակը։`
      ].join("\n"),
      buildWorkplaceLocationReplyMarkup(gpsEnabled)
    );
    return;
  }

  if (command === "/help") {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, "Այս հրամանը հասանելի է միայն ադմինիստրատորին։ SR կոդերի ցանկի համար օգտագործեք /start կամ /departments։");
      return;
    }
    await sendTelegramMessage(chatId, buildAdminHelpText());
    return;
  }

  if (command === "/departments") {
    await sendTelegramMessage(chatId, buildSrDepartmentsText());
    return;
  }

  if (command === "/civil" || command === "/civil_referrals") {
    if (!isTelegramAdminChat(accessChatId)) {
      await sendTelegramMessage(chatId, TELEGRAM_ADMIN_ONLY_TEXT);
      return;
    }
    await sendTelegramCivilReferralsForm(chatId);
    return;
  }

  if (command === "/night" || command === "/night_shift") {
    if (message && isTelegramGroupMessage(message) && String(accessChatId) !== String(chatId)) {
      const person = getTelegramPersonFromMessage(message, accessChatId);
      const firstName = getTelegramColleagueFirstName(person);
      try {
        await sendTelegramNightShiftForm(accessChatId);
        await sendTelegramMessage(
          chatId,
          `${firstName}, ընդունման ձևը ուղարկեցի Ձեր անձնական չատում։`
        );
      } catch (error) {
        console.error("Failed to send Telegram night form privately from group:", sanitizePublicErrorMessage(error));
        await sendTelegramMessage(
          chatId,
          [
            `${firstName}, տեսնում եմ ընդունման հրամանը, բայց չեմ կարող անձնական չատում ձև ուղարկել։`,
            `Խնդրում եմ մեկ անգամ բացեք բոտը անձնական չատում և ուղարկեք /start, հետո այստեղ կրկին գրեք «${TELEGRAM_DAY_SHIFT_BUTTON_TEXT}»։`
          ].join("\n")
        );
      }
      return;
    }
    await sendTelegramNightShiftForm(chatId);
    return;
  }

  if (command === "/day" || command === "/day_shift") {
    if (message && isTelegramGroupMessage(message) && String(accessChatId) !== String(chatId)) {
      const person = getTelegramPersonFromMessage(message, accessChatId);
      const firstName = getTelegramColleagueFirstName(person);
      try {
        await sendTelegramDayShiftForm(accessChatId);
        await sendTelegramMessage(
          chatId,
          `${firstName}, ընդունման ձևը ուղարկեցի Ձեր անձնական չատում։`
        );
      } catch (error) {
        await sendTelegramMessage(
          chatId,
          [
            `${firstName}, տեսնում եմ ընդունման հրամանը, բայց չեմ կարող անձնական չատում ձև ուղարկել։`,
            `Խնդրում եմ մեկ անգամ բացեք բոտը անձնական չատում և ուղարկեք /start, հետո այստեղ կրկին գրեք «${TELEGRAM_DAY_SHIFT_BUTTON_TEXT}»։`
          ].join("\n")
        );
      }
      return;
    }
    await sendTelegramDayShiftForm(chatId);
    return;
  }

  if (command === "/discharge" || command === "/morning" || command === "/morning_discharge") {
    if (message && isTelegramGroupMessage(message) && String(accessChatId) !== String(chatId)) {
      const person = getTelegramPersonFromMessage(message, accessChatId);
      const firstName = getTelegramColleagueFirstName(person);
      try {
        await sendTelegramDischargeShiftForm(accessChatId);
        await sendTelegramMessage(
          chatId,
          `${firstName}, դուրսգրման ձևը ուղարկեցի Ձեր անձնական չատում։`
        );
      } catch (error) {
        await sendTelegramMessage(
          chatId,
          [
            `${firstName}, տեսնում եմ դուրսգրման հրամանը, բայց չեմ կարող անձնական չատում ձև ուղարկել։`,
            `Խնդրում եմ մեկ անգամ բացեք բոտը անձնական չատում և ուղարկեք /start, հետո այստեղ կրկին գրեք «${TELEGRAM_DISCHARGE_SHIFT_BUTTON_TEXT}»։`
          ].join("\n")
        );
      }
      return;
    }
    await sendTelegramDischargeShiftForm(chatId);
    return;
  }

  if (command === "/sheet") {
    const departmentId = detectDepartmentFromHint(text);
    if (!departmentId) {
      await sendTelegramMessage(chatId, "Խնդրում եմ հրամանից հետո նշել բաժանմունքը՝ /sheet r4 կամ /sheet SR-4։");
      return;
    }
    await sendWorkingSheetForDepartment(supabase, chatId, departmentId, text);
    return;
  }

  if (command === "/form") {
    const departmentId = detectDepartmentFromHint(text);
    if (!departmentId) {
      await sendTelegramMessage(chatId, "Խնդրում եմ հրամանից հետո նշել բաժանմունքը՝ /form r4 կամ /form SR-4։");
      return;
    }
    await sendTelegramWebFormForDepartment(supabase, chatId, departmentId, text);
    return;
  }

  if (isAllCurrentDepartmentsPdfRequest(command)) {
    await sendAllCurrentDepartmentsPdf(supabase, chatId, text);
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
        "Գլխավոր ֆայլը պատրաստ է այս էջում՝",
        getMainPageUrl(),
        "",
        "Բացեք էջը եւ PDF-ը պահեք բրաուզերի տպման կոճակով։"
      ].join("\n")
    );
    return;
  }

  await sendTelegramMessage(chatId, "Հրամանը չճանաչվեց։ Օգտագործեք /start կամ SR-?՝ բաժանմունքների ցանկը տեսնելու համար։");
}

async function processTelegramGroupCommand(
  supabase: ReturnType<typeof createClient>,
  message: Record<string, unknown>,
  accessChatId: number | string
) {
  const text = getMessageText(message);
  if (!text) {
    return;
  }

  if (!await isTelegramUserAllowedByRuntimeState(supabase, accessChatId)) {
    return;
  }

  const civilReferralSearchQuery = getCivilReferralTelegramSearchQuery(text);
  if (civilReferralSearchQuery) {
    await sendCivilReferralSearchWordDocument(
      supabase as ReturnType<typeof createClient>,
      accessChatId,
      civilReferralSearchQuery
    );
    return;
  }

  if (text.startsWith("/")) {
    await handleTelegramCommand(supabase, accessChatId, text, message, accessChatId);
    return;
  }

  if (isTelegramNightShiftButtonRequest(text)) {
    await handleTelegramCommand(supabase, accessChatId, "/night", message, accessChatId);
    return;
  }

  if (isTelegramDayShiftButtonRequest(text)) {
    await handleTelegramCommand(supabase, accessChatId, "/day", message, accessChatId);
    return;
  }

  if (isTelegramDischargeShiftButtonRequest(text)) {
    await handleTelegramCommand(supabase, accessChatId, "/discharge", message, accessChatId);
    return;
  }

  if (isSrDepartmentsListRequest(text)) {
    await sendTelegramMessage(accessChatId, buildSrDepartmentsText());
    return;
  }

  if (isAllCurrentDepartmentsPdfRequest(text)) {
    await sendAllCurrentDepartmentsPdf(supabase, accessChatId, text);
    return;
  }

  const requestedDepartmentId = detectDepartmentFromHint(text);
  if (requestedDepartmentId && !extractPhotoFileId(message)) {
    await sendTelegramWebFormForDepartment(supabase, accessChatId, requestedDepartmentId, text);
  }
}

async function requestTelegramPhotoApproval(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  message: Record<string, unknown>,
  fileId: string,
  hintText: string,
  senderPerson: TelegramColleagueChat
) {
  const approvalId = crypto.randomUUID();
  const senderName = getTelegramColleagueDisplayName(senderPerson);
  await addTelegramPendingPhotoApproval(supabase, {
    id: approvalId,
    chatId: String(chatId),
    fileId,
    hintText,
    message,
    senderName,
    createdAt: new Date().toISOString()
  });

  const adminChatIds = getPrivateTelegramAdminChatIds(chatId);
  const caption = [
    buildIncomingPhotoAdminCaption(message, chatId, hintText),
    "",
    "Нужно ваше решение: принять фото в обработку или отклонить."
  ].join("\n");
  const replyMarkup = buildPhotoApprovalReplyMarkup(approvalId);
  const sourceMessageId = getTelegramMessageId(message);

  if (adminChatIds.length && sourceMessageId !== null) {
    await copyTelegramMessageToMany(adminChatIds, chatId, sourceMessageId, caption, replyMarkup);
  } else if (adminChatIds.length) {
    await sendTelegramMessageWithReplyMarkup(adminChatIds[0], caption, replyMarkup);
  } else {
    console.warn("Telegram photo approval was not sent: admin chat is not configured.");
  }

  await sendTelegramMessage(
    chatId,
    `${getTelegramColleagueFirstName(senderPerson)}, լուսանկարը ստացվել է։ Սպասում եմ Վադիմ Աշոտիչի հաստատմանը, հետո միայն կսկսեմ մշակումը։`
  );
}

async function handleTelegramPhoto(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  message: Record<string, unknown>,
  options: TelegramPhotoHandlingOptions = {}
) {
  const fileId = extractPhotoFileId(message);
  if (!fileId) {
    await sendTelegramMessage(chatId, "Պետք է բլանկի լուսանկար։ Ուղարկեք լուսանկար կամ նկարը որպես փաստաթուղթ։");
    return;
  }

  const hintText = getMessageText(message);
  const hintedDepartmentId = detectDepartmentFromHint(hintText);
  const hintedReportDate = detectReportDateFromHint(hintText);
  const senderPerson = getTelegramPersonFromMessage(message, chatId);
  const senderFirstName = getTelegramColleagueFirstName(senderPerson);
  if (!options.approved && !isTelegramAdminChat(chatId)) {
    await requestTelegramPhotoApproval(supabase, chatId, message, fileId, hintText, senderPerson);
    return;
  }

  await sendTelegramMessage(
    chatId,
    `${senderFirstName}, լուսանկարը ստացել եմ։ Հիմա ուշադիր կարդում եմ բլանկը։`
  );

  const sourceMessageId = getTelegramMessageId(message);
  const photoNotifyChatIds = getTelegramNotifyChatIds(chatId)
    .filter((targetChatId) => String(targetChatId) !== String(chatId));
  if (!options.skipAdminPhotoCopy && photoNotifyChatIds.length && sourceMessageId !== null) {
    await copyTelegramMessageToMany(
      photoNotifyChatIds,
      chatId,
      sourceMessageId,
      buildIncomingPhotoAdminCaption(message, chatId, hintText)
    );
  } else if (!options.skipAdminPhotoCopy && photoNotifyChatIds.length) {
    console.warn("Telegram photo copy was not sent: original message_id is missing.");
  }

  const downloadedPhoto = await downloadTelegramImageAsDataUrl(fileId);
  const shouldAutoRotatePhoto = await isTelegramPhotoAutoRotateEnabled(supabase);
  const preparedPhoto = await inspectTelegramPhotoOrientation(
    downloadedPhoto.dataUrl,
    downloadedPhoto.fileName,
    {
      requireAdvice: false,
      enabled: shouldAutoRotatePhoto
    }
  );
  const dataUrl = preparedPhoto.dataUrl;
  const fileName = preparedPhoto.fileName;
  const orientationNotes = preparedPhoto.orientationNotes;

  let departmentId = hintedDepartmentId;
  const departmentSource = hintedDepartmentId ? "подсказка в сообщении" : "автоопределение по фото";

  if (!departmentId) {
    const detection = await detectDepartmentFromPhoto(dataUrl);
    departmentId = detection.departmentId;
    if (!departmentId) {
      const detectionSummary = [
        "Фото обработано. Отделение не определено.",
        "Источник отделения: автоопределение по фото"
      ].filter(Boolean).join("\n");
      const notifyChatIds = getTelegramNotifyChatIds(chatId);
      if (notifyChatIds.length) {
        await sendTelegramMessageToMany(notifyChatIds, detectionSummary);
      } else {
        console.warn("Telegram photo detection summary was not sent: TELEGRAM_NOTIFY_CHAT_IDS is not configured.");
      }
      await sendTelegramMessage(
        chatId,
        buildPhotoRetakeResponse("լուսանկարով բաժանմունքը վստահ որոշել չհաջողվեց", senderFirstName)
      );
      return;
    }
  }

  const reportDate = hintedReportDate || getYerevanReportDateText();
  const currentSnapshot = await loadSnapshot(supabase);
  const currentDepartmentRow = currentSnapshot?.rows.find((item) => item.id === departmentId) || null;

  const selectedPhotoDataUrl = dataUrl;
  const selectedPhotoFileName = fileName;
  const recognized = await recognizeDepartmentPhoto(departmentId, selectedPhotoDataUrl);
  const recognizedEvaluation = evaluateTelegramPhotoRecognitionCandidate(
    recognized,
    currentDepartmentRow?.values
  );

  const structureInvalid = recognizedEvaluation.structureInvalid;
  const hasRecognizedValues = recognizedEvaluation.hasRecognizedValues;
  const photoValidation = recognizedEvaluation.validation;
  const photoValidationLinesHy = formatDepartmentValidationLinesHy(photoValidation);
  const isPhotoControlPassed = recognizedEvaluation.isControlPassed;
  const telegramWebFormFeedback = await loadLatestTelegramWebFormFeedback(supabase, departmentId, reportDate);
  const feedbackId = await insertAcceptedFeedback(
    supabase,
    departmentId,
    reportDate,
    recognized.reportDate,
    selectedPhotoFileName,
    selectedPhotoDataUrl,
    recognized.values,
    recognized.recognizedKeys,
    [...orientationNotes, ...recognized.notes]
  );
  let shouldSaveSnapshot = false;
  let savedSnapshot: Awaited<ReturnType<typeof loadSnapshot>> | null = null;
  let autoSaveSource: "telegram-form" | "photo" | null = null;
  let autoPdfResult:
    | Awaited<ReturnType<typeof maybeAutoSendMainPdfsWhenSnapshotReady>>
    | null = null;
  if (telegramWebFormFeedback) {
    await saveDepartmentSnapshot(supabase, departmentId, reportDate, telegramWebFormFeedback.values, "telegram-form");
    await markDepartmentPhotoProcessed(supabase, departmentId, feedbackId, selectedPhotoFileName, "processed_telegram");
    shouldSaveSnapshot = true;
    autoSaveSource = "telegram-form";
    savedSnapshot = await loadSnapshot(supabase);
  } else if (isPhotoControlPassed) {
    await saveDepartmentSnapshot(supabase, departmentId, reportDate, recognized.values, "photo");
    await markDepartmentPhotoProcessed(supabase, departmentId, feedbackId, selectedPhotoFileName, "processed_photo");
    shouldSaveSnapshot = true;
    autoSaveSource = "photo";
    savedSnapshot = await loadSnapshot(supabase);
  } else {
    await markDepartmentPhotoPending(supabase, departmentId, feedbackId, selectedPhotoFileName);
  }

  if (shouldSaveSnapshot && savedSnapshot) {
    try {
      autoPdfResult = await maybeAutoSendMainPdfsWhenSnapshotReady(supabase, savedSnapshot);
    } catch (error) {
      console.error("Failed to auto-send main PDFs after Telegram photo save:", sanitizePublicErrorMessage(error));
    }
  }

  const detailedPhotoSummary = buildPhotoSaveSummary(
    departmentId,
    reportDate,
    recognized,
    departmentSource,
    feedbackId,
    shouldSaveSnapshot,
    photoValidation,
    autoSaveSource
  );
  const notifyChatIds = getTelegramNotifyChatIds(chatId);
  if (notifyChatIds.length) {
    if (shouldSaveSnapshot && savedSnapshot && autoSaveSource === "telegram-form" && telegramWebFormFeedback) {
      await sendTelegramMessageToMany(
        notifyChatIds,
        `Значения Web App: ${buildTelegramWebFormValuesText(telegramWebFormFeedback.values)}`
      );
    }
    await sendTelegramMessageToMany(notifyChatIds, detailedPhotoSummary, { parseMode: "HTML" });
  } else {
    console.warn("Telegram photo OCR summary was not sent: TELEGRAM_NOTIFY_CHAT_IDS is not configured.");
  }

  if (shouldSaveSnapshot) {
    await sendTelegramMessage(
      chatId,
      (
        autoSaveSource === "telegram-form"
          ? [
            photoValidation?.isValid === false
              ? `${senderFirstName}, լուսանկարը և Telegram ձևը ստացվել են, բայց OCR վերահսկումը նկատել է անհամապատասխանություն։`
              : `${senderFirstName}, լուսանկարը և Telegram ձևը ստացվել են։ Շնորհակալություն, շատ լավ աշխատանք է։ 🙂`,
            "Տվյալները վերցրել եմ Telegram ձևից և ավտոմատ գրանցել հիմնական աղյուսակում։",
            ...(photoValidation?.isValid === false ? ["Ուշադրություն. ստուգիր «Վերահսկիչ գումարներ» բաժնի նշումները։"] : []),
            ...(photoValidationLinesHy.length ? ["Վերահսկիչ գումարներ:", ...photoValidationLinesHy] : []),
            ...(autoPdfResult?.sent ? [buildMainPdfsAutoSentNoticeHy(autoPdfResult.sent)] : []),
            "Տվյալները պահպանվել են հիմնական աղյուսակում։"
          ]
          : [
            `${senderFirstName}, լուսանկարը ստացվել է և OCR վերահսկումը անցել է։ Շնորհակալություն։ 🙂`,
            "Տվյալները վերցրել եմ լուսանկարից և ավտոմատ գրանցել հիմնական աղյուսակում։",
            ...(photoValidationLinesHy.length ? ["Վերահսկիչ գումարներ:", ...photoValidationLinesHy] : []),
            ...(autoPdfResult?.sent ? [buildMainPdfsAutoSentNoticeHy(autoPdfResult.sent)] : []),
            "Տվյալները պահպանվել են հիմնական աղյուսակում։"
          ]
      ).join("\n")
    );
  } else {
    await sendTelegramWebFormPromptAfterPhoto(
      supabase,
      chatId,
      departmentId,
      reportDate,
      buildPhotoSenderResponse(isPhotoControlPassed, photoValidation, structureInvalid, hasRecognizedValues, senderFirstName)
    );
  }

}

async function handleTelegramSheetDocument(
  chatId: number,
  sheetDocument: { fileId: string; fileName: string; mimeType: string }
) {
  await sendTelegramMessage(chatId, "XLSX ֆայլը ստացել եմ։ Հիմա ստուգում եմ բանաձևը...");

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
        "⚠️ Աշխատանքային աղյուսակի կառուցվածքը փոխված է։",
        "Ֆայլը վերադարձնում եմ. խնդրում եմ վերցնել թարմ ֆայլը բոտից եւ լրացնել միայն մուտքագրման բջիջները։",
        "",
        `Բաժանմունք: ${meta.department} (${meta.marker})`,
        `Ինչ է գտնվել: ${result.integrity.issues.join("; ")}.`,
        "",
        "Հեռախոսում հավելվածը կարող է թույլ տալ սեղմել բոլոր բջիջները, բայց փոխել պետք է միայն զրոներով մուտքագրման բջիջները։"
      ].join("\n")
    );
    return;
  }

  if (!result.validation.isValid) {
    const validationLinesHy = formatDepartmentValidationLinesHy(result.validation);
    await sendTelegramDocument(
      chatId,
      fileName,
      bytes,
      [
        "⚠️ Բանաձևի վերահսկումը չի անցել։",
        "Ֆայլը վերադարձնում եմ. պետք է մի փոքր ուղղել տվյալները եւ կրկին ուղարկել։",
        "",
        `Բաժանմունք: ${meta.department} (${meta.marker})`,
        ...(validationLinesHy.length ? ["Վերահսկիչ գումարներ:", ...validationLinesHy] : []),
        "",
        "Խնդրում եմ ստուգել մուտքագրման բջիջները եւ վերահսկիչ գումարների հետ կապված թվերը։"
      ].join("\n")
    );
    return;
  }

  const validationLinesHy = formatDepartmentValidationLinesHy(result.validation);
  await sendTelegramMessage(
    chatId,
    [
      "Շնորհակալություն։ Գերազանց աշխատանք է։ 🙂",
      "Ֆայլը ստուգված է. բանաձևը համընկավ։",
      `Բաժանմունք: ${meta.department} (${meta.marker})`,
      ...(validationLinesHy.length ? ["Վերահսկիչ գումարներ:", ...validationLinesHy] : []),
      "Տվյալները ընդունված են ստուգման։ Ընդհանուր աղյուսակում դեռ ավտոմատ չեն գրանցվել։"
    ].join("\n")
  );
}

async function processTelegramUpdate(update: Record<string, unknown>) {
  const callbackQuery = update.callback_query as Record<string, unknown> | undefined;
  if (callbackQuery && typeof callbackQuery === "object") {
    const supabase = createSupabaseAdmin();
    await handleTelegramCallbackQuery(supabase, callbackQuery);
    return;
  }

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
  const accessChatId = getTelegramAccessChatId(message, safeChatId);

  // The bot must stay silent in shared groups. Allowed commands are handled by
  // sending the result to the sender's private chat, without replying in-group.
  if (isTelegramGroupMessage(message)) {
    await processTelegramGroupCommand(supabase, message, accessChatId);
    return;
  }

  if (!await isTelegramUserAllowedByRuntimeState(supabase, accessChatId)) {
    await requestTelegramColleagueApproval(supabase, message, accessChatId, safeChatId);
    return;
  }

  try {
    await rememberTelegramColleagueChat(supabase, message, accessChatId);
  } catch (error) {
    console.error("Failed to remember Telegram colleague chat:", sanitizePublicErrorMessage(error));
  }

  const text = getMessageText(message);
  const telegramLocation = extractTelegramLocation(message);

  if (telegramLocation) {
    await handleTelegramLocation(supabase, safeChatId, message, accessChatId, telegramLocation);
    return;
  }

  const civilReferralSearchQuery = getCivilReferralTelegramSearchQuery(text);
  if (civilReferralSearchQuery) {
    await sendCivilReferralSearchWordDocument(
      supabase as ReturnType<typeof createClient>,
      safeChatId,
      civilReferralSearchQuery
    );
    return;
  }

  if (text.startsWith("/")) {
    await handleTelegramCommand(supabase, safeChatId, text, message, accessChatId);
    return;
  }

  const sheetDocument = extractSheetDocument(message);
  if (sheetDocument) {
    await handleTelegramSheetDocument(safeChatId, sheetDocument);
    return;
  }

  if (isTelegramNightShiftButtonRequest(text)) {
    await handleTelegramCommand(supabase, safeChatId, "/night", message, accessChatId);
    return;
  }

  if (isTelegramDayShiftButtonRequest(text)) {
    await handleTelegramCommand(supabase, safeChatId, "/day", message, accessChatId);
    return;
  }

  if (isTelegramDischargeShiftButtonRequest(text)) {
    await handleTelegramCommand(supabase, safeChatId, "/discharge", message, accessChatId);
    return;
  }

  if (isSrDepartmentsListRequest(text)) {
    await sendTelegramMessage(safeChatId, buildSrDepartmentsText());
    return;
  }

  if (isAllCurrentDepartmentsPdfRequest(text)) {
    await sendAllCurrentDepartmentsPdf(supabase, safeChatId, text);
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

    if (action === "send-shift-form") {
      if (!isTelegramReminderRequestValid(request)) {
        return jsonResponse({ ok: false, error: "Invalid reminder secret." }, 403);
      }
      try {
        const mode = normalizeShiftFormMode(currentUrl.searchParams.get("mode"));
        const result = await sendShiftFormToTelegram(mode);
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
          status: "shift_form_send_failed",
          error: error instanceof Error ? error.message : String(error)
        }, 500);
      }
    }

    if (action === "night-duty-reminder") {
      if (!isTelegramReminderRequestValid(request)) {
        return jsonResponse({ ok: false, error: "Invalid reminder secret." }, 403);
      }
      try {
        const forceRaw = (currentUrl.searchParams.get("force") || "").trim().toLowerCase();
        const force = forceRaw === "1" || forceRaw === "true" || forceRaw === "yes";
        const supabase = createSupabaseAdmin();
        const result = await sendNightDutyReminderToColleagues(supabase, { force });
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
          status: "night_duty_reminder_failed",
          error: error instanceof Error ? error.message : String(error)
        }, 500);
      }
    }

    if (action === "night-shift-summary") {
      if (!isTelegramReminderRequestValid(request)) {
        return jsonResponse({ ok: false, error: "Invalid reminder secret." }, 403);
      }
      try {
        const forceRaw = (currentUrl.searchParams.get("force") || "").trim().toLowerCase();
        const force = forceRaw === "1" || forceRaw === "true" || forceRaw === "yes";
        const supabase = createSupabaseAdmin();
        const result = await sendMorningNightShiftSummaryToAdmins(supabase, { force });
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
          status: "night_shift_summary_failed",
          error: error instanceof Error ? error.message : String(error)
        }, 500);
      }
    }

    if (action === "telegram-form-pdf") {
      try {
        const currentUrl = new URL(request.url);
        const feedbackId = currentUrl.searchParams.get("id") || "";
        const departmentId = parseDepartmentId(currentUrl.searchParams.get("departmentId"));
        const supabase = createSupabaseAdmin();
        const record = await loadTelegramWebFormArchiveRecord(
          supabase,
          feedbackId,
          departmentId || undefined
        );
        if (!record) {
          return jsonResponse({ ok: false, error: "Telegram Web App form not found." }, 404);
        }

        const pdfBytes = await buildFilledDepartmentPdfBytes(
          record.departmentId,
          record.values,
          record.reportDate,
          record.patientNotes
        );
        return buildPdfBytesResponse(
          pdfBytes,
          buildDepartmentPdfFileName(record.departmentId, record.reportDate, "telegram-form")
        );
      } catch (error) {
        return jsonResponse({
          ok: false,
          service: "Mainflow-telegram",
          status: "telegram_form_pdf_failed",
          error: getErrorText(error)
        }, 500);
      }
    }

    if (action === "telegram-form-archive-pdf") {
      try {
        const currentUrl = new URL(request.url);
        const dateKey = normalizeTelegramFormArchiveDateKey(currentUrl.searchParams.get("date") || "");
        if (!dateKey) {
          return jsonResponse({ ok: false, error: "Archive date is required." }, 400);
        }

        const supabase = createSupabaseAdmin();
        const records = await loadTelegramWebFormArchiveRecordsForDate(supabase, dateKey);
        if (!records.length) {
          return jsonResponse({ ok: false, error: "Telegram Web App forms not found." }, 404);
        }

        const pdfBytes = await buildTelegramWebFormArchiveDatePdfBytes(records);
        return buildPdfBytesResponse(
          pdfBytes,
          `Telegram_forms_${dateKey}.pdf`
        );
      } catch (error) {
        return jsonResponse({
          ok: false,
          service: "Mainflow-telegram",
          status: "telegram_form_archive_pdf_failed",
          error: getErrorText(error)
        }, 500);
      }
    }

    if (action === "main-archive-pdf") {
      try {
        const currentUrl = new URL(request.url);
        const supabase = createSupabaseAdmin();
        const liveSnapshot = await loadSnapshot(supabase);
        const liveReportDate = liveSnapshot.reportDate || getYerevanReportDateText();
        const requestedDate = (currentUrl.searchParams.get("date") || "").trim();
        const dateKey = normalizeTelegramFormArchiveDateKey(requestedDate || liveReportDate) || getYerevanDateKey();
        const archiveSnapshot = await loadMainArchiveSnapshotByDateKey(supabase, dateKey);
        const effectiveSnapshot = archiveSnapshot || liveSnapshot;
        const effectiveReportDate = effectiveSnapshot.reportDate || liveReportDate;
        const pdfBytes = await buildMainArchivePdfBytes(supabase, effectiveSnapshot, effectiveReportDate, dateKey);
        return buildPdfBytesResponse(
          pdfBytes,
          buildMainArchivePdfFileName(dateKey)
        );
      } catch (error) {
        return jsonResponse({
          ok: false,
          service: "Mainflow-telegram",
          status: "main_archive_pdf_failed",
          error: getErrorText(error)
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

    if (action === "latest-department-photo") {
      try {
        const currentUrl = new URL(request.url);
        const departmentId = parseDepartmentId(currentUrl.searchParams.get("departmentId"));
        const reportDate = (currentUrl.searchParams.get("reportDate") || DEFAULT_DATE).trim() || DEFAULT_DATE;
        if (!departmentId) {
          return jsonResponse({ ok: false, error: "Department is required." }, 400);
        }

        const supabase = createSupabaseAdmin();
        const record = await loadLatestDepartmentPhotoPreview(
          supabase,
          departmentId,
          reportDate
        );
        return jsonResponse({ ok: true, record });
      } catch (error) {
        return jsonResponse({
          ok: false,
          service: "Mainflow-telegram",
          status: "latest_department_photo_failed",
          error: error instanceof Error ? error.message : String(error)
        }, 500);
      }
    }

    if (action === "latest-department-submission") {
      try {
        const currentUrl = new URL(request.url);
        const departmentId = parseDepartmentId(currentUrl.searchParams.get("departmentId"));
        const reportDate = (currentUrl.searchParams.get("reportDate") || DEFAULT_DATE).trim() || DEFAULT_DATE;
        if (!departmentId) {
          return jsonResponse({ ok: false, error: "Department is required." }, 400);
        }

        const supabase = createSupabaseAdmin();
        const record = await loadLatestDepartmentSubmissionRecord(
          supabase,
          departmentId,
          reportDate
        );
        return jsonResponse({ ok: true, record });
      } catch (error) {
        return jsonResponse({
          ok: false,
          service: "Mainflow-telegram",
          status: "latest_department_submission_failed",
          error: error instanceof Error ? error.message : String(error)
        }, 500);
      }
    }

    if (action === "android-mainform-feedback") {
      try {
        const currentUrl = new URL(request.url);
        const createdDateKey = String(currentUrl.searchParams.get("createdDateKey") || "").trim() || getYerevanDateKey();
        const limit = Number(currentUrl.searchParams.get("limit") || 80);
        const supabase = createSupabaseAdmin();
        const records = await listAndroidMainformFeedbackRecords(
          supabase,
          createdDateKey,
          limit
        );
        return jsonResponse({ ok: true, records });
      } catch (error) {
        return jsonResponse({
          ok: false,
          service: "Mainflow-telegram",
          status: "android_mainform_feedback_failed",
          error: error instanceof Error ? error.message : String(error)
        }, 500);
      }
    }

    if (action === "android-intake-state") {
      return await handleAndroidIntakeState(request);
    }

    if (action === "android-device-notifications") {
      return await handleAndroidDeviceNotifications(request);
    }

    if (action === "android-firebase-config") {
      return await handleAndroidFirebaseConfig(request);
    }

    if (action === "android-form-url") {
      try {
        const currentUrl = new URL(request.url);
        const rawDepartmentId = String(currentUrl.searchParams.get("departmentId") || "").trim();
        const isAndroidIntakeHub = rawDepartmentId === ANDROID_INTAKE_HUB_ID;
        const departmentId = isAndroidIntakeHub ? null : parseDepartmentId(rawDepartmentId);
        if (!isAndroidIntakeHub && !departmentId) {
          return jsonResponse({ ok: false, error: "Department is required." }, 400);
        }
        const deviceId = sanitizeAndroidDeviceId(currentUrl.searchParams.get("deviceId"));
        const deviceName = sanitizeAndroidDeviceName(currentUrl.searchParams.get("deviceName"));
        if (!deviceId) {
          return jsonResponse({ ok: false, error: "Device id is required." }, 400);
        }

        const supabase = createSupabaseAdmin();
        const accessState = await getAndroidDeviceAccessState(
          supabase,
          deviceId,
          deviceName,
          departmentId || "r4"
        );
        if (accessState.status === "missing") {
          return jsonResponse({
            ok: false,
            error: "device_required",
            message: "Устройство не идентифицировано. Откройте форму заново."
          }, 400);
        }
        if (accessState.status === "blocked") {
          return jsonResponse({
            ok: false,
            error: "access_denied",
            message: "Доступ для этого устройства отклонён через Telegram-бот."
          }, 403);
        }
        if (accessState.status !== "approved") {
          return jsonResponse({
            ok: false,
            error: "pending_approval",
            message: "Запрос доступа отправлен владельцу в Telegram. После подтверждения нажмите «Обновить данные»."
          }, 202);
        }
        const snapshot = await loadSnapshot(supabase);
        const reportDate = snapshot.reportDate || getYerevanReportDateText();
        const carryoverValues = departmentId
          ? getTelegramWebFormCarryoverFromSnapshot(snapshot, departmentId)
          : null;
        const autoRotateImages = await isTelegramPhotoAutoRotateEnabled(supabase);
        const formUrl = isAndroidIntakeHub
          ? getAndroidIntakeHubUrl(reportDate, { deviceId, deviceName })
          : getTelegramWebFormUrl(
            departmentId as DepartmentId,
            reportDate,
            carryoverValues || undefined,
            { deviceId, deviceName },
            { autoRotateImages }
          );

        return jsonResponse({
          ok: true,
          departmentId: isAndroidIntakeHub ? ANDROID_INTAKE_HUB_ID : departmentId,
          reportDate,
          deviceId,
          autoRotateImages,
          url: formUrl
        });
      } catch (error) {
        return jsonResponse({
          ok: false,
          service: "Mainflow-telegram",
          status: "android_form_url_failed",
          error: getErrorText(error)
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
  if (postUrl.searchParams.get("action") === "web-qh-form-submit") {
    return await handleTelegramQhFormSubmit(request);
  }
  if (postUrl.searchParams.get("action") === "android-photo-check") {
    return await handleAndroidPhotoCheck(request);
  }
  if (postUrl.searchParams.get("action") === "android-intake-photo-submit") {
    return await handleAndroidIntakePhotoSubmit(request);
  }
  if (postUrl.searchParams.get("action") === "android-device-notifications-ack") {
    return await handleAndroidDeviceNotificationsAck(request);
  }
  if (postUrl.searchParams.get("action") === "android-device-fcm-register") {
    return await handleAndroidDeviceFcmRegister(request);
  }
  if (postUrl.searchParams.get("action") === "night-form-load") {
    return await handleTelegramShiftFormLoad(request, "night");
  }
  if (postUrl.searchParams.get("action") === "day-form-load") {
    return await handleTelegramShiftFormLoad(request, "day");
  }
  if (postUrl.searchParams.get("action") === "discharge-form-load") {
    return await handleTelegramShiftFormLoad(request, "discharge");
  }
  if (postUrl.searchParams.get("action") === "civil-referrals-load") {
    return await handleTelegramCivilReferralsLoad(request);
  }
  if (postUrl.searchParams.get("action") === "night-form-submit") {
    return await handleTelegramNightFormSubmit(request);
  }
  if (postUrl.searchParams.get("action") === "day-form-submit") {
    return await handleTelegramDayFormSubmit(request);
  }
  if (postUrl.searchParams.get("action") === "discharge-form-submit") {
    return await handleTelegramDischargeFormSubmit(request);
  }
  if (postUrl.searchParams.get("action") === "civil-referrals-save") {
    return await handleTelegramCivilReferralsSave(request);
  }
  if (postUrl.searchParams.get("action") === "civil-referrals-delete") {
    return await handleTelegramCivilReferralsDelete(request);
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
        await sendTelegramMessage(chatId, `Հարցումը մշակել չհաջողվեց: ${publicMessage}`);
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
