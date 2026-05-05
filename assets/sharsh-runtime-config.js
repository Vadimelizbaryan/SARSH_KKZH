(function () {
  const STORAGE_KEY = "sarsh-kkzh-runtime-config-v1";
  const DEFAULT_CONFIG = {
    syncMode: "local-only",
    supabaseUrl: "",
    supabaseAnonKey: "",
    functionName: "sharsh-sync",
    autoSync: true,
    refreshIntervalMs: 30000,
    requireAccessCode: false
  };

  function parseBoolean(value, fallback) {
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

  function parsePositiveInteger(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.trunc(parsed);
  }

  function normalizeConfig(source) {
    const next = {
      ...DEFAULT_CONFIG
    };

    if (source && typeof source === "object") {
      if (source.syncMode === "supabase-function" || source.syncMode === "local-only") {
        next.syncMode = source.syncMode;
      }

      if (typeof source.supabaseUrl === "string") {
        next.supabaseUrl = source.supabaseUrl.trim();
      }
      if (typeof source.supabaseAnonKey === "string") {
        next.supabaseAnonKey = source.supabaseAnonKey.trim();
      }
      if (typeof source.functionName === "string" && source.functionName.trim()) {
        next.functionName = source.functionName.trim();
      }

      next.autoSync = parseBoolean(source.autoSync, DEFAULT_CONFIG.autoSync);
      next.refreshIntervalMs = parsePositiveInteger(source.refreshIntervalMs, DEFAULT_CONFIG.refreshIntervalMs);
      next.requireAccessCode = parseBoolean(source.requireAccessCode, DEFAULT_CONFIG.requireAccessCode);
    }

    if (next.syncMode !== "supabase-function") {
      next.supabaseUrl = "";
      next.supabaseAnonKey = "";
    }

    return next;
  }

  function loadStoredConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return normalizeConfig(JSON.parse(raw));
    } catch (_error) {
      return null;
    }
  }

  function saveStoredConfig(source) {
    const normalized = normalizeConfig(source);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function clearStoredConfig() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function parseQueryConfig() {
    const params = new URLSearchParams(window.location.search);
    const hasOverride = ["sync", "sbUrl", "sbKey", "fn", "as", "ri", "ac"].some((key) => params.has(key));
    if (!hasOverride) {
      return null;
    }

    const syncValue = params.get("sync");
    return normalizeConfig({
      syncMode: syncValue === "supabase" || syncValue === "supabase-function"
        ? "supabase-function"
        : "local-only",
      supabaseUrl: params.get("sbUrl") || "",
      supabaseAnonKey: params.get("sbKey") || "",
      functionName: params.get("fn") || DEFAULT_CONFIG.functionName,
      autoSync: params.has("as") ? params.get("as") : DEFAULT_CONFIG.autoSync,
      refreshIntervalMs: params.get("ri") || DEFAULT_CONFIG.refreshIntervalMs,
      requireAccessCode: params.get("ac")
    });
  }

  function buildShareQueryString(source) {
    const normalized = normalizeConfig(source);
    if (
      normalized.syncMode !== "supabase-function"
      || !normalized.supabaseUrl
      || !normalized.supabaseAnonKey
    ) {
      return "";
    }

    const params = new URLSearchParams();
    params.set("sync", "supabase-function");
    params.set("sbUrl", normalized.supabaseUrl);
    params.set("sbKey", normalized.supabaseAnonKey);

    if (normalized.functionName !== DEFAULT_CONFIG.functionName) {
      params.set("fn", normalized.functionName);
    }
    if (!normalized.autoSync) {
      params.set("as", "0");
    }
    if (normalized.refreshIntervalMs !== DEFAULT_CONFIG.refreshIntervalMs) {
      params.set("ri", String(normalized.refreshIntervalMs));
    }
    if (normalized.requireAccessCode) {
      params.set("ac", "1");
    }

    return `?${params.toString()}`;
  }

  const queryConfig = parseQueryConfig();
  const storedConfig = queryConfig ? null : loadStoredConfig();
  const effectiveConfig = queryConfig || storedConfig || normalizeConfig(DEFAULT_CONFIG);

  if (queryConfig) {
    saveStoredConfig(queryConfig);
  }

  window.SHARSH_RUNTIME_CONFIG = effectiveConfig;
  window.SHARSH_RUNTIME_CONFIG_META = {
    storageKey: STORAGE_KEY,
    source: queryConfig ? "query" : (storedConfig ? "storage" : "default"),
    shareQuery: buildShareQueryString(effectiveConfig),
    buildShareQueryString,
    normalizeConfig,
    loadStoredConfig,
    saveStoredConfig,
    clearStoredConfig
  };
})();
