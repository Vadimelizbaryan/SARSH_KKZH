import JSZip from "npm:jszip@3.10.1";
import { createClient } from "npm:@supabase/supabase-js@2";

const SOURCE_BUCKET = "sona-source";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TEXT_LENGTH = 90000;
const SUPPORTED_EXTENSIONS = new Set(["docx", "rtf", "doc", "pdf", "xlsx"]);
const EXTRACTABLE_EXTENSIONS = new Set(["docx", "rtf"]);
const MIME_BY_EXTENSION: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  rtf: "application/rtf",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};
const REGISTRY_TYPES = [
  "civil_hospitals",
  "admitted_military",
  "discharged_transferred",
  "referrals_admissions",
  "returned",
  "outpatient",
  "discharged_not_transferred",
  "archive_only",
  "unclassified"
] as const;

type RegistryType = typeof REGISTRY_TYPES[number];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function createSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase environment variables are missing.");
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

function getAllowedOwnerEmails() {
  const names = [
    "ALLOWED_OWNER_EMAILS",
    "ALLOWED_ACCOUNT_EMAILS",
    ["ALLOWED_", "GOO", "GLE", "_EMAILS"].join("")
  ];
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw || !raw.trim()) {
      continue;
    }
    return raw.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  }
  return [] as string[];
}

function extractBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authHeader.split(" ");
  return scheme === "Bearer" && token ? token.trim() : "";
}

async function authorizeOwner(request: Request, supabase: ReturnType<typeof createClient>) {
  const allowedEmails = getAllowedOwnerEmails();
  if (!allowedEmails.length) {
    return { error: "Owner access is not configured on the server." };
  }
  const token = extractBearerToken(request);
  if (!token) {
    return { error: "Owner sign-in is required." };
  }
  const { data, error } = await supabase.auth.getUser(token);
  const user = data?.user || null;
  const email = String(user?.email || "").trim().toLowerCase();
  if (error || !user || !email || !allowedEmails.includes(email)) {
    return { error: "Access is allowed only for the owner account." };
  }
  return { user, email };
}

function readString(value: unknown, limit = 500) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, limit) : "";
}

function normalizeSourcePath(value: unknown) {
  const path = readString(value, 1000).replace(/\\/g, "/").replace(/^\/+/, "");
  if (!path || path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Invalid source path.");
  }
  return path;
}

function getExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]{1,10})$/);
  return match ? match[1] : "";
}

function assertFileMetadata(payload: Record<string, unknown>) {
  const sourcePath = normalizeSourcePath(payload.sourcePath);
  const originalName = readString(payload.originalName || sourcePath.split("/").at(-1), 240);
  const extension = getExtension(originalName);
  const byteSize = Number(payload.byteSize);
  if (!originalName || !SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("Only DOCX, RTF, DOC, PDF and XLSX files may be placed in the SONA archive.");
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_FILE_BYTES) {
    throw new Error("File size must be between 1 byte and 50 MB.");
  }
  const mimeType = MIME_BY_EXTENSION[extension];
  return { sourcePath, originalName, extension, byteSize: Math.trunc(byteSize), mimeType };
}

function safeStorageName(originalName: string) {
  const extension = getExtension(originalName);
  const stem = originalName
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "document";
  return `${crypto.randomUUID()}-${stem}.${extension}`;
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeExtractedText(value: string) {
  return decodeXml(value)
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function extractDocxText(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file("word/document.xml");
  if (!documentXml) {
    throw new Error("The DOCX file has no Word document content.");
  }
  const xml = await documentXml.async("string");
  return normalizeExtractedText(
    xml
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<w:cr\b[^>]*\/>/g, "\n")
      .replace(/<\/w:tc>/g, " | ")
      .replace(/<\/w:tr>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
  );
}

function rtfUnicode(code: string) {
  let value = Number(code);
  if (!Number.isFinite(value)) {
    return "";
  }
  if (value < 0) {
    value += 65536;
  }
  try {
    return String.fromCodePoint(value);
  } catch (_error) {
    return "";
  }
}

function extractRtfText(buffer: ArrayBuffer) {
  const raw = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const decoded = raw
    .replace(/\\u(-?\d+)(?:\\'?[0-9a-fA-F]{2}|.)?/g, (_match, code) => rtfUnicode(code))
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\line\b/g, "\n")
    .replace(/\\row\b/g, "\n")
    .replace(/\\cell\b/g, " | ")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "");
  return normalizeExtractedText(decoded);
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
      const typed = part as { type?: string; text?: string };
      if (typed?.type === "output_text" && typeof typed.text === "string" && typed.text.trim()) {
        return typed.text.trim();
      }
    }
  }
  return "";
}

