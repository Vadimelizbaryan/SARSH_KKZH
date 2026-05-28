(function () {
  const config = window.SHARSH_CONFIG;
  const sync = window.SHARSH_SYNC || null;
  const app = document.getElementById("app");
  const queryParams = new URLSearchParams(window.location.search);
  const view = (queryParams.get("view") || "").trim().toLowerCase();
  const bodyView = (document.body.dataset.view || "").trim().toLowerCase();
  const isDischargeView =
    view === "discharge"
    || bodyView === "discharge-shift"
    || bodyView === "morning-discharge";
  const isAdmissionView =
    view === "day"
    || view === "night"
    || bodyView === "day-shift"
    || bodyView === "night-shift";
  const mode = isDischargeView ? "discharge" : (isAdmissionView ? "admission" : "");

  if (!config || !app || !mode) {
    return;
  }

  const COLUMNS = [
    { key: "shar", label: "ՇԱՐ" },
    { key: "spa", label: "ՍՊԱ" },
    { key: "paym", label: "ՊԱՅՄ" },
    { key: "zh", label: "Զ/Հ" },
    { key: "family", label: "Զ/Ծ ընտ" },
    { key: "zp", label: "Զ/Պ" },
    { key: "qi", label: "Ք-ի" }
  ];

  const MODES = {
    admission: {
      storage: "day-shift",
      legacyStorage: "night-shift",
      title: "Ընդունում",
      lead: "Օրվա ընթացքում գրանցեք ընդունված հիվանդների քանակը ըստ բաժանմունքների։",
      kicker: "Օրվա աշխատանքային էջ",
      subtitle: "Լրացրեք ընդունվածների թվերը, պահեք էջում և օրվա վերջում փոխանցեք հիմնական աղյուսակին",
      help: "Այս էջը կարող է բաց մնալ ընդունման պատասխանատու աշխատակցի մոտ։ Օրվա ընթացքում պահեք թվերը որպես черновик, իսկ օրվա վերջում սեղմեք փոխանցման կոճակը։",
      clearLabel: "Մաքրել",
      saveLabel: "Պահպանել էջում",
      transferLabel: "Տեղադրել հիմնական աղյուսակում",
      totalLabel: "Ընդամենը ընդունվել է",
      noValues: "Ընդունման էջում դեռ արժեքներ չկան։",
      syncMissing: "Չհաջողվեց աշխատել ընդունման էջի սինխրոնացման հետ։",
      saving: "Պահպանում եմ ընդունման черновик-ը...",
      saved: "Ընդունման черновик-ը պահպանվել է",
      transferring: "Տեղափոխում եմ ընդունման տվյալները հիմնական աղյուսակ...",
      transferred: "Ընդունման տվյալները ավելացվել են հիմնական աղյուսակին",
      cleared: "Ընդունման աղյուսակը մաքրվել է։",
      loadOk: "Բեռնվել են ընդունման էջի պահված տվյալները։",
      loadFail: "Չհաջողվեց բեռնել ընդունման էջի տվյալները։",
      confirmClear: "Մաքրե՞լ ընդունման աղյուսակի բոլոր արժեքները։",
      saveFn: "saveDayShiftDraft",
      applyFn: "applyDayShiftToMain",
      loadFns: ["loadDayShiftDraft", "loadNightShiftDraft"],
      clearFns: ["clearDayShiftDraft", "clearNightShiftDraft"],
      consolidateClearFns: ["clearNightShiftDraft"]
    },
    discharge: {
      storage: "discharge-shift",
      title: "Դուրսգրում",
      lead: "Օրվա ընթացքում գրանցեք դուրս գրված հիվանդների քանակը ըստ բաժանմունքների։",
      kicker: "Օրվա աշխատանքային էջ",
      subtitle: "Լրացրեք դուրսգրվածների թվերը, պահեք էջում և օրվա վերջում փոխանցեք հիմնական աղյուսակին",
      help: "Այս էջը կարող է բաց մնալ դուրսգրման պատասխանատու աշխատակցի մոտ։ Օրվա ընթացքում պահեք թվերը որպես черновик, իսկ օրվա վերջում սեղմեք փոխանցման կոճակը։",
      clearLabel: "Մաքրել",
      saveLabel: "Պահպանել էջում",
      transferLabel: "Տեղադրել հիմնական աղյուսակում",
      totalLabel: "Ընդամենը դուրս է գրվել",
      noValues: "Դուրսգրման էջում դեռ արժեքներ չկան։",
      syncMissing: "Չհաջողվեց աշխատել դուրսգրման էջի սինխրոնացման հետ։",
      saving: "Պահպանում եմ դուրսգրման черновик-ը...",
      saved: "Դուրսգրման черновик-ը պահպանվել է",
      transferring: "Տեղափոխում եմ դուրսգրման տվյալները հիմնական աղյուսակ...",
      transferred: "Դուրսգրման տվյալները ավելացվել են հիմնական աղյուսակին",
      cleared: "Դուրսգրման աղյուսակը մաքրվել է։",
      loadOk: "Բեռնվել են դուրսգրման էջի պահված տվյալները։",
      loadFail: "Չհաջողվեց բեռնել դուրսգրման էջի տվյալները։",
      confirmClear: "Մաքրե՞լ դուրսգրման աղյուսակի բոլոր արժեքները։",
      saveFn: "saveDischargeShiftDraft",
      applyFn: "applyDischargeShiftToMain",
      loadFns: ["loadDischargeShiftDraft"],
      clearFns: ["clearDischargeShiftDraft"],
      consolidateClearFns: []
    }
  };

  const copy = MODES[mode];
  const STORAGE_KEY = `${config.STORAGE_NAMESPACE}:${copy.storage}:v3`;
  const LEGACY_STORAGE_KEY = copy.legacyStorage
    ? `${config.STORAGE_NAMESPACE}:${copy.legacyStorage}:v1`
    : "";
  const state = loadState();
  let statusText = "";
  let statusIsError = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function shortenText(value, maxLength = 8) {
    const chars = Array.from(String(value ?? "").trim());
    return chars.length > maxLength ? chars.slice(0, maxLength).join("") : chars.join("");
  }

  function renderResponsiveDepartmentName(value) {
    return `<span class="dept-name-short">${escapeHtml(shortenText(value))}</span>`;
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

  function normalizeReportDateTime(value, fallback = getYerevanDateTime()) {
    const raw = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!raw) {
      return fallback;
    }

    const dateTimeMatch = raw.match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{2,4})[\s,]+(\d{1,2}):(\d{2})$/);
    const dateOnlyMatch = raw.match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{2,4})$/);
    const match = dateTimeMatch || dateOnlyMatch;
    if (!match) {
      return /\d{1,2}:\d{2}/.test(raw) ? raw : fallback;
    }

    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    if (!dateTimeMatch) {
      return fallback;
    }

    return `${day}.${month}.${year} ${match[4].padStart(2, "0")}:${match[5]}`;
  }

  function getMainPageHref() {
    if (window.location.pathname.includes("/functions/v1/site")) {
      return `${window.location.origin}/functions/v1/site?path=${encodeURIComponent(config.MAIN_PAGE_FILENAME || "index.html")}`;
    }
    return typeof config.getMainPagePath === "function" ? config.getMainPagePath(".") : "index.html";
  }

  function sanitizeNumber(value) {
    const parsed = Number.parseInt(String(value ?? "").replace(/[^\d-]/g, ""), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.min(parsed, 9999);
  }

  function buildEmptyRows() {
    return Object.fromEntries(
      config.departmentDefinitions.map((department) => [
        department.id,
        Object.fromEntries(COLUMNS.map((column) => [column.key, 0]))
      ])
    );
  }

  function rowsHaveValues(rows) {
    return config.departmentDefinitions.some((department) =>
      COLUMNS.some((column) => sanitizeNumber(rows?.[department.id]?.[column.key]) > 0)
    );
  }

  function parseStoredState(rawValue, fallbackReportDateTime) {
    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue);
      const rows = buildEmptyRows();
      if (parsed && parsed.rows && typeof parsed.rows === "object") {
        config.departmentDefinitions.forEach((department) => {
          COLUMNS.forEach((column) => {
            rows[department.id][column.key] = sanitizeNumber(parsed.rows?.[department.id]?.[column.key]);
          });
        });
      }

      return {
        reportDateTime: normalizeReportDateTime(parsed?.reportDateTime, fallbackReportDateTime),
        savedAt: typeof parsed?.savedAt === "string" ? parsed.savedAt : "",
        rows
      };
    } catch (_error) {
      return null;
    }
  }

  function loadState() {
    const fallback = {
      reportDateTime: getYerevanDateTime(),
      savedAt: "",
      rows: buildEmptyRows()
    };

    const current = parseStoredState(localStorage.getItem(STORAGE_KEY), fallback.reportDateTime);
    if (current) {
      return current;
    }

    if (LEGACY_STORAGE_KEY) {
      const legacy = parseStoredState(localStorage.getItem(LEGACY_STORAGE_KEY), fallback.reportDateTime);
      if (legacy && rowsHaveValues(legacy.rows)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return legacy;
      }
    }

    return fallback;
  }

  function saveState() {
    state.reportDateTime = normalizeReportDateTime(state.reportDateTime);
    state.savedAt = getYerevanDateTime();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function applyDraft(draft) {
    if (!draft || !draft.rows || typeof draft.rows !== "object") {
      return false;
    }

    const rows = buildEmptyRows();
    let hasRows = false;
    config.departmentDefinitions.forEach((department) => {
      COLUMNS.forEach((column) => {
        const value = sanitizeNumber(draft.rows?.[department.id]?.[column.key]);
        rows[department.id][column.key] = value;
        hasRows = hasRows || value > 0;
      });
    });

    state.rows = rows;
    state.reportDateTime = normalizeReportDateTime(draft.reportDateTime, state.reportDateTime);
    state.savedAt = typeof draft.savedAt === "string" && draft.savedAt.trim()
      ? draft.savedAt.trim()
      : state.savedAt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return hasRows;
  }

  function resetState() {
    state.reportDateTime = getYerevanDateTime();
    state.savedAt = "";
    state.rows = buildEmptyRows();
    saveState();
    if (LEGACY_STORAGE_KEY) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }

  function clearStateRows() {
    state.rows = buildEmptyRows();
    state.savedAt = getYerevanDateTime();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (LEGACY_STORAGE_KEY) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }

  function getCell(departmentId, key) {
    return sanitizeNumber(state.rows?.[departmentId]?.[key]);
  }

  function setCell(departmentId, key, value) {
    if (!state.rows[departmentId]) {
      state.rows[departmentId] = {};
    }
    state.rows[departmentId][key] = sanitizeNumber(value);
  }

  function getRowTotal(departmentId) {
    return COLUMNS.reduce((sum, column) => sum + getCell(departmentId, column.key), 0);
  }

  function getColumnTotal(key) {
    return config.departmentDefinitions.reduce((sum, department) => sum + getCell(department.id, key), 0);
  }

  function getGrandTotal() {
    return config.departmentDefinitions.reduce((sum, department) => sum + getRowTotal(department.id), 0);
  }

  function setStatus(message, isError = false) {
    statusText = message || "";
    statusIsError = Boolean(isError);
  }

  function getLatestSavedAt(records) {
    const valid = records
      .map((record) => String(record?.savedAt || "").trim())
      .filter(Boolean);
    return valid.sort().slice(-1)[0] || "";
  }

  function normalizeDraftRecord(record) {
    const rows = buildEmptyRows();
    let hasRows = false;

    if (record && record.rows && typeof record.rows === "object") {
      config.departmentDefinitions.forEach((department) => {
        COLUMNS.forEach((column) => {
          const nextValue = sanitizeNumber(record.rows?.[department.id]?.[column.key]);
          rows[department.id][column.key] = nextValue;
          hasRows = hasRows || nextValue > 0;
        });
      });
    }

    return {
      reportDateTime: normalizeReportDateTime(record?.reportDateTime, getYerevanDateTime()),
      savedAt: String(record?.savedAt || "").trim(),
      rows,
      hasRows
    };
  }

  function combineDrafts(records) {
    const rows = buildEmptyRows();
    let hasRows = false;

    records.forEach((record) => {
      if (!record || !record.rows || typeof record.rows !== "object") {
        return;
      }
      config.departmentDefinitions.forEach((department) => {
        COLUMNS.forEach((column) => {
          const nextValue = sanitizeNumber(record.rows?.[department.id]?.[column.key]);
          rows[department.id][column.key] += nextValue;
          hasRows = hasRows || nextValue > 0;
        });
      });
    });

    return {
      reportDateTime: normalizeReportDateTime(records.find((record) => record?.reportDateTime)?.reportDateTime, getYerevanDateTime()),
      savedAt: getLatestSavedAt(records),
      rows,
      hasRows
    };
  }

  async function callSyncFunction(functionName, ...args) {
    const fn = sync && sync[functionName];
    if (typeof fn !== "function") {
      throw new Error(copy.syncMissing);
    }
    return await fn(...args);
  }

  async function loadRemoteDrafts() {
    const records = [];
    for (const functionName of copy.loadFns) {
      const result = await callSyncFunction(functionName);
      if (result && result.draft) {
        records.push(result.draft);
      }
    }
    if (mode === "admission" && records.length) {
      const normalized = records.map(normalizeDraftRecord);
      return normalized.find((record) => record.hasRows) || normalized[0];
    }
    return combineDrafts(records);
  }

  async function clearRemoteDraftsBestEffort(reportDateTime, functionNames) {
    const warnings = [];
    for (const functionName of functionNames) {
      try {
        await callSyncFunction(functionName, reportDateTime);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : String(error || ""));
      }
    }
    return warnings;
  }

  function updateTotals() {
    config.departmentDefinitions.forEach((department) => {
      const target = app.querySelector(`[data-shift-row-total="${department.id}"]`);
      if (target) {
        target.textContent = String(getRowTotal(department.id));
      }
    });

    COLUMNS.forEach((column) => {
      const target = app.querySelector(`[data-shift-col-total="${column.key}"]`);
      if (target) {
        target.textContent = String(getColumnTotal(column.key));
      }
    });

    const grand = app.querySelector("[data-shift-grand-total]");
    if (grand) {
      grand.textContent = String(getGrandTotal());
    }

    const saved = app.querySelector("[data-shift-saved-at]");
    if (saved) {
      saved.textContent = state.savedAt || "դեռ չի պահպանվել";
    }
  }

  function renderRows() {
    return config.departmentDefinitions.map((department) => `
      <tr>
        <th scope="row">
          <span>${escapeHtml(department.marker)}</span>
          <strong title="${escapeHtml(department.department)}">${renderResponsiveDepartmentName(department.department)}</strong>
        </th>
        ${COLUMNS.map((column) => `
          <td>
            <input
              type="number"
              min="0"
              max="9999"
              inputmode="numeric"
              value="${escapeHtml(getCell(department.id, column.key))}"
              data-shift-input="${escapeHtml(department.id)}"
              data-shift-key="${escapeHtml(column.key)}"
              aria-label="${escapeHtml(`${department.marker} ${column.label}`)}"
            >
          </td>
        `).join("")}
        <td class="night-total" data-shift-row-total="${escapeHtml(department.id)}">${escapeHtml(getRowTotal(department.id))}</td>
      </tr>
    `).join("");
  }

  function render() {
    app.innerHTML = `
      <div class="page night-page">
        <div class="toolbar no-print">
          <div>
            <h1>${escapeHtml(copy.title)}</h1>
            <p>${escapeHtml(copy.lead)}</p>
          </div>
          <div class="toolbar-actions">
            <a class="button-link" href="${escapeHtml(getMainPageHref())}">Դեպի գլխավոր էջ</a>
            <button type="button" id="shiftPrintBtn">Տպել</button>
            <button type="button" id="shiftResetBtn">${escapeHtml(copy.clearLabel)}</button>
            <button type="button" id="shiftSaveBtn">${escapeHtml(copy.saveLabel)}</button>
            <button type="button" id="shiftTransferBtn">${escapeHtml(copy.transferLabel)}</button>
          </div>
        </div>

        <section class="night-hero no-print">
          <div>
            <p class="night-kicker">${escapeHtml(copy.kicker)}</p>
            <h2>${escapeHtml(copy.subtitle)}</h2>
            <p>${escapeHtml(copy.help)}</p>
          </div>
          <div class="night-meta">
            <span>Ամսաթիվ և ժամ</span>
            <strong>${escapeHtml(state.reportDateTime)}</strong>
            <em>Վերջին պահպանումը: <b data-shift-saved-at>${escapeHtml(state.savedAt || "դեռ չի պահպանվել")}</b></em>
          </div>
        </section>

        ${statusText ? `<p class="hint${statusIsError ? " warning-note" : ""}">${escapeHtml(statusText)}</p>` : ""}

        <div class="night-table-shell">
          <div class="night-table-wrap">
            <table class="night-table">
              <thead>
                <tr>
                  <th scope="col">Բաժանմունք</th>
                  ${COLUMNS.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join("")}
                  <th scope="col">Ընդամենը</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows()}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">${escapeHtml(copy.totalLabel)}</th>
                  ${COLUMNS.map((column) => `<td data-shift-col-total="${escapeHtml(column.key)}">${escapeHtml(getColumnTotal(column.key))}</td>`).join("")}
                  <td data-shift-grand-total>${escapeHtml(getGrandTotal())}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  app.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches("[data-shift-input]")) {
      return;
    }
    setCell(input.dataset.shiftInput || "", input.dataset.shiftKey || "", input.value);
    saveState();
    updateTotals();
  });

  async function handleSave(button) {
    saveState();

    if (!getGrandTotal()) {
      setStatus(copy.noValues, false);
      render();
      return;
    }

    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
    }
    setStatus(copy.saving, false);
    render();

    try {
      const result = await callSyncFunction(copy.saveFn, state.rows, state.reportDateTime);
      const draft = result && result.draft ? result.draft : null;
      if (draft && typeof draft.savedAt === "string" && draft.savedAt) {
        state.savedAt = draft.savedAt;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
      const clearWarnings = await clearRemoteDraftsBestEffort(state.reportDateTime, copy.consolidateClearFns);
      const sourceText = result && result.source === "remote" ? "առցանց" : "տեղային";
      const warningText = clearWarnings.length ? ` Զգուշացում: ${clearWarnings.join(" | ")}` : "";
      setStatus(`${copy.saved} (${sourceText})։${warningText}`, false);
      render();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.syncMissing, true);
      render();
    }
  }

  async function handleTransfer(button) {
    saveState();

    if (!getGrandTotal()) {
      setStatus(copy.noValues, false);
      render();
      return;
    }

    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
    }
    setStatus(copy.transferring, false);
    render();

    try {
      const result = await callSyncFunction(copy.applyFn, state.rows, state.reportDateTime);
      const clearWarnings = await clearRemoteDraftsBestEffort(state.reportDateTime, copy.clearFns);
      clearStateRows();
      const sourceText = result && result.source === "remote" ? "առցանց" : "տեղային";
      const warningText = clearWarnings.length ? ` Զգուշացում: ${clearWarnings.join(" | ")}` : "";
      setStatus(`${copy.transferred} (${sourceText})։${warningText}`, false);
      render();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.syncMissing, true);
      render();
    }
  }

  async function handleReset(button) {
    resetState();

    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
    }
    render();

    try {
      const clearWarnings = await clearRemoteDraftsBestEffort(state.reportDateTime, copy.clearFns);
      const warningText = clearWarnings.length ? ` Զգուշացում: ${clearWarnings.join(" | ")}` : "";
      setStatus(`${copy.cleared}${warningText}`, false);
      render();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.cleared, true);
      render();
    }
  }

  app.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.id === "shiftSaveBtn") {
      handleSave(target);
      return;
    }
    if (target.id === "shiftTransferBtn") {
      handleTransfer(target);
      return;
    }
    if (target.id === "shiftResetBtn") {
      if (window.confirm(copy.confirmClear)) {
        handleReset(target);
      }
      return;
    }
    if (target.id === "shiftPrintBtn") {
      window.print();
    }
  });

  async function init() {
    if (window.SHARSH_AUTH_READY) {
      await window.SHARSH_AUTH_READY;
    }
    if (sync && typeof sync.hasRemoteSync === "function" && sync.hasRemoteSync()) {
      try {
        const combined = await loadRemoteDrafts();
        if (combined.hasRows) {
          applyDraft(combined);
          setStatus(copy.loadOk, false);
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : copy.loadFail, true);
      }
    }
    render();
  }

  init();
})();
