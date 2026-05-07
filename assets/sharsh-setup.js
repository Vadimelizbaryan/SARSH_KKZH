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
    requireAccessCode: document.getElementById("requireAccessCodeField"),
    requireOwnerAuth: document.getElementById("requireOwnerAuthField")
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
      requireAccessCode: fields.requireAccessCode ? fields.requireAccessCode.checked : false,
      requireOwnerAuth: fields.requireOwnerAuth ? fields.requireOwnerAuth.checked : false
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
      sourceLabel.textContent = "Из ссылки";
      sourceLabel.className = "pill remote";
      return;
    }
    if (source === "local-env") {
      sourceLabel.textContent = "Локально";
      sourceLabel.className = "pill local";
      return;
    }
    if (source === "storage" || (storedConfig && storedConfig.syncMode === "supabase-function")) {
      sourceLabel.textContent = "Сохранено в браузере";
      sourceLabel.className = "pill remote";
      return;
    }

    sourceLabel.textContent = "Локально";
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
          <button type="button" class="setup-link-copy" data-copy-value="${escapeHtml(url)}">Копировать</button>
        </div>
      `;
    }).join("");

    linksContainer.querySelectorAll("[data-copy-value]").forEach((button) => {
      button.addEventListener("click", async () => {
        const value = button.getAttribute("data-copy-value") || "";
        try {
          await copyText(value);
          setStatus("Ссылка отделения скопирована.", false);
        } catch (_error) {
          window.prompt("Скопируйте эту ссылку", value);
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
      setStatus("Сначала введите Supabase URL и anon key.", true);
      return;
    }

    const baseUrl = runtimeConfig.supabaseUrl.replace(/\/+$/, "");
    const endpoint = `${baseUrl}/functions/v1/${runtimeConfig.functionName}`;
    const accessToken = window.SHARSH_AUTH && typeof window.SHARSH_AUTH.getAccessToken === "function"
      ? window.SHARSH_AUTH.getAccessToken()
      : "";

    setStatus("Проверяю подключение к серверу...", false);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          apikey: runtimeConfig.supabaseAnonKey,
          Authorization: `Bearer ${accessToken || runtimeConfig.supabaseAnonKey}`
        }
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
      }

      const rowCount = payload && Array.isArray(payload.rows) ? payload.rows.length : 0;
      setStatus(`Подключение работает. Сервер вернул ${rowCount} строк отделений.`, false);
    } catch (error) {
      setStatus(
        error instanceof Error ? `Ошибка подключения: ${error.message}` : "Ошибка подключения.",
        true
      );
    }
  }

  function saveBrowserConfig() {
    const runtimeConfig = buildFormConfig();
    if (runtimeConfig.syncMode === "supabase-function") {
      runtimeMeta.saveStoredConfig(runtimeConfig);
      setStatus("Настройки интернет-синхронизации сохранены в этом браузере.", false);
    } else {
      runtimeMeta.clearStoredConfig();
      setStatus("Браузер возвращён в локальный режим.", false);
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
    if (fields.requireOwnerAuth) {
      fields.requireOwnerAuth.checked = false;
    }

    updateGeneratedLinks();
    updateSourceLabel();
    setStatus("Сохранённые настройки синхронизации удалены.", false);
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
    if (fields.requireOwnerAuth) {
      fields.requireOwnerAuth.checked = runtime.requireOwnerAuth !== false;
    }
  }

  async function init() {
    if (window.SHARSH_AUTH_READY) {
      await window.SHARSH_AUTH_READY;
    }

    prefillFields();
    updateSourceLabel();
    updateGeneratedLinks();
    setStatus("Введите значения Supabase, проверьте подключение, затем откройте главную ссылку.", false);

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
  }

  init();
})();
