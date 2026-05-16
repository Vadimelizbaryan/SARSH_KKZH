(function () {
  const config = window.SHARSH_CONFIG || {};
  const sync = window.SHARSH_SYNC || {};
  const app = document.getElementById("app");
  const scriptBaseUrl = document.currentScript instanceof HTMLScriptElement && document.currentScript.src
    ? document.currentScript.src
    : new URL("assets/civil-referrals.js", window.location.href).href;
  let pdfJsModulePromise = null;

  const FIELD_DEFINITIONS = [
    { key: "patientName", label: "Ա․Ա․Հ․", hint: "Фамилия имя отчество" },
    { key: "medicalCenter", label: "ԲԿ", hint: "Медицинский центр" },
    { key: "militaryUnit", label: "Զորամաս", hint: "Номер войсковой части" },
    { key: "rank", label: "Կոչում", hint: "Звание" },
    { key: "draftYear", label: "Զորակ", hint: "Год призыва" },
    { key: "birthYear", label: "Ծնված", hint: "Год рождения" },
    { key: "referralDate", label: "Ուղեգրման", hint: "Дата направления" },
    { key: "dischargeDate", label: "Դուրսգրում", hint: "День выписки" }
  ];
  const IMPORT_FIELD_DEFINITIONS = FIELD_DEFINITIONS.filter((field) => field.key !== "dischargeDate");
  const SAVED_PAGE_SIZE = 80;

  const state = {
    parsedRows: [],
    savedRows: [],
    savedTotal: 0,
    savedLimit: SAVED_PAGE_SIZE,
    savedOffset: 0,
    savedQuery: "",
    sourceFileName: "",
    filter: "",
    status: "Загрузите RTF/PDF-файл Word, проверьте найденные строки и сохраните в базу.",
    isBusy: false,
    source: ""
  };
  let savedSearchTimer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/\u0000/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\?/g, "")
      .replace(/[ \t\r\n]+/g, " ")
      .replace(/\s+([։:.,])/g, "$1")
      .trim();
  }

  const ARMENIAN_WORD_RE = /^[\u0531-\u0587]+$/;

  function mergeShortArmenianSplits(value, options = {}) {
    const tokens = normalizeText(value).split(" ").filter(Boolean);
    const merged = [];

    tokens.forEach((token) => {
      const previous = merged[merged.length - 1];
      const shouldMerge = options.medicalCenter
        ? previous?.length <= 3 && token.length <= 3 && token !== "\u0532\u053F"
        : previous?.length <= 2 || token.length <= 2;
      if (
        previous
        && ARMENIAN_WORD_RE.test(previous)
        && ARMENIAN_WORD_RE.test(token)
        && shouldMerge
      ) {
        merged[merged.length - 1] = `${previous}${token}`;
      } else {
        merged.push(token);
      }
    });

    return merged.join(" ");
  }

  function normalizeCivilNameField(value) {
    return mergeShortArmenianSplits(value);
  }

  function normalizeCivilMedicalCenterField(value) {
    return mergeShortArmenianSplits(value, { medicalCenter: true });
  }

  function normalizeSearchText(value) {
    return normalizeText(value).toLowerCase();
  }

  function normalizeCompactSearchText(value) {
    return normalizeText(value)
      .replace(/([\u0531-\u0587])\s+([\u0531-\u0587])/g, "$1$2")
      .toLowerCase();
  }

  function decodeWindows1251Byte(byte) {
    try {
      return new TextDecoder("windows-1251").decode(new Uint8Array([byte]));
    } catch (_error) {
      return String.fromCharCode(byte);
    }
  }

  function normalizeRtfUnicodeCodePoint(value) {
    let codePoint = Number(value);
    if (!Number.isFinite(codePoint)) {
      return "";
    }
    if (codePoint < 0) {
      codePoint += 65536;
    }
    try {
      return String.fromCodePoint(codePoint);
    } catch (_error) {
      return "";
    }
  }

  function parseRtfTableRows(rtfText) {
    const rows = [];
    let cells = [];
    let current = "";
    let unicodeFallbackLength = 1;

    function pushCell() {
      cells.push(normalizeText(current));
      current = "";
    }

    function pushRow() {
      if (current.trim()) {
        pushCell();
      }
      const meaningful = cells.map(normalizeText).filter(Boolean);
      if (meaningful.length) {
        rows.push(cells.map(normalizeText));
      }
      cells = [];
      current = "";
    }

    function skipRtfFallbackChar(index) {
      const nextIndex = index + 1;
      if (nextIndex >= rtfText.length) {
        return index;
      }
      if (
        rtfText[nextIndex] === "\\"
        && rtfText[nextIndex + 1] === "'"
        && /^[0-9a-fA-F]{2}$/.test(rtfText.slice(nextIndex + 2, nextIndex + 4))
      ) {
        return index + 4;
      }
      return index + 1;
    }

    for (let index = 0; index < rtfText.length; index += 1) {
      const char = rtfText[index];

      if (char === "{" || char === "}") {
        continue;
      }

      if (char !== "\\") {
        current += char;
        continue;
      }

      const next = rtfText[index + 1];
      if (next === "'" && /^[0-9a-fA-F]{2}$/.test(rtfText.slice(index + 2, index + 4))) {
        current += decodeWindows1251Byte(parseInt(rtfText.slice(index + 2, index + 4), 16));
        index += 3;
        continue;
      }

      if (next && !/[a-zA-Z]/.test(next)) {
        if (next === "~") {
          current += " ";
        } else if (next === "_") {
          current += "-";
        } else if (next === "\\" || next === "{" || next === "}") {
          current += next;
        }
        index += 1;
        continue;
      }

      const match = rtfText.slice(index + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (!match) {
        continue;
      }

      const word = match[1];
      const numeric = match[2];
      const tokenLength = match[0].length;
      index += tokenLength;

      if (word === "uc" && numeric) {
        unicodeFallbackLength = Math.max(0, Number(numeric) || 0);
      } else if (word === "u" && numeric) {
        current += normalizeRtfUnicodeCodePoint(numeric);
        for (let skip = 0; skip < unicodeFallbackLength && index + 1 < rtfText.length; skip += 1) {
          index = skipRtfFallbackChar(index);
        }
      } else if (word === "cell") {
        pushCell();
      } else if (word === "row") {
        pushRow();
      } else if (word === "par" || word === "line" || word === "tab") {
        current += " ";
      }
    }

    pushRow();
    return rows;
  }

  async function loadPdfJs() {
    if (!pdfJsModulePromise) {
      pdfJsModulePromise = import(new URL("vendor/pdfjs/pdf.mjs", scriptBaseUrl).href).then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("vendor/pdfjs/pdf.worker.mjs", scriptBaseUrl).href;
        return pdfjs;
      });
    }
    return pdfJsModulePromise;
  }

  function getPdfItemText(item) {
    return normalizeText(item && item.str);
  }

  function groupPdfItemsIntoLines(items) {
    const lines = [];
    const sorted = items
      .filter((item) => item.text)
      .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);

    sorted.forEach((item) => {
      const line = lines.find((candidate) => {
        return candidate.page === item.page && Math.abs(candidate.y - item.y) <= 3.5;
      });
      if (line) {
        line.items.push(item);
        line.y = (line.y + item.y) / 2;
      } else {
        lines.push({ page: item.page, y: item.y, width: item.pageWidth, items: [item] });
      }
    });

    return lines.map((line) => ({
      ...line,
      items: line.items.sort((a, b) => a.x - b.x)
    }));
  }

  function splitPdfLineToCells(line) {
    let items = line.items.filter((item) => item.text);
    if (items.length < IMPORT_FIELD_DEFINITIONS.length) {
      return null;
    }

    if (/^\d{1,4}$/.test(items[0]?.text || "") && items.length > IMPORT_FIELD_DEFINITIONS.length) {
      items = items.slice(1);
    }

    if (items.length === IMPORT_FIELD_DEFINITIONS.length) {
      return items.map((item) => item.text);
    }

    const gaps = [];
    for (let index = 0; index < items.length - 1; index += 1) {
      const current = items[index];
      const next = items[index + 1];
      gaps.push({
        index,
        gap: next.x - (current.x + Math.max(current.width, 0))
      });
    }

    const splitIndexes = gaps
      .filter((gap) => gap.gap > Math.max(3, line.width * 0.004))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, IMPORT_FIELD_DEFINITIONS.length - 1)
      .map((gap) => gap.index)
      .sort((a, b) => a - b);

    if (splitIndexes.length < IMPORT_FIELD_DEFINITIONS.length - 1) {
      return null;
    }

    const groups = [];
    let startIndex = 0;
    splitIndexes.forEach((splitIndex) => {
      groups.push(items.slice(startIndex, splitIndex + 1));
      startIndex = splitIndex + 1;
    });
    groups.push(items.slice(startIndex));

    return groups.map((group) => normalizeText(group.map((item) => item.text).join(" ")));
  }

  async function parseCivilReferralPdf(file) {
    const pdfjs = await loadPdfJs();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const documentTask = pdfjs.getDocument({ data: bytes });
    const pdf = await documentTask.promise;
    const items = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      textContent.items.forEach((item) => {
        const text = getPdfItemText(item);
        if (!text) {
          return;
        }
        const transform = item.transform || [];
        items.push({
          page: pageNumber,
          pageWidth: viewport.width,
          text,
          x: Number(transform[4]) || 0,
          y: Number(transform[5]) || 0,
          width: Number(item.width) || 0
        });
      });
    }

    const rows = groupPdfItemsIntoLines(items)
      .map(splitPdfLineToCells)
      .filter((cells) => Array.isArray(cells) && cells.length >= IMPORT_FIELD_DEFINITIONS.length)
      .map((cells) => cells.slice(0, IMPORT_FIELD_DEFINITIONS.length))
      .filter((cells) => !isHeaderRow(cells))
      .map((cells, index) => normalizeRecord(cells, file.name, index + 1))
      .filter((record) => record.patientName && record.medicalCenter && record.referralDate);

    return rows;
  }

  function normalizeReferralDate(value) {
    const text = normalizeText(value);
    const match = text.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})/);
    if (!match) {
      return text;
    }
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3].length === 4 ? match[3].slice(-2) : match[3].padStart(2, "0");
    return `${day}.${month}.${year}`;
  }

  function normalizeRecord(cells, sourceFileName, sourceRow) {
    return {
      patientName: normalizeCivilNameField(cells[0]),
      medicalCenter: normalizeCivilMedicalCenterField(cells[1]),
      militaryUnit: normalizeText(cells[2]),
      rank: normalizeText(cells[3]),
      draftYear: normalizeText(cells[4]).replace(/[^\d]/g, ""),
      birthYear: normalizeText(cells[5]).replace(/[^\d]/g, ""),
      referralDate: normalizeReferralDate(cells[6]),
      dischargeDate: "",
      sourceFileName,
      sourceRow
    };
  }

  function normalizePageRecord(record) {
    const source = record && typeof record === "object" ? record : {};
    return {
      ...source,
      patientName: normalizeCivilNameField(source.patientName),
      medicalCenter: normalizeCivilMedicalCenterField(source.medicalCenter),
      militaryUnit: normalizeText(source.militaryUnit),
      rank: normalizeText(source.rank),
      draftYear: normalizeText(source.draftYear).replace(/[^\d]/g, ""),
      birthYear: normalizeText(source.birthYear).replace(/[^\d]/g, ""),
      referralDate: normalizeReferralDate(source.referralDate),
      dischargeDate: normalizeReferralDate(source.dischargeDate),
      sourceFileName: normalizeText(source.sourceFileName),
      importedAt: normalizeText(source.importedAt),
      updatedAt: normalizeText(source.updatedAt)
    };
  }

