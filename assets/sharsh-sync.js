(function () {
  const config = window.SHARSH_CONFIG;
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const runtimeMeta = window.SHARSH_RUNTIME_CONFIG_META || {};
  const auth = window.SHARSH_AUTH || null;

  function hasRemoteSync() {
    return runtime.syncMode === "supabase-function"
      && typeof runtime.supabaseUrl === "string"
      && runtime.supabaseUrl.trim() !== ""
      && typeof runtime.supabaseAnonKey === "string"
      && runtime.supabaseAnonKey.trim() !== "";
  }

  function requiresOwnerAuth() {
    return Boolean(runtime.requireOwnerAuth && hasRemoteSync());
  }

  function getAccessToken() {
    return auth && typeof auth.getAccessToken === "function"
      ? String(auth.getAccessToken() || "")
      : "";
  }

  function getSyncEndpoint() {
    const baseUrl = String(runtime.supabaseUrl || "").replace(/\/+$/, "");
    const functionName = String(runtime.functionName || "sharsh-sync").trim();
    return `${baseUrl}/functions/v1/${functionName}`;
  }

  function getTelegramFunctionEndpoint() {
    const baseUrl = String(runtime.supabaseUrl || "").replace(/\/+$/, "");
    return `${baseUrl}/functions/v1/Mainflow-telegram`;
  }

  function getAuthHeaders() {
    const headers = {
      "Content-Type": "application/json"
    };

    if (hasRemoteSync()) {
      const accessToken = getAccessToken();
      headers.apikey = runtime.supabaseAnonKey;
      headers.Authorization = `Bearer ${accessToken || runtime.supabaseAnonKey}`;
    }

    return headers;
  }

  function ensureOwnerAuth() {
    if (requiresOwnerAuth() && !getAccessToken()) {
      throw new Error("Сначала войдите как владелец.");
    }
  }

  async function handleOwnerAuthFailure(response) {
    if (!requiresOwnerAuth() || response.status !== 403) {
      return false;
    }
    if (!auth || typeof auth.signOut !== "function") {
      return false;
    }

    try {
      await auth.signOut();
    } catch (_error) {
    }
    return true;
  }

  function buildResponseError(response, payload, fallback) {
    if (payload && typeof payload.error === "string" && payload.error.trim()) {
      return new Error(payload.error.trim());
    }
    return new Error(`${fallback} (${response.status})`);
  }

  function readLocalDepartmentRecord(departmentId) {
    const raw = localStorage.getItem(config.getDepartmentStorageKey(departmentId));
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      return {
        id: departmentId,
        values: config.normalizeRowValues(parsed.values),
        updatedAt: parsed.updatedAt ? String(parsed.updatedAt) : null
      };
    } catch (_error) {
      return null;
    }
  }

  function writeLocalSnapshot(snapshot) {
    const normalized = config.buildSnapshotFromSaved(snapshot);
    localStorage.setItem(config.getReportDateStorageKey(), normalized.reportDate);
    localStorage.setItem(config.getMainCacheStorageKey(), JSON.stringify(normalized));

    normalized.rows.forEach((row) => {
      localStorage.setItem(config.getDepartmentStorageKey(row.id), JSON.stringify({
        values: row.values,
        updatedAt: row.updatedAt || new Date().toISOString()
      }));
    });

    return normalized;
  }

  function migrateLegacySnapshotIfNeeded() {
    const hasCurrentCache = localStorage.getItem(config.getMainCacheStorageKey());
    if (hasCurrentCache) {
      return null;
    }

    const legacyRaw = localStorage.getItem(config.LEGACY_MAIN_STORAGE_KEY);
    if (!legacyRaw) {
      return null;
    }

    try {
      const migrated = config.buildSnapshotFromSaved(JSON.parse(legacyRaw));
      return writeLocalSnapshot(migrated);
    } catch (_error) {
      return null;
    }
  }

  function loadLocalSnapshot() {
    const migrated = migrateLegacySnapshotIfNeeded();
    if (migrated) {
      return migrated;
    }

    const cachedRaw = localStorage.getItem(config.getMainCacheStorageKey());
    if (cachedRaw) {
      try {
        return config.buildSnapshotFromSaved(JSON.parse(cachedRaw));
      } catch (_error) {
        localStorage.removeItem(config.getMainCacheStorageKey());
      }
    }

    const fallback = config.buildDefaultSnapshot();
    const reportDate = localStorage.getItem(config.getReportDateStorageKey());
    if (typeof reportDate === "string" && reportDate.trim()) {
      fallback.reportDate = reportDate;
    }

    fallback.rows = fallback.rows.map((row) => {
      const saved = readLocalDepartmentRecord(row.id);
      return saved
        ? { ...row, values: saved.values, updatedAt: saved.updatedAt }
        : row;
    });

    return fallback;
  }

  async function loadRemoteSnapshot() {
    ensureOwnerAuth();
    const response = await fetch(getSyncEndpoint(), {
      method: "GET",
      headers: getAuthHeaders()
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось загрузить данные");
    }

    const snapshot = config.buildSnapshotFromSaved(payload);
    writeLocalSnapshot(snapshot);
    return snapshot;
  }

  async function loadSnapshot() {
    if (!hasRemoteSync()) {
      const snapshot = loadLocalSnapshot();
      writeLocalSnapshot(snapshot);
      return {
        snapshot,
        source: "local-only"
      };
    }

    try {
      const snapshot = await loadRemoteSnapshot();
      return {
        snapshot,
        source: "remote"
      };
    } catch (error) {
      if (requiresOwnerAuth()) {
        throw error;
      }
      const snapshot = loadLocalSnapshot();
      return {
        snapshot,
        source: "local-cache",
        warning: error instanceof Error ? error.message : "Не удалось подключиться к серверу"
      };
    }
  }

  async function postRemote(body) {
    ensureOwnerAuth();
    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Ошибка синхронизации");
    }

    const snapshot = config.buildSnapshotFromSaved(payload);
    writeLocalSnapshot(snapshot);
    return snapshot;
  }

  async function verifyDepartmentAccess(departmentId, accessCode) {
    ensureOwnerAuth();
    if (!hasRemoteSync()) {
      throw new Error("Защищённый вход доступен только при включённой онлайн-синхронизации.");
    }

    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "verify_access_code",
        departmentId,
        accessCode: accessCode || ""
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Ошибка проверки кода");
    }

    return payload;
  }

  async function recognizeDepartmentPhoto(departmentId, imageDataUrl, extraImageDataUrls = []) {
    ensureOwnerAuth();
    if (!hasRemoteSync()) {
      throw new Error("Распознавание фото доступно только в онлайн-режиме владельца.");
    }

    if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
      throw new Error("Нужен файл изображения для распознавания.");
    }

    const normalizedExtraImageDataUrls = Array.isArray(extraImageDataUrls)
      ? extraImageDataUrls.filter((item) => typeof item === "string" && item.startsWith("data:image/"))
      : [];

    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "recognize_department_photo",
        departmentId,
        imageDataUrl,
        extraImageDataUrls: normalizedExtraImageDataUrls
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось распознать фото бланка");
    }

    return payload;
  }

  async function detectDepartmentPhoto(imageDataUrl) {
    ensureOwnerAuth();
    if (!hasRemoteSync()) {
      throw new Error("Определение отделения доступно только в онлайн-режиме владельца.");
    }

    if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
      throw new Error("Нужен файл изображения для определения отделения.");
    }

    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "detect_department_photo",
        imageDataUrl
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось определить отделение по фото");
    }

    return payload;
  }

  async function queueDepartmentPhoto(departmentId, imageName, imageDataUrl, notes = []) {
    ensureOwnerAuth();
    if (!hasRemoteSync()) {
      throw new Error("Очередь фото доступна только в онлайн-режиме владельца.");
    }

    if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
      throw new Error("Нужен файл изображения для очереди отделения.");
    }

    const snapshot = await postRemote({
      type: "queue_department_photo",
      departmentId,
      reportDate: loadLocalSnapshot().reportDate,
      imageName: imageName || "",
      imageDataUrl,
      notes: Array.isArray(notes) ? notes : []
    });

    return {
      snapshot,
      source: "remote"
    };
  }

  async function saveDepartment(departmentId, reportDate, values, accessCode) {
    const localSnapshot = loadLocalSnapshot();
    const rowMap = new Map(localSnapshot.rows.map((row) => [row.id, row]));
    const targetRow = rowMap.get(departmentId);

    if (targetRow) {
      targetRow.values = config.normalizeRowValues(values);
      targetRow.updatedAt = new Date().toISOString();
    }

    localSnapshot.reportDate = typeof reportDate === "string" && reportDate.trim()
      ? reportDate
      : localSnapshot.reportDate;
    localSnapshot.updatedAt = new Date().toISOString();
    writeLocalSnapshot(localSnapshot);

    if (!hasRemoteSync()) {
      return {
        snapshot: localSnapshot,
        source: "local-only"
      };
    }

    const snapshot = await postRemote({
      type: "save_department",
      departmentId,
      reportDate: localSnapshot.reportDate,
      values: config.normalizeRowValues(values),
      accessCode: accessCode || ""
    });

    return {
      snapshot,
      source: "remote"
    };
  }

  const NIGHT_SHIFT_TRANSFER_KEYS = ["shar", "spa", "paym", "zh", "family", "zp", "qi"];

  function sanitizeNightShiftRows(rows) {
    const output = {};
    config.departmentDefinitions.forEach((department) => {
      const source = rows && typeof rows === "object" ? rows[department.id] : null;
      output[department.id] = {};
      NIGHT_SHIFT_TRANSFER_KEYS.forEach((key) => {
        output[department.id][key] = config.normalizeCellValue(source && source[key]);
      });
    });
    return output;
  }

  function getNightValue(rows, departmentId, key) {
    return config.normalizeCellValue(rows?.[departmentId]?.[key]);
  }

  function addCell(values, key, amount) {
    values[key] = config.normalizeCellValue(values[key]) + config.normalizeCellValue(amount);
  }

  function applyNightShiftRowsToSnapshot(snapshot, rows, reportDate) {
    const normalized = config.buildSnapshotFromSaved(snapshot);
    const nightRows = sanitizeNightShiftRows(rows);
    const now = new Date().toISOString();

    normalized.rows.forEach((row) => {
      const n1 = getNightValue(nightRows, row.id, "shar");
      const n2 = getNightValue(nightRows, row.id, "spa");
      const n3 = getNightValue(nightRows, row.id, "paym");
      const n4 = getNightValue(nightRows, row.id, "zh");
      const n5 = getNightValue(nightRows, row.id, "family");
      const n6 = getNightValue(nightRows, row.id, "zp");
      const n7 = getNightValue(nightRows, row.id, "qi");
      // Formula from the night-shift workflow: n5 is counted twice, n6 is not included in admittedTotal.
      const nightTotal = n1 + n2 + n3 + n4 + n5 + n5 + n7;
      const hasAnyNightValue = n1 + n2 + n3 + n4 + n5 + n6 + n7;

      if (!hasAnyNightValue) {
        return;
      }

      const values = config.normalizeRowValues(row.values);
      addCell(values, "admittedSeries", n1);
      addCell(values, "currentShar", n1);
      values.currentSpa = n2;
      values.currentPaym = n3;
      values.currentZh = n4;
      values.family = n5;
      values.officer = n6;
      values.civil = n7;
      addCell(values, "admittedTotal", nightTotal);
      addCell(values, "admittedSoldier", n1 + n2 + n3);

      row.values = values;
      row.updatedAt = now;
    });

    if (typeof reportDate === "string" && reportDate.trim()) {
      normalized.reportDate = reportDate.trim();
    }
    normalized.updatedAt = now;
    return normalized;
  }

  async function applyNightShiftToMain(rows, reportDate) {
    const nightRows = sanitizeNightShiftRows(rows);

    if (hasRemoteSync()) {
      const snapshot = await postRemote({
        type: "apply_night_shift",
        reportDate,
        rows: nightRows
      });
      return {
        snapshot,
        source: "remote"
      };
    }

    const snapshot = applyNightShiftRowsToSnapshot(loadLocalSnapshot(), nightRows, reportDate);
    writeLocalSnapshot(snapshot);
    return {
      snapshot,
      source: "local-only"
    };
  }

  async function listOcrFeedback(limit) {
    if (!hasRemoteSync()) {
      return [];
    }

    ensureOwnerAuth();
    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "list_ocr_feedback",
        limit: Number.isFinite(Number(limit)) ? Number(limit) : 100
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось загрузить OCR feedback");
    }

    return Array.isArray(payload?.records) ? payload.records : [];
  }

  async function saveOcrFeedback(feedback) {
    if (!hasRemoteSync() || !feedback || typeof feedback !== "object") {
      return { ok: false };
    }

    ensureOwnerAuth();
    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "save_ocr_feedback",
        feedback
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось сохранить OCR feedback");
    }

    return payload;
  }

  async function saveReportDate(reportDate) {
    const localSnapshot = loadLocalSnapshot();
    localSnapshot.reportDate = typeof reportDate === "string" && reportDate.trim()
      ? reportDate
      : config.DEFAULT_DATE;
    localSnapshot.updatedAt = new Date().toISOString();
    writeLocalSnapshot(localSnapshot);

    if (!hasRemoteSync()) {
      return {
        snapshot: localSnapshot,
        source: "local-only"
      };
    }

    const snapshot = await postRemote({
      type: "save_report_date",
      reportDate: localSnapshot.reportDate
    });

    return {
      snapshot,
      source: "remote"
    };
  }

  async function notifyOwnerLogin(details) {
    if (!hasRemoteSync()) {
      return { ok: false, reason: "remote-sync-disabled" };
    }

    ensureOwnerAuth();
    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "notify_owner_login",
        details: details && typeof details === "object" ? details : {}
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Ð¡ÐµÑÑÐ¸Ñ Ð²Ð»Ð°Ð´ÐµÐ»ÑŒÑ†Ð° Ð½ÐµÐ´ÐµÐ¹ÑÑ‚Ð²Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ð°. Ð’Ð¾Ð¹Ð´Ð¸Ñ‚Ðµ ÑÐ½Ð¾Ð²Ð°.");
      }
      throw buildResponseError(response, payload, "ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ Telegram-ÑƒÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ðµ");
    }

    return payload;
  }

  async function sendMainPdfsToTelegram() {
    ensureOwnerAuth();
    if (!hasRemoteSync()) {
      throw new Error("Онлайн-синхронизация нужна для отправки PDF в Telegram.");
    }

    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "send_main_pdfs_to_telegram"
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось отправить PDF в Telegram");
    }

    return payload || { ok: true };
  }

  async function loadTelegramPhotoFeedback(feedbackId, departmentId) {
    const normalizedId = String(feedbackId || "").trim();
    if (!hasRemoteSync() || !normalizedId) {
      return null;
    }

    const url = new URL(getTelegramFunctionEndpoint());
    url.searchParams.set("action", "feedback-photo");
    url.searchParams.set("id", normalizedId);
    if (departmentId) {
      url.searchParams.set("departmentId", String(departmentId));
    }

    const response = await fetch(url.toString(), {
      method: "GET"
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw buildResponseError(response, payload, "Не удалось загрузить фото из Telegram");
    }

    return payload && typeof payload.record === "object" ? payload.record : null;
  }

  function getSourceLabel(source) {
    if (source === "remote") {
      return "Онлайн-синхронизация";
    }
    if (source === "local-cache") {
      return "Локальный кэш";
    }
    return "Локальный режим";
  }

  function getShareQuery() {
    return typeof runtimeMeta.shareQuery === "string" ? runtimeMeta.shareQuery : "";
  }

  window.SHARSH_SYNC = {
    runtime,
    hasRemoteSync,
    loadSnapshot,
    saveDepartment,
    applyNightShiftToMain,
    saveOcrFeedback,
    saveReportDate,
    notifyOwnerLogin,
    sendMainPdfsToTelegram,
    loadTelegramPhotoFeedback,
    listOcrFeedback,
    verifyDepartmentAccess,
    detectDepartmentPhoto,
    recognizeDepartmentPhoto,
    queueDepartmentPhoto,
    loadLocalSnapshot,
    writeLocalSnapshot,
    getSourceLabel,
    getShareQuery
  };
})();
