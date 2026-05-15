(function () {
  const config = window.SHARSH_CONFIG;
  const sync = window.SHARSH_SYNC || null;
  const app = document.getElementById("app");
  const queryParams = new URLSearchParams(window.location.search);
  const view = queryParams.get("view");
  const bodyView = document.body.dataset.view || "";
  const mode = view === "day" || bodyView === "day-shift" ? "day"
    : view === "night" || bodyView === "night-shift" ? "night"
      : "";

  if (!config || !app || !mode) {
    return;
  }

  const COLUMNS = [
    { key: "shar", label: "ՇԱՐ" },
    { key: "spa", label: "ՍՊԱ" },
    { key: "paym", label: "ՊԱՅՄ" },
    { key: "zh", label: "Զ/Հ" },
    { key: "family", label: "Զ/Ծ ԸՆՏ" },
    { key: "zp", label: "Զ/Պ" },
    { key: "qi", label: "ք-ի" }
  ];

  const MODES = {
    night: {
      storage: "night-shift",
      title: "Ночная смена",
      lead: "Поступления по всем отделениям. Выписки ночью не учитываются.",
      kicker: "Черновик перед утренним переносом",
      subtitle: "Добавляем только поступивших за ночь",
      help: "Telegram форма сохраняет значения сюда. Перенос в основную таблицу выполняется только кнопкой Сохранить на этой странице.",
      clearLabel: "Очистить ночь",
      totalLabel: "Итого за ночь",
      noValues: "Ночная смена сохранена локально. Для переноса в основную таблицу нет значений.",
      syncMissing: "Перенос в основную таблицу пока недоступен: модуль синхронизации не загружен.",
      saving: "Переношу ночную смену в основную таблицу...",
      saved: "Ночная смена перенесена в основную таблицу",
      cleared: "Ночная таблица очищена.",
      loadOk: "Загружены данные ночной смены, отправленные через Telegram форму.",
      loadFail: "Не удалось загрузить ночную смену из Telegram формы.",
      confirmClear: "Очистить все значения ночной смены?",
      applyFn: "applyNightShiftToMain",
      loadFn: "loadNightShiftDraft"
    },
    day: {
      storage: "day-shift",
      title: "Дневная смена",
      lead: "Дневной прием пациентов по всем отделениям. Сейчас формулы такие же, как у ночного приема.",
      kicker: "Черновик дневного приема",
      subtitle: "Добавляем поступивших за дневную смену",
      help: "Telegram форма дневной смены сохраняет значения сюда. Перенос в основную таблицу выполняется только кнопкой Сохранить на этой странице.",
      clearLabel: "Очистить день",
      totalLabel: "Итого за день",
      noValues: "Дневная смена сохранена локально. Для переноса в основную таблицу нет значений.",
      syncMissing: "Перенос в основную таблицу пока недоступен: модуль синхронизации не загружен.",
      saving: "Переношу дневную смену в основную таблицу...",
      saved: "Дневная смена перенесена в основную таблицу",
      cleared: "Дневная таблица очищена.",
      loadOk: "Загружены данные дневной смены, отправленные через Telegram форму.",
      loadFail: "Не удалось загрузить дневную смену из Telegram формы.",
      confirmClear: "Очистить все значения дневной смены?",
      applyFn: "applyDayShiftToMain",
      loadFn: "loadDayShiftDraft"
    }
  };

  const copy = MODES[mode];
  const STORAGE_KEY = `${config.STORAGE_NAMESPACE}:${copy.storage}:v1`;
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

  function loadState() {
    const fallback = {
      reportDateTime: getYerevanDateTime(),
      savedAt: "",
      rows: buildEmptyRows()
    };

    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const rows = buildEmptyRows();
      if (parsed && parsed.rows && typeof parsed.rows === "object") {
        config.departmentDefinitions.forEach((department) => {
          COLUMNS.forEach((column) => {
            rows[department.id][column.key] = sanitizeNumber(parsed.rows?.[department.id]?.[column.key]);
          });
        });
      }
      return {
        reportDateTime: typeof parsed?.reportDateTime === "string" ? parsed.reportDateTime : fallback.reportDateTime,
        savedAt: typeof parsed?.savedAt === "string" ? parsed.savedAt : "",
        rows
      };
    } catch (_error) {
      return fallback;
    }
  }

  function saveState() {
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
    state.reportDateTime = typeof draft.reportDateTime === "string" && draft.reportDateTime.trim()
      ? draft.reportDateTime.trim()
      : state.reportDateTime;
    state.savedAt = typeof draft.savedAt === "string" && draft.savedAt.trim()
      ? draft.savedAt.trim()
      : state.savedAt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return hasRows;
  }

  function clearRowsAfterTransfer() {
    state.reportDateTime = getYerevanDateTime();
    state.rows = buildEmptyRows();
    saveState();
  }

  function resetState() {
    state.reportDateTime = getYerevanDateTime();
    state.savedAt = "";
    state.rows = buildEmptyRows();
    saveState();
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
      saved.textContent = state.savedAt || "ещё не сохранено";
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
            <a class="button-link" href="${escapeHtml(getMainPageHref())}">К главному</a>
            <button type="button" id="shiftPrintBtn">Печать</button>
            <button type="button" id="shiftResetBtn">${escapeHtml(copy.clearLabel)}</button>
            <button type="button" id="shiftSaveBtn">Сохранить</button>
          </div>
        </div>

        <section class="night-hero no-print">
          <div>
            <p class="night-kicker">${escapeHtml(copy.kicker)}</p>
            <h2>${escapeHtml(copy.subtitle)}</h2>
            <p>${escapeHtml(copy.help)}</p>
          </div>
          <div class="night-meta">
            <span>Дата и время</span>
            <strong>${escapeHtml(state.reportDateTime)}</strong>
            <em>Последнее сохранение: <b data-shift-saved-at>${escapeHtml(state.savedAt || "ещё не сохранено")}</b></em>
          </div>
        </section>

        ${statusText ? `<p class="hint${statusIsError ? " warning-note" : ""}">${escapeHtml(statusText)}</p>` : ""}

        <div class="night-table-shell">
          <div class="night-table-wrap">
            <table class="night-table">
              <thead>
                <tr>
                  <th scope="col">Отделение</th>
                  ${COLUMNS.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join("")}
                  <th scope="col">Итого</th>
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

    const applyFn = sync && sync[copy.applyFn];
    if (typeof applyFn !== "function") {
      setStatus(copy.syncMissing, true);
      render();
      return;
    }

    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
    }
    setStatus(copy.saving, false);
    render();

    try {
      const result = await applyFn(state.rows, state.reportDateTime);
      clearRowsAfterTransfer();
      const sourceText = result && result.source === "remote" ? "онлайн" : "локально";
      setStatus(`${copy.saved} (${sourceText}). ${copy.cleared}`, false);
      render();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось перенести данные в основную таблицу.", true);
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
    if (target.id === "shiftResetBtn") {
      if (window.confirm(copy.confirmClear)) {
        resetState();
        render();
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
    const loadFn = sync && sync[copy.loadFn];
    if (sync && typeof sync.hasRemoteSync === "function" && sync.hasRemoteSync() && typeof loadFn === "function") {
      try {
        const result = await loadFn();
        const hasRows = applyDraft(result && result.draft);
        if (hasRows) {
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
