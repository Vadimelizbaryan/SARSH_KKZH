(function () {
  const telegram = window.Telegram && window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;
  const desktopHost =
    window.SONO_DESKTOP_HOST && typeof window.SONO_DESKTOP_HOST === "object"
      ? window.SONO_DESKTOP_HOST
      : null;
  const root = document.getElementById("tg-sono-root");
  const mode = desktopHost ? "desktop" : "telegram";
  let telegramViewportListenerAttached = false;
  let desktopListenerAttached = false;
  let desktopUiState = {
    lastDownload: null,
    messageElement: null,
    manualDownloadButton: null,
    openFolderButton: null,
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getFunctionBaseUrl() {
    if (desktopHost && desktopHost.functionBaseUrl) {
      return String(desktopHost.functionBaseUrl).replace(/\/+$/, "");
    }
    const runtime = window.SHARSH_RUNTIME_CONFIG || {};
    const baseUrl = String(
      runtime.supabaseUrl || "https://ywecvlapdlaojpvijaqy.supabase.co",
    ).replace(/\/+$/, "");
    return `${baseUrl}/functions/v1/Mainflow-telegram`;
  }

  function getActionUrl(action) {
    const url = new URL(getFunctionBaseUrl());
    url.searchParams.set("action", action);
    return url.toString();
  }

  function getInitData() {
    return telegram && typeof telegram.initData === "string"
      ? telegram.initData
      : "";
  }

  function getDesktopDeviceId() {
    return desktopHost && desktopHost.deviceId
      ? String(desktopHost.deviceId).trim()
      : "";
  }

  function getDesktopDeviceName() {
    return desktopHost && desktopHost.deviceName
      ? String(desktopHost.deviceName).trim()
      : "SONO Desktop";
  }

  function syncViewportHeight() {
    const viewportHeight = telegram &&
        typeof telegram.viewportHeight === "number" &&
        telegram.viewportHeight > 0
      ? telegram.viewportHeight
      : window.innerHeight;
    document.documentElement.style.setProperty(
      "--sono-vh",
      `${Math.max(360, Math.round(viewportHeight || 0))}px`,
    );
  }

  function maximizeTelegramWebApp() {
    syncViewportHeight();
    if (!telegram) {
      return;
    }

    telegram.ready();
    if (typeof telegram.expand === "function") {
      telegram.expand();
    }
    if (typeof telegram.disableVerticalSwipes === "function") {
      telegram.disableVerticalSwipes();
    }
    if (
      !telegramViewportListenerAttached &&
      typeof telegram.onEvent === "function"
    ) {
      telegram.onEvent("viewportChanged", syncViewportHeight);
      telegramViewportListenerAttached = true;
    }
    if (typeof telegram.requestFullscreen === "function") {
      setTimeout(function () {
        try {
          telegram.requestFullscreen();
        } catch (_error) {
          // Ignore clients that do not allow fullscreen requests.
        }
      }, 80);
    }
  }

  function decodeBase64ToBytes(base64) {
    const normalized = String(base64 || "").trim();
    if (!normalized) {
      return new Uint8Array();
    }

    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function triggerBrowserDownload(fileName, mimeType, fileBase64) {
    const bytes = decodeBase64ToBytes(fileBase64);
    if (!bytes.length) {
      return false;
    }

    const blob = new Blob([bytes], {
      type: mimeType ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName || "Sono.docx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(blobUrl);
    }, 1500);
    return true;
  }

  function renderError(message) {
    root.innerHTML = `
      <section class="tg-sono-card">
        <p class="tg-sono-kicker">${
      mode === "desktop" ? "SONO Desktop" : "SARSH_KKZH"
    }</p>
        <h1 class="tg-sono-title">Форма недоступна</h1>
        <p class="tg-sono-message tg-sono-message--error">${
      escapeHtml(message)
    }</p>
      </section>
    `;
  }

  function renderLoading(message) {
    root.innerHTML = `
      <section class="tg-sono-card tg-sono-card--loading">
        <p class="tg-sono-kicker">${
      mode === "desktop" ? "SONO Desktop" : "SARSH_KKZH"
    }</p>
        <h1 class="tg-sono-title">Перевод УЗИ</h1>
        <p class="tg-sono-muted">${escapeHtml(message)}</p>
      </section>
    `;
  }

  function renderApprovalPending(message) {
    root.innerHTML = `
      <section class="tg-sono-card">
        <header class="tg-sono-head">
          <div>
            <p class="tg-sono-kicker">SONO Desktop</p>
            <h1 class="tg-sono-title">Ожидается подтверждение</h1>
          </div>
          <p class="tg-sono-badge">Компьютер: ${
      escapeHtml(getDesktopDeviceName())
    }</p>
        </header>

        <div class="tg-sono-note">
          <strong>Что происходит:</strong>
          <span>${escapeHtml(message)}</span>
        </div>

        <div class="tg-sono-footnote">
          <span>После однократного подтверждения через Telegram эта программа будет работать без повторного запроса доступа на этом компьютере.</span>
        </div>

        <div class="tg-sono-actions">
          <button class="tg-sono-submit" type="button" data-recheck>Проверить снова</button>
          <p class="tg-sono-message">Если подтверждение уже нажато в Telegram, просто повторите проверку.</p>
        </div>
      </section>
    `;

    const recheckButton = root.querySelector("[data-recheck]");
    recheckButton.addEventListener("click", function () {
      initDesktop();
    });
  }

  function setMessageState(messageElement, kind, text) {
    if (!messageElement) {
      return;
    }
    messageElement.className = kind
      ? `tg-sono-message ${kind}`
      : "tg-sono-message";
    messageElement.textContent = text;
  }

  function postDesktopMessage(payload) {
    if (
      !window.chrome || !window.chrome.webview ||
      typeof window.chrome.webview.postMessage !== "function"
    ) {
      return false;
    }
    window.chrome.webview.postMessage(payload);
    return true;
  }

  function attachDesktopHostListener() {
    if (
      desktopListenerAttached || !window.chrome || !window.chrome.webview ||
      typeof window.chrome.webview.addEventListener !== "function"
    ) {
      return;
    }
    window.chrome.webview.addEventListener("message", function (event) {
      const payload = event && event.data ? event.data : null;
      if (!payload || typeof payload !== "object") {
        return;
      }
      const type = typeof payload.type === "string" ? payload.type : "";
      if (type === "sono-save-complete") {
        if (desktopUiState.openFolderButton) {
          desktopUiState.openFolderButton.hidden = false;
        }
        setMessageState(
          desktopUiState.messageElement,
          "tg-sono-message--success",
          payload.savedPath
            ? `Готово. Word сохранен в Downloads: ${
              payload.fileName || "Sono.docx"
            }`
            : "Готово. Word сохранен в папку Downloads.",
        );
      } else if (type === "sono-save-failed") {
        if (desktopUiState.manualDownloadButton) {
          desktopUiState.manualDownloadButton.hidden =
            desktopUiState.lastDownload ? false : true;
        }
        setMessageState(
          desktopUiState.messageElement,
          "tg-sono-message--error",
          payload.error
            ? `Не удалось сохранить Word в Downloads: ${payload.error}`
            : "Не удалось автоматически сохранить Word в Downloads.",
        );
      }
    });
    desktopListenerAttached = true;
  }

  async function loadTelegramConfig() {
    const response = await fetch(getActionUrl("sono-config"));
    const payload = await response.json().catch(() => null);
    if (
      !response.ok || !payload || payload.ok !== true ||
      !Array.isArray(payload.clinics) || !payload.clinics.length
    ) {
      throw new Error(
        payload && payload.error
          ? payload.error
          : "Не удалось загрузить список бланков.",
      );
    }
    return payload;
  }

  async function loadDesktopState() {
    const deviceId = getDesktopDeviceId();
    if (!deviceId) {
      throw new Error(
        "Компьютер не идентифицирован. Переустановите SONO Desktop.",
      );
    }

    const url = new URL(getActionUrl("sono-desktop-state"));
    url.searchParams.set("deviceId", deviceId);
    url.searchParams.set("deviceName", getDesktopDeviceName());
    const response = await fetch(url.toString());
    const payload = await response.json().catch(() => null);
    if (response.status === 202 && payload) {
      return {
        ok: false,
        status: "pending",
        message: payload.message || "Запрос доступа отправлен в Telegram.",
      };
    }
    if (response.status === 403 && payload) {
      return {
        ok: false,
        status: "blocked",
        message: payload.message || payload.error || "Доступ отклонен.",
      };
    }
    if (
      !response.ok || !payload || payload.ok !== true ||
      !Array.isArray(payload.clinics) || !payload.clinics.length
    ) {
      throw new Error(
        payload && (payload.message || payload.error)
          ? payload.message || payload.error
          : "Не удалось проверить доступ SONO Desktop.",
      );
    }
    return {
      ok: true,
      status: "approved",
      config: payload,
    };
  }

  function renderClinicOptions(clinics) {
    return clinics.map((clinic, index) => `
      <label class="tg-sono-clinic-option">
        <input type="radio" name="clinicId" value="${escapeHtml(clinic.id)}" ${
      index === 0 ? "checked" : ""
    }>
        <span class="tg-sono-clinic-card">
          <strong>${escapeHtml(clinic.label)}</strong>
          <small>${escapeHtml(clinic.hint || "Рабочий бланк клиники")}</small>
        </span>
      </label>
    `).join("");
  }

  function renderForm(config) {
    const defaultDate = String(config.defaultReportDate || "").trim() ||
      new Date().toISOString().slice(0, 10);
    const isDesktop = mode === "desktop";
    const badgeText = isDesktop
      ? "Word сохранится прямо в Downloads"
      : "Word вернется прямо в этот чат";
    const workflowText = isDesktop
      ? "Вы выбираете бланк клиники, вставляете русское заключение, а программа сохраняет готовый Word-файл на армянском в папку Downloads."
      : "Вы выбираете бланк клиники, вставляете русское заключение, а бот присылает готовый Word-файл уже на армянском языке.";
    const footnoteText = isDesktop
      ? "После перевода файл автоматически сохранится в папку Downloads этого компьютера. Ручное скачивание останется как запасной вариант."
      : "Готовый файл можно сразу печатать. Если у вас уже есть Word-файл, отправьте боту Sono.docx или Sono.doc.";

    root.innerHTML = `
      <section class="tg-sono-card">
        <header class="tg-sono-head">
          <div>
            <p class="tg-sono-kicker">${
      isDesktop ? "Desktop Word Workflow" : "Telegram Word Workflow"
    }</p>
            <h1 class="tg-sono-title">Перевод УЗИ на армянский</h1>
          </div>
          <p class="tg-sono-badge">${escapeHtml(badgeText)}</p>
        </header>

        <div class="tg-sono-note">
          <strong>Как это работает:</strong>
          <span>${escapeHtml(workflowText)}</span>
        </div>

        <form class="tg-sono-form" data-form>
          <section class="tg-sono-section">
            <div class="tg-sono-section-head">
              <h2>Бланк клиники</h2>
              <span>Доступно: ${config.clinics.length}</span>
            </div>
            <div class="tg-sono-clinic-grid">
              ${renderClinicOptions(config.clinics)}
            </div>
          </section>

          <section class="tg-sono-grid">
            <label class="tg-sono-field">
              <span>ФИО пациента</span>
              <input type="text" name="patientName" maxlength="180" placeholder="Необязательно">
            </label>

            <label class="tg-sono-field">
              <span>Дата документа</span>
              <input type="date" name="reportDate" value="${
      escapeHtml(defaultDate)
    }">
            </label>
          </section>

          <label class="tg-sono-field">
            <span>Название исследования</span>
            <input type="text" name="studyName" maxlength="220" placeholder="Например: УЗИ органов брюшной полости">
          </label>

          <label class="tg-sono-field">
            <span>Русское заключение</span>
            <textarea name="conclusionText" rows="11" maxlength="20000" placeholder="Вставьте сюда полное заключение на русском языке" required></textarea>
          </label>

          <div class="tg-sono-footnote">
            <span>${escapeHtml(footnoteText)}</span>
          </div>

          <div class="tg-sono-actions">
            <button class="tg-sono-submit" type="submit" data-submit>Перевести и получить Word</button>
            <button class="tg-sono-download" type="button" data-download hidden>Скачать Word вручную</button>
            <button class="tg-sono-download" type="button" data-open-folder ${
      isDesktop ? "hidden" : "hidden"
    }>Открыть папку Downloads</button>
            <p class="tg-sono-message" data-message>Форма готова к отправке.</p>
          </div>
        </form>
      </section>
    `;

    const form = root.querySelector("[data-form]");
    const submit = root.querySelector("[data-submit]");
    const download = root.querySelector("[data-download]");
    const openFolder = root.querySelector("[data-open-folder]");
    const message = root.querySelector("[data-message]");
    let lastDownload = null;

    desktopUiState = {
      lastDownload: null,
      messageElement: message,
      manualDownloadButton: download,
      openFolderButton: openFolder,
    };

    download.addEventListener("click", function () {
      if (!lastDownload) {
        return;
      }
      triggerBrowserDownload(
        lastDownload.fileName,
        lastDownload.mimeType,
        lastDownload.fileBase64,
      );
    });

    if (isDesktop) {
      openFolder.addEventListener("click", function () {
        postDesktopMessage({ type: "sono-open-downloads" });
      });
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!isDesktop && !getInitData()) {
        renderError(
          "Откройте форму из Telegram-бота, иначе отправка не сработает.",
        );
        return;
      }

      const formData = new FormData(form);
      const payload = {
        clinicId: formData.get("clinicId") || "",
        patientName: formData.get("patientName") || "",
        studyName: formData.get("studyName") || "",
        reportDate: formData.get("reportDate") || "",
        conclusionText: formData.get("conclusionText") || "",
      };

      if (isDesktop) {
        payload.deviceId = getDesktopDeviceId();
        payload.deviceName = getDesktopDeviceName();
      } else {
        payload.initData = getInitData();
      }

      if (!String(payload.conclusionText).trim()) {
        setMessageState(
          message,
          "tg-sono-message--error",
          "Сначала вставьте русское заключение.",
        );
        return;
      }

      submit.disabled = true;
      submit.textContent = "Перевожу...";
      download.hidden = true;
      openFolder.hidden = true;
      lastDownload = null;
      desktopUiState.lastDownload = null;
      setMessageState(
        message,
        "",
        isDesktop
          ? "Проверяю текст, перевожу и готовлю Word для сохранения в Downloads..."
          : "Проверяю текст и отправляю его на перевод...",
      );

      try {
        const response = await fetch(
          getActionUrl(
            isDesktop ? "sono-desktop-submit" : "sono-form-submit",
          ),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        const result = await response.json().catch(() => null);
        if (!response.ok || !result || result.ok !== true) {
          throw new Error(
            result && result.error
              ? result.error
              : "Не удалось подготовить документ.",
          );
        }

        const hasDirectDownload = result.fileName && result.fileBase64;
        const telegramDelivered = result.telegramDelivered !== false;
        if (hasDirectDownload) {
          lastDownload = {
            fileName: result.fileName,
            mimeType: result.mimeType,
            fileBase64: result.fileBase64,
          };
          desktopUiState.lastDownload = lastDownload;
          download.hidden = false;
        }

        submit.disabled = false;
        submit.textContent = "Перевести и получить Word";

        if (isDesktop) {
          if (
            hasDirectDownload && postDesktopMessage({
              type: "sono-save-file",
              fileName: result.fileName,
              mimeType: result.mimeType,
              fileBase64: result.fileBase64,
            })
          ) {
            setMessageState(
              message,
              "",
              "Перевод готов. Сохраняю Word в папку Downloads...",
            );
          } else if (hasDirectDownload) {
            const downloaded = triggerBrowserDownload(
              result.fileName,
              result.mimeType,
              result.fileBase64,
            );
            setMessageState(
              message,
              downloaded ? "tg-sono-message--success" : "",
              downloaded
                ? "Готово. Word скачан вручную через встроенный браузер."
                : "Готово. Нажмите «Скачать Word вручную».",
            );
          } else {
            setMessageState(
              message,
              "tg-sono-message--success",
              "Готово. Перевод подготовлен.",
            );
          }
          return;
        }

        setMessageState(
          message,
          "tg-sono-message--success",
          hasDirectDownload
            ? (() => {
              const downloaded = triggerBrowserDownload(
                result.fileName,
                result.mimeType,
                result.fileBase64,
              );
              if (!telegramDelivered) {
                return downloaded
                  ? "Готово. Telegram не прислал файл в чат, но Word уже скачан в браузер."
                  : "Готово. Telegram не прислал файл в чат. Нажмите «Скачать Word вручную».";
              }
              return downloaded
                ? "Готово. Бот отправил файл в чат, и Word уже скачивается в браузер."
                : "Готово. Бот отправил файл в чат. Если Telegram Web не скачивает его, нажмите «Скачать Word вручную».";
            })()
            : "Готово. Бот уже отправил Word-файл в этот чат.",
        );

        if (telegram) {
          if (telegram.HapticFeedback) {
            telegram.HapticFeedback.notificationOccurred("success");
          }
          if (telegram.MainButton) {
            telegram.MainButton.setText("Закрыть")
              .show()
              .onClick(function () {
                telegram.close();
              });
          }
        }
      } catch (error) {
        submit.disabled = false;
        submit.textContent = "Перевести и получить Word";
        setMessageState(
          message,
          "tg-sono-message--error",
          error instanceof Error
            ? error.message
            : "Не удалось подготовить документ.",
        );
        if (telegram && telegram.HapticFeedback) {
          telegram.HapticFeedback.notificationOccurred("error");
        }
      }
    });
  }

  async function initTelegram() {
    maximizeTelegramWebApp();
    renderLoading("Подключаю список бланков и готовлю форму...");
    const config = await loadTelegramConfig();
    renderForm(config);
  }

  async function initDesktop() {
    attachDesktopHostListener();
    renderLoading("Проверяю доступ этого компьютера и подключаю форму...");
    const state = await loadDesktopState();
    if (!state.ok) {
      if (state.status === "pending") {
        renderApprovalPending(state.message);
        return;
      }
      throw new Error(state.message || "Доступ SONO Desktop недоступен.");
    }
    renderForm(state.config);
  }

  async function init() {
    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight, { passive: true });

    if (!root) {
      return;
    }

    try {
      if (mode === "desktop") {
        await initDesktop();
      } else {
        await initTelegram();
      }
    } catch (error) {
      renderError(
        error instanceof Error ? error.message : "Не удалось открыть форму.",
      );
    }
  }

  init();
})();
