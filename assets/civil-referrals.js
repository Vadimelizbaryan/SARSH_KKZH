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
  const DATE_FIELD_KEYS = new Set(["referralDate", "dischargeDate"]);
  const SAVED_PAGE_SIZE = 80;
  const DOCUMENT_EXPORT_LIMIT = 1000;

  const state = {
    parsedRows: [],
    savedRows: [],
    savedTotal: 0,
    savedLimit: SAVED_PAGE_SIZE,
    savedOffset: 0,
    savedQuery: "",
    selectedSavedIds: [],
    newRow: createEmptyRecord(),
    sourceFileName: "",
    filter: "",
    searchDraft: "",
    status: "Загрузите RTF/PDF-файл Word, проверьте найденные строки и сохраните в базу.",
    isBusy: false,
    source: ""
  };

  function createEmptyRecord() {
    return FIELD_DEFINITIONS.reduce((record, field) => {
      record[field.key] = "";
      return record;
    }, {});
  }

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

  function isDateFieldKey(key) {
    return DATE_FIELD_KEYS.has(key);
  }

  function sanitizeDateDraft(value) {
    return normalizeText(value)
      .replace(/[^\d.,/-]/g, "")
      .replace(/[,\-\/]+/g, ".")
      .replace(/\.{2,}/g, ".")
      .replace(/^\./, "")
      .slice(0, 10);
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
    const text = sanitizeDateDraft(value);
    const compact = text.replace(/\D/g, "");
    const compactMatch = compact.length === 6
      ? compact.match(/^(\d{2})(\d{2})(\d{2})$/)
      : compact.length === 8
        ? compact.match(/^(\d{2})(\d{2})(\d{4})$/)
        : null;
    const match = compactMatch || text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (!match) {
      return "";
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

  function padTwo(value) {
    return String(value).padStart(2, "0");
  }

  function formatDocumentDateTime(date = new Date()) {
    return `${padTwo(date.getDate())}.${padTwo(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)},${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
  }

  function getDocumentFileName() {
    return `Քաղ_ԲԿ_բազա_${formatDocumentDateTime().replace(/[.:,]/g, "-")}.doc`;
  }

  function buildCivilDocumentHtml(rows) {
    const generatedAt = formatDocumentDateTime();
    const searchText = normalizeText(state.filter);
    const metaText = searchText
      ? `Որոնում՝ ${searchText}`
      : "Բոլոր ցուցադրված տողերը";
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
    table.referrals td { background: #fff; }
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
      <col class="patient">
      <col class="center">
      <col class="unit">
      <col class="rank">
      <col class="short">
      <col class="short">
      <col class="date">
      <col class="date">
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        ${FIELD_DEFINITIONS.map((field) => `<th>${escapeHtml(field.label)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows.map((row, index) => `
        <tr>
          <td style="text-align:center;">${index + 1}</td>
          ${FIELD_DEFINITIONS.map((field) => `<td>${escapeHtml(row[field.key] || "")}</td>`).join("")}
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  async function loadDocumentRows() {
    const listOptions = {
      ...getSavedListOptions(0),
      limit: DOCUMENT_EXPORT_LIMIT,
      offset: 0
    };
    if (typeof sync.listCivilReferrals !== "function") {
      return state.savedRows.map(normalizePageRecord);
    }
    const payload = await sync.listCivilReferrals(listOptions);
    return Array.isArray(payload?.rows) ? payload.rows.map(normalizePageRecord) : [];
  }

  function downloadWordDocument(rows) {
    const html = buildCivilDocumentHtml(rows);
    const blob = new Blob([`\ufeff${html}`], { type: "application/msword;charset=utf-8" });
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
      state.status = "Браузер заблокировал окно печати. Попробуйте сохранить Word-документ.";
      render();
      return;
    }
    targetWindow.document.open();
    targetWindow.document.write(buildCivilDocumentHtml(rows));
    targetWindow.document.close();
    targetWindow.focus();
    targetWindow.setTimeout(() => targetWindow.print(), 350);
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

  function getSavedRowId(row) {
    return normalizeText(row && row.id);
  }

  function pruneSelectedSavedIds() {
    const visibleIds = new Set(state.savedRows.map(getSavedRowId).filter(Boolean));
    state.selectedSavedIds = state.selectedSavedIds.filter((id) => visibleIds.has(id));
  }

  function updateSelectedSavedId(id, isSelected) {
    const cleanId = normalizeText(id);
    if (!cleanId) {
      return;
    }
    const selected = new Set(state.selectedSavedIds);
    if (isSelected) {
      selected.add(cleanId);
    } else {
      selected.delete(cleanId);
    }
    state.selectedSavedIds = [...selected];
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
    pruneSelectedSavedIds();
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

  function renderNewRowForm() {
    return `
      <div class="civil-new-entry">
        <div class="civil-new-entry-head">
          <strong>Новая строка</strong>
          <span>Введите данные здесь и добавьте запись в базу.</span>
        </div>
        <div class="civil-new-entry-grid">
          ${FIELD_DEFINITIONS.map((field) => `
            <label class="civil-new-field ${field.key === "patientName" ? "is-wide" : ""}">
              <span title="${escapeHtml(field.hint)}">${escapeHtml(field.label)}</span>
              <input
                class="civil-new-input${isDateFieldKey(field.key) ? " civil-date-input" : ""}"
                type="text"
                value="${escapeHtml(state.newRow[field.key] || "")}"
                data-key="${escapeHtml(field.key)}"
                ${isDateFieldKey(field.key) ? 'inputmode="numeric" maxlength="10" placeholder="дд.мм.гг" autocomplete="off"' : ""}
                ${state.isBusy ? "disabled" : ""}
                aria-label="${escapeHtml(field.label)}"
              >
            </label>
          `).join("")}
          <button type="button" id="civilAddRowBtn" class="civil-new-add" ${state.isBusy ? "disabled" : ""}>Добавить</button>
        </div>
      </div>
    `;
  }

  function renderRowsTable(rows, emptyText, sourceName, options = {}) {
    const visibleEntries = options.applyFilter === false
      ? rows.map((row, index) => ({ row, index }))
      : getFilteredRowEntries(rows);
    const rowNumberOffset = Math.max(0, Math.trunc(Number(options.rowNumberOffset) || 0));
    const isSavedTable = sourceName === "saved";
    const selectedSavedIds = new Set(state.selectedSavedIds);
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
            ${visibleEntries.map(({ row, index }, visibleIndex) => {
              const rowNumber = rowNumberOffset + visibleIndex + 1;
              const rowId = isSavedTable ? getSavedRowId(row) : "";
              const isSelected = rowId && selectedSavedIds.has(rowId);
              return `
                <tr class="${isSelected ? "is-selected" : ""}">
                  <td>
                    ${isSavedTable ? `
                      <label class="civil-row-select" title="Выбрать строку">
                        <input
                          class="civil-row-checkbox"
                          type="checkbox"
                          data-id="${escapeHtml(rowId)}"
                          ${rowId ? "" : "disabled"}
                          ${isSelected ? "checked" : ""}
                          ${state.isBusy ? "disabled" : ""}
                        >
                        <span>${rowNumber}</span>
                      </label>
                    ` : rowNumber}
                  </td>
                  ${FIELD_DEFINITIONS.map((field) => `
                    <td>
                      <input
                        class="civil-edit-input${isDateFieldKey(field.key) ? " civil-date-input" : ""}"
                        type="text"
                        value="${escapeHtml(row[field.key] || "")}"
                        data-source="${escapeHtml(sourceName)}"
                        data-index="${index}"
                        data-key="${escapeHtml(field.key)}"
                        ${isDateFieldKey(field.key) ? 'inputmode="numeric" maxlength="10" placeholder="дд.мм.гг" autocomplete="off"' : ""}
                        aria-label="${escapeHtml(field.label)}"
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
    if (!app) {
      return;
    }
    const parsedCount = state.parsedRows.length;
    const savedCount = state.savedTotal || state.savedRows.length;
    const savedPageCount = state.savedRows.length;
    const filteredParsedCount = getFilteredRows(state.parsedRows).length;
    const selectedSavedCount = state.selectedSavedIds.length;

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
              <button type="button" id="civilPrintDocBtn" class="civil-document-button" ${!savedCount || state.isBusy ? "disabled" : ""}>Печать документа</button>
              <button type="button" id="civilExportDocBtn" class="civil-document-button" ${!savedCount || state.isBusy ? "disabled" : ""}>Сохранить Word</button>
              <button type="button" id="civilDeleteSelectedBtn" class="civil-delete-button" ${!selectedSavedCount || state.isBusy ? "disabled" : ""}>Удалить${selectedSavedCount ? ` (${selectedSavedCount})` : ""}</button>
              <button type="button" id="civilSaveDatabaseBtn" ${!savedPageCount || state.isBusy ? "disabled" : ""}>Сохранить правки базы</button>
            </div>
          </div>
          ${renderNewRowForm()}
          <div class="civil-database-tools">
            <input
              type="search"
              id="civilFilterInput"
              placeholder="Поиск: ФИО, БК, SR-21-7, SR-21-out-7, SR-21-14.05.25"
              value="${escapeHtml(state.searchDraft)}"
              ${state.isBusy ? "disabled" : ""}
            >
            <button
              type="button"
              id="civilSearchBtn"
              class="civil-search-button"
              title="Поиск"
              aria-label="Поиск"
              ${state.isBusy ? "disabled" : ""}
            >&#128269;</button>
            <span class="civil-search-note">Примеры: SR-21-7 - последние 7 дней направления, SR-21-out-7 - последние 7 дней выписки, SR-21-out-14.05.25 - дата выписки.</span>
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

  async function deleteSelectedSavedRows() {
    const ids = [...new Set(state.selectedSavedIds.map(normalizeText).filter(Boolean))];
    if (!ids.length || state.isBusy) {
      return;
    }
    const message = ids.length === 1
      ? "Удалить выбранную строку из базы?"
      : `Удалить выбранные строки из базы: ${ids.length}?`;
    if (!window.confirm(message)) {
      return;
    }

    setBusy(true, "Удаляю выбранные строки...");
    try {
      const listOptions = getSavedListOptions();
      const payload = typeof sync.deleteCivilReferrals === "function"
        ? await sync.deleteCivilReferrals(ids, listOptions)
        : { rows: state.savedRows.filter((row) => !ids.includes(getSavedRowId(row))), deleted: ids.length };
      state.selectedSavedIds = [];
      applySavedPayload(payload);
      if (!state.savedRows.length && state.savedTotal > 0 && state.savedOffset > 0) {
        const previousOffset = Math.max(0, state.savedOffset - state.savedLimit);
        state.savedOffset = previousOffset;
        await loadSavedRows({ offset: previousOffset });
        return;
      }
      state.status = `Удалено строк: ${payload?.deleted || ids.length}. В базе записей: ${state.savedTotal}.`;
    } catch (error) {
      state.status = error instanceof Error ? error.message : "Не удалось удалить выбранные строки.";
    } finally {
      state.isBusy = false;
      render();
    }
  }

  function normalizeEditableFieldValue(key, value, commit = false) {
    if (isDateFieldKey(key)) {
      return commit ? normalizeReferralDate(value) : sanitizeDateDraft(value);
    }
    if (key === "patientName") {
      return normalizeCivilNameField(value);
    }
    if (key === "medicalCenter") {
      return normalizeCivilMedicalCenterField(value);
    }
    return normalizeText(value);
  }

  function getNormalizedNewRow() {
    return FIELD_DEFINITIONS.reduce((record, field) => {
      record[field.key] = normalizeEditableFieldValue(field.key, state.newRow[field.key], true);
      return record;
    }, {});
  }

  function handleNewRowEdit(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains("civil-new-input")) {
      return;
    }
    const key = input.dataset.key;
    if (!key || !FIELD_DEFINITIONS.some((field) => field.key === key)) {
      return;
    }
    const value = normalizeEditableFieldValue(key, input.value, event.type === "change");
    input.value = value;
    state.newRow = {
      ...state.newRow,
      [key]: value
    };
  }

  async function saveNewRow() {
    if (state.isBusy) {
      return;
    }
    const row = getNormalizedNewRow();
    if (!row.patientName || !row.medicalCenter) {
      state.status = "Для новой строки заполните минимум ФИО и БК.";
      render();
      return;
    }
    setBusy(true, "Добавляю новую строку в базу...");
    try {
      state.savedOffset = 0;
      const listOptions = getSavedListOptions(0);
      const payload = typeof sync.saveCivilReferrals === "function"
        ? await sync.saveCivilReferrals([row], "manual-add", listOptions)
        : { rows: [row], saved: 1 };
      applySavedPayload(payload);
      state.newRow = createEmptyRecord();
      state.status = `Новая строка сохранена. В базе записей: ${state.savedTotal}.`;
    } catch (error) {
      state.status = error instanceof Error ? error.message : "Не удалось добавить новую строку.";
    } finally {
      state.isBusy = false;
      render();
    }
  }

  async function exportCurrentDocument() {
    if (state.isBusy) {
      return;
    }
    setBusy(true, "Готовлю Word-документ по текущему поиску...");
    try {
      const rows = await loadDocumentRows();
      if (!rows.length) {
        state.status = "Нет строк для сохранения в Word. Проверьте поисковый фильтр.";
        return;
      }
      downloadWordDocument(rows);
      state.status = `Word-документ подготовлен: ${rows.length} строк.`;
    } catch (error) {
      state.status = error instanceof Error ? error.message : "Не удалось подготовить Word-документ.";
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
    setBusy(true, "Готовлю документ к печати...");
    try {
      const rows = await loadDocumentRows();
      if (!rows.length) {
        state.status = "Нет строк для печати. Проверьте поисковый фильтр.";
        if (printWindow) {
          printWindow.close();
        }
        return;
      }
      printDocument(rows, printWindow);
      state.status = `Документ для печати открыт: ${rows.length} строк.`;
    } catch (error) {
      if (printWindow) {
        printWindow.close();
      }
      state.status = error instanceof Error ? error.message : "Не удалось подготовить печать.";
    } finally {
      state.isBusy = false;
      render();
    }
  }

  function runSavedSearch() {
    const input = document.getElementById("civilFilterInput");
    state.searchDraft = input instanceof HTMLInputElement ? input.value : state.searchDraft;
    state.filter = state.searchDraft;
    state.savedOffset = 0;
    loadSavedRows();
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

    if (isDateFieldKey(key)) {
      input.value = event.type === "change"
        ? normalizeReferralDate(input.value)
        : sanitizeDateDraft(input.value);
    }

    rows[index] = {
      ...rows[index],
      [key]: isDateFieldKey(key)
        ? input.value
        : key === "patientName"
          ? normalizeCivilNameField(input.value)
          : key === "medicalCenter"
            ? normalizeCivilMedicalCenterField(input.value)
            : normalizeText(input.value)
    };
  }

  function handleSavedRowSelection(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains("civil-row-checkbox")) {
      return;
    }
    updateSelectedSavedId(input.dataset.id, input.checked);
    render();
  }

  function bindEvents() {
    document.getElementById("civilFileInput")?.addEventListener("change", handleFileUpload);
    document.getElementById("civilSaveBtn")?.addEventListener("click", saveParsedRows);
    document.getElementById("civilSaveDatabaseBtn")?.addEventListener("click", saveSavedRows);
    document.getElementById("civilPrintDocBtn")?.addEventListener("click", printCurrentDocument);
    document.getElementById("civilExportDocBtn")?.addEventListener("click", exportCurrentDocument);
    document.getElementById("civilDeleteSelectedBtn")?.addEventListener("click", deleteSelectedSavedRows);
    document.getElementById("civilAddRowBtn")?.addEventListener("click", saveNewRow);
    document.getElementById("civilReloadBtn")?.addEventListener("click", () => {
      state.savedOffset = 0;
      loadSavedRows();
    });
    document.getElementById("civilFilterInput")?.addEventListener("input", (event) => {
      if (event.target instanceof HTMLInputElement) {
        state.searchDraft = event.target.value;
      }
    });
    document.getElementById("civilFilterInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runSavedSearch();
      }
    });
    document.getElementById("civilSearchBtn")?.addEventListener("click", runSavedSearch);
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
    document.querySelectorAll(".civil-row-checkbox").forEach((input) => {
      input.addEventListener("change", handleSavedRowSelection);
    });
    document.querySelectorAll(".civil-new-input").forEach((input) => {
      input.addEventListener("input", handleNewRowEdit);
      input.addEventListener("change", handleNewRowEdit);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveNewRow();
        }
      });
    });
  }

  render();
  loadSavedRows();
})();
