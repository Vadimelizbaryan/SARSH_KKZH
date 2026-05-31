(function () {
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const telegram = window.Telegram && window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;
  const root = document.getElementById("tg-sono-root");

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

          <div class="tg-sono-actions">
            <button class="tg-sono-submit" type="submit" data-submit>Перевести и получить Word</button>
            <p class="tg-sono-message" data-message>Форма готова к отправке.</p>
          </div>
        </form>
      </section>
    `;

    const form = root.querySelector("[data-form]");
    const submit = root.querySelector("[data-submit]");
    const message = root.querySelector("[data-message]");

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

        message.className = "tg-sono-message tg-sono-message--success";
        message.textContent = "Готово. Бот уже отправил Word-файл в этот чат.";
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
    if (telegram) {
      telegram.ready();
      telegram.expand();
    }

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