function nullableStringSchema() {
  return { type: ["string", "null"] };
}

function buildExtractionSchema() {
  const recordProperties = {
    registryType: { type: "string", enum: REGISTRY_TYPES },
    patientName: nullableStringSchema(),
    militaryUnit: nullableStringSchema(),
    rank: nullableStringSchema(),
    birthYear: { type: ["integer", "null"] },
    draftYear: { type: ["integer", "null"] },
    medicalCenter: nullableStringSchema(),
    departmentName: nullableStringSchema(),
    diagnosis: nullableStringSchema(),
    eventDate: nullableStringSchema(),
    admissionDate: nullableStringSchema(),
    dischargeDate: nullableStringSchema(),
    referralDate: nullableStringSchema(),
    transferDestination: nullableStringSchema(),
    notes: nullableStringSchema(),
    sourceRow: { type: ["integer", "null"] },
    sourceText: nullableStringSchema(),
    confidence: { type: "string", enum: ["high", "medium", "low"] }
  };
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      documentType: { type: "string", enum: REGISTRY_TYPES },
      documentDate: nullableStringSchema(),
      summary: nullableStringSchema(),
      warnings: { type: "array", items: { type: "string" } },
      records: {
        type: "array",
        maxItems: 500,
        items: {
          type: "object",
          additionalProperties: false,
          properties: recordProperties,
          required: Object.keys(recordProperties)
        }
      }
    },
    required: ["documentType", "documentDate", "summary", "warnings", "records"]
  };
}

async function extractRecordsWithOpenAi(documentName: string, sourcePath: string, text: string) {
  const apiKey = (Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }
  const model = (Deno.env.get("OPENAI_SONA_MODEL") || "gpt-5.6-terra").trim();
  const prompt = [
    "You are extracting structured records from a private Armenian/Russian hospital document.",
    "Classify only what the text supports. Do not invent names, dates, diagnoses, units, or a registry.",
    "Registry meanings: civil_hospitals = civilian hospital/referral list; admitted_military = admitted service members; discharged_transferred = discharged or transferred; referrals_admissions = referrals/admission list; returned = returned service members; outpatient = outpatient treatment; discharged_not_transferred = discharged but not transferred; archive_only = cover letter or no individual register; unclassified = uncertain.",
    "For a cover letter or an empty/summary-only document, return archive_only with an empty records array.",
    "Keep dates exactly as written where possible. Use null rather than guessing. Each sourceRow is the visible table row number when known, otherwise null.",
    `File name: ${documentName}`,
    `Relative source path: ${sourcePath}`,
    "Document text follows:",
    text.slice(0, MAX_TEXT_LENGTH)
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      reasoning: { effort: "medium" },
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      text: {
        format: {
          type: "json_schema",
          name: "sona_document_records",
          strict: true,
          schema: buildExtractionSchema()
        }
      }
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object") {
    const message = payload && typeof payload === "object" && typeof (payload as { error?: { message?: string } }).error?.message === "string"
      ? (payload as { error: { message: string } }).error.message
      : `OpenAI processing failed (${response.status}).`;
    throw new Error(message);
  }
  const outputText = extractOpenAiOutputText(payload as Record<string, unknown>);
  if (!outputText) {
    throw new Error("OpenAI returned an empty result.");
  }
  try {
    return { model, result: JSON.parse(outputText) as Record<string, unknown> };
  } catch (_error) {
    throw new Error("OpenAI returned invalid structured data.");
  }
}

