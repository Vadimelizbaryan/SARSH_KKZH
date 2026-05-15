(function () {
  const config = window.SHARSH_CONFIG;
  const sync = window.SHARSH_SYNC || null;
  const app = document.getElementById("app");
  const queryParams = new URLSearchParams(window.location.search);
  const isNightShiftView = document.body.dataset.view === "night-shift" || queryParams.get("view") === "night";

  if (!config || !app || !isNightShiftView) {
    return;
  }

  const STORAGE_KEY = `${config.STORAGE_NAMESPACE}:night-shift:v1`;
  const NIGHT_COLUMNS = [
    { key: "shar", label: "ՇԱՐ" },
    { key: "spa", label: "ՍՊԱ" },
    { key: "paym", label: "ՊԱՅՄ" },
    { key: "zh", label: "Զ/Հ" },
    { key: "family", label: "Զ/Ծ ԸՆՏ" },
    { key: "zp", label: "Զ/Պ" },
    { key: "qi", label: "ք-ի" }
  ];

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
        Object.fromEntries(NIGHT_COLUMNS.map((column) => [column.key, 0]))
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
          NIGHT_COLUMNS.forEach((column) => {
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

  function clearNightRowsAfterTransfer() {
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
    return NIGHT_COLUMNS.reduce((sum, column) => sum + getCell(departmentId, column.key), 0);
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
      const target = app.querySelector(`[data-night-row-total="${department.id}"]`);
      if (target) {
        target.textContent = String(getRowTotal(department.id));
      }
    });

    NIGHT_COLUMNS.forEach((column) => {
      const target = app.querySelector(`[data-night-col-total="${column.key}"]`);
      if (target) {
        target.textContent = String(getColumnTotal(column.key));
      }
    });

    const grand = app.querySelector("[data-night-grand-total]");
    if (grand) {
      grand.textContent = String(getGrandTotal());
    }

    const saved = app.querySelector("[data-night-saved-at]");
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
        ${NIGHT_COLUMNS.map((column) => `
          <td>
            <input
              type="number"
              min="0"
              max="9999"
              inputmode="numeric"
              value="${escapeHtml(getCell(department.id, column.key))}"
              data-night-input="${escapeHtml(department.id)}"
              data-night-key="${escapeHtml(column.key)}"
              aria-label="${escapeHtml(`${department.marker} ${column.label}`)}"
            >
          </td>
        `).join("")}
        <td class="night-total" data-night-row-total="${escapeHtml(department.id)}">${escapeHtml(getRowTotal(department.id))}</td>
      </tr>
    `).join("");
  }

  function render() {
    app.innerHTML = `
      <div class="page night-page">
        <div class="toolbar no-print">
          <div>
            <h1>Ночная смена</h1>
            <p>Поступления по всем отделениям. Выписки ночью не учитываются.</p>
          </div>
          <div class="toolbar-actions">
            <a class="button-link" href="${escapeHtml(getMainPageHref())}">К главному</a>
            <button type="button" id="nightPrintBtn">Печать</button>
            <button type="button" id="nightResetBtn">Очистить ночь</button>
            <button type="button" id="nightSaveBtn">Сохранить</button>
          </div>
        </div>

        <section class="night-hero no-print">
          <div>
            <p class="night-kicker">Черновик перед утренним переносом</p>
            <h2>Добавляем только поступивших за ночь</h2>
            <p>Логика переноса в основную таблицу будет добавлена позже. Сейчас страница сохраняет ночные значения локально.</p>
          </div>
          <div class="night-meta">
            <span>Дата и время</span>
            <strong>${escapeHtml(state.reportDateTime)}</strong>
            <em>Последнее сохранение: <b data-night-saved-at>${escapeHtml(state.savedAt || "ещё не сохранено")}</b></em>
          </div>
        </section>

        ${statusText ? `<p class="hint${statusIsError ? " warning-note" : ""}">${escapeHtml(statusText)}</p>` : ""}

        <div class="night-table-shell">
          <div class="night-table-wrap">
            <table class="night-table">
              <thead>
                <tr>
                  <th scope="col">Отделение</th>
                  ${NIGHT_COLUMNS.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join("")}
                  <th scope="col">Итого</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows()}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Итого за ночь</th>
                  ${NIGHT_COLUMNS.map((column) => `<td data-night-col-total="${escapeHtml(column.key)}">${escapeHtml(getColumnTotal(column.key))}</td>`).join("")}
                  <td data-night-grand-total>${escapeHtml(getGrandTotal())}</td>
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
    if (!(input instanceof HTMLInputElement) || !input.matches("[data-night-input]")) {
      return;
    }
    setCell(input.dataset.nightInput || "", input.dataset.nightKey || "", input.value);
    saveState();
    updateTotals();
  });

  async function handleNightSave(button) {
    saveState();

    if (!getGrandTotal()) {
      setStatus("Ночная смена сохранена локально. Для переноса в основную таблицу нет значений.", false);
      render();
      return;
    }

    if (!sync || typeof sync.applyNightShiftToMain !== "function") {
      setStatus("Перенос в основную таблицу пока недоступен: модуль синхронизации не загружен.", true);
      render();
      return;
    }

    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
    }
    setStatus("Переношу ночную смену в основную таблицу...", false);
    render();

    try {
      const result = await sync.applyNightShiftToMain(state.rows, state.reportDateTime);
      clearNightRowsAfterTransfer();
      const sourceText = result && result.source === "remote" ? "онлайн" : "локально";
      setStatus(`Ночная смена перенесена в основную таблицу (${sourceText}). Ночная таблица очищена.`, false);
      render();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось перенести ночную смену в основную таблицу.", true);
      render();
    }
  }

  app.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.id === "nightSaveBtn") {
      handleNightSave(target);
      return;
    }
    if (target.id === "nightResetBtn") {
      if (window.confirm("Очистить все значения ночной смены?")) {
        resetState();
        render();
      }
      return;
    }
    if (target.id === "nightPrintBtn") {
      window.print();
    }
  });

  async function init() {
    if (window.SHARSH_AUTH_READY) {
      await window.SHARSH_AUTH_READY;
    }
    render();
  }

  init();
})();
