(function () {
  const config = window.SHARSH_CONFIG;
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};

  function deepCopy(value) {
    return config.deepCopy(value);
  }

  function hasRemoteSync() {
    return runtime.syncMode === "supabase-function"
      && typeof runtime.supabaseUrl === "string"
      && runtime.supabaseUrl.trim() !== ""
      && typeof runtime.supabaseAnonKey === "string"
      && runtime.supabaseAnonKey.trim() !== "";
  }

  function getSyncEndpoint() {
    const baseUrl = String(runtime.supabaseUrl || "").replace(/\/+$/, "");
    const functionName = String(runtime.functionName || "sharsh-sync").trim();
    return `${baseUrl}/functions/v1/${functionName}`;
  }

  function getAuthHeaders() {
    const headers = {
      "Content-Type": "application/json"
    };

    if (hasRemoteSync()) {
      headers.apikey = runtime.supabaseAnonKey;
      headers.Authorization = `Bearer ${runtime.supabaseAnonKey}`;
    }

    return headers;
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
    } catch (error) {
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
    } catch (error) {
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
      } catch (error) {
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

    if (!response.ok) {
      throw new Error(`Не удалось загрузить данные (${response.status})`);
    }

    const payload = await response.json();
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
      const snapshot = loadLocalSnapshot();
      return {
        snapshot,
        source: "local-cache",
        warning: error instanceof Error ? error.message : "Не удалось подключиться к серверу"
      };
    }
  }

  async function postRemote(body) {
    const response = await fetch(getSyncEndpoint(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload && payload.error ? payload.error : `Ошибка синхронизации (${response.status})`;
      throw new Error(message);
    }

    const snapshot = config.buildSnapshotFromSaved(payload);
    writeLocalSnapshot(snapshot);
    return snapshot;
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

  function getSourceLabel(source) {
    if (source === "remote") {
      return "Онлайн-синхронизация";
    }
    if (source === "local-cache") {
      return "Локальный кэш";
    }
    return "Локальный режим";
  }

  window.SHARSH_SYNC = {
    runtime,
    hasRemoteSync,
    loadSnapshot,
    saveDepartment,
    saveReportDate,
    loadLocalSnapshot,
    writeLocalSnapshot,
    getSourceLabel
  };
})();