function isHeaderRow(cells) {
  const first = cells[0] || "";
  const third = cells[2] || "";
  const seventh = cells[6] || "";
  return first.length > 400
    || first.toLowerCase().includes("times new roman")
    || first.includes("Ա․Ա")
    || first.includes("ա․ա")
    || third.includes("Զորամաս")
    || third.includes("զորամաս")
    || seventh.includes("ՈՒղեգրման")
    || seventh.includes("Ուղեգրման")
    || seventh.includes("ուղեգրման");
}

  function parseCivilReferralRtf(rtfText, sourceFileName) {
    const tableRows = parseRtfTableRows(rtfText);
    return tableRows
      .filter((cells) => cells.length >= IMPORT_FIELD_DEFINITIONS.length)
      .map((cells) => cells.slice(0, IMPORT_FIELD_DEFINITIONS.length))
      .filter((cells) => !isHeaderRow(cells))
      .map((cells, index) => normalizeRecord(cells, sourceFileName, index + 1))
      .filter((record) => record.patientName && record.medicalCenter);
  }

  function getMainPagePath() {
    return config && typeof config.getMainPagePath === "function"
      ? config.getMainPagePath(".")
      : "index.html";
  }

  function getFilteredRows(rows) {
    return getFilteredRowEntries(rows).map((entry) => entry.row);
  }

  function getFilteredRowEntries(rows) {
    const query = normalizeSearchText(state.filter);
    const compactQuery = normalizeCompactSearchText(state.filter);
    return rows.map((row, index) => ({ row, index })).filter(({ row }) => {
      if (!query) {
        return true;
      }
      return FIELD_DEFINITIONS.some((field) => {
        return normalizeSearchText(row[field.key]).includes(query)
          || normalizeCompactSearchText(row[field.key]).includes(compactQuery);
      });
    });
  }

  function getSavedListOptions(offset = state.savedOffset) {
    return {
      limit: state.savedLimit || SAVED_PAGE_SIZE,
      offset: Math.max(0, Math.trunc(Number(offset) || 0)),
      query: normalizeText(state.filter).slice(0, 120)
    };
  }

  function applySavedPayload(payload) {
    state.savedRows = Array.isArray(payload?.rows) ? payload.rows.map(normalizePageRecord) : [];
    state.savedTotal = Number.isFinite(Number(payload?.total))
      ? Math.max(0, Math.trunc(Number(payload.total)))
      : state.savedRows.length;
    state.savedLimit = Math.max(1, Math.trunc(Number(payload?.limit) || state.savedLimit || SAVED_PAGE_SIZE));
    state.savedOffset = Math.max(0, Math.trunc(Number(payload?.offset) || 0));
    state.savedQuery = normalizeText(payload?.query || "");
    state.source = payload?.source || "";
  }

  function getSavedRangeText() {
    if (!state.savedTotal) {
      return "0 / 0";
    }
    const from = state.savedOffset + 1;
    const to = Math.min(state.savedOffset + state.savedRows.length, state.savedTotal);
    return `${from}-${to} / ${state.savedTotal}`;
  }

  function renderSavedPagination() {
    const totalPages = Math.ceil((state.savedTotal || 0) / (state.savedLimit || SAVED_PAGE_SIZE));
    if (totalPages <= 1) {
      return "";
    }

    const currentPage = Math.floor(state.savedOffset / state.savedLimit) + 1;
    const pageSet = new Set([1, totalPages, currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2]);
    const pages = [...pageSet]
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
    const parts = [];
    pages.forEach((page, index) => {
      if (index && page - pages[index - 1] > 1) {
        parts.push(`<span class="civil-page-gap">...</span>`);
      }
      parts.push(`
        <button
          type="button"
          class="civil-page-btn ${page === currentPage ? "is-active" : ""}"
          data-civil-page="${page}"
          ${page === currentPage || state.isBusy ? "disabled" : ""}
        >${page}</button>
      `);
    });

    return `
      <div class="civil-pagination" aria-label="Страницы базы">
        <button type="button" class="civil-page-btn" data-civil-page="${currentPage - 1}" ${currentPage <= 1 || state.isBusy ? "disabled" : ""}>Назад</button>
        ${parts.join("")}
        <button type="button" class="civil-page-btn" data-civil-page="${currentPage + 1}" ${currentPage >= totalPages || state.isBusy ? "disabled" : ""}>Вперёд</button>
      </div>
    `;
  }

  function renderRowsTable(rows, emptyText, sourceName, options = {}) {
    const visibleEntries = options.applyFilter === false
      ? rows.map((row, index) => ({ row, index }))
      : getFilteredRowEntries(rows);
    const rowNumberOffset = Math.max(0, Math.trunc(Number(options.rowNumberOffset) || 0));
    if (!visibleEntries.length) {
      return `<div class="civil-empty">${escapeHtml(emptyText)}</div>`;
    }

    return `
      <div class="civil-table-wrap">
        <table class="civil-table">
          <thead>
            <tr>
              <th>#</th>
              ${FIELD_DEFINITIONS.map((field) => `<th title="${escapeHtml(field.hint)}">${escapeHtml(field.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${visibleEntries.map(({ row, index }, visibleIndex) => `
              <tr>
                <td>${rowNumberOffset + visibleIndex + 1}</td>
                ${FIELD_DEFINITIONS.map((field) => `
                  <td>
                    <input
                      class="civil-edit-input"
                      type="text"
                      value="${escapeHtml(row[field.key] || "")}"
                      data-source="${escapeHtml(sourceName)}"
                      data-index="${index}"
                      data-key="${escapeHtml(field.key)}"
                      aria-label="${escapeHtml(field.label)}"
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
    if (!app) {
      return;
    }
    const parsedCount = state.parsedRows.length;
    const savedCount = state.savedTotal || state.savedRows.length;
    const savedPageCount = state.savedRows.length;
    const filteredParsedCount = getFilteredRows(state.parsedRows).length;

    app.innerHTML = `
      <div class="toolbar no-print">
        <div>
          <h1>Քաղ. ԲԿ բազա</h1>
          <p>Загрузка Word/RTF/PDF-документа с направленными в гражданские медцентры.</p>
        </div>
        <div class="toolbar-actions">
          <a class="button-link" href="${escapeHtml(getMainPagePath())}">К главному</a>
          <button type="button" id="civilReloadBtn" ${state.isBusy ? "disabled" : ""}>Обновить</button>
        </div>
      </div>

      <main class="civil-page">
        <section class="civil-hero">
          <div>
            <div class="civil-kicker">Безопасный отдельный реестр</div>
            <h2>Քաղաքացիական հիվանդանոցներ</h2>
            <p>Сначала проверьте строки после загрузки. Сохранение идет в отдельную группу базы и не меняет основную таблицу движения.</p>
          </div>
          <div class="civil-stats">
            <span>Найдено: <strong>${parsedCount}</strong></span>
            <span>В базе: <strong>${savedCount}</strong></span>
            <span>Показано: <strong>${state.parsedRows.length ? filteredParsedCount : savedPageCount}</strong></span>
          </div>
        </section>

        <section class="panel civil-database-panel">
          <div class="civil-section-head">
            <div>
              <h2>Загруженная база</h2>
              <p class="hint">Эти данные уже сохранены на сервере. Строки можно исправить прямо здесь и сохранить правки.</p>
            </div>
            <div class="civil-section-actions">
              <span class="civil-count-pill">${escapeHtml(getSavedRangeText())}</span>
              <button type="button" id="civilSaveDatabaseBtn" ${!savedPageCount || state.isBusy ? "disabled" : ""}>Сохранить правки базы</button>
            </div>
          </div>
          ${renderRowsTable(state.savedRows, "В базе пока нет записей.", "saved", { applyFilter: false, rowNumberOffset: state.savedOffset })}
          ${renderSavedPagination()}
        </section>

        <section class="panel civil-upload-panel">
          <h2>Загрузить документ</h2>
          <p class="hint">Поддерживается RTF или PDF из Word. Если файл в DOC/DOCX, сохраните его в Word как RTF/PDF и загрузите сюда.</p>
          <div class="civil-actions">
            <label class="button-link civil-file-label">
              <input type="file" id="civilFileInput" accept=".rtf,.pdf,.txt,application/pdf,application/rtf,text/rtf,text/plain" ${state.isBusy ? "disabled" : ""}>
              Выбрать RTF/PDF
            </label>
            <input type="search" id="civilFilterInput" placeholder="Поиск по ФИО, БК, части..." value="${escapeHtml(state.filter)}">
          </div>
          <div class="civil-status">${escapeHtml(state.status)}</div>
        </section>

        ${state.parsedRows.length ? `
          <section class="panel civil-draft-panel">
            <div class="civil-section-head">
              <div>
                <h2>Новые строки перед сохранением</h2>
                <p class="hint">Источник: ${escapeHtml(state.sourceFileName)}. Проверьте и исправьте эти строки, затем сохраните их в базу.</p>
              </div>
              <div class="civil-section-actions">
                <span class="civil-count-pill">${filteredParsedCount} / ${parsedCount}</span>
                <button type="button" id="civilSaveBtn" ${state.isBusy ? "disabled" : ""}>Сохранить найденные строки</button>
              </div>
            </div>
            ${renderRowsTable(state.parsedRows, "По текущему фильтру строк не найдено.", "parsed")}
          </section>
        ` : ""}
      </main>
    `;

    bindEvents();
  }

  function setBusy(isBusy, status) {
    state.isBusy = isBusy;
    if (status) {
      state.status = status;
    }
    render();
  }

  async function handleFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    setBusy(true, `Читаю файл: ${file.name}`);
    try {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isRtf = /\.rtf$/i.test(file.name) || /rtf|text\/plain/i.test(file.type || "");
      const rows = isPdf
        ? await parseCivilReferralPdf(file)
        : isRtf
          ? parseCivilReferralRtf(await file.text(), file.name)
          : [];
      if (!isPdf && !isRtf) {
        throw new Error("Можно загрузить RTF или PDF. Если документ в DOC/DOCX, сохраните его в Word как RTF или PDF.");
      }
      if (!rows.length) {
        throw new Error("Не нашел строки с 7 колонками. Проверьте, что документ сохранен из Word как RTF/PDF и таблица читается как текст.");
      }
      state.parsedRows = rows;
      state.sourceFileName = file.name;
      state.status = `Найдено строк: ${rows.length}. Проверьте таблицу и нажмите «Сохранить найденные строки».`;
    } catch (error) {
      state.parsedRows = [];
      state.sourceFileName = "";
      state.status = error instanceof Error ? error.message : "Не удалось прочитать файл.";
    } finally {
      state.isBusy = false;
      render();
    }
  }

  async function loadSavedRows(options = {}) {
    if (Number.isFinite(Number(options.offset))) {
      state.savedOffset = Math.max(0, Math.trunc(Number(options.offset)));
    }
    setBusy(true, "Проверяю сессию владельца...");
    try {
      const authReady = window.SHARSH_AUTH_READY;
      if (authReady && typeof authReady.then === "function") {
        await authReady;
      }
      state.status = "Загружаю сохраненную базу...";
      render();
      const listOptions = getSavedListOptions();
      const payload = typeof sync.listCivilReferrals === "function"
        ? await sync.listCivilReferrals(listOptions)
        : { rows: [] };
      applySavedPayload(payload);
      if (!state.savedRows.length && state.savedTotal > 0 && state.savedOffset > 0) {
        const lastOffset = Math.floor((state.savedTotal - 1) / state.savedLimit) * state.savedLimit;
        state.savedOffset = lastOffset;
        return await loadSavedRows({ offset: lastOffset });
      }
      const searchText = state.savedQuery ? ` Поиск: ${state.savedQuery}.` : "";
      state.status = state.savedTotal
        ? `База загружена: ${getSavedRangeText()}.${searchText}`
        : `В базе пока нет записей.${searchText}`;
    } catch (error) {
      state.status = error instanceof Error ? error.message : "Не удалось загрузить базу.";
    } finally {
      state.isBusy = false;
      render();
    }
  }

  async function saveParsedRows() {
    if (!state.parsedRows.length) {
      return;
    }
    setBusy(true, "Сохраняю строки в базу...");
    try {
      state.savedOffset = 0;
      const listOptions = getSavedListOptions(0);
      const payload = typeof sync.saveCivilReferrals === "function"
        ? await sync.saveCivilReferrals(state.parsedRows, state.sourceFileName, listOptions)
        : { rows: state.parsedRows, saved: state.parsedRows.length };
      applySavedPayload(payload);
      state.status = `Сохранено: ${payload?.saved || state.parsedRows.length}. В базе записей: ${state.savedTotal}.`;
    } catch (error) {
      state.status = error instanceof Error ? error.message : "Не удалось сохранить строки.";
    } finally {
      state.isBusy = false;
      render();
    }
  }

  async function saveSavedRows() {
    if (!state.savedRows.length) {
      return;
    }
    setBusy(true, "Сохраняю ручные правки в базу...");
    try {
      const listOptions = getSavedListOptions();
      const payload = typeof sync.saveCivilReferrals === "function"
        ? await sync.saveCivilReferrals(state.savedRows, "manual-edit", listOptions)
        : { rows: state.savedRows, saved: state.savedRows.length };
      applySavedPayload(payload);
      state.status = `Правки сохранены. В базе записей: ${state.savedTotal}.`;
    } catch (error) {
      state.status = error instanceof Error ? error.message : "Не удалось сохранить правки базы.";
    } finally {
      state.isBusy = false;
      render();
    }
  }

  function handleTableEdit(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains("civil-edit-input")) {
      return;
    }

    const source = input.dataset.source;
    const index = Number(input.dataset.index);
    const key = input.dataset.key;
    if (!Number.isInteger(index) || !key || !FIELD_DEFINITIONS.some((field) => field.key === key)) {
      return;
    }

    const rows = source === "parsed"
      ? state.parsedRows
      : source === "saved"
        ? state.savedRows
        : null;
    if (!rows || !rows[index]) {
      return;
    }

    rows[index] = {
      ...rows[index],
      [key]: key === "referralDate" || key === "dischargeDate"
        ? normalizeReferralDate(input.value)
        : key === "patientName"
          ? normalizeCivilNameField(input.value)
          : key === "medicalCenter"
            ? normalizeCivilMedicalCenterField(input.value)
            : normalizeText(input.value)
    };
  }

  function bindEvents() {
    document.getElementById("civilFileInput")?.addEventListener("change", handleFileUpload);
    document.getElementById("civilSaveBtn")?.addEventListener("click", saveParsedRows);
    document.getElementById("civilSaveDatabaseBtn")?.addEventListener("click", saveSavedRows);
    document.getElementById("civilReloadBtn")?.addEventListener("click", () => {
      state.savedOffset = 0;
      loadSavedRows();
    });
    document.getElementById("civilFilterInput")?.addEventListener("input", (event) => {
      state.filter = event.target.value;
      state.savedOffset = 0;
      window.clearTimeout(savedSearchTimer);
      savedSearchTimer = window.setTimeout(() => loadSavedRows(), 350);
    });
    document.querySelectorAll(".civil-page-btn[data-civil-page]").forEach((button) => {
      button.addEventListener("click", () => {
        const page = Number(button.getAttribute("data-civil-page"));
        if (!Number.isFinite(page) || page < 1) {
          return;
        }
        const offset = (Math.trunc(page) - 1) * state.savedLimit;
        loadSavedRows({ offset });
      });
    });
    document.querySelectorAll(".civil-edit-input").forEach((input) => {
      input.addEventListener("input", handleTableEdit);
      input.addEventListener("change", handleTableEdit);
    });
  }

  render();
  loadSavedRows();
})();
