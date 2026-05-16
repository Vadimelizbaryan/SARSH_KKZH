(function () {
  const config = window.SHARSH_CONFIG || {};
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const telegram = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const root = document.getElementById("tg-night-form-root")
    || document.getElementById("tg-day-form-root")
    || document.getElementById("tg-discharge-form-root");
  const mode = root && root.dataset.shift === "day" ? "day"
    : root && root.dataset.shift === "discharge" ? "discharge"
      : "night";

  const columns = [
    { key: "shar", label: "ՇԱՐ" },
    { key: "spa", label: "ՍՊԱ" },
    { key: "paym", label: "ՊԱՅՄ" },
    { key: "zh", label: "Զ/Հ" },
    { key: "family", label: "Զ/Ծ ԸՆՏ" },
    { key: "zp", label: "Զ/Պ" },
    { key: "qi", label: "ք-ի" }
  ];

  const copy = mode === "day"
    ? {
      action: "day-form-submit",
      kicker: "Ցերեկային հերթափոխ",
      title: "Նոր ընդունվածներ",
      button: "Ուղարկել ամփոփումը",
      sending: "Ուղարկվում է...",
      saving: "Պահպանում եմ ցերեկային հերթափոխի տվյալները...",
      openWithBot: "Բացեք ձևը Telegram բոտի կոճակով։",
      hint: "Լրացրեք միայն այն բաժանմունքները, որտեղ ցերեկվա ընթացքում ընդունում է եղել։",
      success: "Շնորհակալություն։ Տվյալները պահպանվել են և ամփոփումը ուղարկվել է։",
      fail: "Չհաջողվեց ուղարկել ցերեկային ձևը։",
      aria: "Ցերեկային հերթափոխի աղյուսակ"
    }
    : mode === "discharge"
      ? {
        action: "discharge-form-submit",
        kicker: "Առավոտյան դուրսգրում",
        title: "Ստացիոնարից դուրս գրվածներ",
        button: "Ուղարկել ամփոփումը",
        sending: "Ուղարկվում է...",
        saving: "Պահպանում եմ առավոտյան դուրսգրման տվյալները...",
        openWithBot: "Բացեք ձևը Telegram բոտի կոճակով։",
        hint: "Լրացրեք միայն այն բաժանմունքները, որտեղ առավոտյան դուրսգրում է եղել։",
        success: "Շնորհակալություն։ Տվյալները պահպանվել են և ամփոփումը ուղարկվել է։",
        fail: "Չհաջողվեց ուղարկել առավոտյան դուրսգրման ձևը։",
        aria: "Առավոտյան դուրսգրման աղյուսակ"
      }
      : {
      action: "night-form-submit",
      kicker: "Գիշերային հերթափոխ",
      title: "Նոր ընդունվածներ",
      button: "Ուղարկել ամփոփումը",
      sending: "Ուղարկվում է...",
      saving: "Պահպանում եմ գիշերային հերթափոխի տվյալները...",
      openWithBot: "Բացեք ձևը Telegram բոտի կոճակով։",
      hint: "Լրացրեք միայն այն բաժանմունքները, որտեղ գիշերվա ընթացքում ընդունում է եղել։",
      success: "Շնորհակալություն։ Տվյալները պահպանվել են և ամփոփումը ուղարկվել է։",
      fail: "Չհաջողվեց ուղարկել գիշերային ձևը։",
      aria: "Գիշերային հերթափոխի աղյուսակ"
    };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getQuery() {
    return new URLSearchParams(window.location.search);
  }

  function getReportDateTime() {
    return getQuery().get("date") || getYerevanDateTime();
  }

  function getYerevanDateTime() {
    const parts = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Asia/Yerevan",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
  }

  function toNumber(value) {
    const parsed = Number.parseInt(String(value ?? "").replace(/\D+/g, ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 9999) : 0;
  }

  function getInitData() {
    return telegram && typeof telegram.initData === "string" ? telegram.initData : "";
  }

  function getEndpoint() {
    const baseUrl = String(runtime.supabaseUrl || "https://ywecvlapdlaojpvijaqy.supabase.co").replace(/\/+$/, "");
    return `${baseUrl}/functions/v1/Mainflow-telegram?action=${copy.action}`;
  }

  function getDepartments() {
    return Array.isArray(config.departmentDefinitions) ? config.departmentDefinitions : [];
  }

  function readRows() {
    const rows = {};
    getDepartments().forEach((department) => {
      rows[department.id] = {};
      columns.forEach((column) => {
        const input = root.querySelector(`[data-department="${department.id}"][data-key="${column.key}"]`);
        rows[department.id][column.key] = toNumber(input ? input.value : 0);
      });
    });
    return rows;
  }

  function readFilledRows() {
    const rows = readRows();
    return getDepartments()
      .map((department) => ({
        departmentId: department.id,
        values: rows[department.id] || {}
      }))
      .filter((item) => columns.some((column) => toNumber(item.values[column.key]) > 0));
  }

  function getRowTotal(departmentId) {
    return columns.reduce((sum, column) => {
      const input = root.querySelector(`[data-department="${departmentId}"][data-key="${column.key}"]`);
      return sum + toNumber(input ? input.value : 0);
    }, 0);
  }

  function getColumnTotal(key) {
    return getDepartments().reduce((sum, department) => {
      const input = root.querySelector(`[data-department="${department.id}"][data-key="${key}"]`);
      return sum + toNumber(input ? input.value : 0);
    }, 0);
  }

  function getGrandTotal() {
    return getDepartments().reduce((sum, department) => sum + getRowTotal(department.id), 0);
  }

  function updateTotals() {
    getDepartments().forEach((department) => {
      const target = root.querySelector(`[data-row-total="${department.id}"]`);
      if (target) {
        target.textContent = String(getRowTotal(department.id));
      }
    });
    columns.forEach((column) => {
      const target = root.querySelector(`[data-column-total="${column.key}"]`);
      if (target) {
        target.textContent = String(getColumnTotal(column.key));
      }
    });
    const grand = root.querySelector("[data-grand-total]");
    if (grand) {
      grand.textContent = String(getGrandTotal());
    }
  }

  async function submitForm(event) {
    event.preventDefault();
    const submit = root.querySelector("[data-submit]");
    const message = root.querySelector("[data-message]");

    if (submit) {
      submit.disabled = true;
      submit.textContent = copy.sending;
    }
    if (message) {
      message.className = "tg-form-message";
      message.textContent = copy.saving;
    }

    try {
      const response = await fetch(getEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(),
          reportDateTime: getReportDateTime(),
          rows: readRows(),
          filledRows: readFilledRows()
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(payload && payload.error ? payload.error : copy.fail);
      }
      if (message) {
        const countText = typeof payload.filledDepartments === "number"
          ? ` Լրացված բաժանմունքներ՝ ${payload.filledDepartments}։`
          : "";
        message.className = "tg-form-message success";
        message.textContent = `${copy.success}${countText}`;
      }
      if (telegram) {
        telegram.HapticFeedback && telegram.HapticFeedback.notificationOccurred("success");
        telegram.MainButton && telegram.MainButton.setText("Փակել").show().onClick(() => telegram.close());
      }
    } catch (error) {
      if (message) {
        message.className = "tg-form-message error";
        message.textContent = error instanceof Error ? error.message : copy.fail;
      }
      if (telegram && telegram.HapticFeedback) {
        telegram.HapticFeedback.notificationOccurred("error");
      }
      if (submit) {
        submit.disabled = false;
        submit.textContent = copy.button;
      }
    }
  }

  function renderRows() {
    return getDepartments().map((department) => `
      <tr>
        <th scope="row">
          <span class="tg-night-marker">${escapeHtml(department.marker)}</span>
          <strong>${escapeHtml(department.department)}</strong>
        </th>
        ${columns.map((column) => `
          <td>
            <input
              class="tg-form-input"
              data-department="${escapeHtml(department.id)}"
              data-key="${escapeHtml(column.key)}"
              inputmode="numeric"
              pattern="[0-9]*"
              type="text"
              autocomplete="off"
              maxlength="4"
              value="0"
              aria-label="${escapeHtml(`${department.marker} ${column.label}`)}"
            >
          </td>
        `).join("")}
        <td><span class="tg-form-control-value" data-row-total="${escapeHtml(department.id)}">0</span></td>
      </tr>
    `).join("");
  }

  function render() {
    if (!root) {
      return;
    }

    const headerCells = columns.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join("");
    const totalCells = columns
      .map((column) => `<td data-column-total="${escapeHtml(column.key)}">0</td>`)
      .join("");

    root.innerHTML = `
      <section class="tg-form-card tg-night-card">
        <header class="tg-form-head">
          <div>
            <p class="tg-form-kicker">${escapeHtml(copy.kicker)}</p>
            <h1 class="tg-form-title">${escapeHtml(copy.title)}</h1>
          </div>
          <div class="tg-form-meta">
            <span class="tg-form-pill">${escapeHtml(getReportDateTime())}</span>
            <span class="tg-form-pill">Telegram ձև</span>
          </div>
        </header>

        <form data-form>
          <div class="tg-form-table-wrap tg-night-table-wrap" aria-label="${escapeHtml(copy.aria)}">
            <table class="tg-form-table tg-night-table">
              <thead>
                <tr>
                  <th scope="col">Բաժանմունք</th>
                  ${headerCells}
                  <th scope="col">Ընդհ</th>
                </tr>
              </thead>
              <tbody>${renderRows()}</tbody>
              <tfoot>
                <tr>
                  <th scope="row">Ընդհ</th>
                  ${totalCells}
                  <td data-grand-total>0</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="tg-form-actions">
            <button class="tg-form-submit" data-submit type="submit">${escapeHtml(copy.button)}</button>
            <div class="tg-form-message${getInitData() ? "" : " error"}" data-message>
              ${getInitData() ? escapeHtml(copy.hint) : escapeHtml(copy.openWithBot)}
            </div>
          </div>
        </form>
      </section>
    `;

    root.querySelectorAll(".tg-form-input").forEach((input) => {
      input.addEventListener("input", () => {
        const digitsOnly = input.value.replace(/\D+/g, "").slice(0, 4);
        if (input.value !== digitsOnly) {
          input.value = digitsOnly;
        }
        updateTotals();
      });
      input.addEventListener("focus", () => input.select());
    });
    const form = root.querySelector("[data-form]");
    if (form) {
      form.addEventListener("submit", submitForm);
    }
    updateTotals();
  }

  if (telegram) {
    telegram.ready();
    telegram.expand();
  }

  render();
})();