function asNullableText(value: unknown, limit = 2000) {
  const text = readString(value, limit);
  return text || null;
}

function asNullableYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}

function asNullableIndex(value: unknown) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function isRegistryType(value: unknown): value is RegistryType {
  return typeof value === "string" && REGISTRY_TYPES.includes(value as RegistryType);
}

function mapExtractionRecords(documentId: string, extracted: Record<string, unknown>) {
  const rows = Array.isArray(extracted.records) ? extracted.records : [];
  return rows.slice(0, 500).map((row, index) => {
    const item = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const registryType = isRegistryType(item.registryType) ? item.registryType : "unclassified";
    const confidence = ["high", "medium", "low"].includes(String(item.confidence)) ? String(item.confidence) : "low";
    return {
      document_id: documentId,
      record_index: index,
      registry_type: registryType,
      patient_name: asNullableText(item.patientName, 300),
      military_unit: asNullableText(item.militaryUnit, 300),
      rank: asNullableText(item.rank, 120),
      birth_year: asNullableYear(item.birthYear),
      draft_year: asNullableYear(item.draftYear),
      medical_center: asNullableText(item.medicalCenter, 500),
      department_name: asNullableText(item.departmentName, 300),
      diagnosis: asNullableText(item.diagnosis, 1000),
      event_date: asNullableText(item.eventDate, 80),
      admission_date: asNullableText(item.admissionDate, 80),
      discharge_date: asNullableText(item.dischargeDate, 80),
      referral_date: asNullableText(item.referralDate, 80),
      transfer_destination: asNullableText(item.transferDestination, 500),
      notes: asNullableText(item.notes, 2000),
      source_row: asNullableIndex(item.sourceRow),
      source_text: asNullableText(item.sourceText, 5000),
      confidence,
      details: { documentType: extracted.documentType || "unclassified", documentDate: extracted.documentDate || null },
      review_status: "pending_review",
      updated_at: new Date().toISOString()
    };
  });
}

async function requireBatch(supabase: ReturnType<typeof createClient>, batchId: string) {
  const { data, error } = await supabase.from("sona_import_batches").select("id, batch_name").eq("id", batchId).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("SONA batch was not found.");
  }
  return data as { id: string; batch_name: string };
}

async function getBatchFile(supabase: ReturnType<typeof createClient>, fileId: string) {
  const { data, error } = await supabase
    .from("sona_batch_files")
    .select("id, batch_id, document_id, source_path, storage_path, original_name, extension, upload_status")
    .eq("id", fileId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("SONA source file was not found.");
  }
  return data as Record<string, string | null>;
}

