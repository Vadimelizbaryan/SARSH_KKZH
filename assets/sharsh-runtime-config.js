(function () {
  const STORAGE_KEY = "sarsh-kkzh-runtime-config-v2";
  const DEFAULT_CONFIG = {
    syncMode: "supabase-function",
    supabaseUrl: "https://ywecvlapdlaojpvijaqy.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3ZWN2bGFwZGxhb2pwdmlqYXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNTAzMjgsImV4cCI6MjA5MzYyNjMyOH0._HEPdPB2bBTo_N-1Qo8jLau5g5oYGgvoGnBWPxDupL4",
    functionName: "sharsh-sync",
    autoSync: true,
    refreshIntervalMs: 30000,
    requireAccessCode: false,
    requireGoogleAuth: true
  };

  function isLocalEnvironment() {
    const protocol = String(window.location.protocol || "").toLowerCase();
    const hostname = String(window.location.hostname || "").toLowerCase();
    return protocol === "file:"
      || hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname === "::1";
  }

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
      next.requireGoogleAuth = parseBoolean(source.requireGoogleAuth, DEFAULT_CONFIG.requireGoogleAuth);
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

  function configsMatch(left, right) {
    return left.syncMode === right.syncMode
      && left.supabaseUrl === right.supabaseUrl
      && left.supabaseAnonKey === right.supabaseAnonKey
      && left.functionName === right.functionName
      && left.autoSync === right.autoSync
      && left.refreshIntervalMs === right.refreshIntervalMs
      && left.requireAccessCode === right.requireAccessCode
      && left.requireGoogleAuth === right.requireGoogleAuth;
  }

  function parseQueryConfig() {
    const params = new URLSearchParams(window.location.search);
    const hasOverride = ["sync", "sbUrl", "sbKey", "fn", "as", "ri", "ac", "ga"].some((key) => params.has(key));
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
      requireAccessCode: params.has("ac") ? params.get("ac") : DEFAULT_CONFIG.requireAccessCode,
      requireGoogleAuth: params.has("ga") ? params.get("ga") : DEFAULT_CONFIG.requireGoogleAuth
    });
  }

  function buildShareQueryString(source) {
    const normalized = normalizeConfig(source);
    const defaultConfig = normalizeConfig(DEFAULT_CONFIG);

    if (configsMatch(normalized, defaultConfig)) {
      return "";
    }

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
    if (normalized.requireAccessCode !== DEFAULT_CONFIG.requireAccessCode) {
      params.set("ac", normalized.requireAccessCode ? "1" : "0");
    }
    if (normalized.requireGoogleAuth !== DEFAULT_CONFIG.requireGoogleAuth) {
      params.set("ga", normalized.requireGoogleAuth ? "1" : "0");
    }

    return `?${params.toString()}`;
  }

  function buildForcedLocalConfig(source) {
    return normalizeConfig({
      ...source,
      syncMode: "local-only",
      requireAccessCode: false,
      requireGoogleAuth: false
    });
  }

  const queryConfig = parseQueryConfig();
  const storedConfig = queryConfig ? null : loadStoredConfig();
  const baseConfig = queryConfig || storedConfig || normalizeConfig(DEFAULT_CONFIG);
  const forceLocalMode = !queryConfig && isLocalEnvironment();
  const effectiveConfig = forceLocalMode ? buildForcedLocalConfig(baseConfig) : baseConfig;

  if (queryConfig) {
    saveStoredConfig(queryConfig);
  }

  window.SHARSH_RUNTIME_CONFIG = effectiveConfig;
  window.SHARSH_RUNTIME_CONFIG_META = {
    storageKey: STORAGE_KEY,
    source: queryConfig ? "query" : (forceLocalMode ? "local-env" : (storedConfig ? "storage" : "default")),
    isLocalEnvironment,
    shareQuery: buildShareQueryString(effectiveConfig),
    buildShareQueryString,
    normalizeConfig,
    loadStoredConfig,
    saveStoredConfig,
    clearStoredConfig
  };
})();
