(function () {
  const config = window.SHARSH_CONFIG || {};
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const telegram = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const root = document.getElementById("tg-civil-referrals-root");
  const pageSize = 20;
  const documentExportLimit = 1000;
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
    selectedIds: [],
    newRow: createEmptyRecord(),
    isBusy: false,
    message: "",
    messageType: ""
  };

  function createEmptyRecord() {
    return fields.reduce((record, field) => {
      record[field.key] = "";
      return record;
    }, {});
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&")
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

  function getRowId(row) {
    return normalizeText(row && row.id);
  }

  function pruneSelectedIds() {
    const visibleIds = new Set(state.rows.map(getRowId).filter(Boolean));
    state.selectedIds = state.selectedIds.filter((id) => visibleIds.has(id));
  }

  function updateSelectedId(id, isSelected) {
    const cleanId = normalizeText(id);
    if (!cleanId) {
      return;
    }
    const selected = new Set(state.selectedIds);
    if (isSelected) {
      selected.add(cleanId);
    } else {
      selected.delete(cleanId);
    }
    state.selectedIds = [...selected];
  }

  function padTwo(value) {
    return String(value).padStart(2, "0");
  }

  function formatDocumentDateTime(date = new Date()) {
    return `${padTwo(date.getDate())}.${padTwo(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)},${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
  }

  function getDocumentFileName() {
    return `Քաղ_ԲԿ_բազա_${formatDocumentDateTime().replace(/[.:,]/g, "-")}.doc`;
  }

  function getDocumentFields(rows) {
    const hasDischargeDate = rows.some((row) => normalizeText(row && row.dischargeDate));
    return fields.filter((field) => {
      return hasDischargeDate
        ? field.key !== "referralDate"
        : field.key !== "dischargeDate";
    });
  }

  function getDocumentColumnClass(field) {
    if (field.key === "patientName") {
      return "patient";
    }
    if (field.key === "medicalCenter") {
      return "center";
    }
    if (field.key === "militaryUnit") {
      return "unit";
    }
    if (field.key === "rank") {
      return "rank";
    }
    if (field.key === "referralDate" || field.key === "dischargeDate") {
      return "date";
    }
    return "short";
  }

  function buildDocumentHtml(rows) {
    const generatedAt = formatDocumentDateTime();
    const documentFields = getDocumentFields(rows);
    const searchText = normalizeText(state.query || state.searchDraft);
    const metaText = searchText ? `Որոնում՝ ${searchText}` : "Բոլոր ցուցադրված տողերը";
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Քաղ. ԲԿ բազա</title>
  <style>
    @page { size: 29.7cm 21cm; margin: 1.1cm; }
    body { font-family: "Times New Roman", "Sylfaen", serif; color: #000; font-size: 11pt; }
    h1 { margin: 0 0 8px; text-align: center; font-size: 18pt; }
    .meta { width: 100%; margin: 0 0 10px; border-collapse: collapse; }
    .meta td { border: 0; padding: 0 0 6px; font-size: 10pt; }
    .meta .right { text-align: right; }
    table.referrals { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.referrals th, table.referrals td { border: 1px solid #000; padding: 4px 5px; vertical-align: middle; }
    table.referrals th { background: #f6c894; text-align: center; font-weight: 700; }
    table.referrals td:nth-child(2) { font-weight: 700; }
    col.num { width: 0.8cm; }
    col.patient { width: 6.3cm; }
    col.center { width: 3.9cm; }
    col.unit { width: 3.2cm; }
    col.rank { width: 2.7cm; }
    col.short { width: 1.6cm; }
    col.date { width: 2.3cm; }
  </style>
</head>
<body>
  <h1>Քաղաքացիական հիվանդանոցներ</h1>
  <table class="meta">
    <tr>
      <td>${escapeHtml(metaText)}</td>
      <td class="right">Ստեղծվել է՝ ${escapeHtml(generatedAt)}</td>
    </tr>
  </table>
  <table class="referrals">
    <colgroup>
      <col class="num">
      ${documentFields.map((field) => `<col class="${getDocumentColumnClass(field)}">`).join("")}
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        ${documentFields.map((field) => `<th>${escapeHtml(field.label)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows.map((row, index) => `
        <tr>
          <td style="text-align:center;">${index + 1}</td>
          ${documentFields.map((field) => `<td>${escapeHtml(row[field.key] || "")}</td>`).join("")}
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  async function loadDocumentRows() {
    const payload = await requestServer("civil-referrals-load", {
      limit: documentExportLimit,
      offset: 0,
      query: state.query || state.searchDraft
    });
    return normalizeRows(payload.rows);
  }

  function downloadWordDocument(rows) {
    const blob = new Blob([`\ufeff${buildDocumentHtml(rows)}`], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getDocumentFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printDocument(rows, printWindow) {
    const targetWindow = printWindow || window.open("", "_blank");
    if (!targetWindow) {
      setMessage("Telegram-ը արգելափակեց տպման պատուհանը։ Փորձեք Word ֆայլը պահպանել։", "error");
      render();
      return;
    }
    targetWindow.document.open();
    targetWindow.document.write(buildDocumentHtml(rows));
    targetWindow.document.close();
    targetWindow.focus();
    targetWindow.setTimeout(() => targetWindow.print(), 350);
  }

  function setMessage(message, type = "") {
    state.message = message;
    state.messageType = type;
  }

  function confirmAction(message) {
    return new Promise((resolve) => {
      if (telegram && typeof telegram.showConfirm === "function") {
        telegram.showConfirm(message, (confirmed) => resolve(Boolean(confirmed)));
        return;
      }
      resolve(window.confirm(message));
    });
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
      pruneSelectedIds();
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
      pruneSelectedIds();
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

  function normalizeFieldValue(key, value, commit = false) {
    if (dateFieldKeys.has(key)) {
      return commit
        ? normalizeDate(value)
        : normalizeText(value).replace(/[^\d.,/-]/g, "").slice(0, 10);
    }
    return normalizeText(value);
  }

  function getNormalizedNewRow() {
    return fields.reduce((record, field) => {
      record[field.key] = normalizeFieldValue(field.key, state.newRow[field.key], true);
      return record;
    }, {});
  }

  async function saveNewRow() {
    if (state.isBusy) {
      return;
    }
    const row = getNormalizedNewRow();
    if (!row.patientName || !row.medicalCenter) {
      setMessage("Նոր տողի համար լրացրեք առնվազն Ա.Ա.Հ. և ԲԿ դաշտերը։", "error");
      render();
      return;
    }
    state.isBusy = true;
    setMessage("Նոր տողը պահպանվում է...", "");
    render();
    try {
      const payload = await requestServer("civil-referrals-save", {
        rows: [row],
        limit: pageSize,
        offset: 0,
        query: ""
      });
      state.rows = normalizeRows(payload.rows);
      state.total = Math.max(0, Number(payload.total) || state.total);
      state.offset = Math.max(0, Number(payload.offset) || 0);
      state.query = normalizeText(payload.query || "");
      state.searchDraft = state.query;
      state.newRow = createEmptyRecord();
      state.selectedIds = [];
      setMessage(payload.message || "Նոր տողը պահպանված է։", "success");
      if (telegram && telegram.HapticFeedback) {
        telegram.HapticFeedback.notificationOccurred("success");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Չհաջողվեց պահպանել նոր տողը։", "error");
      if (telegram && telegram.HapticFeedback) {
        telegram.HapticFeedback.notificationOccurred("error");
      }
    } finally {
      state.isBusy = false;
      render();
    }
  }

  async function exportCurrentDocument() {
    if (state.isBusy) {
      return;
    }
    state.isBusy = true;
    setMessage("Պատրաստում եմ Word ֆայլը...", "");
    render();
    try {
      const rows = await loadDocumentRows();
      if (!rows.length) {
        setMessage("Այս որոնմամբ պահպանելու տողեր չկան։", "error");
        return;
      }
      downloadWordDocument(rows);
      setMessage(`Word ֆայլը պատրաստ է՝ ${rows.length} տող։`, "success");
      if (telegram && telegram.HapticFeedback) {
        telegram.HapticFeedback.notificationOccurred("success");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Չհաջողվեց պատրաստել Word ֆայլը։", "error");
      if (telegram && telegram.HapticFeedback) {
        telegram.HapticFeedback.notificationOccurred("error");
      }
    } finally {
      state.isBusy = false;
      render();
    }
  }

  async function printCurrentDocument() {
    if (state.isBusy) {
      return;
    }
    const printWindow = window.open("", "_blank");
    state.isBusy = true;
    setMessage("Պատրաստում եմ տպման ֆայլը...", "");
    render();
    try {
      const rows = await loadDocumentRows();
      if (!rows.length) {
        if (printWindow) {
          printWindow.close();
        }
        setMessage("Այս որոնմամբ տպելու տողեր չկան։", "error");
        return;
      }
      printDocument(rows, printWindow);
      setMessage(`Տպման փաստաթուղթը բացված է՝ ${rows.length} տող։`, "success");
    } catch (error) {
      if (printWindow) {
        printWindow.close();
      }
      setMessage(error instanceof Error ? error.message : "Չհաջողվեց բացել տպումը։", "error");
    } finally {
      state.isBusy = false;
      render();
    }
  }

  async function deleteSelectedRows() {
    const ids = [...new Set(state.selectedIds.map(normalizeText).filter(Boolean))];
    if (!ids.length || state.isBusy) {
      return;
    }
    const confirmed = await confirmAction(ids.length === 1
      ? "Ջնջե՞լ ընտրված տողը։"
      : `Ջնջե՞լ ընտրված ${ids.length} տողերը։`);
    if (!confirmed) {
      return;
    }

    state.isBusy = true;
    setMessage("Ջնջվում է...", "");
    render();
    try {
      const payload = await requestServer("civil-referrals-delete", {
        ids,
        limit: pageSize,
        offset: state.offset,
        query: state.query
      });
      state.selectedIds = [];
      state.rows = normalizeRows(payload.rows);
      state.total = Math.max(0, Number(payload.total) || 0);
      state.offset = Math.max(0, Number(payload.offset) || 0);
      state.query = normalizeText(payload.query || state.query);
      state.searchDraft = state.query;
      if (!state.rows.length && state.total > 0 && state.offset > 0) {
        await loadRows(Math.max(0, state.offset - pageSize), state.query);
        return;
      }
      setMessage(payload.message || `Ջնջված է՝ ${payload.deleted || ids.length} տող։`, "success");
      if (telegram && telegram.HapticFeedback) {
        telegram.HapticFeedback.notificationOccurred("success");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Չհաջողվեց ջնջել ընտրված տողերը։", "error");
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

  function renderNewRowForm() {
    return `
      <section class="tg-civil-new-row">
        <div class="tg-civil-new-head">
          <strong>Նոր տող</strong>
          <span>Լրացրեք տվյալները և պահպանեք բազայում։</span>
        </div>
        <div class="tg-civil-new-grid">
          ${fields.map((field) => `
            <label class="tg-civil-new-field ${field.key === "patientName" ? "is-wide" : ""}">
              <span>${escapeHtml(field.label)}</span>
              <input
                class="tg-civil-new-input${dateFieldKeys.has(field.key) ? " tg-civil-date-input" : ""}"
                data-key="${escapeHtml(field.key)}"
                value="${escapeHtml(state.newRow[field.key] || "")}"
                ${dateFieldKeys.has(field.key) ? 'inputmode="numeric" maxlength="10" placeholder="օր.ամ.տտ"' : 'type="text"'}
                autocomplete="off"
                ${state.isBusy ? "disabled" : ""}
              >
            </label>
          `).join("")}
          <button id="tgCivilAddRowBtn" class="tg-civil-new-add" type="button" ${state.isBusy ? "disabled" : ""}>Ավելացնել</button>
        </div>
      </section>
    `;
  }

  function renderTable() {
    if (!state.rows.length) {
      return `<div class="tg-civil-empty">Տվյալներ չկան։</div>`;
    }
    const selectedIds = new Set(state.selectedIds);
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
            ${state.rows.map((row, rowIndex) => {
              const rowId = getRowId(row);
              const isSelected = rowId && selectedIds.has(rowId);
              return `
                <tr class="${isSelected ? "is-selected" : ""}">
                  <th scope="row">
                    <label class="tg-civil-row-select" title="Ընտրել տողը">
                      <input
                        class="tg-civil-row-checkbox"
                        type="checkbox"
                        data-id="${escapeHtml(rowId)}"
                        ${rowId ? "" : "disabled"}
                        ${isSelected ? "checked" : ""}
                        ${state.isBusy ? "disabled" : ""}
                      >
                      <span>${state.offset + rowIndex + 1}</span>
                    </label>
                  </th>
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
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function render() {
    if (!root) {
      return;
    }
    const selectedCount = state.selectedIds.length;
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

        ${renderNewRowForm()}

        <div class="tg-civil-toolbar">
          <input id="tgCivilSearchInput" class="tg-civil-search" type="search" value="${escapeHtml(state.searchDraft)}" placeholder="Որոնում՝ ԱԱՀ, ԲԿ, SR-21-7, SR-21-out-7">
          <button id="tgCivilSearchBtn" class="tg-civil-search-btn" type="button" ${state.isBusy ? "disabled" : ""} aria-label="Որոնել">⌕</button>
        </div>
        <div class="tg-civil-document-actions">
          <button id="tgCivilPrintBtn" type="button" ${state.isBusy || !state.total ? "disabled" : ""}>Տպել</button>
          <button id="tgCivilExportBtn" type="button" ${state.isBusy || !state.total ? "disabled" : ""}>Word</button>
          <button id="tgCivilDeleteBtn" class="tg-civil-delete-btn" type="button" ${state.isBusy || !selectedCount ? "disabled" : ""}>Ջնջել${selectedCount ? ` (${selectedCount})` : ""}</button>
          <span>Կոճակները վերցնում են ընթացիկ որոնման տողերը։</span>
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
    document.getElementById("tgCivilAddRowBtn")?.addEventListener("click", saveNewRow);
    document.getElementById("tgCivilPrintBtn")?.addEventListener("click", printCurrentDocument);
    document.getElementById("tgCivilExportBtn")?.addEventListener("click", exportCurrentDocument);
    document.getElementById("tgCivilDeleteBtn")?.addEventListener("click", deleteSelectedRows);
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
    root.querySelectorAll(".tg-civil-row-checkbox").forEach((input) => {
      input.addEventListener("change", () => {
        updateSelectedId(input.getAttribute("data-id"), input.checked);
        render();
      });
    });
    root.querySelectorAll(".tg-civil-new-input").forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.getAttribute("data-key");
        if (!key) {
          return;
        }
        const value = normalizeFieldValue(key, input.value, false);
        input.value = value;
        state.newRow[key] = value;
      });
      input.addEventListener("blur", () => {
        const key = input.getAttribute("data-key");
        if (!key) {
          return;
        }
        const value = normalizeFieldValue(key, input.value, true);
        input.value = value;
        state.newRow[key] = value;
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveNewRow();
        }
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