async function listRecordsForBatch(supabase: ReturnType<typeof createClient>, batchId: string, registryType: string, reviewStatus: string, limit: number) {
  const { data: batchFiles, error: batchFilesError } = await supabase
    .from("sona_batch_files")
    .select("document_id, source_path, original_name")
    .eq("batch_id", batchId)
    .not("document_id", "is", null);
  if (batchFilesError) {
    throw batchFilesError;
  }
  const fileRows = (batchFiles || []) as Array<{ document_id: string; source_path: string; original_name: string }>;
  const documentIds = [...new Set(fileRows.map((row) => row.document_id).filter(Boolean))];
  if (!documentIds.length) {
    return [];
  }
  let query = supabase.from("sona_records").select("*").in("document_id", documentIds).order("created_at", { ascending: false }).limit(limit);
  if (isRegistryType(registryType)) {
    query = query.eq("registry_type", registryType);
  }
  if (["pending_review", "approved", "rejected"].includes(reviewStatus)) {
    query = query.eq("review_status", reviewStatus);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const sourceByDocument = new Map(fileRows.map((row) => [row.document_id, { sourcePath: row.source_path, originalName: row.original_name }]));
  return (data || []).map((row) => ({ ...row, source: sourceByDocument.get(String(row.document_id)) || null }));
}

async function handleCreateBatch(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>, user: { id: string }, email: string) {
  const batchName = readString(payload.batchName, 180);
  if (!batchName) {
    throw new Error("Enter a name for the SONA folder batch.");
  }
  const { data, error } = await supabase.from("sona_import_batches").insert({
    batch_name: batchName,
    source_folder: readString(payload.sourceFolder, 500),
    source_date: readString(payload.sourceDate, 80) || null,
    notes: readString(payload.notes, 1000),
    created_by: user.id,
    created_by_email: email,
    status: "draft"
  }).select("*").single();
  if (error) {
    throw error;
  }
  return { batch: data };
}

async function handleCreateUploadUrl(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const batchId = readString(payload.batchId, 80);
  await requireBatch(supabase, batchId);
  const file = assertFileMetadata(payload);
  const storagePath = `${batchId}/${safeStorageName(file.originalName)}`;
  const { data, error } = await supabase.storage.from(SOURCE_BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data?.token) {
    throw error || new Error("Could not create a private upload URL.");
  }
  await supabase.from("sona_import_batches").update({ status: "uploading", updated_at: new Date().toISOString() }).eq("id", batchId);
  return { bucket: SOURCE_BUCKET, storagePath, token: data.token, file };
}

async function handleRegisterFile(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>, user: { id: string }) {
  const batchId = readString(payload.batchId, 80);
  await requireBatch(supabase, batchId);
  const file = assertFileMetadata(payload);
  const storagePath = readString(payload.storagePath, 400);
  if (!storagePath.startsWith(`${batchId}/`)) {
    throw new Error("Invalid private storage path.");
  }
  const { data: downloaded, error: downloadError } = await supabase.storage.from(SOURCE_BUCKET).download(storagePath);
  if (downloadError || !downloaded) {
    throw downloadError || new Error("The uploaded source file could not be read.");
  }
  const bytes = await downloaded.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error("The uploaded source file has an invalid size.");
  }
  const fileHash = await sha256Hex(bytes);
  const now = new Date().toISOString();
  const { data: document, error: documentError } = await supabase
    .from("sona_documents")
    .upsert({
      file_hash: fileHash,
      canonical_storage_path: storagePath,
      original_name: file.originalName,
      extension: file.extension,
      mime_type: file.mimeType,
      byte_size: bytes.byteLength,
      updated_at: now
    }, { onConflict: "file_hash", ignoreDuplicates: true })
    .select("id, file_hash, canonical_storage_path, processing_status, extraction_status")
    .single();
  if (documentError || !document) {
    if (documentError?.code === "PGRST116") {
      const retry = await supabase.from("sona_documents").select("id, file_hash, canonical_storage_path, processing_status, extraction_status").eq("file_hash", fileHash).single();
      if (retry.error || !retry.data) {
        throw retry.error || documentError;
      }
      return await registerBatchFile(supabase, batchId, storagePath, file, retry.data, user.id, now, true);
    }
    throw documentError || new Error("Could not create a SONA document record.");
  }
  return await registerBatchFile(supabase, batchId, storagePath, file, document, user.id, now, document.canonical_storage_path !== storagePath);
}

async function registerBatchFile(
  supabase: ReturnType<typeof createClient>,
  batchId: string,
  storagePath: string,
  file: ReturnType<typeof assertFileMetadata>,
  document: { id: string; canonical_storage_path: string; processing_status: string; extraction_status: string },
  userId: string,
  now: string,
  duplicate: boolean
) {
  const status = document.processing_status === "processed" || document.processing_status === "not_required"
    ? "processed"
    : document.extraction_status === "unsupported"
      ? "unsupported"
      : "registered";
  const { data: batchFile, error } = await supabase.from("sona_batch_files").upsert({
    batch_id: batchId,
    document_id: document.id,
    source_path: file.sourcePath,
    storage_path: storagePath,
    original_name: file.originalName,
    extension: file.extension,
    mime_type: file.mimeType,
    byte_size: file.byteSize,
    upload_status: status,
    uploaded_by: userId,
    updated_at: now
  }, { onConflict: "batch_id,source_path" }).select("*").single();
  if (error) {
    throw error;
  }
  await supabase.from("sona_import_batches").update({ status: "ready", updated_at: now }).eq("id", batchId);
  return { file: batchFile, document, duplicate };
}

