(function () {
  const config = window.SHARSH_CONFIG;
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const runtimeMeta = window.SHARSH_RUNTIME_CONFIG_META || {};
  const auth = window.SHARSH_AUTH || null;
  const PENDING_SYNC_STORAGE_KEY = `${config.STORAGE_NAMESPACE || "sarsh-kkzh-v2"}:pending-sync-queue:v1`;
  const PENDING_SYNC_EVENT_NAME = "sharsh-pending-sync-changed";
  let pendingSyncInFlightPromise = null;

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
    const message = payload && typeof payload.error === "string" && payload.error.trim()
      ? payload.error.trim()
      : `${fallback} (${response.status})`;
    const error = new Error(message);
    error.statusCode = response.status;
    return error;
  }

  function buildEmptyPendingSyncState() {
    return {
      version: 1,
      items: [],
      lastSyncedAt: "",
      lastAttemptedAt: "",
      lastError: ""
    };
  }

  function normalizePendingSyncItem(item) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const type = typeof item.type === "string" ? item.type.trim() : "";
    if (!type) {
      return null;
    }
    const payload = item.payload && typeof item.payload === "object"
      ? config.deepCopy(item.payload)
      : {};
    return {
      id: typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      createdAt: typeof item.createdAt === "string" && item.createdAt.trim()
        ? item.createdAt
        : new Date().toISOString()
    };
  }

  function normalizePendingSyncState(input) {
    const fallback = buildEmptyPendingSyncState();
    if (!input || typeof input !== "object") {
      return fallback;
    }
    const rawItems = Array.isArray(input.items) ? input.items : [];
    return {
      version: 1,
      items: rawItems.map(normalizePendingSyncItem).filter(Boolean),
      lastSyncedAt: typeof input.lastSyncedAt === "string" ? input.lastSyncedAt : "",
      lastAttemptedAt: typeof input.lastAttemptedAt === "string" ? input.lastAttemptedAt : "",
      lastError: typeof input.lastError === "string" ? input.lastError : ""
    };
  }

  function readPendingSyncState() {
    try {
      const raw = localStorage.getItem(PENDING_SYNC_STORAGE_KEY);
      if (!raw) {
        return buildEmptyPendingSyncState();
      }
      return normalizePendingSyncState(JSON.parse(raw));
    } catch (_error) {
      return buildEmptyPendingSyncState();
    }
  }

  function dispatchPendingSyncChanged(state = readPendingSyncState()) {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
      return;
    }
    try {
      window.dispatchEvent(new CustomEvent(PENDING_SYNC_EVENT_NAME, {
        detail: {
          count: state.items.length,
          hasPending: state.items.length > 0,
          isSyncing: Boolean(pendingSyncInFlightPromise),
          lastSyncedAt: state.lastSyncedAt || "",
          lastAttemptedAt: state.lastAttemptedAt || "",
          lastError: state.lastError || ""
        }
      }));
    } catch (_error) {
    }
  }

  function writePendingSyncState(nextState) {
    const normalized = normalizePendingSyncState(nextState);
    localStorage.setItem(PENDING_SYNC_STORAGE_KEY, JSON.stringify(normalized));
    dispatchPendingSyncChanged(normalized);
    return normalized;
  }

  function getPendingSyncStatus() {
    const state = readPendingSyncState();
    return {
      count: state.items.length,
      hasPending: state.items.length > 0,
      isSyncing: Boolean(pendingSyncInFlightPromise),
      lastSyncedAt: state.lastSyncedAt || "",
      lastAttemptedAt: state.lastAttemptedAt || "",
      lastError: state.lastError || "",
      items: state.items.map((item) => ({
        id: item.id,
        type: item.type,
        createdAt: item.createdAt
      }))
    };
  }

  function hasPendingSyncItems() {
    return readPendingSyncState().items.length > 0;
  }

  function createPendingSyncItem(type, payload) {
    const createdAt = new Date().toISOString();
    return normalizePendingSyncItem({
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      createdAt
    });
  }

  function enqueuePendingMutation(type, payload, lastError = "") {
    const nextState = readPendingSyncState();
    const item = createPendingSyncItem(type, payload);
    if (!item) {
      throw new Error("Не удалось подготовить офлайн-изменение для очереди.");
    }
    nextState.items.push(item);
    if (typeof lastError === "string" && lastError.trim()) {
      nextState.lastError = lastError.trim();
    }
    writePendingSyncState(nextState);
    return nextState;
  }

  function getPendingSyncMessage(status = getPendingSyncStatus(), lastError = "") {
    const count = Number(status?.count) || 0;
    const base = count > 0
      ? `Накоплено несинхронизированных изменений: ${count}. При появлении интернета очередь отправится автоматически, а кнопку синхронизации можно использовать вручную.`
      : "Очередь синхронизации пуста.";
    const errorText = typeof lastError === "string" && lastError.trim()
      ? lastError.trim()
      : (typeof status?.lastError === "string" && status.lastError.trim() ? status.lastError.trim() : "");
    return errorText ? `${base} Последняя ошибка: ${errorText}` : base;
  }

  function buildPendingSyncResult(snapshot, lastError = "") {
    const status = getPendingSyncStatus();
    return {
      snapshot,
      source: "pending-sync",
      warning: getPendingSyncMessage(status, lastError)
    };
  }

  function shouldQueueRemoteError(error) {
    if (!(error instanceof Error)) {
      return false;
    }
    const statusCode = Number(error.statusCode);
    if (Number.isFinite(statusCode) && statusCode > 0) {
      return statusCode === 401
        || statusCode === 403
        || statusCode === 408
        || statusCode === 429
        || statusCode >= 500;
    }
    return true;
  }

  function shouldEnqueueMutationNow() {
    return !hasRemoteSync()
      || hasPendingSyncItems()
      || (requiresOwnerAuth() && !getAccessToken());
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
    const pendingStatus = getPendingSyncStatus();
    if (pendingStatus.hasPending) {
      const snapshot = loadLocalSnapshot();
      writeLocalSnapshot(snapshot);
      return {
        snapshot,
        source: "pending-sync",
        warning: getPendingSyncMessage(pendingStatus)
      };
    }

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

  async function postRemotePayload(body, fallbackMessage = "Ошибка синхронизации") {
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
      throw buildResponseError(response, payload, fallbackMessage);
    }

    return payload;
  }

  async function replayPendingMutation(item) {
    const payload = item && item.payload && typeof item.payload === "object"
      ? config.deepCopy(item.payload)
      : {};

    switch (item?.type) {
      case "save_department":
        return {
          snapshot: await postRemote({
            type: "save_department",
            departmentId: payload.departmentId,
            reportDate: payload.reportDate,
            values: config.normalizeRowValues(payload.values),
            accessCode: payload.accessCode || ""
          }),
          source: "remote"
        };
      case "save_department_from_main":
        return {
          snapshot: await postRemote({
            type: "save_department_from_main",
            departmentId: payload.departmentId,
            reportDate: payload.reportDate,
            values: config.normalizeRowValues(payload.values)
          }),
          source: "remote"
        };
      case "save_report_date":
        return {
          snapshot: await postRemote({
            type: "save_report_date",
            reportDate: payload.reportDate
          }),
          source: "remote"
        };
      case "apply_night_shift":
        return {
          snapshot: await postRemote({
            type: "apply_night_shift",
            reportDate: payload.reportDate,
            rows: sanitizeNightShiftRows(payload.rows)
          }),
          source: "remote"
        };
      case "apply_day_shift":
        return {
          snapshot: await postRemote({
            type: "apply_day_shift",
            reportDate: payload.reportDate,
            rows: sanitizeNightShiftRows(payload.rows)
          }),
          source: "remote"
        };
      case "apply_discharge_shift":
        return {
          snapshot: await postRemote({
            type: "apply_discharge_shift",
            reportDate: payload.reportDate,
            rows: sanitizeNightShiftRows(payload.rows)
          }),
          source: "remote"
        };
      case "rollover_main_after_archive": {
        const responsePayload = await postRemotePayload(
          {
            type: "rollover_main_after_archive",
            archiveKey: typeof payload.archiveKey === "string" ? payload.archiveKey : "",
            reportDate: payload.reportDate
          },
          "Не удалось выполнить утренний перенос главной таблицы"
        );
        const snapshot = config.buildSnapshotFromSaved(responsePayload);
        writeLocalSnapshot(snapshot);
        return {
          snapshot,
          source: "remote",
          archiveRecord: responsePayload && typeof responsePayload.archiveRecord === "object" ? responsePayload.archiveRecord : null,
          rolloverApplied: Boolean(responsePayload && responsePayload.rolloverApplied),
          rolloverAlreadyApplied: Boolean(responsePayload && responsePayload.rolloverAlreadyApplied)
        };
      }
      default:
        throw new Error(`Неизвестный тип офлайн-операции: ${String(item?.type || "")}`);
    }
  }

  async function syncPendingChanges() {
    if (pendingSyncInFlightPromise) {
      return pendingSyncInFlightPromise;
    }

    pendingSyncInFlightPromise = (async () => {
      const initialState = readPendingSyncState();
      if (!initialState.items.length) {
        return {
          snapshot: loadLocalSnapshot(),
          source: hasRemoteSync() ? "remote" : "local-only",
          syncedCount: 0,
          remainingCount: 0
        };
      }
      if (!hasRemoteSync()) {
        throw new Error("Для синхронизации очереди включите онлайн-режим.");
      }

      ensureOwnerAuth();

      let queueState = writePendingSyncState({
        ...initialState,
        lastAttemptedAt: new Date().toISOString()
      });
      let syncedCount = 0;
      let lastResult = {
        snapshot: loadLocalSnapshot(),
        source: "pending-sync"
      };

      while (queueState.items.length) {
        const currentItem = queueState.items[0];
        try {
          lastResult = await replayPendingMutation(currentItem);
          syncedCount += 1;
          queueState = writePendingSyncState({
            ...queueState,
            items: queueState.items.slice(1),
            lastSyncedAt: new Date().toISOString(),
            lastError: ""
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Не удалось синхронизировать накопленные изменения.";
          writePendingSyncState({
            ...queueState,
            lastAttemptedAt: new Date().toISOString(),
            lastError: message
          });
          throw error;
        }
      }

      return {
        ...lastResult,
        syncedCount,
        remainingCount: 0
      };
    })().finally(() => {
      pendingSyncInFlightPromise = null;
      dispatchPendingSyncChanged();
    });

    return pendingSyncInFlightPromise;
  }

  const CIVIL_REFERRALS_LOCAL_STORAGE_KEY = `${config.STORAGE_NAMESPACE || "sarsh-kkzh-v2"}:civil-referrals:v1`;
  const CIVIL_REFERRAL_FIELDS = [
    "patientName",
    "medicalCenter",
    "militaryUnit",
    "rank",
    "draftYear",
    "birthYear",
    "referralDate",
    "dischargeDate"
  ];
  const CIVIL_REFERRAL_SEARCH_FIELDS = [...CIVIL_REFERRAL_FIELDS, "sourceFileName"];
  const CIVIL_REFERRAL_HASH_FIELDS = CIVIL_REFERRAL_FIELDS.filter((key) => key !== "dischargeDate");
  const CIVIL_REFERRALS_DEFAULT_LIMIT = 80;
  const CIVIL_REFERRALS_MAX_LIMIT = 1000;
  const CIVIL_REFERRAL_DAY_MS = 24 * 60 * 60 * 1000;
  const ARMENIA_UTC_OFFSET_MS = 4 * 60 * 60 * 1000;

  function normalizeCivilText(value) {
    return String(value ?? "")
      .replace(/\u0000/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\r\n]+/g, " ")
      .trim();
  }

  function normalizeCivilDateText(value) {
    const text = normalizeCivilText(value)
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

  function normalizeCivilListOptions(options = {}) {
    const limit = Math.min(
      CIVIL_REFERRALS_MAX_LIMIT,
      Math.max(1, Math.trunc(Number(options.limit) || CIVIL_REFERRALS_DEFAULT_LIMIT))
    );
    const offset = Math.max(0, Math.trunc(Number(options.offset) || 0));
    const query = normalizeCivilText(options.query).slice(0, 120);
    return { limit, offset, query };
  }

  function normalizeCivilReferralIds(ids) {
    return Array.isArray(ids)
      ? [...new Set(ids.map((id) => normalizeCivilText(id)).filter(Boolean))]
      : [];
  }

  function normalizeCivilSearchText(value) {
    return normalizeCivilText(value).toLocaleLowerCase("hy-AM");
  }

  function normalizeCivilCompactSearchText(value) {
    return normalizeCivilSearchText(value).replace(/\s+/g, "");
  }

  function normalizeCivilSmartQueryText(value) {
    return normalizeCivilText(value)
      .replace(/[\s\u00a0]+/g, "")
      .replace(/[\u2010-\u2015\u2212]/g, "-");
  }

  function parseCivilReferralSmartQuery(query) {
    const compact = normalizeCivilSmartQueryText(query);
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

    const date = normalizeCivilDateText(suffix);
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

  function normalizeCivilSrText(value) {
    return normalizeCivilSearchText(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function rowMatchesCivilSr(row, srMarker) {
    const marker = normalizeCivilSrText(srMarker);
    if (!marker) {
      return true;
    }
    if (marker === "SR21") {
      return true;
    }
    return [
      row && row.sourceFileName,
      row && row.departmentId,
      row && row.departmentName,
      row && row.source,
      row && row.fileName
    ].some((value) => normalizeCivilSrText(value).includes(marker));
  }

  function getCivilReferralTodayTime() {
    const armeniaNow = new Date(Date.now() + ARMENIA_UTC_OFFSET_MS);
    return Date.UTC(
      armeniaNow.getUTCFullYear(),
      armeniaNow.getUTCMonth(),
      armeniaNow.getUTCDate()
    );
  }

  function rowMatchesCivilSmartQuery(row, smartQuery) {
    if (!rowMatchesCivilSr(row, smartQuery.srMarker)) {
      return false;
    }
    if (smartQuery.mode === "sr") {
      return true;
    }
    const dateValue = getCivilReferralDateSortValue(row && row[smartQuery.dateField]);
    if (!dateValue) {
      return false;
    }
    if (smartQuery.mode === "date") {
      return normalizeCivilDateText(row && row[smartQuery.dateField]) === smartQuery.date;
    }
    if (smartQuery.mode === "range") {
      const end = getCivilReferralTodayTime();
      const start = end - (smartQuery.days - 1) * CIVIL_REFERRAL_DAY_MS;
      return dateValue >= start && dateValue <= end;
    }
    return false;
  }

  function filterCivilReferralRows(rows, query) {
    const smartQuery = parseCivilReferralSmartQuery(query);
    if (smartQuery) {
      return rows.filter((row) => rowMatchesCivilSmartQuery(row, smartQuery));
    }

    const normalizedQuery = normalizeCivilSearchText(query);
    const compactQuery = normalizeCivilCompactSearchText(query);
    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((row) => {
      return CIVIL_REFERRAL_SEARCH_FIELDS.some((key) => {
        return normalizeCivilSearchText(row[key]).includes(normalizedQuery)
          || normalizeCivilCompactSearchText(row[key]).includes(compactQuery);
      });
    });
  }

  function getCivilReferralDateSortValue(value) {
    const text = normalizeCivilDateText(value);
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

  function getCivilReferralRowSortValue(row) {
    const referralTime = getCivilReferralDateSortValue(row && row.referralDate);
    if (referralTime) {
      return referralTime;
    }
    const updatedTime = Date.parse(String(row && (row.updatedAt || row.importedAt) || ""));
    return Number.isFinite(updatedTime) ? updatedTime : 0;
  }

  function sortCivilReferralRows(rows) {
    return [...rows].sort((a, b) => {
      const byDate = getCivilReferralRowSortValue(b) - getCivilReferralRowSortValue(a);
      if (byDate) {
        return byDate;
      }
      return normalizeCivilSearchText(a.patientName).localeCompare(normalizeCivilSearchText(b.patientName), "hy-AM");
    });
  }

  function pageCivilReferralRows(rows, options = {}) {
    const { limit, offset, query } = normalizeCivilListOptions(options);
    const filteredRows = sortCivilReferralRows(filterCivilReferralRows(rows, query));
    return {
      rows: filteredRows.slice(offset, offset + limit),
      total: filteredRows.length,
      limit,
      offset,
      query
    };
  }

  const CIVIL_ARMENIAN_WORD_RE = /^[\u0531-\u0587]+$/;

  function normalizeCivilNameText(value, options = {}) {
    const tokens = normalizeCivilText(value).split(" ").filter(Boolean);
    const merged = [];

    tokens.forEach((token) => {
      const previous = merged[merged.length - 1];
      const shouldMerge = options.medicalCenter
        ? previous?.length <= 3 && token.length <= 3 && token !== "\u0532\u053F"
        : previous?.length <= 2 || token.length <= 2;
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

  function stableCivilReferralHash(record) {
    const source = CIVIL_REFERRAL_HASH_FIELDS
      .map((key) => normalizeCivilText(record[key]).toLowerCase())
      .join("|");
    let hash = 5381;
    for (let index = 0; index < source.length; index += 1) {
      hash = ((hash << 5) + hash + source.charCodeAt(index)) >>> 0;
    }
    return hash.toString(36).padStart(7, "0");
  }

  function normalizeCivilReferralRecord(record, sourceFileName = "") {
    const output = {};
    CIVIL_REFERRAL_FIELDS.forEach((key) => {
      output[key] = key === "patientName"
        ? normalizeCivilNameText(record && record[key])
        : key === "medicalCenter"
          ? normalizeCivilNameText(record && record[key], { medicalCenter: true })
          : key === "referralDate" || key === "dischargeDate"
            ? normalizeCivilDateText(record && record[key])
            : normalizeCivilText(record && record[key]);
    });
    output.sourceFileName = normalizeCivilText(record?.sourceFileName || sourceFileName);
    output.sourceRow = Number.isFinite(Number(record?.sourceRow)) ? Math.max(0, Math.trunc(Number(record.sourceRow))) : null;
    output.id = normalizeCivilText(record?.id) || stableCivilReferralHash(output);
    output.importedAt = normalizeCivilText(record?.importedAt);
    output.updatedAt = normalizeCivilText(record?.updatedAt);
    return output;
  }

  function normalizeCivilReferralRows(rows, sourceFileName = "") {
    if (!Array.isArray(rows)) {
      return [];
    }

    const byId = new Map();
    rows
      .map((row) => normalizeCivilReferralRecord(row, sourceFileName))
      .filter((row) => row.patientName && row.medicalCenter)
      .forEach((row) => {
        if (!byId.has(row.id)) {
          byId.set(row.id, row);
        }
      });
    return [...byId.values()];
  }

  function readLocalCivilReferrals() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CIVIL_REFERRALS_LOCAL_STORAGE_KEY) || "[]");
      return normalizeCivilReferralRows(parsed);
    } catch (_error) {
      return [];
    }
  }

  function writeLocalCivilReferrals(rows) {
    const normalized = sortCivilReferralRows(normalizeCivilReferralRows(rows));
    localStorage.setItem(CIVIL_REFERRALS_LOCAL_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  async function listCivilReferrals(options = {}) {
    const listOptions = normalizeCivilListOptions(options);
    if (hasRemoteSync()) {
      const payload = await postRemotePayload(
        { type: "list_civil_referrals", ...listOptions },
        "Не удалось загрузить базу гражданских направлений"
      );
      return {
        rows: normalizeCivilReferralRows(payload?.rows),
        total: Number(payload?.total) || 0,
        limit: Number(payload?.limit) || listOptions.limit,
        offset: Number(payload?.offset) || listOptions.offset,
        query: normalizeCivilText(payload?.query || listOptions.query),
        source: "remote"
      };
    }

    const paged = pageCivilReferralRows(readLocalCivilReferrals(), listOptions);
    return {
      ...paged,
      source: "local-only"
    };
  }

  async function saveCivilReferrals(rows, sourceFileName = "", options = {}) {
    const normalized = normalizeCivilReferralRows(rows, sourceFileName);
    const listOptions = normalizeCivilListOptions(options);
    if (hasRemoteSync()) {
      const payload = await postRemotePayload(
        {
          type: "save_civil_referrals",
          sourceFileName,
          rows: normalized,
          ...listOptions
        },
        "Не удалось сохранить базу гражданских направлений"
      );
      return {
        rows: normalizeCivilReferralRows(payload?.rows),
        total: Number(payload?.total) || 0,
        limit: Number(payload?.limit) || listOptions.limit,
        offset: Number(payload?.offset) || listOptions.offset,
        query: normalizeCivilText(payload?.query || listOptions.query),
        saved: Number(payload?.saved) || normalized.length,
        source: "remote"
      };
    }

    const now = new Date().toISOString();
    const existing = readLocalCivilReferrals();
    const map = new Map(existing.map((row) => [row.id, row]));
    normalized.forEach((row) => {
      map.set(row.id, {
        ...map.get(row.id),
        ...row,
        sourceFileName: row.sourceFileName || sourceFileName,
        importedAt: row.importedAt || now,
        updatedAt: now
      });
    });
    const paged = pageCivilReferralRows(writeLocalCivilReferrals([...map.values()]), listOptions);
    return {
      ...paged,
      saved: normalized.length,
      source: "local-only"
    };
  }

  async function deleteCivilReferrals(ids, options = {}) {
    const cleanIds = normalizeCivilReferralIds(ids);
    const listOptions = normalizeCivilListOptions(options);
    if (hasRemoteSync()) {
      const payload = await postRemotePayload(
        {
          type: "delete_civil_referrals",
          ids: cleanIds,
          ...listOptions
        },
        "Не удалось удалить строки гражданских направлений"
      );
      return {
        rows: normalizeCivilReferralRows(payload?.rows),
        total: Number(payload?.total) || 0,
        limit: Number(payload?.limit) || listOptions.limit,
        offset: Number(payload?.offset) || listOptions.offset,
        query: normalizeCivilText(payload?.query || listOptions.query),
        deleted: Number(payload?.deleted) || cleanIds.length,
        source: "remote"
      };
    }

    if (cleanIds.length) {
      const idSet = new Set(cleanIds);
      writeLocalCivilReferrals(readLocalCivilReferrals().filter((row) => !idSet.has(row.id)));
    }
    const paged = pageCivilReferralRows(readLocalCivilReferrals(), listOptions);
    return {
      ...paged,
      deleted: cleanIds.length,
      source: "local-only"
    };
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

  function applyLocalDepartmentSnapshot(departmentId, reportDate, values) {
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
    return localSnapshot;
  }

  async function saveDepartment(departmentId, reportDate, values, accessCode) {
    const normalizedValues = config.normalizeRowValues(values);
    const currentSnapshot = loadLocalSnapshot();
    const effectiveReportDate = typeof reportDate === "string" && reportDate.trim()
      ? reportDate
      : currentSnapshot.reportDate;
    const queuePayload = {
      departmentId,
      reportDate: effectiveReportDate,
      values: normalizedValues,
      accessCode: accessCode || ""
    };

    if (shouldEnqueueMutationNow()) {
      const snapshot = applyLocalDepartmentSnapshot(departmentId, effectiveReportDate, normalizedValues);
      enqueuePendingMutation("save_department", queuePayload);
      return buildPendingSyncResult(snapshot);
    }

    try {
      const snapshot = await postRemote({
        type: "save_department",
        departmentId,
        reportDate: effectiveReportDate,
        values: normalizedValues,
        accessCode: accessCode || ""
      });

      return {
        snapshot,
        source: "remote"
      };
    } catch (error) {
      if (!shouldQueueRemoteError(error)) {
        throw error;
      }
      const snapshot = applyLocalDepartmentSnapshot(departmentId, effectiveReportDate, normalizedValues);
      enqueuePendingMutation("save_department", queuePayload, error instanceof Error ? error.message : "");
      return buildPendingSyncResult(snapshot, error instanceof Error ? error.message : "");
    }
  }

  async function saveDepartmentFromMain(departmentId, reportDate, values) {
    const normalizedValues = config.normalizeRowValues(values);
    const currentSnapshot = loadLocalSnapshot();
    const effectiveReportDate = typeof reportDate === "string" && reportDate.trim()
      ? reportDate
      : currentSnapshot.reportDate;
    const queuePayload = {
      departmentId,
      reportDate: effectiveReportDate,
      values: normalizedValues
    };

    if (shouldEnqueueMutationNow()) {
      const snapshot = applyLocalDepartmentSnapshot(departmentId, effectiveReportDate, normalizedValues);
      enqueuePendingMutation("save_department_from_main", queuePayload);
      return buildPendingSyncResult(snapshot);
    }

    try {
      const snapshot = await postRemote({
        type: "save_department_from_main",
        departmentId,
        reportDate: effectiveReportDate,
        values: normalizedValues
      });

      return {
        snapshot,
        source: "remote"
      };
    } catch (error) {
      if (!shouldQueueRemoteError(error)) {
        throw error;
      }
      const snapshot = applyLocalDepartmentSnapshot(departmentId, effectiveReportDate, normalizedValues);
      enqueuePendingMutation("save_department_from_main", queuePayload, error instanceof Error ? error.message : "");
      return buildPendingSyncResult(snapshot, error instanceof Error ? error.message : "");
    }
  }

  const NIGHT_SHIFT_TRANSFER_KEYS = ["shar", "spa", "paym", "zh", "family", "zp", "qi"];
  const QH_CALC_DEPARTMENT_IDS = new Set();
  const MORNING_ROLLOVER_DONE_PREFIX = `${config.STORAGE_NAMESPACE || "sarsh-kkzh-v2"}:morning-rollover-done:`;
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
  ];
  const MORNING_ROLLOVER_ZERO_KEYS = [
    "admittedTotal",
    "admittedSoldier",
    "admittedSeries",
    "dgTotal",
    "dgSoldier",
    "dgSeries",
    "transferFromDepartment",
    "transferToDepartment"
  ];

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

  function subtractCell(values, key, amount) {
    values[key] = Math.max(0, getLocalRowNumber(values, key) - config.normalizeCellValue(amount));
  }

  function getLocalRowNumber(values, key) {
    return config.normalizeCellValue(values && values[key]) || 0;
  }

  function primeQhMorningBaseValues(values) {
    const hasBaseValues =
      getLocalRowNumber(values, "qhBaseSoldier") !== 0
      || getLocalRowNumber(values, "qhBaseOfficer") !== 0
      || getLocalRowNumber(values, "qhBaseContract") !== 0;
    const hasQhFlowValues =
      getLocalRowNumber(values, "qhIncomingSoldier") !== 0
      || getLocalRowNumber(values, "qhIncomingOfficer") !== 0
      || getLocalRowNumber(values, "qhIncomingContract") !== 0
      || getLocalRowNumber(values, "qhDischargedSoldier") !== 0
      || getLocalRowNumber(values, "qhDischargedOfficer") !== 0
      || getLocalRowNumber(values, "qhDischargedContract") !== 0;
    const hasCurrentValues =
      getLocalRowNumber(values, "currentShar") !== 0
      || getLocalRowNumber(values, "currentSpa") !== 0
      || getLocalRowNumber(values, "currentPaym") !== 0;

    if (!hasBaseValues && !hasQhFlowValues && hasCurrentValues) {
      values.qhBaseSoldier = getLocalRowNumber(values, "currentShar");
      values.qhBaseOfficer = getLocalRowNumber(values, "currentSpa");
      values.qhBaseContract = getLocalRowNumber(values, "currentPaym");
    }
  }

  function syncQhMorningCalculatedValues(departmentId, values) {
    if (!QH_CALC_DEPARTMENT_IDS.has(departmentId)) {
      return;
    }

    primeQhMorningBaseValues(values);
    values.currentShar = getLocalRowNumber(values, "qhBaseSoldier")
      + getLocalRowNumber(values, "qhIncomingSoldier")
      - getLocalRowNumber(values, "qhDischargedSoldier");
    values.currentSpa = getLocalRowNumber(values, "qhBaseOfficer")
      + getLocalRowNumber(values, "qhIncomingOfficer")
      - getLocalRowNumber(values, "qhDischargedOfficer");
    values.currentPaym = getLocalRowNumber(values, "qhBaseContract")
      + getLocalRowNumber(values, "qhIncomingContract")
      - getLocalRowNumber(values, "qhDischargedContract");
  }

  function applyMorningRolloverRowsToSnapshot(snapshot, reportDate) {
    const normalized = config.buildSnapshotFromSaved(snapshot);
    const now = new Date().toISOString();

    normalized.rows.forEach((row) => {
      const values = config.normalizeRowValues(row.values);
      const currentShar = getLocalRowNumber(values, "currentShar");
      const currentSpa = getLocalRowNumber(values, "currentSpa");
      const currentPaym = getLocalRowNumber(values, "currentPaym");
      const leaveSharq = getLocalRowNumber(values, "leaveSharq");
      const leaveSpa = getLocalRowNumber(values, "leaveSpa");
      const leavePaym = getLocalRowNumber(values, "leavePaym");
      const presentKeys = Array.isArray(row.presentKeys) && row.presentKeys.length
        ? row.presentKeys
        : MORNING_ROLLOVER_PRESENT_KEYS;
      const presentTotal = presentKeys.reduce((sum, key) => sum + getLocalRowNumber(values, key), 0);

      values.beenTotal = presentTotal;
      values.beenSoldier = currentShar + currentSpa + currentPaym + leaveSharq + leaveSpa + leavePaym;
      values.beenSeries = currentShar + leaveSharq;
      MORNING_ROLLOVER_ZERO_KEYS.forEach((key) => {
        values[key] = 0;
      });

      row.values = values;
      row.updatedAt = now;
    });

    if (typeof reportDate === "string" && reportDate.trim()) {
      normalized.reportDate = reportDate.trim();
    }
    normalized.updatedAt = now;
    return normalized;
  }

  async function rolloverMainAfterArchive(archiveKey, reportDate) {
    const safeArchiveKey = typeof archiveKey === "string" ? archiveKey.trim() : "";
    if (!safeArchiveKey) {
      throw new Error("Не указан день архива для утреннего переноса.");
    }

    if (hasRemoteSync()) {
      const payload = await postRemotePayload(
        {
          type: "rollover_main_after_archive",
          archiveKey: safeArchiveKey,
          reportDate
        },
        "Не удалось выполнить утренний перенос главной таблицы"
      );
      const snapshot = config.buildSnapshotFromSaved(payload);
      writeLocalSnapshot(snapshot);
      return {
        snapshot,
        source: "remote",
        archiveRecord: payload && typeof payload.archiveRecord === "object" ? payload.archiveRecord : null,
        rolloverApplied: Boolean(payload && payload.rolloverApplied),
        rolloverAlreadyApplied: Boolean(payload && payload.rolloverAlreadyApplied)
      };
    }

    const doneKey = `${MORNING_ROLLOVER_DONE_PREFIX}${safeArchiveKey}`;
    if (localStorage.getItem(doneKey) === "1") {
      return {
        snapshot: loadLocalSnapshot(),
        source: "local-only",
        archiveRecord: null,
        rolloverApplied: false,
        rolloverAlreadyApplied: true
      };
    }

    const snapshot = applyMorningRolloverRowsToSnapshot(loadLocalSnapshot(), reportDate);
    writeLocalSnapshot(snapshot);
    localStorage.setItem(doneKey, "1");
    return {
      snapshot,
      source: "local-only",
      archiveRecord: null,
      rolloverApplied: true,
      rolloverAlreadyApplied: false
    };
  }

  async function queueAwareRolloverMainAfterArchive(archiveKey, reportDate) {
    const safeArchiveKey = typeof archiveKey === "string" ? archiveKey.trim() : "";
    if (!safeArchiveKey) {
      throw new Error("Не указан день архива для утреннего переноса.");
    }

    const queuePayload = {
      archiveKey: safeArchiveKey,
      reportDate
    };
    const doneKey = `${MORNING_ROLLOVER_DONE_PREFIX}${safeArchiveKey}`;

    if (shouldEnqueueMutationNow()) {
      if (localStorage.getItem(doneKey) === "1") {
        return {
          snapshot: loadLocalSnapshot(),
          source: "pending-sync",
          archiveRecord: null,
          rolloverApplied: false,
          rolloverAlreadyApplied: true,
          warning: getPendingSyncMessage()
        };
      }

      const snapshot = applyMorningRolloverRowsToSnapshot(loadLocalSnapshot(), reportDate);
      writeLocalSnapshot(snapshot);
      localStorage.setItem(doneKey, "1");
      enqueuePendingMutation("rollover_main_after_archive", queuePayload);
      return {
        ...buildPendingSyncResult(snapshot),
        archiveRecord: null,
        rolloverApplied: true,
        rolloverAlreadyApplied: false
      };
    }

    try {
      return await rolloverMainAfterArchive(archiveKey, reportDate);
    } catch (error) {
      if (!shouldQueueRemoteError(error)) {
        throw error;
      }

      if (localStorage.getItem(doneKey) === "1") {
        enqueuePendingMutation("rollover_main_after_archive", queuePayload, error instanceof Error ? error.message : "");
        return {
          ...buildPendingSyncResult(loadLocalSnapshot(), error instanceof Error ? error.message : ""),
          archiveRecord: null,
          rolloverApplied: false,
          rolloverAlreadyApplied: true
        };
      }

      const snapshot = applyMorningRolloverRowsToSnapshot(loadLocalSnapshot(), reportDate);
      writeLocalSnapshot(snapshot);
      localStorage.setItem(doneKey, "1");
      enqueuePendingMutation("rollover_main_after_archive", queuePayload, error instanceof Error ? error.message : "");
      return {
        ...buildPendingSyncResult(snapshot, error instanceof Error ? error.message : ""),
        archiveRecord: null,
        rolloverApplied: true,
        rolloverAlreadyApplied: false
      };
    }
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
      const nightTotal = n1 + n2 + n3 + n4 + n5 + n6 + n7;
      const hasAnyNightValue = n1 + n2 + n3 + n4 + n5 + n6 + n7;

      if (!hasAnyNightValue) {
        return;
      }

      const values = config.normalizeRowValues(row.values);
      addCell(values, "admittedSeries", n1);
      if (QH_CALC_DEPARTMENT_IDS.has(row.id)) {
        addCell(values, "qhIncomingSoldier", n1);
        addCell(values, "qhIncomingOfficer", n2);
        addCell(values, "qhIncomingContract", n3);
        syncQhMorningCalculatedValues(row.id, values);
      } else {
        addCell(values, "currentShar", n1);
        addCell(values, "currentSpa", n2);
        addCell(values, "currentPaym", n3);
      }
      addCell(values, "currentZh", n4);
      addCell(values, "family", n5);
      addCell(values, "officer", n6);
      addCell(values, "civil", n7);
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

  async function queueAwareApplyNightShiftToMain(rows, reportDate) {
    const nightRows = sanitizeNightShiftRows(rows);
    const queuePayload = {
      reportDate,
      rows: nightRows
    };

    if (shouldEnqueueMutationNow()) {
      const snapshot = applyNightShiftRowsToSnapshot(loadLocalSnapshot(), nightRows, reportDate);
      writeLocalSnapshot(snapshot);
      enqueuePendingMutation("apply_night_shift", queuePayload);
      return buildPendingSyncResult(snapshot);
    }

    try {
      return await applyNightShiftToMain(rows, reportDate);
    } catch (error) {
      if (!shouldQueueRemoteError(error)) {
        throw error;
      }
      const snapshot = applyNightShiftRowsToSnapshot(loadLocalSnapshot(), nightRows, reportDate);
      writeLocalSnapshot(snapshot);
      enqueuePendingMutation("apply_night_shift", queuePayload, error instanceof Error ? error.message : "");
      return buildPendingSyncResult(snapshot, error instanceof Error ? error.message : "");
    }
  }

  function normalizeNightShiftDraft(payload) {
    return {
      reportDateTime: typeof payload?.reportDateTime === "string" ? payload.reportDateTime : "",
      savedAt: typeof payload?.savedAt === "string" ? payload.savedAt : "",
      rows: sanitizeNightShiftRows(payload?.rows)
    };
  }

  async function loadNightShiftDraft() {
    if (!hasRemoteSync()) {
      return {
        draft: normalizeNightShiftDraft(null),
        source: "local-only"
      };
    }

    const payload = await postRemotePayload(
      { type: "load_night_shift" },
      "Не удалось загрузить ночную смену"
    );
    return {
      draft: normalizeNightShiftDraft(payload),
      source: "remote"
    };
  }

  async function saveNightShiftDraft(rows, reportDateTime) {
    const nightRows = sanitizeNightShiftRows(rows);
    if (!hasRemoteSync()) {
      return {
        draft: normalizeNightShiftDraft({ rows: nightRows, reportDateTime }),
        source: "local-only"
      };
    }

    const payload = await postRemotePayload(
      {
        type: "save_night_shift",
        reportDateTime,
        rows: nightRows
      },
      "Не удалось сохранить ночную смену"
    );
    return {
      draft: normalizeNightShiftDraft(payload),
      source: "remote"
    };
  }

  async function clearNightShiftDraft(reportDateTime) {
    if (!hasRemoteSync()) {
      return {
        draft: normalizeNightShiftDraft({ reportDateTime }),
        source: "local-only"
      };
    }

    const payload = await postRemotePayload(
      {
        type: "clear_night_shift",
        reportDateTime
      },
      "Не удалось очистить ночную смену"
    );
    return {
      draft: normalizeNightShiftDraft(payload),
      source: "remote"
    };
  }

  function applyDayShiftRowsToSnapshot(snapshot, rows, reportDate) {
    // Day-shift admissions currently follow the same transfer formula as night shift.
    return applyNightShiftRowsToSnapshot(snapshot, rows, reportDate);
  }

  function applyDischargeShiftRowsToSnapshot(snapshot, rows, reportDate) {
    const normalized = config.buildSnapshotFromSaved(snapshot);
    const dischargeRows = sanitizeNightShiftRows(rows);
    const now = new Date().toISOString();

    normalized.rows.forEach((row) => {
      const requested1 = getNightValue(dischargeRows, row.id, "shar");
      const requested2 = getNightValue(dischargeRows, row.id, "spa");
      const requested3 = getNightValue(dischargeRows, row.id, "paym");
      const requested4 = getNightValue(dischargeRows, row.id, "zh");
      const requested5 = getNightValue(dischargeRows, row.id, "family");
      const requested6 = getNightValue(dischargeRows, row.id, "zp");
      const requested7 = getNightValue(dischargeRows, row.id, "qi");
      const values = config.normalizeRowValues(row.values);
      const n1 = Math.min(requested1, getLocalRowNumber(values, "currentShar"));
      const n2 = Math.min(requested2, getLocalRowNumber(values, "currentSpa"));
      const n3 = Math.min(requested3, getLocalRowNumber(values, "currentPaym"));
      const n4 = Math.min(requested4, getLocalRowNumber(values, "currentZh"));
      const n5 = Math.min(requested5, getLocalRowNumber(values, "family"));
      const n6 = Math.min(requested6, getLocalRowNumber(values, "officer"));
      const n7 = Math.min(requested7, getLocalRowNumber(values, "civil"));
      const dischargeTotal = n1 + n2 + n3 + n4 + n5 + n6 + n7;

      if (!dischargeTotal) {
        return;
      }

      addCell(values, "dgSeries", n1);
      addCell(values, "dgTotal", dischargeTotal);
      addCell(values, "dgSoldier", n1 + n2 + n3);

      if (QH_CALC_DEPARTMENT_IDS.has(row.id)) {
        addCell(values, "qhDischargedSoldier", n1);
        addCell(values, "qhDischargedOfficer", n2);
        addCell(values, "qhDischargedContract", n3);
        syncQhMorningCalculatedValues(row.id, values);
      } else {
        subtractCell(values, "currentShar", n1);
        subtractCell(values, "currentSpa", n2);
        subtractCell(values, "currentPaym", n3);
      }

      subtractCell(values, "currentZh", n4);
      subtractCell(values, "family", n5);
      subtractCell(values, "officer", n6);
      subtractCell(values, "civil", n7);

      row.values = values;
      row.updatedAt = now;
    });

    if (typeof reportDate === "string" && reportDate.trim()) {
      normalized.reportDate = reportDate.trim();
    }
    normalized.updatedAt = now;
    return normalized;
  }

  async function applyDayShiftToMain(rows, reportDate) {
    const dayRows = sanitizeNightShiftRows(rows);

    if (hasRemoteSync()) {
      const snapshot = await postRemote({
        type: "apply_day_shift",
        reportDate,
        rows: dayRows
      });
      return {
        snapshot,
        source: "remote"
      };
    }

    const snapshot = applyDayShiftRowsToSnapshot(loadLocalSnapshot(), dayRows, reportDate);
    writeLocalSnapshot(snapshot);
    return {
      snapshot,
      source: "local-only"
    };
  }

  async function queueAwareApplyDayShiftToMain(rows, reportDate) {
    const dayRows = sanitizeNightShiftRows(rows);
    const queuePayload = {
      reportDate,
      rows: dayRows
    };

    if (shouldEnqueueMutationNow()) {
      const snapshot = applyDayShiftRowsToSnapshot(loadLocalSnapshot(), dayRows, reportDate);
      writeLocalSnapshot(snapshot);
      enqueuePendingMutation("apply_day_shift", queuePayload);
      return buildPendingSyncResult(snapshot);
    }

    try {
      return await applyDayShiftToMain(rows, reportDate);
    } catch (error) {
      if (!shouldQueueRemoteError(error)) {
        throw error;
      }
      const snapshot = applyDayShiftRowsToSnapshot(loadLocalSnapshot(), dayRows, reportDate);
      writeLocalSnapshot(snapshot);
      enqueuePendingMutation("apply_day_shift", queuePayload, error instanceof Error ? error.message : "");
      return buildPendingSyncResult(snapshot, error instanceof Error ? error.message : "");
    }
  }

  async function applyDischargeShiftToMain(rows, reportDate) {
    const dischargeRows = sanitizeNightShiftRows(rows);

    if (hasRemoteSync()) {
      const snapshot = await postRemote({
        type: "apply_discharge_shift",
        reportDate,
        rows: dischargeRows
      });
      return {
        snapshot,
        source: "remote"
      };
    }

    const snapshot = applyDischargeShiftRowsToSnapshot(loadLocalSnapshot(), dischargeRows, reportDate);
    writeLocalSnapshot(snapshot);
    return {
      snapshot,
      source: "local-only"
    };
  }

  async function queueAwareApplyDischargeShiftToMain(rows, reportDate) {
    const dischargeRows = sanitizeNightShiftRows(rows);
    const queuePayload = {
      reportDate,
      rows: dischargeRows
    };

    if (shouldEnqueueMutationNow()) {
      const snapshot = applyDischargeShiftRowsToSnapshot(loadLocalSnapshot(), dischargeRows, reportDate);
      writeLocalSnapshot(snapshot);
      enqueuePendingMutation("apply_discharge_shift", queuePayload);
      return buildPendingSyncResult(snapshot);
    }

    try {
      return await applyDischargeShiftToMain(rows, reportDate);
    } catch (error) {
      if (!shouldQueueRemoteError(error)) {
        throw error;
      }
      const snapshot = applyDischargeShiftRowsToSnapshot(loadLocalSnapshot(), dischargeRows, reportDate);
      writeLocalSnapshot(snapshot);
      enqueuePendingMutation("apply_discharge_shift", queuePayload, error instanceof Error ? error.message : "");
      return buildPendingSyncResult(snapshot, error instanceof Error ? error.message : "");
    }
  }

  function normalizeDayShiftDraft(payload) {
    return {
      reportDateTime: typeof payload?.reportDateTime === "string" ? payload.reportDateTime : "",
      savedAt: typeof payload?.savedAt === "string" ? payload.savedAt : "",
      rows: sanitizeNightShiftRows(payload?.rows)
    };
  }

  async function loadDayShiftDraft() {
    if (!hasRemoteSync()) {
      return {
        draft: normalizeDayShiftDraft(null),
        source: "local-only"
      };
    }

    const payload = await postRemotePayload(
      { type: "load_day_shift" },
      "Не удалось загрузить дневную смену"
    );
    return {
      draft: normalizeDayShiftDraft(payload),
      source: "remote"
    };
  }

  async function saveDayShiftDraft(rows, reportDateTime) {
    const dayRows = sanitizeNightShiftRows(rows);
    if (!hasRemoteSync()) {
      return {
        draft: normalizeDayShiftDraft({ rows: dayRows, reportDateTime }),
        source: "local-only"
      };
    }

    const payload = await postRemotePayload(
      {
        type: "save_day_shift",
        reportDateTime,
        rows: dayRows
      },
      "Не удалось сохранить дневную смену"
    );
    return {
      draft: normalizeDayShiftDraft(payload),
      source: "remote"
    };
  }

  async function clearDayShiftDraft(reportDateTime) {
    if (!hasRemoteSync()) {
      return {
        draft: normalizeDayShiftDraft({ reportDateTime }),
        source: "local-only"
      };
    }

    const payload = await postRemotePayload(
      {
        type: "clear_day_shift",
        reportDateTime
      },
      "Не удалось очистить дневную смену"
    );
    return {
      draft: normalizeDayShiftDraft(payload),
      source: "remote"
    };
  }

  function normalizeDischargeShiftDraft(payload) {
    return {
      reportDateTime: typeof payload?.reportDateTime === "string" ? payload.reportDateTime : "",
      savedAt: typeof payload?.savedAt === "string" ? payload.savedAt : "",
      rows: sanitizeNightShiftRows(payload?.rows)
    };
  }

  async function loadDischargeShiftDraft() {
    if (!hasRemoteSync()) {
      return {
        draft: normalizeDischargeShiftDraft(null),
        source: "local-only"
      };
    }

    const payload = await postRemotePayload(
      { type: "load_discharge_shift" },
      "Не удалось загрузить утреннюю выписку"
    );
    return {
      draft: normalizeDischargeShiftDraft(payload),
      source: "remote"
    };
  }

  async function saveDischargeShiftDraft(rows, reportDateTime) {
    const dischargeRows = sanitizeNightShiftRows(rows);
    if (!hasRemoteSync()) {
      return {
        draft: normalizeDischargeShiftDraft({ rows: dischargeRows, reportDateTime }),
        source: "local-only"
      };
    }

    const payload = await postRemotePayload(
      {
        type: "save_discharge_shift",
        reportDateTime,
        rows: dischargeRows
      },
      "Не удалось сохранить утреннюю выписку"
    );
    return {
      draft: normalizeDischargeShiftDraft(payload),
      source: "remote"
    };
  }

  async function clearDischargeShiftDraft(reportDateTime) {
    if (!hasRemoteSync()) {
      return {
        draft: normalizeDischargeShiftDraft({ reportDateTime }),
        source: "local-only"
      };
    }

    const payload = await postRemotePayload(
      {
        type: "clear_discharge_shift",
        reportDateTime
      },
      "Не удалось очистить утреннюю выписку"
    );
    return {
      draft: normalizeDischargeShiftDraft(payload),
      source: "remote"
    };
  }

  async function listOcrFeedback(limit, feedbackIdsOrOptions, maybeOptions) {
    if (!hasRemoteSync()) {
      return [];
    }

    ensureOwnerAuth();
    const feedbackIds = Array.isArray(feedbackIdsOrOptions) ? feedbackIdsOrOptions : [];
    const options = (
      feedbackIdsOrOptions
      && typeof feedbackIdsOrOptions === "object"
      && !Array.isArray(feedbackIdsOrOptions)
    )
      ? feedbackIdsOrOptions
      : (maybeOptions && typeof maybeOptions === "object" ? maybeOptions : {});
    const cleanFeedbackIds = feedbackIds
      ? feedbackIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
      : [];
    const createdDateKey = typeof options.createdDateKey === "string" ? options.createdDateKey.trim() : "";
    const excludeTelegramForms = Boolean(options.excludeTelegramForms);
    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "list_ocr_feedback",
        limit: Number.isFinite(Number(limit)) ? Number(limit) : 100,
        feedbackIds: cleanFeedbackIds,
        createdDateKey,
        excludeTelegramForms
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

  async function listTelegramFormFeedback(limit) {
    if (!hasRemoteSync()) {
      return [];
    }

    ensureOwnerAuth();
    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "list_telegram_form_feedback",
        limit: Number.isFinite(Number(limit)) ? Number(limit) : 80
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось загрузить Telegram Web формы");
    }

    return Array.isArray(payload?.records) ? payload.records : [];
  }

  async function listAndroidMainformFeedback(limit, options = {}) {
    if (!hasRemoteSync()) {
      return [];
    }

    const url = new URL(getTelegramFunctionEndpoint());
    url.searchParams.set("action", "android-mainform-feedback");
    url.searchParams.set(
      "limit",
      String(Number.isFinite(Number(limit)) ? Number(limit) : 80)
    );

    const createdDateKey = typeof options.createdDateKey === "string"
      ? options.createdDateKey.trim()
      : "";
    if (createdDateKey) {
      url.searchParams.set("createdDateKey", createdDateKey);
    }

    const response = await fetch(url.toString(), {
      method: "GET"
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw buildResponseError(response, payload, "Не удалось загрузить отправки Android MAINFORM");
    }

    return Array.isArray(payload?.records) ? payload.records : [];
  }

  async function loadRuntimePreferences() {
    if (!hasRemoteSync()) {
      return {
        autoRotateImages: Boolean(runtime.autoRotateImages)
      };
    }

    ensureOwnerAuth();
    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "get_runtime_preferences"
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось загрузить настройки");
    }

    return {
      autoRotateImages: Boolean(payload?.autoRotateImages)
    };
  }

  async function saveRuntimePreferences(preferences) {
    if (!hasRemoteSync()) {
      return {
        autoRotateImages: Boolean(preferences?.autoRotateImages)
      };
    }

    ensureOwnerAuth();
    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "save_runtime_preferences",
        preferences: {
          autoRotateImages: Boolean(preferences?.autoRotateImages)
        }
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось сохранить настройки");
    }

    return {
      autoRotateImages: Boolean(payload?.autoRotateImages)
    };
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

  async function updateOcrFeedbackImage(feedbackId, imageDataUrl) {
    if (!hasRemoteSync()) {
      throw new Error("Поворот фото на сервере доступен только в онлайн-режиме владельца.");
    }

    const normalizedFeedbackId = Number(feedbackId);
    const normalizedImageDataUrl = typeof imageDataUrl === "string" ? imageDataUrl.trim() : "";
    if (!Number.isFinite(normalizedFeedbackId) || normalizedFeedbackId <= 0) {
      throw new Error("Нужен корректный id OCR feedback.");
    }
    if (!normalizedImageDataUrl.startsWith("data:image/")) {
      throw new Error("Нужно корректное изображение для сохранения.");
    }

    ensureOwnerAuth();
    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "update_ocr_feedback_image",
        feedbackId: Math.trunc(normalizedFeedbackId),
        imageDataUrl: normalizedImageDataUrl
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось сохранить поворот фото");
    }

    return payload && typeof payload.record === "object" ? payload.record : null;
  }

  async function reassignOcrFeedbackDepartment(feedbackId, departmentId) {
    if (!hasRemoteSync()) {
      throw new Error("Переназначение фото доступно только в онлайн-режиме владельца.");
    }

    const normalizedFeedbackId = Number(feedbackId);
    const normalizedDepartmentId = String(departmentId || "").trim();
    if (!Number.isFinite(normalizedFeedbackId) || normalizedFeedbackId <= 0) {
      throw new Error("Нужен корректный id OCR feedback.");
    }
    if (!normalizedDepartmentId) {
      throw new Error("Нужно выбрать отделение.");
    }

    ensureOwnerAuth();
    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "reassign_ocr_feedback_department",
        feedbackId: Math.trunc(normalizedFeedbackId),
        departmentId: normalizedDepartmentId
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось изменить отделение для фото");
    }

    return {
      snapshot: payload && payload.snapshot ? payload.snapshot : null,
      record: payload && typeof payload.record === "object" ? payload.record : null,
      source: "remote"
    };
  }

  async function deleteDepartmentFeedback(departmentId, feedbackId) {
    if (!hasRemoteSync()) {
      throw new Error("Удаление отправленных данных доступно только в онлайн-режиме владельца.");
    }

    const payload = {
      type: "delete_department_feedback",
      feedbackId: Number(feedbackId)
    };
    const normalizedDepartmentId = String(departmentId || "").trim();
    if (normalizedDepartmentId) {
      payload.departmentId = normalizedDepartmentId;
    }

    const snapshot = await postRemote(payload);

    return {
      snapshot,
      source: "remote"
    };
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

  async function queueAwareSaveReportDate(reportDate) {
    const currentSnapshot = loadLocalSnapshot();
    const effectiveReportDate = typeof reportDate === "string" && reportDate.trim()
      ? reportDate
      : config.DEFAULT_DATE;
    const queuePayload = {
      reportDate: effectiveReportDate
    };

    if (shouldEnqueueMutationNow()) {
      currentSnapshot.reportDate = effectiveReportDate;
      currentSnapshot.updatedAt = new Date().toISOString();
      writeLocalSnapshot(currentSnapshot);
      enqueuePendingMutation("save_report_date", queuePayload);
      return buildPendingSyncResult(currentSnapshot);
    }

    try {
      return await saveReportDate(reportDate);
    } catch (error) {
      if (!shouldQueueRemoteError(error)) {
        throw error;
      }
      currentSnapshot.reportDate = effectiveReportDate;
      currentSnapshot.updatedAt = new Date().toISOString();
      writeLocalSnapshot(currentSnapshot);
      enqueuePendingMutation("save_report_date", queuePayload, error instanceof Error ? error.message : "");
      return buildPendingSyncResult(currentSnapshot, error instanceof Error ? error.message : "");
    }
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
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось отправить Telegram-уведомление");
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

  function normalizeShiftFormMode(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "day" || normalized === "day_shift") {
      return "day";
    }
    if (normalized === "discharge" || normalized === "morning" || normalized === "morning_discharge") {
      return "discharge";
    }
    return "night";
  }

  async function sendShiftFormToTelegram(mode) {
    ensureOwnerAuth();
    if (!hasRemoteSync()) {
      throw new Error("Онлайн-синхронизация нужна для отправки Telegram формы.");
    }

    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: "send_shift_form_to_telegram",
        mode: normalizeShiftFormMode(mode)
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (await handleOwnerAuthFailure(response)) {
        throw new Error("Сессия владельца недействительна. Войдите снова.");
      }
      throw buildResponseError(response, payload, "Не удалось отправить Telegram форму");
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

  function buildTelegramFormPdfUrl(feedbackId, departmentId) {
    const normalizedId = String(feedbackId || "").trim();
    if (!hasRemoteSync() || !normalizedId) {
      return "";
    }

    const url = new URL(getTelegramFunctionEndpoint());
    url.searchParams.set("action", "telegram-form-pdf");
    url.searchParams.set("id", normalizedId);
    if (departmentId) {
      url.searchParams.set("departmentId", String(departmentId));
    }
    return url.toString();
  }

  function buildTelegramFormArchiveDatePdfUrl(dateKey) {
    const normalizedDate = String(dateKey || "").trim();
    if (!hasRemoteSync() || !normalizedDate) {
      return "";
    }

    const url = new URL(getTelegramFunctionEndpoint());
    url.searchParams.set("action", "telegram-form-archive-pdf");
    url.searchParams.set("date", normalizedDate);
    return url.toString();
  }

  function getSourceLabel(source) {
    if (source === "remote") {
      return "Առցանց սինխր.";
    }
    if (source === "pending-sync") {
      return "Առցանց + ուղարկման հերթ.";
    }
    if (source === "local-cache") {
      return "Տեղային պահոց";
    }
    return "Տեղային ռեժիմ";
  }

  function getShareQuery() {
    return typeof runtimeMeta.shareQuery === "string" ? runtimeMeta.shareQuery : "";
  }

  window.SHARSH_SYNC = {
    runtime,
    hasRemoteSync,
    loadSnapshot,
    getPendingSyncStatus,
    syncPendingChanges,
    saveDepartment,
    saveDepartmentFromMain,
    rolloverMainAfterArchive: queueAwareRolloverMainAfterArchive,
    applyNightShiftToMain: queueAwareApplyNightShiftToMain,
    loadNightShiftDraft,
    saveNightShiftDraft,
    clearNightShiftDraft,
    applyDayShiftToMain: queueAwareApplyDayShiftToMain,
    applyDischargeShiftToMain: queueAwareApplyDischargeShiftToMain,
    loadDayShiftDraft,
    saveDayShiftDraft,
    clearDayShiftDraft,
    loadDischargeShiftDraft,
    saveDischargeShiftDraft,
    clearDischargeShiftDraft,
    listCivilReferrals,
    saveCivilReferrals,
    deleteCivilReferrals,
    saveOcrFeedback,
    updateOcrFeedbackImage,
    listTelegramFormFeedback,
    loadRuntimePreferences,
    reassignOcrFeedbackDepartment,
    deleteDepartmentFeedback,
    saveRuntimePreferences,
    saveReportDate: queueAwareSaveReportDate,
    notifyOwnerLogin,
    sendMainPdfsToTelegram,
    sendShiftFormToTelegram,
    loadTelegramPhotoFeedback,
    buildTelegramFormPdfUrl,
    buildTelegramFormArchiveDatePdfUrl,
    listOcrFeedback,
    listAndroidMainformFeedback,
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
