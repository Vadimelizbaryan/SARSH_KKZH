(function () {
  const config = window.SHARSH_CONFIG || {};
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const telegram = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const root = document.getElementById("tg-civil-referrals-root");
  const pageSize = 20;
  const dateFieldKeys = new Set(["referralDate", "dischargeDate"]);
  const fields = [
    { key: "patientName", label: "Ա.Ա.Հ.", wide: true },
    { key: "medicalCenter", label: "ԲԿ", wide: true },
    { key: "militaryUnit", label: "Զորամաս" },
    { key: "rank", label: "Կոչում" },
    { key: "draftYear", label: "Զորակ" },
    { key: "birthYear", label: "Ծնված" },
    { key: "referralDate", label: "Ուղեգրման" },
    { key: "dischargeDate", label: "Դուրսգրում" }
  ];
  const state = {
    rows: [],
    total: 0,
    offset: 0,
    query: "",
    searchDraft: "",
    isBusy: false,
    message: "",
    messageType: ""
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getInitData() {
    return telegram && telegram.initData ? telegram.initData : "";
  }

  function getEndpoint(action) {
    const baseUrl = String(runtime.supabaseUrl || config.SUPABASE_URL || "").replace(/\/+$/, "");
    if (!baseUrl) {
      throw new Error("Supabase URL-ը կարգավորված չէ։");
    }
    return `${baseUrl}/functions/v1/Mainflow-telegram?action=${encodeURIComponent(action)}`;
  }

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/\u0000/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\r\n]+/g, " ")
      .trim();
  }

  function normalizeDate(value) {
    const text = normalizeText(value)
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
      return text;
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

  function normalizeRows(rows) {
    return Array.isArray(rows)
      ? rows.map((row) => {
        const output = { id: normalizeText(row && row.id) };
        fields.forEach((field) => {
          output[field.key] = dateFieldKeys.has(field.key)
            ? normalizeDate(row && row[field.key])
            : normalizeText(row && row[field.key]);
        });
        output.importedAt = normalizeText(row && row.importedAt);
        output.updatedAt = normalizeText(row && row.updatedAt);
        output.sourceFileName = normalizeText(row && row.sourceFileName);
        output.sourceRow = row && Number.isFinite(Number(row.sourceRow)) ? Math.max(0, Math.trunc(Number(row.sourceRow))) : null;
        return output;
      })
      : [];
  }

  function setMessage(message, type = "") {
    state.message = message;
    state.messageType = type;
  }

  async function requestServer(action, body) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(getEndpoint(action), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), ...body }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok === false) {
        throw new Error(payload && payload.error ? payload.error : "Սերվերը չընդունեց հարցումը։");
      }
      return payload;
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("Կապը երկար տևեց։ Փորձեք կրկին։");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function loadRows(offset = state.offset, query = state.query) {
    if (!getInitData()) {
      setMessage("Բացեք այս ձևը Telegram բոտի կոճակով։", "error");
      render();
      return;
    }
    state.isBusy = true;
    setMessage("Բեռնվում է...", "");
    render();
    try {
      const payload = await requestServer("civil-referrals-load", {
        limit: pageSize,
        offset,
        query
      });
      state.rows = normalizeRows(payload.rows);
      state.total = Math.max(0, Number(payload.total) || 0);
      state.offset = Math.max(0, Number(payload.offset) || 0);
      state.query = normalizeText(payload.query || query);
      state.searchDraft = state.query;
      setMessage(state.rows.length ? "Տողերը բեռնված են։ Կարող եք խմբագրել և պահպանել։" : "Այս որոնմամբ տողեր չկան։", state.rows.length ? "success" : "");
      if (telegram && telegram.HapticFeedback) {
        telegram.HapticFeedback.notificationOccurred("success");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Չհաջողվեց բեռնել բազան։", "error");
      if (telegram && telegram.HapticFeedback) {
        telegram.HapticFeedback.notificationOccurred("error");
      }
    } finally {
      state.isBusy = false;
      render();
    }
  }

  async function saveRows() {
    if (!state.rows.length || state.isBusy) {
      return;
    }
    state.isBusy = true;
    setMessage("Պահպանվում է...", "");
    render();
    try {
      const payload = await requestServer("civil-referrals-save", {
        rows: state.rows,
        limit: pageSize,
        offset: state.offset,
        query: state.query
      });
      state.rows = normalizeRows(payload.rows);
      state.total = Math.max(0, Number(payload.total) || state.total);
      state.offset = Math.max(0, Number(payload.offset) || state.offset);
      setMessage(payload.message || "Փոփոխությունները պահպանված են։", "success");
      if (telegram && telegram.HapticFeedback) {
        telegram.HapticFeedback.notificationOccurred("success");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Չհաջողվեց պահպանել։", "error");
      if (telegram && telegram.HapticFeedback) {
        telegram.HapticFeedback.notificationOccurred("error");
      }
    } finally {
      state.isBusy = false;
      render();
    }
  }

  function renderPagination() {
    const start = state.total ? state.offset + 1 : 0;
    const end = Math.min(state.offset + state.rows.length, state.total);
    return `
      <div class="tg-civil-pagination">
        <button type="button" data-page="prev" ${state.offset <= 0 || state.isBusy ? "disabled" : ""}>Նախորդ</button>
        <span>${escapeHtml(`${start}-${end} / ${state.total}`)}</span>
        <button type="button" data-page="next" ${state.offset + pageSize >= state.total || state.isBusy ? "disabled" : ""}>Հաջորդ</button>
      </div>
    `;
  }

  function renderTable() {
    if (!state.rows.length) {
      return `<div class="tg-civil-empty">Տվյալներ չկան։</div>`;
    }
    return `
      <div class="tg-form-table-wrap tg-civil-table-wrap">
        <table class="tg-form-table tg-civil-table">
          <colgroup>
            <col class="tg-civil-col-index">
            ${fields.map((field) => `<col class="tg-civil-col-${escapeHtml(field.key)}">`).join("")}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">#</th>
              ${fields.map((field) => `<th scope="col" class="${field.wide ? "tg-civil-wide-head" : ""}">${escapeHtml(field.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${state.rows.map((row, rowIndex) => `
              <tr>
                <th scope="row">${state.offset + rowIndex + 1}</th>
                ${fields.map((field) => `
                  <td class="${field.wide ? "tg-civil-wide-cell" : ""}">
                    <input
                      class="tg-civil-input${dateFieldKeys.has(field.key) ? " tg-civil-date-input" : ""}"
                      data-row="${rowIndex}"
                      data-key="${escapeHtml(field.key)}"
                      value="${escapeHtml(row[field.key])}"
                      ${dateFieldKeys.has(field.key) ? 'inputmode="numeric" maxlength="10" placeholder="օր.ամ.տտ"' : 'type="text"'}
                      autocomplete="off"
                    >
                  </td>
                `).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function render() {
    if (!root) {
      return;
    }
    root.innerHTML = `
      <section class="tg-form-card tg-civil-card">
        <header class="tg-form-head">
          <div>
            <p class="tg-form-kicker">Քաղ. ԲԿ բազա</p>
            <h1 class="tg-form-title">Ուղեգրումների բազա</h1>
            <p class="tg-form-muted">Փնտրեք, խմբագրեք և պահպանեք բազայի տողերը։</p>
          </div>
          <div class="tg-form-meta">
            <span class="tg-form-pill">Telegram ձև</span>
            <span class="tg-form-pill">${escapeHtml(`${state.total} տող`)}</span>
          </div>
        </header>

        <div class="tg-civil-toolbar">
          <input id="tgCivilSearchInput" class="tg-civil-search" type="search" value="${escapeHtml(state.searchDraft)}" placeholder="Որոնում՝ ԱԱՀ, ԲԿ, զորամաս, ամսաթիվ...">
          <button id="tgCivilSearchBtn" class="tg-civil-search-btn" type="button" ${state.isBusy ? "disabled" : ""} aria-label="Որոնել">⌕</button>
        </div>

        ${renderPagination()}
        ${renderTable()}
        ${renderPagination()}

        <div class="tg-form-actions tg-civil-actions">
          <button id="tgCivilSaveBtn" class="tg-form-submit" type="button" ${state.isBusy || !state.rows.length ? "disabled" : ""}>
            ${state.isBusy ? "Սպասեք..." : "Պահպանել փոփոխությունները"}
          </button>
          <div class="tg-form-message ${state.messageType}" data-message>${escapeHtml(state.message)}</div>
        </div>
      </section>
    `;
    bindEvents();
  }

  function bindEvents() {
    const searchInput = document.getElementById("tgCivilSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        state.searchDraft = event.target.value;
      });
      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          loadRows(0, state.searchDraft);
        }
      });
    }
    document.getElementById("tgCivilSearchBtn")?.addEventListener("click", () => {
      loadRows(0, state.searchDraft);
    });
    document.getElementById("tgCivilSaveBtn")?.addEventListener("click", saveRows);
    root.querySelectorAll("[data-page]").forEach((button) => {
      button.addEventListener("click", () => {
        const direction = button.getAttribute("data-page");
        const nextOffset = direction === "prev"
          ? Math.max(0, state.offset - pageSize)
          : state.offset + pageSize;
        loadRows(nextOffset, state.query);
      });
    });
    root.querySelectorAll(".tg-civil-input").forEach((input) => {
      input.addEventListener("input", () => {
        const rowIndex = Number(input.getAttribute("data-row"));
        const key = input.getAttribute("data-key");
        if (!state.rows[rowIndex] || !key) {
          return;
        }
        if (dateFieldKeys.has(key)) {
          input.value = input.value.replace(/[^\d.,/-]/g, "").slice(0, 10);
        }
        state.rows[rowIndex][key] = input.value;
      });
      input.addEventListener("blur", () => {
        const rowIndex = Number(input.getAttribute("data-row"));
        const key = input.getAttribute("data-key");
        if (!state.rows[rowIndex] || !key) {
          return;
        }
        const normalized = dateFieldKeys.has(key)
          ? normalizeDate(input.value)
          : normalizeText(input.value);
        input.value = normalized;
        state.rows[rowIndex][key] = normalized;
      });
    });
  }

  if (telegram) {
    telegram.ready();
    telegram.expand();
  }

  render();
  loadRows(0, "");
})();
