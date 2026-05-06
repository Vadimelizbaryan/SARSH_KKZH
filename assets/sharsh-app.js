(function () {
  const config = window.SHARSH_CONFIG;
  const sync = window.SHARSH_SYNC;
  const app = document.getElementById("app");

  if (!config || !sync || !app) {
    return;
  }

  const mode = document.body.dataset.view === "department" ? "department" : "main";
  const departmentId = document.body.dataset.departmentId || "";
  const basePath = document.body.dataset.basePath || ".";
  const PRINT_REPORT_TITLE = "ԿԿԶՀ-Շարժ․";
  const DEFAULT_DOCUMENT_TITLE = document.title;

  const state = {
    snapshot: config.buildDefaultSnapshot(),
    loadedSnapshot: config.buildDefaultSnapshot(),
    source: "local-only",
    warning: "",
    info: "",
    infoIsError: false,
    saveTimer: 0,
    dateTimer: 0,
    saveSequence: 0,
    printHandlersAttached: false,
    refreshIntervalId: 0,
    freshnessIntervalId: 0,
    clockIntervalId: 0
  };

  function deepCopy(value) {
    return config.deepCopy(value);
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatTimestamp(value) {
    if (!value) {
      return "еще не отправлялось";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "еще не отправлялось";
    }
    return date.toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getCurrentDateTimeParts() {
    const now = new Date();
    const date = now.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const time = now.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    });
    return {
      date,
      time,
      full: `${date} ${time}`
    };
  }

  function syncCurrentReportDate() {
    const parts = getCurrentDateTimeParts();
    state.snapshot.reportDate = parts.full;
    return parts;
  }

  function parseTimestamp(value) {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatAge(value) {
    const date = parseTimestamp(value);
    if (!date) {
      return "нет отправки";
    }

    const diffMs = Math.max(0, Date.now() - date.getTime());
    const totalMinutes = Math.floor(diffMs / 60000);

    if (totalMinutes < 1) {
      return "меньше минуты назад";
    }
    if (totalMinutes < 60) {
      return `${totalMinutes} мин назад`;
    }

    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (totalHours < 24) {
      return minutes ? `${totalHours} ч ${minutes} мин назад` : `${totalHours} ч назад`;
    }

    const totalDays = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return hours ? `${totalDays} д ${hours} ч назад` : `${totalDays} д назад`;
  }

  function rowHasSubmittedData(row) {
    if (!row || !row.values || typeof row.values !== "object") {
      return false;
    }

    return Object.values(row.values).some((value) =>
      value !== null && value !== "" && typeof value !== "undefined"
    );
  }

  function getFreshnessMeta(updatedAt, hasData = true) {
    if (!hasData) {
      return {
        level: "missing",
        label: "Нет данных",
        timestamp: "еще не отправлялось",
        age: "Отделение еще не присылало данные."
      };
    }

    const date = parseTimestamp(updatedAt);
    if (!date) {
      return {
        level: "missing",
        label: "Нет данных",
        timestamp: "еще не отправлялось",
        age: "Отделение еще не присылало данные."
      };
    }

    const diffMs = Math.max(0, Date.now() - date.getTime());
    const twoHours = 2 * 60 * 60 * 1000;
    const twelveHours = 12 * 60 * 60 * 1000;

    if (diffMs <= twoHours) {
      return {
        level: "fresh",
        label: "Свежие",
        timestamp: formatTimestamp(updatedAt),
        age: `Обновлено ${formatAge(updatedAt)}`
      };
    }

    if (diffMs <= twelveHours) {
      return {
        level: "warning",
        label: "Проверить",
        timestamp: formatTimestamp(updatedAt),
        age: `Последнее обновление ${formatAge(updatedAt)}`
      };
    }

    return {
      level: "stale",
      label: "Старые",
      timestamp: formatTimestamp(updatedAt),
      age: `Данные не обновлялись ${formatAge(updatedAt)}`
    };
  }

  function getRowFreshnessMeta(row) {
    return getFreshnessMeta(row && row.updatedAt, rowHasSubmittedData(row));
  }

  function buildFreshnessStats(rows) {
    const counts = {
      fresh: 0,
      warning: 0,
      stale: 0,
      missing: 0
    };

    let oldestRow = null;
    let newestRow = null;

    rows.forEach((row) => {
      const meta = getRowFreshnessMeta(row);
      counts[meta.level] += 1;

      const time = parseTimestamp(row.updatedAt);
      if (!time || !rowHasSubmittedData(row)) {
        return;
      }

      if (!oldestRow || time.getTime() < parseTimestamp(oldestRow.updatedAt).getTime()) {
        oldestRow = row;
      }
      if (!newestRow || time.getTime() > parseTimestamp(newestRow.updatedAt).getTime()) {
        newestRow = row;
      }
    });

    return {
      counts,
      oldestRow,
      newestRow
    };
  }

  function getDepartmentRow(snapshot, rowId) {
    return snapshot.rows.find((row) => row.id === rowId) || null;
  }

  function getLinkedSource(row, key) {
    return config.linkedCells[`${row.id}:${key}`] || null;
  }

  function getEffectiveValue(snapshot, row, key) {
    const linkedSource = getLinkedSource(row, key);
    if (!linkedSource) {
      return row.values[key];
    }
    const sourceRow = getDepartmentRow(snapshot, linkedSource.rowId);
    return sourceRow ? sourceRow.values[linkedSource.key] : null;
  }

  function getNumber(snapshot, row, key) {
    const value = getEffectiveValue(snapshot, row, key);
    return value === null || value === "" || typeof value === "undefined" ? 0 : Number(value);
  }

  function getDisplayValue(value) {
    return value === null || value === "" || typeof value === "undefined" ? "" : String(value);
  }

  function calcPresentTotal(snapshot, row) {
    return row.presentKeys.reduce((sum, key) => sum + getNumber(snapshot, row, key), 0);
  }

  function calcLeaveTotal(snapshot, row) {
    if (!row.hasLeaveTotal) {
      return null;
    }
    return getNumber(snapshot, row, "leaveSharq")
      + getNumber(snapshot, row, "leaveSpa")
      + getNumber(snapshot, row, "leavePaym");
  }

  function getSummaryValue(snapshot, rows, key) {
    return rows.reduce((sum, row) => {
      if (key === "presentTotal") {
        return sum + calcPresentTotal(snapshot, row);
      }
      if (key === "leaveTotal") {
        return sum + (calcLeaveTotal(snapshot, row) || 0);
      }
      return sum + getNumber(snapshot, row, key);
    }, 0);
  }

  function supportsValue(row, key) {
    if (key === "presentTotal" || key === "leaveTotal") {
      return true;
    }
    if (key === "transferFromDepartment" || key === "transferToDepartment") {
      return true;
    }
    return row.editableKeys.includes(key) || Boolean(getLinkedSource(row, key));
  }

  function isEditable(row, key) {
    if (key === "transferFromDepartment" || key === "transferToDepartment") {
      return true;
    }
    if (getLinkedSource(row, key)) {
      return false;
    }
    return row.editableKeys.includes(key);
  }

  function getCellClasses(key, row, type) {
    const classes = ["data-cell"];

    if (key === "beenSeries" || key === "admittedSeries" || key === "dgSeries" || key === "transferToDepartment") {
      classes.push("group-end");
    }
    if (key === "transferFromDepartment" || key === "presentTotal" || key === "leaveSharq" || key === "leaveTotal") {
      classes.push("major-left");
    }
    if (key === "presentTotal") {
      classes.push("calc-cell");
    }
    if (key === "leaveTotal" && row && row.hasLeaveTotal) {
      classes.push("calc-cell");
    }
    if ((type === "summary" || type === "grand") && config.summaryAccentKeys.has(key)) {
      classes.push("accent-total");
    }

    return classes.join(" ");
  }

  function renderColgroup() {
    return `
      <colgroup>
        <col class="dept-col">
        <col class="num-col"><col class="num-col"><col class="num-col">
        <col class="num-col"><col class="num-col"><col class="num-col">
        <col class="num-col"><col class="num-col"><col class="num-col">
        <col class="num-col"><col class="num-col">
        <col class="num-col">
        <col class="num-col"><col class="num-col"><col class="num-col">
        <col class="num-col"><col class="num-col"><col class="num-col"><col class="num-col">
        <col class="num-col"><col class="num-col"><col class="num-col">
        <col class="wide-col">
      </colgroup>
    `;
  }

  function renderHead() {
    const currentDateTime = getCurrentDateTimeParts();
    return `
      <thead>
        <tr>
          <th rowspan="2" class="hdr-peach dept-head">Բաժանմունք</th>
          <th colspan="3" rowspan="2" class="hdr-peach group-end">ԵՂԵԼ է</th>
          <th colspan="3" rowspan="2" class="hdr-peach group-end">ԸՆՈՒՆՎԵԼ Է</th>
          <th colspan="3" rowspan="2" class="hdr-peach group-end">Դ/Գ</th>
          <th colspan="2" rowspan="2" class="hdr-peach group-end major-left">Տեղափոխ</th>
          <th colspan="8" class="hdr-peach major-left">ԱՌԿԱ Է</th>
          <th colspan="3" class="hdr-peach major-left">որոնցից բուժական</th>
          <th class="hdr-yellow major-left">&nbsp;</th>
        </tr>
        <tr>
          <th rowspan="2" class="hdr-yellow major-left">ԸՆԴԱՄ</th>
          <th colspan="3" class="hdr-peach">Զինծառայող</th>
          <th rowspan="2" class="hdr-peach">Զ/Հ</th>
          <th rowspan="2" class="hdr-peach">Զ/Ծ ԸՆՏ</th>
          <th rowspan="2" class="hdr-peach">Զ/Պ</th>
          <th rowspan="2" class="hdr-peach">Ք-ի</th>
          <th colspan="3" class="hdr-peach major-left">արձակուրդում</th>
          <th rowspan="2" class="hdr-yellow major-left">Ընդհանուր</th>
        </tr>
        <tr>
          <th class="hdr-peach dept-head">
            <div class="sheet-datetime" id="sheetDateDisplay" aria-label="Текущая дата и время">
              <span class="sheet-datetime-date" id="sheetDateText">${escapeHtml(currentDateTime.date)}</span>
              <span class="sheet-datetime-time" id="sheetTimeText">${escapeHtml(currentDateTime.time)}</span>
            </div>
          </th>
          <th class="hdr-peach">ԸՆԴ</th>
          <th class="hdr-peach-dark">Զ/Ծ</th>
          <th class="hdr-peach group-end">ՇԱՐ</th>
          <th class="hdr-peach">ԸՆԴ</th>
          <th class="hdr-peach-dark">Զ/Ծ</th>
          <th class="hdr-peach group-end">ՇԱՐ</th>
          <th class="hdr-peach">ԸՆԴ</th>
          <th class="hdr-peach-dark">Զ/Ծ</th>
          <th class="hdr-peach group-end">ՇԱՐ</th>
          <th class="hdr-peach major-left">Տեղափ բաժնից</th>
          <th class="hdr-peach group-end">Տեղափ բաժին</th>
          <th class="hdr-peach">ՇԱՐ</th>
          <th class="hdr-peach">ՍՊԱ</th>
          <th class="hdr-peach">ՊԱՅՄ</th>
          <th class="hdr-peach major-left">ՇԱՐՔ</th>
          <th class="hdr-peach">ՍՊԱ</th>
          <th class="hdr-peach">ՊԱՅՄ</th>
        </tr>
      </thead>
    `;
  }

  function renderDetailCell(snapshot, row, key, interactive) {
    const classes = getCellClasses(key, row, "detail");

    if (key === "presentTotal") {
      return `<td class="${classes}"><span data-output="presentTotal" data-row="${row.id}"></span></td>`;
    }

    if (key === "leaveTotal") {
      if (!row.hasLeaveTotal) {
        return `<td class="${classes} blank-cell"><span></span></td>`;
      }
      return `<td class="${classes}"><span data-output="leaveTotal" data-row="${row.id}"></span></td>`;
    }

    const linkedSource = getLinkedSource(row, key);
    if (linkedSource) {
      return `<td class="${classes}"><span data-linked="${row.id}:${key}"></span></td>`;
    }

    if (!supportsValue(row, key)) {
      return `<td class="${classes} blank-cell"><span></span></td>`;
    }

    if (!interactive || !isEditable(row, key)) {
      return `<td class="${classes}"><span data-value="${row.id}:${key}">${escapeHtml(getDisplayValue(getEffectiveValue(snapshot, row, key)))}</span></td>`;
    }

    return `
      <td class="${classes}">
        <input
          type="text"
          inputmode="numeric"
          aria-label="${escapeHtml(row.department)} ${escapeHtml(key)}"
          data-row="${row.id}"
          data-key="${key}"
          value="${escapeHtml(getDisplayValue(row.values[key]))}"
        >
      </td>
    `;
  }

  function renderDetailRow(snapshot, row, interactive) {
    return `
      <tr class="detail-row ${row.group === "extra" ? "extra-row" : "primary-row"}" data-row-id="${row.id}">
        <td class="dept-cell">${escapeHtml(row.department)}</td>
        ${config.columns.map((key) => renderDetailCell(snapshot, row, key, interactive)).join("")}
      </tr>
    `;
  }

  function renderSummaryRow(summaryId, label, rowClass) {
    return `
      <tr class="${rowClass}">
        <td class="dept-cell">${escapeHtml(label)}</td>
        ${config.columns.map((key) => `
          <td class="${getCellClasses(key, null, rowClass === "grand-row" ? "grand" : "summary")}">
            <span data-summary="${summaryId}" data-key="${key}"></span>
          </td>
        `).join("")}
      </tr>
    `;
  }

  function renderTable(snapshot, rows, options) {
    const interactive = Boolean(options.interactive);
    let bodyHtml = "";

    if (options.viewMode === "main") {
      const primaryRows = rows.filter((row) => row.group === "primary");
      const extraRows = rows.filter((row) => row.group === "extra");
      bodyHtml = [
        ...primaryRows.map((row) => renderDetailRow(snapshot, row, interactive)),
        renderSummaryRow("subtotal", "Ընդամենը", "subtotal-row"),
        ...extraRows.map((row) => renderDetailRow(snapshot, row, interactive)),
        renderSummaryRow("grand", "Ընդամենը", "grand-row")
      ].join("");
    } else {
      bodyHtml = [
        ...rows.map((row) => renderDetailRow(snapshot, row, interactive)),
        renderSummaryRow("single", "Итог отделения", "single-total-row")
      ].join("");
    }

    return `
      <table class="sheet" id="sheetTable" aria-label="SARSH KKZH">
        ${renderColgroup()}
        ${renderHead()}
        <tbody id="sheetBody">${bodyHtml}</tbody>
      </table>
    `;
  }

  function getCurrentRow() {
    return mode === "department" ? getDepartmentRow(state.snapshot, departmentId) : null;
  }

  function getCurrentLoadedRow() {
    return mode === "department" ? getDepartmentRow(state.loadedSnapshot, departmentId) : null;
  }

  function buildCopyCard(definition) {
    const row = getDepartmentRow(state.snapshot, definition.id);
    const freshness = getRowFreshnessMeta(row);
    const relativePath = appendShareQuery(config.getDepartmentPagePath(".", definition.id));
    return `
      <div class="link-card">
        <strong>${escapeHtml(definition.department)}</strong>
        <div class="link-card-meta">
          <span class="status-chip status-chip--${freshness.level}" data-department-status="${definition.id}">${escapeHtml(freshness.label)}</span>
          <span class="link-card-time" data-department-updated="${definition.id}">${escapeHtml(freshness.timestamp)}</span>
        </div>
        <p class="link-card-subtext" data-department-age="${definition.id}">${escapeHtml(freshness.age)}</p>
        <div class="link-card-actions">
          <a href="${escapeHtml(relativePath)}" target="_blank" rel="noopener">Открыть</a>
          <button type="button" data-copy-link="${escapeHtml(relativePath)}">Копировать ссылку</button>
        </div>
      </div>
    `;
  }

  function appendShareQuery(path) {
    const shareQuery = sync.getShareQuery();
    if (!shareQuery) {
      return path;
    }
    return path.includes("?") ? `${path}${shareQuery.replace("?", "&")}` : `${path}${shareQuery}`;
  }

  function getSetupPath() {
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return appendShareQuery(`${prefix}setup-sync.html`);
  }

  function buildDepartmentUpdateItem(row) {
    const freshness = getRowFreshnessMeta(row);
    return `
      <div class="update-item" data-update-row="${row.id}">
        <div class="update-item-main">
          <strong>${escapeHtml(row.department)}</strong>
          <span class="status-chip status-chip--${freshness.level}" data-update-status="${row.id}">${escapeHtml(freshness.label)}</span>
        </div>
        <div class="update-item-time" data-update-time="${row.id}">${escapeHtml(freshness.timestamp)}</div>
        <div class="update-item-age" data-update-age="${row.id}">${escapeHtml(freshness.age)}</div>
      </div>
    `;
  }

  function getSourceClass() {
    return state.source === "remote" ? "remote" : "local";
  }

  function getSyncDescription() {
    if (state.source === "remote") {
      return "Данные объединяются между компьютерами через интернет.";
    }
    if (state.source === "local-cache") {
      return "Сейчас показан локальный кэш. Сервер временно недоступен.";
    }
    return "Сейчас включен локальный режим. Между разными компьютерами данные еще не объединяются.";
  }

  function getPrintDocumentTitle() {
    if (mode === "department") {
      const row = getCurrentRow();
      return row ? `${PRINT_REPORT_TITLE} ${row.department}` : PRINT_REPORT_TITLE;
    }
    return PRINT_REPORT_TITLE;
  }

  function renderMainPage() {
    const sourceLabel = sync.getSourceLabel(state.source);
    const freshnessStats = buildFreshnessStats(state.snapshot.rows);
    const summaryFreshness = getFreshnessMeta(state.snapshot.updatedAt);
    const currentDateTime = getCurrentDateTimeParts();

    app.innerHTML = `
      <div class="page">
        <div class="print-title print-only">
          <h1>${escapeHtml(PRINT_REPORT_TITLE)}</h1>
        </div>
        <div class="toolbar no-print">
          <div>
            <h1>SARSH_KKZH</h1>
            <p>Главный файл собирает данные всех отделений, показывает общий документ и готов для печати в PDF.</p>
          </div>
          <div class="toolbar-actions">
            <span class="pill ${getSourceClass()}" id="syncModeLabel">${escapeHtml(sourceLabel)}</span>
            <div class="zoom-control">
              <label for="zoomRange">Масштаб</label>
              <input type="range" id="zoomRange" min="60" max="140" step="5" value="100">
              <span class="zoom-value" id="zoomValue">100%</span>
            </div>
            <a class="button-link" href="${escapeHtml(getSetupPath())}">Sync setup</a>
            <button type="button" id="refreshBtn">Обновить</button>
            <button type="button" id="printBtn">Печать</button>
          </div>
        </div>

        <div class="layout-grid split">
          <div class="info-stack">
            <div class="panel no-print">
              <h2>Сводка и дата</h2>
              <div class="meta-row">
                <div class="inline-field static-field">
                  <span>Дата и время</span>
                  <strong id="reportDateField">${escapeHtml(currentDateTime.full)}</strong>
                </div>
                <span class="pill ${getSourceClass()}" id="sheetSourcePill">${escapeHtml(sourceLabel)}</span>
              </div>
              <p id="syncStatusText">${escapeHtml(getSyncDescription())}</p>
              <p class="hint" id="syncInfoText">${escapeHtml(state.info || "Главный файл можно печатать сразу, а PDF создается через кнопку Печать в браузере.")}</p>
              <p class="hint${state.warning ? " warning-note" : ""}" id="warningText">${escapeHtml(state.warning)}</p>
              <div class="freshness-overview">
                <div class="freshness-stat freshness-stat--fresh">
                  <span>Свежие</span>
                  <strong id="freshCount">${freshnessStats.counts.fresh}</strong>
                </div>
                <div class="freshness-stat freshness-stat--warning">
                  <span>Проверить</span>
                  <strong id="warningCount">${freshnessStats.counts.warning}</strong>
                </div>
                <div class="freshness-stat freshness-stat--stale">
                  <span>Старые</span>
                  <strong id="staleCount">${freshnessStats.counts.stale}</strong>
                </div>
                <div class="freshness-stat freshness-stat--missing">
                  <span>Нет данных</span>
                  <strong id="missingCount">${freshnessStats.counts.missing}</strong>
                </div>
              </div>
              <p class="hint" id="freshnessOldestText">${
                freshnessStats.oldestRow
                  ? escapeHtml(`Самые старые данные: ${freshnessStats.oldestRow.department} — ${formatTimestamp(freshnessStats.oldestRow.updatedAt)} (${formatAge(freshnessStats.oldestRow.updatedAt)})`)
                  : "Нет ни одного отделения с отправленными данными."
              }</p>
            </div>

            <div class="zoom-target">
              <div class="sheet-shell">
                <p class="status-line no-print">
                  <strong>Последнее обновление сводки:</strong>
                  <span id="lastUpdatedText">${escapeHtml(formatTimestamp(state.snapshot.updatedAt))}</span>
                  <span class="status-chip status-chip--${summaryFreshness.level}" id="lastUpdatedBadge">${escapeHtml(summaryFreshness.label)}</span>
                </p>
                <div class="table-wrap">
                  ${renderTable(state.snapshot, state.snapshot.rows, { interactive: false, viewMode: "main" })}
                </div>
              </div>
            </div>

            <section class="panel no-print updates-panel">
              <h2>Обновления отделений</h2>
              <p>Точный список по каждому отделению: когда именно пришли последние данные.</p>
              <div class="updates-list" id="departmentUpdatesList">
                ${state.snapshot.rows.map((row) => buildDepartmentUpdateItem(row)).join("")}
              </div>
            </section>
          </div>

          <aside class="panel no-print">
            <h2>Ссылки отделений</h2>
            <p>У каждого отделения своя отдельная HTML-страница. Им можно отправлять только свою ссылку.</p>
            <div class="link-grid">
              ${config.departmentDefinitions.map(buildCopyCard).join("")}
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  function renderDepartmentPage() {
    const row = getCurrentRow();
    const sourceLabel = sync.getSourceLabel(state.source);
    const rowFreshness = getRowFreshnessMeta(row);
    const currentDateTime = getCurrentDateTimeParts();

    if (!row) {
      app.innerHTML = `
        <div class="page">
          <div class="panel">
            <h2>Отделение не найдено</h2>
            <p>Для этой страницы не найдено нужное отделение. Вернись в главный файл и открой ссылку снова.</p>
          </div>
        </div>
      `;
      return;
    }

    const mainPath = appendShareQuery(config.getMainPagePath(basePath));
    const accessCodeValue = localStorage.getItem(config.getAccessCodeStorageKey(departmentId)) || "";

    app.innerHTML = `
      <div class="page">
        <div class="print-title print-only">
          <h1>${escapeHtml(PRINT_REPORT_TITLE)}</h1>
          <p>${escapeHtml(row.department)}</p>
        </div>
        <div class="toolbar no-print">
          <div>
            <h1>${escapeHtml(row.department)}</h1>
            <p>Эта страница заполняет только одно отделение и отправляет его данные в общий SARSH_KKZH.</p>
          </div>
          <div class="toolbar-actions">
            <span class="pill ${getSourceClass()}" id="syncModeLabel">${escapeHtml(sourceLabel)}</span>
            <div class="zoom-control">
              <label for="zoomRange">Масштаб</label>
              <input type="range" id="zoomRange" min="60" max="140" step="5" value="100">
              <span class="zoom-value" id="zoomValue">100%</span>
            </div>
            <a class="button-link" href="${escapeHtml(getSetupPath())}">Sync setup</a>
            <button type="button" id="saveBtn">Сохранить</button>
            <button type="button" id="refreshBtn">Обновить</button>
            <button type="button" id="resetBtn">Сбросить</button>
            <button type="button" id="printBtn">Печать</button>
            <a class="button-link" href="${escapeHtml(mainPath)}">К главному</a>
          </div>
        </div>

        <div class="info-stack">
          <div class="panel no-print">
            <h2>Синхронизация отделения</h2>
            <div class="meta-row">
              <div class="inline-field static-field">
                <span>Дата и время</span>
                <strong id="reportDateField">${escapeHtml(currentDateTime.full)}</strong>
              </div>
              ${sync.runtime.requireAccessCode ? `
                <label class="inline-field access-code">
                  <span>Код</span>
                  <input type="password" id="accessCodeField" value="${escapeHtml(accessCodeValue)}" aria-label="Код отделения">
                </label>
              ` : ""}
            </div>
            <p id="syncStatusText">${escapeHtml(getSyncDescription())}</p>
            <p class="hint" id="syncInfoText">${escapeHtml(state.info || "Изменения сохраняются локально сразу. Если онлайн-синхронизация включена, они автоматически отправляются в общий файл.")}</p>
            <p class="hint${state.warning ? " warning-note" : ""}" id="warningText">${escapeHtml(state.warning)}</p>
          </div>

          <div class="zoom-target">
            <div class="sheet-shell">
              <p class="status-line no-print">
                <strong>Последняя отправка:</strong>
                <span id="lastUpdatedText">${escapeHtml(formatTimestamp(row.updatedAt))}</span>
                <span class="status-chip status-chip--${rowFreshness.level}" id="lastUpdatedBadge">${escapeHtml(rowFreshness.label)}</span>
              </p>
              <div class="table-wrap">
                ${renderTable(state.snapshot, [row], { interactive: true, viewMode: "department" })}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPage() {
    if (mode === "department") {
      renderDepartmentPage();
    } else {
      renderMainPage();
    }

    attachCommonEvents();
    applyZoom(loadZoom());
    refreshTableData();
  }

  function refreshComputedCells() {
    const body = document.getElementById("sheetBody");
    if (!body) {
      return;
    }

    const rows = mode === "department" ? [getCurrentRow()].filter(Boolean) : state.snapshot.rows;
    rows.forEach((row) => {
      const presentEl = body.querySelector(`[data-output="presentTotal"][data-row="${row.id}"]`);
      if (presentEl) {
        presentEl.textContent = String(calcPresentTotal(state.snapshot, row));
      }

      const leaveEl = body.querySelector(`[data-output="leaveTotal"][data-row="${row.id}"]`);
      if (leaveEl) {
        leaveEl.textContent = String(calcLeaveTotal(state.snapshot, row) || 0);
      }

      config.columns.forEach((key) => {
        const span = body.querySelector(`[data-value="${row.id}:${key}"]`);
        if (span) {
          span.textContent = getDisplayValue(getEffectiveValue(state.snapshot, row, key));
        }
      });
    });

    Object.keys(config.linkedCells).forEach((linkedKey) => {
      const [targetRowId, targetKey] = linkedKey.split(":");
      const linkedEl = body.querySelector(`[data-linked="${linkedKey}"]`);
      if (linkedEl) {
        const targetRow = getDepartmentRow(state.snapshot, targetRowId);
        linkedEl.textContent = targetRow ? getDisplayValue(getEffectiveValue(state.snapshot, targetRow, targetKey)) : "";
      }
    });

    if (mode === "main") {
      refreshSummary("subtotal", state.snapshot.rows.filter((row) => row.group === "primary"));
      refreshSummary("grand", state.snapshot.rows);
    } else {
      const row = getCurrentRow();
      if (row) {
        refreshSummary("single", [row]);
      }
    }
  }

  function refreshSummary(summaryId, rows) {
    const body = document.getElementById("sheetBody");
    if (!body) {
      return;
    }
    config.columns.forEach((key) => {
      const el = body.querySelector(`[data-summary="${summaryId}"][data-key="${key}"]`);
      if (el) {
        el.textContent = String(getSummaryValue(state.snapshot, rows, key));
      }
    });
  }

  function refreshTableData() {
    const headerDateText = document.getElementById("sheetDateText");
    const headerTimeText = document.getElementById("sheetTimeText");
    const reportDateField = document.getElementById("reportDateField");
    const syncStatusText = document.getElementById("syncStatusText");
    const syncInfoText = document.getElementById("syncInfoText");
    const warningText = document.getElementById("warningText");
    const lastUpdatedText = document.getElementById("lastUpdatedText");
    const lastUpdatedBadge = document.getElementById("lastUpdatedBadge");
    const pills = Array.from(document.querySelectorAll("#syncModeLabel, #sheetSourcePill"));
    const currentDateTime = syncCurrentReportDate();

    if (headerDateText) {
      headerDateText.textContent = currentDateTime.date;
    }
    if (headerTimeText) {
      headerTimeText.textContent = currentDateTime.time;
    }
    if (reportDateField) {
      reportDateField.textContent = currentDateTime.full;
    }
    if (syncStatusText) {
      syncStatusText.textContent = getSyncDescription();
    }
    if (syncInfoText) {
      syncInfoText.textContent = state.info || (mode === "department"
        ? "Изменения сохраняются локально сразу. Если онлайн-синхронизация включена, они автоматически отправляются в общий файл."
        : "Главный файл можно печатать сразу, а PDF создается через кнопку Печать в браузере.");
    }
    if (warningText) {
      warningText.textContent = state.warning || "";
      warningText.classList.toggle("warning-note", Boolean(state.warning));
    }
    pills.forEach((pill) => {
      pill.textContent = sync.getSourceLabel(state.source);
      pill.classList.toggle("remote", state.source === "remote");
      pill.classList.toggle("local", state.source !== "remote");
    });

    if (lastUpdatedText) {
      if (mode === "department") {
        const row = getCurrentRow();
        const meta = getRowFreshnessMeta(row);
        lastUpdatedText.textContent = meta.timestamp;
        if (lastUpdatedBadge) {
          lastUpdatedBadge.textContent = meta.label;
          lastUpdatedBadge.className = `status-chip status-chip--${meta.level}`;
        }
      } else {
        lastUpdatedText.textContent = formatTimestamp(state.snapshot.updatedAt);
        if (lastUpdatedBadge) {
          const meta = getFreshnessMeta(state.snapshot.updatedAt);
          lastUpdatedBadge.textContent = meta.label;
          lastUpdatedBadge.className = `status-chip status-chip--${meta.level}`;
        }
      }
    }

    if (mode === "main") {
      const stats = buildFreshnessStats(state.snapshot.rows);
      const freshCount = document.getElementById("freshCount");
      const warningCount = document.getElementById("warningCount");
      const staleCount = document.getElementById("staleCount");
      const missingCount = document.getElementById("missingCount");
      const oldestText = document.getElementById("freshnessOldestText");

      if (freshCount) {
        freshCount.textContent = String(stats.counts.fresh);
      }
      if (warningCount) {
        warningCount.textContent = String(stats.counts.warning);
      }
      if (staleCount) {
        staleCount.textContent = String(stats.counts.stale);
      }
      if (missingCount) {
        missingCount.textContent = String(stats.counts.missing);
      }
      if (oldestText) {
        oldestText.textContent = stats.oldestRow
          ? `Самые старые данные: ${stats.oldestRow.department} — ${formatTimestamp(stats.oldestRow.updatedAt)} (${formatAge(stats.oldestRow.updatedAt)})`
          : "Нет ни одного отделения с отправленными данными.";
      }

      state.snapshot.rows.forEach((row) => {
        const meta = getRowFreshnessMeta(row);
        const statusEl = document.querySelector(`[data-department-status="${row.id}"]`);
        const updatedEl = document.querySelector(`[data-department-updated="${row.id}"]`);
        const ageEl = document.querySelector(`[data-department-age="${row.id}"]`);
        const listStatusEl = document.querySelector(`[data-update-status="${row.id}"]`);
        const listTimeEl = document.querySelector(`[data-update-time="${row.id}"]`);
        const listAgeEl = document.querySelector(`[data-update-age="${row.id}"]`);

        if (statusEl) {
          statusEl.textContent = meta.label;
          statusEl.className = `status-chip status-chip--${meta.level}`;
        }
        if (updatedEl) {
          updatedEl.textContent = meta.timestamp;
        }
        if (ageEl) {
          ageEl.textContent = meta.age;
        }
        if (listStatusEl) {
          listStatusEl.textContent = meta.label;
          listStatusEl.className = `status-chip status-chip--${meta.level}`;
        }
        if (listTimeEl) {
          listTimeEl.textContent = meta.timestamp;
        }
        if (listAgeEl) {
          listAgeEl.textContent = meta.age;
        }
      });
    }

    refreshComputedCells();
  }

  function setInfo(message, isError) {
    state.info = message || "";
    state.infoIsError = Boolean(isError);
    refreshTableData();
  }

  function sanitizeNumericInput(rawValue) {
    const cleaned = String(rawValue).replace(/[^\d]/g, "");
    if (!cleaned) {
      return { text: "", value: null };
    }
    const parsed = Math.max(0, Number(cleaned));
    return { text: String(parsed), value: parsed };
  }

  function getDetailRows() {
    return Array.from(document.querySelectorAll("tr.detail-row"));
  }

  function getRowInputMeta(rowElement) {
    return Array.from(rowElement.querySelectorAll("input[data-row][data-key]"))
      .map((input) => ({
        input,
        columnIndex: config.columnOrder.get(input.dataset.key)
      }))
      .filter((item) => Number.isInteger(item.columnIndex))
      .sort((a, b) => a.columnIndex - b.columnIndex);
  }

  function focusAndSelect(input) {
    input.focus();
    input.select();
    input.scrollIntoView({
      block: "nearest",
      inline: "nearest"
    });
  }

  function findHorizontalTarget(rowElement, currentColumnIndex, direction) {
    const inputs = getRowInputMeta(rowElement);
    const candidates = inputs.filter((item) =>
      direction < 0 ? item.columnIndex < currentColumnIndex : item.columnIndex > currentColumnIndex
    );

    if (!candidates.length) {
      return null;
    }

    return direction < 0 ? candidates[candidates.length - 1].input : candidates[0].input;
  }

  function findVerticalTarget(startRowIndex, currentColumnIndex, direction) {
    const rows = getDetailRows();

    for (let rowIndex = startRowIndex + direction; rowIndex >= 0 && rowIndex < rows.length; rowIndex += direction) {
      const inputs = getRowInputMeta(rows[rowIndex]);
      if (!inputs.length) {
        continue;
      }

      const exactMatch = inputs.find((item) => item.columnIndex === currentColumnIndex);
      if (exactMatch) {
        return exactMatch.input;
      }

      let nearest = inputs[0];
      for (const item of inputs) {
        if (Math.abs(item.columnIndex - currentColumnIndex) < Math.abs(nearest.columnIndex - currentColumnIndex)) {
          nearest = item;
        }
      }
      return nearest.input;
    }

    return null;
  }

  function getAccessCode() {
    const input = document.getElementById("accessCodeField");
    return input ? input.value.trim() : "";
  }

  function persistAccessCode() {
    if (!sync.runtime.requireAccessCode) {
      return;
    }
    localStorage.setItem(config.getAccessCodeStorageKey(departmentId), getAccessCode());
  }

  async function persistDepartment(manual) {
    const row = getCurrentRow();
    if (!row) {
      return;
    }

    syncCurrentReportDate();
    persistAccessCode();

    if (sync.runtime.requireAccessCode && !getAccessCode()) {
      setInfo("Для сохранения нужен код отделения.", true);
      return;
    }

    const saveId = ++state.saveSequence;
    setInfo(manual ? "Сохраняю данные отделения..." : "Отправляю изменения в общий файл...", false);

    try {
      const result = await sync.saveDepartment(departmentId, state.snapshot.reportDate, row.values, getAccessCode());
      if (saveId !== state.saveSequence) {
        return;
      }
      state.snapshot = deepCopy(result.snapshot);
      state.loadedSnapshot = deepCopy(result.snapshot);
      state.source = result.source;
      state.warning = "";
      setInfo(manual ? "Данные отделения сохранены." : "Изменения отправлены в общий файл.", false);
      refreshTableData();
    } catch (error) {
      setInfo(error instanceof Error ? error.message : "Не удалось сохранить данные отделения.", true);
    }
  }

  async function persistReportDate() {
    syncCurrentReportDate();
    setInfo("Сохраняю дату документа...", false);
    try {
      const result = await sync.saveReportDate(state.snapshot.reportDate);
      state.snapshot = deepCopy(result.snapshot);
      state.loadedSnapshot.reportDate = result.snapshot.reportDate;
      state.source = result.source;
      state.warning = "";
      setInfo("Дата документа сохранена.", false);
      refreshTableData();
    } catch (error) {
      setInfo(error instanceof Error ? error.message : "Не удалось сохранить дату.", true);
    }
  }

  function queueDepartmentSave() {
    window.clearTimeout(state.saveTimer);
    if (!sync.runtime.autoSync) {
      setInfo("Изменения сохранены локально. Нажми Сохранить для отправки.", false);
      return;
    }
    state.saveTimer = window.setTimeout(() => {
      persistDepartment(false);
    }, 900);
  }

  function loadZoom() {
    const zoomScope = mode === "department" ? departmentId : "main";
    const ownValue = Number(localStorage.getItem(config.getZoomStorageKey(zoomScope)));
    if (Number.isFinite(ownValue)) {
      return Math.min(140, Math.max(60, ownValue));
    }

    if (mode === "main") {
      const legacyValue = Number(localStorage.getItem(config.LEGACY_ZOOM_STORAGE_KEY));
      if (Number.isFinite(legacyValue)) {
        return Math.min(140, Math.max(60, legacyValue));
      }
    }

    return 100;
  }

  function applyZoom(value) {
    const normalized = Math.min(140, Math.max(60, Number(value) || 100));
    document.documentElement.style.setProperty("--sheet-zoom", String(normalized / 100));

    const range = document.getElementById("zoomRange");
    const label = document.getElementById("zoomValue");
    if (range) {
      range.value = String(normalized);
    }
    if (label) {
      label.textContent = `${normalized}%`;
    }

    const zoomScope = mode === "department" ? departmentId : "main";
    localStorage.setItem(config.getZoomStorageKey(zoomScope), String(normalized));
  }

  async function refreshFromSource() {
    syncCurrentReportDate();
    setInfo("Обновляю данные...", false);
    const result = await sync.loadSnapshot();
    state.snapshot = deepCopy(result.snapshot);
    state.loadedSnapshot = deepCopy(result.snapshot);
    state.source = result.source;
    state.warning = result.warning || "";
    setInfo("Данные обновлены.", false);
    renderPage();
  }

  function handleResetDepartment() {
    const loadedRow = getCurrentLoadedRow();
    const currentRow = getCurrentRow();
    if (!loadedRow || !currentRow) {
      return;
    }

    state.snapshot.reportDate = state.loadedSnapshot.reportDate;
    currentRow.values = deepCopy(loadedRow.values);
    currentRow.updatedAt = loadedRow.updatedAt;
    renderPage();
    setInfo("Возврат к последней сохраненной версии выполнен.", false);
  }

  function attachCommonEvents() {
    const zoomRange = document.getElementById("zoomRange");
    const printBtn = document.getElementById("printBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const resetBtn = document.getElementById("resetBtn");
    const saveBtn = document.getElementById("saveBtn");
    const accessCodeField = document.getElementById("accessCodeField");
    const sheetBody = document.getElementById("sheetBody");

    if (zoomRange) {
      zoomRange.addEventListener("input", () => {
        applyZoom(zoomRange.value);
      });
    }

    if (printBtn) {
      printBtn.addEventListener("click", () => {
        window.print();
      });
    }

    if (!state.printHandlersAttached) {
      window.addEventListener("beforeprint", () => {
        document.title = getPrintDocumentTitle();
      });

      window.addEventListener("afterprint", () => {
        document.title = DEFAULT_DOCUMENT_TITLE;
      });

      state.printHandlersAttached = true;
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        try {
          await refreshFromSource();
        } catch (error) {
          state.warning = error instanceof Error ? error.message : "Не удалось обновить данные.";
          setInfo("Не удалось обновить данные.", true);
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        persistDepartment(true);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        handleResetDepartment();
      });
    }

    if (accessCodeField) {
      accessCodeField.addEventListener("input", () => {
        persistAccessCode();
      });
    }

    document.querySelectorAll("[data-copy-link]").forEach((button) => {
      button.addEventListener("click", async () => {
        const relativeLink = button.getAttribute("data-copy-link") || "";
        const absoluteLink = new URL(relativeLink, window.location.href).toString();
        try {
          await navigator.clipboard.writeText(absoluteLink);
          setInfo(`Ссылка скопирована: ${relativeLink}`, false);
        } catch (error) {
          window.prompt("Скопируй ссылку вручную", absoluteLink);
        }
      });
    });

    if (mode !== "department" || !sheetBody) {
      return;
    }

    sheetBody.addEventListener("input", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      const rowId = input.dataset.row;
      const key = input.dataset.key;
      if (!rowId || !key) {
        return;
      }

      const row = getDepartmentRow(state.snapshot, rowId);
      if (!row) {
        return;
      }

      const sanitized = sanitizeNumericInput(input.value);
      input.value = sanitized.text;
      row.values[key] = sanitized.value;
      refreshTableData();
      queueDepartmentSave();
    });

    sheetBody.addEventListener("keydown", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.matches("input[data-row][data-key]")) {
        return;
      }

      const key = event.key;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) {
        return;
      }

      const rowElement = input.closest("tr.detail-row");
      const currentColumnIndex = config.columnOrder.get(input.dataset.key);
      if (!rowElement || !Number.isInteger(currentColumnIndex)) {
        return;
      }

      const rows = getDetailRows();
      const currentRowIndex = rows.indexOf(rowElement);
      if (currentRowIndex === -1) {
        return;
      }

      let target = null;
      if (key === "ArrowLeft") {
        target = findHorizontalTarget(rowElement, currentColumnIndex, -1);
      } else if (key === "ArrowRight") {
        target = findHorizontalTarget(rowElement, currentColumnIndex, 1);
      } else if (key === "ArrowUp") {
        target = findVerticalTarget(currentRowIndex, currentColumnIndex, -1);
      } else if (key === "ArrowDown") {
        target = findVerticalTarget(currentRowIndex, currentColumnIndex, 1);
      }

      if (!target) {
        return;
      }

      event.preventDefault();
      focusAndSelect(target);
    });
  }

  function startAutoRefreshIfNeeded() {
    window.clearInterval(state.refreshIntervalId);
    if (mode !== "main" || !sync.hasRemoteSync() || !Number.isFinite(sync.runtime.refreshIntervalMs) || sync.runtime.refreshIntervalMs <= 0) {
      return;
    }

    state.refreshIntervalId = window.setInterval(async () => {
      try {
        const result = await sync.loadSnapshot();
        state.snapshot = deepCopy(result.snapshot);
        state.loadedSnapshot = deepCopy(result.snapshot);
        state.source = result.source;
        state.warning = result.warning || "";
        refreshTableData();
      } catch (error) {
        state.warning = error instanceof Error ? error.message : "Не удалось обновить данные.";
        refreshTableData();
      }
    }, sync.runtime.refreshIntervalMs);
  }

  function startFreshnessTicker() {
    window.clearInterval(state.freshnessIntervalId);
    state.freshnessIntervalId = window.setInterval(() => {
      refreshTableData();
    }, 60000);
  }

  function startClockTicker() {
    window.clearInterval(state.clockIntervalId);
    state.clockIntervalId = window.setInterval(() => {
      refreshTableData();
    }, 30000);
  }

  async function init() {
    syncCurrentReportDate();
    setInfo("Загружаю данные...", false);
    const result = await sync.loadSnapshot();
    state.snapshot = deepCopy(result.snapshot);
    state.loadedSnapshot = deepCopy(result.snapshot);
    state.source = result.source;
    state.warning = result.warning || "";
    state.info = "";
    renderPage();
    startAutoRefreshIfNeeded();
    startFreshnessTicker();
    startClockTicker();
  }

  init().catch((error) => {
    app.innerHTML = `
      <div class="page">
        <div class="panel">
          <h2>Ошибка загрузки</h2>
          <p>${escapeHtml(error instanceof Error ? error.message : "Не удалось открыть систему SARSH_KKZH.")}</p>
        </div>
      </div>
    `;
  });
})();
