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
    { key: "referralDate", label: "Ուղեգրման", hint: "Дата направления" }
  ];

  const state = {
    parsedRows: [],
    savedRows: [],
    sourceFileName: "",
    filter: "",
    status: "Загрузите RTF/PDF-файл Word, проверьте найденные строки и сохраните в базу.",
    isBusy: false,
    source: ""
  };

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
    if (items.length < FIELD_DEFINITIONS.length) {
      return null;
    }

    if (/^\d{1,4}$/.test(items[0]?.text || "") && items.length > FIELD_DEFINITIONS.length) {
      items = items.slice(1);
    }

    if (items.length === FIELD_DEFINITIONS.length) {
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
      .slice(0, FIELD_DEFINITIONS.length - 1)
      .map((gap) => gap.index)
      .sort((a, b) => a - b);

    if (splitIndexes.length < FIELD_DEFINITIONS.length - 1) {
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
      .filter((cells) => Array.isArray(cells) && cells.length >= FIELD_DEFINITIONS.length)
      .map((cells) => cells.slice(0, FIELD_DEFINITIONS.length))
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
      .filter((cells) => cells.length >= FIELD_DEFINITIONS.length)
      .map((cells) => cells.slice(0, FIELD_DEFINITIONS.length))
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

  function renderRowsTable(rows, emptyText, sourceName) {
    const visibleEntries = getFilteredRowEntries(rows);
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
                <td>${visibleIndex + 1}</td>
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
    const savedCount = state.savedRows.length;
    const filteredSavedCount = getFilteredRows(state.savedRows).length;
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
            <span>Показано: <strong>${state.parsedRows.length ? filteredParsedCount : filteredSavedCount}</strong></span>
          </div>
        </section>

        <section class="panel civil-upload-panel">
          <h2>Загрузить документ</h2>
          <p class="hint">Поддерживается RTF или PDF из Word. Если файл в DOC/DOCX, сохраните его в Word как RTF/PDF и загрузите сюда.</p>
          <div class="civil-actions">
            <label class="button-link civil-file-label">
              <input type="file" id="civilFileInput" accept=".rtf,.pdf,.txt,application/pdf,application/rtf,text/rtf,text/plain" ${state.isBusy ? "disabled" : ""}>
              Выбрать RTF/PDF
            </label>
            <button type="button" id="civilSaveBtn" ${!parsedCount || state.isBusy ? "disabled" : ""}>Сохранить найденные строки</button>
            <input type="search" id="civilFilterInput" placeholder="Поиск по ФИО, БК, части..." value="${escapeHtml(state.filter)}">
          </div>
          <div class="civil-status">${escapeHtml(state.status)}</div>
        </section>

        ${state.parsedRows.length ? `
          <section class="panel">
            <h2>Предварительный просмотр: ${escapeHtml(state.sourceFileName)}</h2>
            <p class="hint">Можно исправить значения прямо в таблице перед сохранением.</p>
            ${renderRowsTable(state.parsedRows, "По текущему фильтру строк не найдено.", "parsed")}
          </section>
        ` : ""}

        <section class="panel">
          <div class="civil-section-head">
            <div>
              <h2>Сохраненная база</h2>
              <p class="hint">Здесь тоже можно исправить строку и сохранить правки в базе.</p>
            </div>
            <button type="button" id="civilSaveDatabaseBtn" ${!savedCount || state.isBusy ? "disabled" : ""}>Сохранить правки базы</button>
          </div>
          ${renderRowsTable(state.savedRows, "В базе пока нет записей.", "saved")}
        </section>
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

  async function loadSavedRows() {
    setBusy(true, "Загружаю сохраненную базу...");
    try {
      const payload = typeof sync.listCivilReferrals === "function"
        ? await sync.listCivilReferrals()
        : { rows: [] };
      state.savedRows = Array.isArray(payload?.rows) ? payload.rows.map(normalizePageRecord) : [];
      state.source = payload?.source || "";
      state.status = `База загружена. Записей: ${state.savedRows.length}.`;
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
      const payload = typeof sync.saveCivilReferrals === "function"
        ? await sync.saveCivilReferrals(state.parsedRows, state.sourceFileName)
        : { rows: state.parsedRows, saved: state.parsedRows.length };
      state.savedRows = Array.isArray(payload?.rows)
        ? payload.rows.map(normalizePageRecord)
        : state.parsedRows.map(normalizePageRecord);
      state.status = `Сохранено: ${payload?.saved || state.parsedRows.length}. В базе записей: ${state.savedRows.length}.`;
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
      const payload = typeof sync.saveCivilReferrals === "function"
        ? await sync.saveCivilReferrals(state.savedRows, "manual-edit")
        : { rows: state.savedRows, saved: state.savedRows.length };
      state.savedRows = Array.isArray(payload?.rows)
        ? payload.rows.map(normalizePageRecord)
        : state.savedRows.map(normalizePageRecord);
      state.status = `Правки сохранены. В базе записей: ${state.savedRows.length}.`;
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
      [key]: key === "referralDate"
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
    document.getElementById("civilReloadBtn")?.addEventListener("click", loadSavedRows);
    document.getElementById("civilFilterInput")?.addEventListener("input", (event) => {
      state.filter = event.target.value;
      render();
    });
    document.querySelectorAll(".civil-edit-input").forEach((input) => {
      input.addEventListener("input", handleTableEdit);
      input.addEventListener("change", handleTableEdit);
    });
  }

  render();
  loadSavedRows();
})();
