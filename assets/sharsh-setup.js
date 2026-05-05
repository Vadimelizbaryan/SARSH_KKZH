(function () {
  const config = window.SHARSH_CONFIG;
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const runtimeMeta = window.SHARSH_RUNTIME_CONFIG_META || {};

  if (!config || !runtimeMeta) {
    return;
  }

  const fields = {
    syncEnabled: document.getElementById("syncEnabledField"),
    supabaseUrl: document.getElementById("supabaseUrlField"),
    supabaseAnonKey: document.getElementById("supabaseAnonKeyField"),
    functionName: document.getElementById("functionNameField"),
    refreshInterval: document.getElementById("refreshIntervalField"),
    requireAccessCode: document.getElementById("requireAccessCodeField")
  };

  const statusText = document.getElementById("setupStatusText");
  const sourceLabel = document.getElementById("setupSourceLabel");
  const mainLink = document.getElementById("mainLinkField");
  const linksContainer = document.getElementById("departmentLinks");
  const testButton = document.getElementById("testConnectionBtn");
  const saveButton = document.getElementById("saveBrowserBtn");
  const clearButton = document.getElementById("clearBrowserBtn");
  const openMainButton = document.getElementById("openMainBtn");

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function setStatus(message, isError) {
    if (!statusText) {
      return;
    }
    statusText.textContent = message;
    statusText.classList.toggle("warning-note", Boolean(isError));
  }

  function buildFormConfig() {
    const syncMode = fields.syncEnabled && fields.syncEnabled.checked
      ? "supabase-function"
      : "local-only";

    return runtimeMeta.normalizeConfig({
      syncMode,
      supabaseUrl: fields.supabaseUrl ? fields.supabaseUrl.value : "",
      supabaseAnonKey: fields.supabaseAnonKey ? fields.supabaseAnonKey.value : "",
      functionName: fields.functionName ? fields.functionName.value : "",
      refreshIntervalMs: fields.refreshInterval ? fields.refreshInterval.value : "",
      requireAccessCode: fields.requireAccessCode ? fields.requireAccessCode.checked : false
    });
  }

  function buildAbsoluteLink(relativePath, runtimeConfig) {
    const url = new URL(relativePath, window.location.href);
    const shareQuery = runtimeMeta.buildShareQueryString(runtimeConfig);
    url.search = shareQuery ? shareQuery.slice(1) : "";
    return url.toString();
  }

  function copyText(text) {
    return navigator.clipboard.writeText(text);
  }

  function updateSourceLabel() {
    if (!sourceLabel) {
      return;
    }

    const source = runtimeMeta.source || "default";
    const storedConfig = runtimeMeta.loadStoredConfig ? runtimeMeta.loadStoredConfig() : null;
    if (source === "query") {
      sourceLabel.textContent = "From link";
      sourceLabel.className = "pill remote";
      return;
    }
    if (source === "storage" || (storedConfig && storedConfig.syncMode === "supabase-function")) {
      sourceLabel.textContent = "Saved in this browser";
      sourceLabel.className = "pill remote";
      return;
    }

    sourceLabel.textContent = "Local only";
    sourceLabel.className = "pill local";
  }

  function updateGeneratedLinks() {
    const runtimeConfig = buildFormConfig();
    const mainUrl = buildAbsoluteLink("./SARSH_KKZH.html", runtimeConfig);

    if (mainLink) {
      mainLink.value = mainUrl;
    }
    if (openMainButton) {
      openMainButton.href = mainUrl;
    }

    if (!linksContainer) {
      return;
    }

    linksContainer.innerHTML = config.departmentDefinitions.map((definition) => {
      const url = buildAbsoluteLink(`./departments/${definition.slug}.html`, runtimeConfig);
      return `
        <div class="setup-link-row">
          <div>
            <strong>${escapeHtml(definition.department)}</strong>
            <input class="setup-link-url" type="text" readonly value="${escapeHtml(url)}">
          </div>
          <button type="button" class="setup-link-copy" data-copy-value="${escapeHtml(url)}">Copy</button>
        </div>
      `;
    }).join("");

    linksContainer.querySelectorAll("[data-copy-value]").forEach((button) => {
      button.addEventListener("click", async () => {
        const value = button.getAttribute("data-copy-value") || "";
        try {
          await copyText(value);
          setStatus("Department link copied.", false);
        } catch (_error) {
          window.prompt("Copy this link", value);
        }
      });
    });
  }

  async function testConnection() {
    const runtimeConfig = buildFormConfig();
    if (
      runtimeConfig.syncMode !== "supabase-function"
      || !runtimeConfig.supabaseUrl
      || !runtimeConfig.supabaseAnonKey
    ) {
      setStatus("Enter Supabase URL and anon key first.", true);
      return;
    }

    const baseUrl = runtimeConfig.supabaseUrl.replace(/\/+$/, "");
    const endpoint = `${baseUrl}/functions/v1/${runtimeConfig.functionName}`;

    setStatus("Checking server connection...", false);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          apikey: runtimeConfig.supabaseAnonKey,
          Authorization: `Bearer ${runtimeConfig.supabaseAnonKey}`
        }
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
      }

      const rowCount = payload && Array.isArray(payload.rows) ? payload.rows.length : 0;
      setStatus(`Connection OK. Server returned ${rowCount} department rows.`, false);
    } catch (error) {
      setStatus(
        error instanceof Error ? `Connection failed: ${error.message}` : "Connection failed.",
        true
      );
    }
  }

  function saveBrowserConfig() {
    const runtimeConfig = buildFormConfig();
    if (runtimeConfig.syncMode === "supabase-function") {
      runtimeMeta.saveStoredConfig(runtimeConfig);
      setStatus("Remote sync settings saved in this browser.", false);
    } else {
      runtimeMeta.clearStoredConfig();
      setStatus("Browser returned to local-only mode.", false);
    }

    updateGeneratedLinks();
  }

  function clearBrowserConfig() {
    runtimeMeta.clearStoredConfig();

    if (fields.syncEnabled) {
      fields.syncEnabled.checked = false;
    }
    if (fields.supabaseUrl) {
      fields.supabaseUrl.value = "";
    }
    if (fields.supabaseAnonKey) {
      fields.supabaseAnonKey.value = "";
    }
    if (fields.functionName) {
      fields.functionName.value = "sharsh-sync";
    }
    if (fields.refreshInterval) {
      fields.refreshInterval.value = "30000";
    }
    if (fields.requireAccessCode) {
      fields.requireAccessCode.checked = false;
    }

    updateGeneratedLinks();
    updateSourceLabel();
    setStatus("Saved browser sync settings cleared.", false);
  }

  function prefillFields() {
    if (fields.syncEnabled) {
      fields.syncEnabled.checked = runtime.syncMode === "supabase-function";
    }
    if (fields.supabaseUrl) {
      fields.supabaseUrl.value = runtime.supabaseUrl || "";
    }
    if (fields.supabaseAnonKey) {
      fields.supabaseAnonKey.value = runtime.supabaseAnonKey || "";
    }
    if (fields.functionName) {
      fields.functionName.value = runtime.functionName || "sharsh-sync";
    }
    if (fields.refreshInterval) {
      fields.refreshInterval.value = String(runtime.refreshIntervalMs || 30000);
    }
    if (fields.requireAccessCode) {
      fields.requireAccessCode.checked = Boolean(runtime.requireAccessCode);
    }
  }

  prefillFields();
  updateSourceLabel();
  updateGeneratedLinks();
  setStatus("Enter the Supabase values, test the connection, then open the main link.", false);

  Object.values(fields).forEach((field) => {
    if (!field) {
      return;
    }
    field.addEventListener("input", updateGeneratedLinks);
    field.addEventListener("change", updateGeneratedLinks);
  });

  if (testButton) {
    testButton.addEventListener("click", testConnection);
  }
  if (saveButton) {
    saveButton.addEventListener("click", () => {
      saveBrowserConfig();
      updateSourceLabel();
    });
  }
  if (clearButton) {
    clearButton.addEventListener("click", clearBrowserConfig);
  }
  if (mainLink) {
    mainLink.addEventListener("click", () => {
      mainLink.select();
    });
  }
})();