async function handleProcessFile(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const fileId = readString(payload.fileId, 80);
  const batchFile = await getBatchFile(supabase, fileId);
  const documentId = String(batchFile.document_id || "");
  if (!documentId) {
    throw new Error("Register the file before processing it.");
  }
  const extension = String(batchFile.extension || "").toLowerCase();
  const now = new Date().toISOString();
  if (!EXTRACTABLE_EXTENSIONS.has(extension)) {
    const message = extension === "doc"
      ? "Legacy DOC files must first be saved as DOCX or RTF. The original is kept in the private archive."
      : `Automatic text extraction is not yet enabled for .${extension.toUpperCase()} files.`;
    await supabase.from("sona_documents").update({ extraction_status: "unsupported", processing_status: "needs_review", processing_error: message, updated_at: now }).eq("id", documentId);
    await supabase.from("sona_batch_files").update({ upload_status: "unsupported", processing_error: message, updated_at: now }).eq("id", fileId);
    return { ok: false, unsupported: true, message };
  }

  const approvedCheck = await supabase.from("sona_records").select("id").eq("document_id", documentId).eq("review_status", "approved").limit(1);
  if (approvedCheck.error) {
    throw approvedCheck.error;
  }
  if (approvedCheck.data && approvedCheck.data.length) {
    throw new Error("This document already has approved records and cannot be reprocessed automatically.");
  }

  await supabase.from("sona_documents").update({ extraction_status: "pending", processing_status: "processing", processing_error: null, updated_at: now }).eq("id", documentId);
  await supabase.from("sona_batch_files").update({ upload_status: "processing", processing_error: null, updated_at: now }).eq("id", fileId);

  try {
    const { data: downloaded, error: downloadError } = await supabase.storage.from(SOURCE_BUCKET).download(String(batchFile.storage_path));
    if (downloadError || !downloaded) {
      throw downloadError || new Error("The private source file could not be downloaded.");
    }
    const buffer = await downloaded.arrayBuffer();
    const extractedText = extension === "docx" ? await extractDocxText(buffer) : extractRtfText(buffer);
    if (extractedText.length < 20) {
      throw new Error("No readable text was found in this document.");
    }
    const { model, result } = await extractRecordsWithOpenAi(String(batchFile.original_name), String(batchFile.source_path), extractedText);
    const records = mapExtractionRecords(documentId, result);
    const deleteResult = await supabase.from("sona_records").delete().eq("document_id", documentId);
    if (deleteResult.error) {
      throw deleteResult.error;
    }
    if (records.length) {
      const insertResult = await supabase.from("sona_records").insert(records);
      if (insertResult.error) {
        throw insertResult.error;
      }
    }
    const processingStatus = records.length ? "needs_review" : "not_required";
    const { error: documentUpdateError } = await supabase.from("sona_documents").update({
      extracted_text: extractedText.slice(0, 200000),
      extraction_status: "extracted",
      processing_status: processingStatus,
      processing_error: null,
      processed_with_model: model,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("id", documentId);
    if (documentUpdateError) {
      throw documentUpdateError;
    }
    await supabase.from("sona_batch_files").update({ upload_status: "processed", processing_error: null, updated_at: new Date().toISOString() }).eq("id", fileId);
    return { ok: true, model, recordsCreated: records.length, documentType: result.documentType || "unclassified", warnings: Array.isArray(result.warnings) ? result.warnings : [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SONA document processing failed.";
    await supabase.from("sona_documents").update({ extraction_status: "failed", processing_status: "failed", processing_error: message, updated_at: new Date().toISOString() }).eq("id", documentId);
    await supabase.from("sona_batch_files").update({ upload_status: "failed", processing_error: message, updated_at: new Date().toISOString() }).eq("id", fileId);
    throw error;
  }
}

async function handleListBatches(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.from("sona_import_batches").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) {
    throw error;
  }
  return { batches: data || [] };
}

async function handleGetBatch(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const batchId = readString(payload.batchId, 80);
  const { data: batch, error: batchError } = await supabase.from("sona_import_batches").select("*").eq("id", batchId).maybeSingle();
  if (batchError) {
    throw batchError;
  }
  if (!batch) {
    throw new Error("SONA batch was not found.");
  }
  const { data: files, error: filesError } = await supabase
    .from("sona_batch_files")
    .select("id, document_id, source_path, original_name, extension, byte_size, upload_status, processing_error, uploaded_at, updated_at")
    .eq("batch_id", batchId)
    .order("source_path", { ascending: true })
    .limit(5000);
  if (filesError) {
    throw filesError;
  }
  const documentIds = [...new Set((files || []).map((file) => file.document_id).filter(Boolean))] as string[];
  let records: unknown[] = [];
  if (documentIds.length) {
    const response = await supabase.from("sona_records").select("id, document_id, registry_type, review_status").in("document_id", documentIds).limit(10000);
    if (response.error) {
      throw response.error;
    }
    records = response.data || [];
  }
  return { batch, files: files || [], records };
}

async function handleListRecords(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const batchId = readString(payload.batchId, 80);
  await requireBatch(supabase, batchId);
  const limit = Math.max(1, Math.min(1000, Number(payload.limit) || 300));
  return { records: await listRecordsForBatch(supabase, batchId, readString(payload.registryType, 60), readString(payload.reviewStatus, 60), limit) };
}

async function handleReviewRecords(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>, user: { id: string }, email: string) {
  const recordIds = Array.isArray(payload.recordIds)
    ? payload.recordIds.map((value) => readString(value, 80)).filter(Boolean).slice(0, 500)
    : [];
  const reviewStatus = readString(payload.reviewStatus, 30);
  if (!recordIds.length || !["approved", "rejected"].includes(reviewStatus)) {
    throw new Error("Choose one or more records and a valid review decision.");
  }
  const { data, error } = await supabase.from("sona_records").update({
    review_status: reviewStatus,
    reviewed_by: user.id,
    reviewed_by_email: email,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).in("id", recordIds).eq("review_status", "pending_review").select("id");
  if (error) {
    throw error;
  }
  return { updated: data?.length || 0, reviewStatus };
}

async function handleGetDownloadUrl(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const fileId = readString(payload.fileId, 80);
  const file = await getBatchFile(supabase, fileId);
  const { data, error } = await supabase.storage.from(SOURCE_BUCKET).createSignedUrl(String(file.storage_path), 300, { download: String(file.original_name) });
  if (error || !data?.signedUrl) {
    throw error || new Error("Could not create a temporary source-file URL.");
  }
  return { url: data.signedUrl, expiresIn: 300 };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }
  try {
    const supabase = createSupabaseAdmin();
    const auth = await authorizeOwner(request, supabase);
    if ("error" in auth) {
      return jsonResponse({ error: auth.error }, 403);
    }
    const payload = await request.json();
    const type = readString(payload?.type, 80);
    let result: unknown;
    switch (type) {
      case "create_batch":
        result = await handleCreateBatch(supabase, payload, auth.user, auth.email);
        break;
      case "create_upload_url":
        result = await handleCreateUploadUrl(supabase, payload);
        break;
      case "register_file":
        result = await handleRegisterFile(supabase, payload, auth.user);
        break;
      case "process_file":
        result = await handleProcessFile(supabase, payload);
        break;
      case "list_batches":
        result = await handleListBatches(supabase);
        break;
      case "get_batch":
        result = await handleGetBatch(supabase, payload);
        break;
      case "list_records":
        result = await handleListRecords(supabase, payload);
        break;
      case "review_records":
        result = await handleReviewRecords(supabase, payload, auth.user, auth.email);
        break;
      case "get_download_url":
        result = await handleGetDownloadUrl(supabase, payload);
        break;
      default:
        return jsonResponse({ error: "Unknown SONA import operation." }, 400);
    }
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SONA import failed.";
    return jsonResponse({ error: message }, 400);
  }
});
