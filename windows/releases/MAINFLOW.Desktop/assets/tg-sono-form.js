(function () {
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const telegram = window.Telegram && window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;
  const root = document.getElementById("tg-sono-root");
  const SONO_SETUP_URL =
    "https://vadimelizbaryan.github.io/SARSH_KKZH/windows/releases/Sono.exe";
  let telegramViewportListenerAttached = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getFunctionBaseUrl() {
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
    if (!telegramViewportListenerAttached &&
      typeof telegram.onEvent === "function") {
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

  function openExternalUrl(url) {
    const href = String(url || "").trim();
    if (!href) {
      return;
    }

    if (telegram && typeof telegram.openLink === "function") {
      try {
        telegram.openLink(href);
        return;
      } catch (_error) {
        // Fall through to a regular browser open.
      }
    }

    window.open(href, "_blank", "noopener");
  }

  function renderError(message) {
    root.innerHTML = `
      <section class="tg-sono-card">
        <p class="tg-sono-kicker">SARSH_KKZH</p>
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
        <p class="tg-sono-kicker">SARSH_KKZH</p>
        <h1 class="tg-sono-title">Перевод УЗИ</h1>
        <p class="tg-sono-muted">${escapeHtml(message)}</p>
      </section>
    `;
  }

  async function loadConfig() {
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
    root.innerHTML = `
      <section class="tg-sono-card">
        <header class="tg-sono-head">
          <div>
            <p class="tg-sono-kicker">Telegram Word Workflow</p>
            <h1 class="tg-sono-title">Перевод УЗИ на армянский</h1>
          </div>
          <p class="tg-sono-badge">Word вернется прямо в этот чат</p>
        </header>

        <div class="tg-sono-note">
          <strong>Как это работает:</strong>
          <span>Вы выбираете бланк клиники, вставляете русское заключение, а бот присылает готовый Word-файл уже на армянском языке.</span>
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
            <span>Готовый файл можно сразу печатать. Если у вас уже есть Word-файл, отправьте боту <strong>Sono.docx</strong> или <strong>Sono.doc</strong>.</span>
          </div>

          <div class="tg-sono-setup">
            <div class="tg-sono-setup-copy">
              <strong>Нужна отдельная программа для Windows?</strong>
              <span>Из этой формы можно сразу открыть и скачать установщик <strong>SONO.exe</strong> на рабочий компьютер.</span>
            </div>
            <button class="tg-sono-download tg-sono-download--setup" type="button" data-setup-download>Скачать SONO.exe</button>
          </div>

          <div class="tg-sono-actions">
            <button class="tg-sono-submit" type="submit" data-submit>Перевести и получить Word</button>
            <button class="tg-sono-download" type="button" data-download hidden>Скачать Word сразу</button>
            <p class="tg-sono-message" data-message>Форма готова к отправке.</p>
          </div>
        </form>
      </section>
    `;

    const form = root.querySelector("[data-form]");
    const submit = root.querySelector("[data-submit]");
    const download = root.querySelector("[data-download]");
    const setupDownload = root.querySelector("[data-setup-download]");
    const message = root.querySelector("[data-message]");
    let lastDownload = null;

    if (setupDownload) {
      setupDownload.addEventListener("click", function () {
        openExternalUrl(SONO_SETUP_URL);
      });
    }

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

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!getInitData()) {
        renderError(
          "Откройте форму из Telegram-бота, иначе отправка не сработает.",
        );
        return;
      }

      const formData = new FormData(form);
      const payload = {
        initData: getInitData(),
        clinicId: formData.get("clinicId") || "",
        patientName: formData.get("patientName") || "",
        studyName: formData.get("studyName") || "",
        reportDate: formData.get("reportDate") || "",
        conclusionText: formData.get("conclusionText") || "",
      };

      if (!String(payload.conclusionText).trim()) {
        message.className = "tg-sono-message tg-sono-message--error";
        message.textContent = "Сначала вставьте русское заключение.";
        return;
      }

      submit.disabled = true;
      submit.textContent = "Перевожу...";
      download.hidden = true;
      lastDownload = null;
      message.className = "tg-sono-message";
      message.textContent = "Проверяю текст и отправляю его на перевод...";

      try {
        const response = await fetch(getActionUrl("sono-form-submit"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
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
          download.hidden = false;
        }

        message.className = "tg-sono-message tg-sono-message--success";
        if (hasDirectDownload) {
          const downloaded = triggerBrowserDownload(
            result.fileName,
            result.mimeType,
            result.fileBase64,
          );
          if (!telegramDelivered) {
            message.textContent = downloaded
              ? "Готово. Telegram не прислал файл в чат, но Word уже скачан в браузер."
              : "Готово. Telegram не прислал файл в чат. Нажмите «Скачать Word сразу».";
          } else {
            message.textContent = downloaded
              ? "Готово. Бот отправил файл в чат, и Word уже скачивается в браузер."
              : "Готово. Бот отправил файл в чат. Если Telegram Web не скачивает его, нажмите «Скачать Word сразу».";
          }
        } else {
          message.textContent = "Готово. Бот уже отправил Word-файл в этот чат.";
        }
        submit.textContent = "Готово";

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
        message.className = "tg-sono-message tg-sono-message--error";
        message.textContent = error instanceof Error
          ? error.message
          : "Не удалось подготовить документ.";
        submit.disabled = false;
        submit.textContent = "Перевести и получить Word";
        if (telegram && telegram.HapticFeedback) {
          telegram.HapticFeedback.notificationOccurred("error");
        }
      }
    });
  }

  async function init() {
    maximizeTelegramWebApp();
    window.addEventListener("resize", syncViewportHeight, { passive: true });

    if (!root) {
      return;
    }

    renderLoading("Подключаю список бланков и готовлю форму...");
    try {
      const config = await loadConfig();
      renderForm(config);
    } catch (error) {
      renderError(
        error instanceof Error ? error.message : "Не удалось открыть форму.",
      );
    }
  }

  init();
})();
