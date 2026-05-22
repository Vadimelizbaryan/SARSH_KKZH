(function () {
  const config = window.SHARSH_CONFIG || {};
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const telegram = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const root = document.getElementById("tg-form-root");

  const fields = [
    { cell: 1, key: "beenTotal", group: "Եղել է", label: "ընդ." },
    { cell: 2, key: "beenSoldier", group: "Եղել է", label: "զ/ծ" },
    { cell: 3, key: "beenSeries", group: "Եղել է", label: "շարք" },
    { cell: 4, key: "admittedTotal", group: "Ընդունվել է", label: "ընդ." },
    { cell: 5, key: "admittedSoldier", group: "Ընդունվել է", label: "զ/ծ" },
    { cell: 6, key: "admittedSeries", group: "Ընդունվել է", label: "շարք" },
    { cell: 7, key: "dgTotal", group: "Դ/Գ", label: "ընդ." },
    { cell: 8, key: "dgSoldier", group: "Դ/Գ", label: "զ/ծ" },
    { cell: 9, key: "dgSeries", group: "Դ/Գ", label: "շարք" },
    { cell: 10, key: "transferFromDepartment", group: "Տեղափոխ", label: "գնաց" },
    { cell: 11, key: "transferToDepartment", group: "Տեղափոխ", label: "եկավ" },
    { cell: 12, key: "presentTotal", group: "Հսկիչ", label: "հաշվ." },
    { cell: 13, key: "currentShar", group: "Առկա է", label: "շարք" },
    { cell: 14, key: "currentSpa", group: "Առկա է", label: "սպա" },
    { cell: 15, key: "currentPaym", group: "Առկա է", label: "պայմ." },
    { cell: 16, key: "currentZh", group: "Առկա է", label: "զ/հ" },
    { cell: 17, key: "family", group: "Առկա է", label: "զ/ծ ընտ" },
    { cell: 18, key: "officer", group: "Առկա է", label: "զ/պ" },
    { cell: 19, key: "civil", group: "Առկա է", label: "քաղ." },
    { cell: 20, key: "leaveSharq", group: "Արձակուրդ", label: "շարք" },
    { cell: 21, key: "leaveSpa", group: "Արձակուրդ", label: "սպա" },
    { cell: 22, key: "leavePaym", group: "Արձակուրդ", label: "պայմ." }
  ];

  const editableKeys = fields
    .filter((field) => field.key !== "presentTotal")
    .map((field) => field.key);
  const readOnlyKeys = new Set(editableKeys);
  const carryoverQueryParamByKey = {
    beenTotal: "c1",
    beenSoldier: "c2",
    beenSeries: "c3",
    admittedTotal: "c4",
    admittedSoldier: "c5",
    admittedSeries: "c6",
    dgTotal: "c7",
    dgSoldier: "c8",
    dgSeries: "c9",
    transferFromDepartment: "c10",
    transferToDepartment: "c11",
    presentTotal: "c12",
    currentShar: "c13",
    currentSpa: "c14",
    currentPaym: "c15",
    currentZh: "c16",
    family: "c17",
    officer: "c18",
    civil: "c19",
    leaveSharq: "c20",
    leaveSpa: "c21",
    leavePaym: "c22"
  };

  const presentKeys = [
    "currentShar",
    "currentSpa",
    "currentPaym",
    "currentZh",
    "family",
    "officer",
    "civil",
    "leaveSharq",
    "leaveSpa",
    "leavePaym"
  ];

  const fieldByKey = Object.fromEntries(fields.map((field) => [field.key, field]));
  const sectionDefinitions = [
    {
      title: "Եղել է",
      note: "Բերվում է գլխավոր աղյուսակից և մնում է միայն կարդալու համար։",
      columns: 3,
      keys: ["beenTotal", "beenSoldier", "beenSeries"]
    },
    {
      title: "Ընդունվել է",
      columns: 3,
      keys: ["admittedTotal", "admittedSoldier", "admittedSeries"]
    },
    {
      title: "Դ/Գ",
      columns: 3,
      keys: ["dgTotal", "dgSoldier", "dgSeries"]
    },
    {
      title: "Տեղափոխ / Հսկիչ",
      note: "12-րդ բջիջը վերահսկիչ հաշվարկն է և թարմացվում է ավտոմատ։",
      columns: 3,
      keys: ["transferFromDepartment", "transferToDepartment", "presentTotal"]
    },
    {
      title: "Առկա է",
      columns: 4,
      keys: ["currentShar", "currentSpa", "currentPaym", "currentZh", "family", "officer", "civil"]
    },
    {
      title: "Արձակուրդ",
      columns: 3,
      keys: ["leaveSharq", "leaveSpa", "leavePaym"]
    }
  ];

  const patientNoteSections = [
    { key: "admitted", title: "Ընդունված հիվանդներ", rows: 6 },
    { key: "discharged", title: "Դուրս գրված հիվանդներ", rows: 6 },
    { key: "transferred", title: "Տեղափոխված հիվանդներ", rows: 5 },
    { key: "dischargedNotTaken", title: "Դուրսգրված-չտարված", rows: 5 },
    { key: "returnedFromLeave", title: "Վերադարձել են արձակուրդից", rows: 5 },
    { key: "wentOnLeave", title: "Գնացել են արձակուրդ", rows: 5 }
  ];

  const calculatorColumns = [
    { type: "soldier", label: "ՇԱՐ", currentKey: "currentShar", incomingKey: "calcIncomingSoldier", dischargedKey: "calcDischargedSoldier", outputKey: "calcRemainingSoldier" },
    { type: "officer", label: "ՍՊԱ", currentKey: "currentSpa", incomingKey: "calcIncomingOfficer", dischargedKey: "calcDischargedOfficer", outputKey: "calcRemainingOfficer" },
    { type: "contract", label: "ՊԱՅՄ", currentKey: "currentPaym", incomingKey: "calcIncomingContract", dischargedKey: "calcDischargedContract", outputKey: "calcRemainingContract" },
    { type: "zh", label: "Զ/Հ", currentKey: "currentZh", incomingKey: "calcIncomingZh", dischargedKey: "calcDischargedZh", outputKey: "calcRemainingZh" },
    { type: "family", label: "Զ/Ծ ընտ", currentKey: "family", incomingKey: "calcIncomingFamily", dischargedKey: "calcDischargedFamily", outputKey: "calcRemainingFamily" },
    { type: "reserve", label: "Զ/Պ", currentKey: "officer", incomingKey: "calcIncomingReserve", dischargedKey: "calcDischargedReserve", outputKey: "calcRemainingReserve" },
    { type: "civil", label: "Ք-ի", currentKey: "civil", incomingKey: "calcIncomingCivil", dischargedKey: "calcDischargedCivil", outputKey: "calcRemainingCivil" }
  ];

  const calculatorRows = [
    { label: "Ընդունվել է", cells: calculatorColumns.map((column) => ({ key: column.incomingKey, role: "input" })) },
    { label: "Դուրս է գրվել", cells: calculatorColumns.map((column) => ({ key: column.dischargedKey, role: "input" })) },
    { label: "Հաշվարկ", cells: calculatorColumns.map((column) => ({ key: column.outputKey, role: "output" })) }
  ];

  const leaveCalculatorColumns = [
    { type: "sharq", label: "ՇԱՐ", presentKey: "currentShar", leaveKey: "leaveSharq", sentKey: "leaveCalcSentSharq", returnedKey: "leaveCalcReturnedSharq" },
    { type: "spa", label: "ՍՊԱ", presentKey: "currentSpa", leaveKey: "leaveSpa", sentKey: "leaveCalcSentSpa", returnedKey: "leaveCalcReturnedSpa" },
    { type: "paym", label: "ՊԱՅՄ", presentKey: "currentPaym", leaveKey: "leavePaym", sentKey: "leaveCalcSentPaym", returnedKey: "leaveCalcReturnedPaym" }
  ];

  const leaveCalculatorRows = [
    { label: "Ուղարկվել է բուժ. արձակուրդ", cells: leaveCalculatorColumns.map((column) => ({ key: column.sentKey, role: "input" })) },
    { label: "Վերադարձել է արձակուրդից", cells: leaveCalculatorColumns.map((column) => ({ key: column.returnedKey, role: "input" })) },
    { label: "Եղել է արձակուրդում", cells: leaveCalculatorColumns.map((column) => ({ key: column.leaveKey, role: "linked" })) },
    { label: "Հաշվարկ", cells: leaveCalculatorColumns.map((column) => ({ key: column.leaveKey, role: "output" })) }
  ];

  const calculatorState = calculatorColumns.reduce((accumulator, column) => {
    accumulator[column.incomingKey] = 0;
    accumulator[column.dischargedKey] = 0;
    return accumulator;
  }, {});

  const leaveCalculatorState = leaveCalculatorColumns.reduce((accumulator, column) => {
    accumulator[column.sentKey] = 0;
    accumulator[column.returnedKey] = 0;
    return accumulator;
  }, {});
  let fullEditUnlocked = false;

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

  function getDepartment() {
    const departmentId = getQuery().get("department") || "";
    return config.getDepartmentById ? config.getDepartmentById(departmentId) : null;
  }

  function getReportDate() {
    return getQuery().get("date") || (config.DEFAULT_DATE || "05,05,26");
  }

  function getCarryoverValue(key) {
    const query = getQuery();
    return toNumber(query.get(carryoverQueryParamByKey[key] || ""));
  }

  function getInitialValue(key) {
    return Object.prototype.hasOwnProperty.call(carryoverQueryParamByKey, key)
      ? getCarryoverValue(key)
      : 0;
  }

  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
  }

  function getPatientNotesStorageKey(department, reportDate) {
    const departmentId = department && department.id ? department.id : "unknown";
    return `sharsh:tg-form:patient-notes:${departmentId}:${reportDate || ""}`;
  }

  function createEmptyPatientNotes() {
    const notes = {};
    patientNoteSections.forEach((section) => {
      notes[section.key] = Array.from({ length: section.rows }, () => "");
    });
    return notes;
  }

  function normalizePatientNotes(source) {
    const notes = createEmptyPatientNotes();
    if (!source || typeof source !== "object") {
      return notes;
    }
    patientNoteSections.forEach((section) => {
      const values = Array.isArray(source[section.key]) ? source[section.key] : [];
      notes[section.key] = notes[section.key].map((_, index) => String(values[index] || ""));
    });
    return notes;
  }

  function loadPatientNotes(department, reportDate) {
    try {
      const raw = window.localStorage.getItem(getPatientNotesStorageKey(department, reportDate));
      return normalizePatientNotes(raw ? JSON.parse(raw) : null);
    } catch (error) {
      return createEmptyPatientNotes();
    }
  }

  function savePatientNotes(department, reportDate, notes) {
    try {
      window.localStorage.setItem(
        getPatientNotesStorageKey(department, reportDate),
        JSON.stringify(normalizePatientNotes(notes))
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearPatientNotes(department, reportDate) {
    try {
      window.localStorage.removeItem(getPatientNotesStorageKey(department, reportDate));
      return true;
    } catch (error) {
      return false;
    }
  }

  function countPatientNotes(notes) {
    return patientNoteSections.reduce((total, section) => (
      total + (notes[section.key] || []).filter((value) => String(value).trim()).length
    ), 0);
  }

  function readPatientNotes() {
    const notes = createEmptyPatientNotes();
    root.querySelectorAll("[data-patient-note-input]").forEach((input) => {
      const sectionKey = input.getAttribute("data-note-section");
      const index = Number(input.getAttribute("data-note-index"));
      if (sectionKey && Number.isInteger(index) && notes[sectionKey] && index >= 0 && index < notes[sectionKey].length) {
        notes[sectionKey][index] = input.value.trim();
      }
    });
    return notes;
  }

  function updatePatientNotesUi(notes, message) {
    const badge = root.querySelector("[data-patient-notes-badge]");
    const status = root.querySelector("[data-patient-notes-status]");
    const count = countPatientNotes(notes);
    if (badge) {
      badge.textContent = count ? `Լրացված է ${count}` : "Տեղային գրառում չկա";
    }
    if (status) {
      status.textContent = message || "Պահվում է այս սարքում եւ ուղարկվելիս կտեղադրվի PDF բլանկում։";
    }
  }

  function renderPatientNotesBlock(department, reportDate) {
    const notes = loadPatientNotes(department, reportDate);
    const filledCount = countPatientNotes(notes);
    const sections = patientNoteSections.map((section) => {
      const rows = notes[section.key] || [];
      const inputs = Array.from({ length: section.rows }, (_, index) => `
        <label class="tg-patient-note-row">
          <span>${index + 1}.</span>
          <input
            class="tg-patient-note-input"
            data-patient-note-input
            data-note-section="${escapeHtml(section.key)}"
            data-note-index="${index}"
            type="text"
            autocomplete="off"
            placeholder="Ա.Ա.Հ."
            value="${escapeHtml(rows[index] || "")}"
          >
        </label>
      `).join("");

      return `
        <section class="tg-patient-note-section">
          <h3>${escapeHtml(section.title)}</h3>
          <div class="tg-patient-note-lines">${inputs}</div>
        </section>
      `;
    }).join("");

    return `
      <section class="tg-patient-notes" data-patient-notes>
        <header class="tg-patient-notes-head">
          <div>
            <p class="tg-form-kicker">ՏԵՂԱՅԻՆ ԳՐԱՌՈՒՄՆԵՐ</p>
            <h2>Հիվանդների գրառումներ</h2>
          </div>
          <span class="tg-patient-notes-badge" data-patient-notes-badge>
            ${filledCount ? `Լրացված է ${filledCount}` : "Տեղային գրառում չկա"}
          </span>
        </header>
        <p class="tg-patient-notes-help">
          Այս մասը պահվում է այս սարքում եւ ուղարկվելիս կտեղադրվի PDF բլանկում։
        </p>
        <div class="tg-patient-notes-grid">${sections}</div>
        <div class="tg-patient-notes-actions">
          <button type="button" class="tg-patient-notes-save" data-save-patient-notes>Պահպանել տեղում</button>
          <button type="button" class="tg-patient-notes-clear" data-clear-patient-notes>Մաքրել գրառումները</button>
          <span data-patient-notes-status>Պահվում է այս սարքում եւ ուղարկվելիս կտեղադրվի PDF բլանկում։</span>
        </div>
      </section>
    `;
  }

  function readValues() {
    const values = {};
    fields.forEach((field) => {
      const key = field.key;
      const input = root.querySelector(`[data-field="${key}"]`);
      values[key] = toNumber(input ? input.value : 0);
    });
    return values;
  }

  function getCalculatorResult(values) {
    const nextValues = { ...values };
    const originalPresentTotal = getActual(values);
    const originalMilitary = toNumber(values.currentShar) + toNumber(values.currentSpa) + toNumber(values.currentPaym);
    const originalSeries = toNumber(values.currentShar);

    const incomingByType = Object.fromEntries(
      calculatorColumns.map((column) => [column.type, toNumber(calculatorState[column.incomingKey])])
    );
    const dischargedByType = Object.fromEntries(
      calculatorColumns.map((column) => [column.type, toNumber(calculatorState[column.dischargedKey])])
    );
    const remainingByType = Object.fromEntries(
      calculatorColumns.map((column) => [
        column.type,
        toNumber(values[column.currentKey]) + incomingByType[column.type] - dischargedByType[column.type]
      ])
    );

    nextValues.beenTotal = originalPresentTotal;
    nextValues.beenSoldier = originalMilitary;
    nextValues.beenSeries = originalSeries;
    nextValues.admittedTotal = calculatorColumns.reduce((sum, column) => sum + incomingByType[column.type], 0);
    nextValues.admittedSoldier = incomingByType.soldier + incomingByType.officer + incomingByType.contract;
    nextValues.admittedSeries = incomingByType.soldier;
    nextValues.dgTotal = calculatorColumns.reduce((sum, column) => sum + dischargedByType[column.type], 0);
    nextValues.dgSoldier = dischargedByType.soldier + dischargedByType.officer + dischargedByType.contract;
    nextValues.dgSeries = dischargedByType.soldier;
    nextValues.currentShar = remainingByType.soldier;
    nextValues.currentSpa = remainingByType.officer;
    nextValues.currentPaym = remainingByType.contract;
    nextValues.currentZh = remainingByType.zh;
    nextValues.family = remainingByType.family;
    nextValues.officer = remainingByType.reserve;
    nextValues.civil = remainingByType.civil;

    const leaveRemainingByType = Object.fromEntries(
      leaveCalculatorColumns.map((column) => [
        column.type,
        toNumber(values[column.leaveKey]) + toNumber(leaveCalculatorState[column.sentKey]) - toNumber(leaveCalculatorState[column.returnedKey])
      ])
    );
    const leavePresentByType = Object.fromEntries(
      leaveCalculatorColumns.map((column) => [
        column.type,
        toNumber(nextValues[column.presentKey]) - toNumber(leaveCalculatorState[column.sentKey]) + toNumber(leaveCalculatorState[column.returnedKey])
      ])
    );

    nextValues.currentShar = leavePresentByType.sharq;
    nextValues.currentSpa = leavePresentByType.spa;
    nextValues.currentPaym = leavePresentByType.paym;
    nextValues.leaveSharq = leaveRemainingByType.sharq;
    nextValues.leaveSpa = leaveRemainingByType.spa;
    nextValues.leavePaym = leaveRemainingByType.paym;
    nextValues.presentTotal = getExpected(nextValues);

    const invalidCurrentColumns = calculatorColumns.filter((column) => remainingByType[column.type] < 0);
    const invalidLeaveColumns = leaveCalculatorColumns.filter((column) =>
      leaveRemainingByType[column.type] < 0 || leavePresentByType[column.type] < 0
    );

    return {
      nextValues,
      remainingByType,
      leaveRemainingByType,
      invalidCurrentColumns,
      invalidLeaveColumns,
      isValid: invalidCurrentColumns.length === 0 && invalidLeaveColumns.length === 0
    };
  }

  function renderCalculatorEditableRow(row) {
    return `
      <tr>
        <th scope="row" class="tg-qh-row-title">${escapeHtml(row.label)}</th>
        ${row.cells.map((cell) => `
          <td class="tg-qh-cell">
            <input
              class="tg-form-input tg-qh-input"
              data-calc-key="${escapeHtml(cell.key)}"
              inputmode="numeric"
              pattern="[0-9]*"
              type="text"
              autocomplete="off"
              maxlength="4"
              value="${escapeHtml(calculatorState[cell.key] || 0)}"
            >
          </td>
        `).join("")}
      </tr>
    `;
  }

  function renderCalculatorOutputRow() {
    return `
      <tr class="tg-qh-output-row">
        <th scope="row" class="tg-qh-row-title">Հաշվարկ</th>
        ${calculatorColumns.map((column) => `
          <td class="tg-qh-cell tg-qh-cell--output">
            <span class="tg-form-control-value tg-qh-output" data-calc-output="${escapeHtml(column.outputKey)}">0</span>
          </td>
        `).join("")}
      </tr>
    `;
  }

  function renderLeaveCalculatorRow(row) {
    return `
      <tr>
        <th scope="row" class="tg-qh-row-title">${escapeHtml(row.label)}</th>
        ${row.cells.map((cell) => {
          if (cell.role === "input") {
            return `
              <td class="tg-qh-cell">
                <input
                  class="tg-form-input tg-qh-input"
                  data-leave-calc-key="${escapeHtml(cell.key)}"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  type="text"
                  autocomplete="off"
                  maxlength="4"
                  value="${escapeHtml(leaveCalculatorState[cell.key] || 0)}"
                >
              </td>
            `;
          }
          if (cell.role === "linked") {
            return `
              <td class="tg-qh-cell tg-qh-cell--output">
                <span class="tg-form-control-value tg-qh-output" data-leave-base="${escapeHtml(cell.key)}">0</span>
              </td>
            `;
          }
          return `
            <td class="tg-qh-cell tg-qh-cell--output">
              <span class="tg-form-control-value tg-qh-output" data-leave-output="${escapeHtml(cell.key)}">0</span>
            </td>
          `;
        }).join("")}
      </tr>
    `;
  }

  function renderCombinedCalculator() {
    return `
      <section class="tg-sheet-section tg-sheet-section--wide">
        <div class="tg-sheet-section-head">
          <div>
            <p class="tg-form-kicker">Հաշվարկային գործիքներ</p>
            <p class="tg-sheet-section-note">Մուտքագրեք ընդունված, դուրս գրված, արձակուրդ գնացող և արձակուրդից վերադարձած հիվանդների քանակը։ Սեղմեք «Հաշվել և տեղադրել», և տվյալները կտեղադրվեն ստորև եղած բջիջներում։</p>
          </div>
        </div>
        <div class="tg-calc-grid">
          <section class="tg-calc-card">
            <div class="tg-sheet-section-head">
              <div>
                <p class="tg-form-kicker">Ընդունում/Դուրսգրում</p>
              </div>
            </div>
            <div class="tg-form-table-wrap tg-qh-table-wrap">
              <table class="tg-form-table tg-qh-table">
                <thead>
                  <tr>
                    <th></th>
                    ${calculatorColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${calculatorRows.slice(0, 2).map(renderCalculatorEditableRow).join("")}
                  ${renderCalculatorOutputRow()}
                </tbody>
              </table>
            </div>
          </section>
          <section class="tg-calc-card">
            <div class="tg-sheet-section-head">
              <div>
                <p class="tg-form-kicker">Բուժական արձակուրդ</p>
              </div>
            </div>
            <div class="tg-form-table-wrap tg-qh-table-wrap">
              <table class="tg-form-table tg-qh-table">
                <thead>
                  <tr>
                    <th></th>
                    ${leaveCalculatorColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${leaveCalculatorRows.map(renderLeaveCalculatorRow).join("")}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div class="tg-form-status" data-calc-status></div>
        <button class="tg-form-submit tg-calc-apply" data-apply-calculators type="button">Հաշվել և տեղադրել</button>
      </section>
    `;
  }

  function refreshCalculatorUi() {
    const values = readValues();
    const calculatorResult = getCalculatorResult(values);

    calculatorColumns.forEach((column) => {
      const target = root.querySelector(`[data-calc-output="${column.outputKey}"]`);
      if (target) {
        target.textContent = String(calculatorResult.remainingByType[column.type] || 0);
      }
    });

    leaveCalculatorColumns.forEach((column) => {
      const baseTarget = root.querySelector(`[data-leave-base="${column.leaveKey}"]`);
      const outputTarget = root.querySelector(`[data-leave-output="${column.leaveKey}"]`);
      if (baseTarget) {
        baseTarget.textContent = String(toNumber(values[column.leaveKey]));
      }
      if (outputTarget) {
        outputTarget.textContent = String(calculatorResult.leaveRemainingByType[column.type] || 0);
      }
    });

    const status = root.querySelector("[data-calc-status]");
    const applyButton = root.querySelector("[data-apply-calculators]");
    if (status) {
      const invalidLabels = [
        ...calculatorResult.invalidCurrentColumns.map((column) => column.label),
        ...calculatorResult.invalidLeaveColumns.map((column) => column.label)
      ];
      status.className = `tg-form-status${calculatorResult.isValid ? "" : " bad"}`;
      status.innerHTML = calculatorResult.isValid
        ? `
          <div class="tg-form-status-head">
            <strong>Հաշվարկը պատրաստ է</strong>
            <span>Սեղմեք «Հաշվել և տեղադրել», և տվյալները կտեղադրվեն բաժանմունքի ձևի բջիջներում։</span>
          </div>
        `
        : `
          <div class="tg-form-status-head">
            <strong>Ստուգեք հաշվարկը</strong>
            <span>${escapeHtml(`Բացասական արժեք է ստացվում հետևյալ սյունակներում՝ ${invalidLabels.join(", ")}։`)}</span>
          </div>
        `;
    }
    if (applyButton) {
      applyButton.disabled = !calculatorResult.isValid;
    }
  }

  function writeValuesToForm(values) {
    fields.forEach((field) => {
      const key = field.key;
      const input = root.querySelector(`[data-field="${key}"]`);
      if (input) {
        input.value = String(toNumber(values[key]));
      }
    });
  }

  function applyCombinedCalculator() {
    const values = readValues();
    const calculatorResult = getCalculatorResult(values);
    if (!calculatorResult.isValid) {
      refreshCalculatorUi();
      return;
    }

    writeValuesToForm(calculatorResult.nextValues);
    Object.keys(calculatorState).forEach((key) => {
      calculatorState[key] = 0;
      const input = root.querySelector(`[data-calc-key="${key}"]`);
      if (input) {
        input.value = "0";
      }
    });
    Object.keys(leaveCalculatorState).forEach((key) => {
      leaveCalculatorState[key] = 0;
      const input = root.querySelector(`[data-leave-calc-key="${key}"]`);
      if (input) {
        input.value = "0";
      }
    });
    refreshCalculatorUi();
    updateControl();

    const message = root.querySelector("[data-message]");
    if (message && getInitData()) {
      message.className = "tg-form-message";
      message.textContent = "Հաշվարկային տվյալները տեղադրվել են ձևի բջիջներում։ Ստուգեք և ուղարկեք։";
    }
  }

  function renderPatientNotesMobileBlock(department, reportDate) {
    const notes = loadPatientNotes(department, reportDate);
    const filledCount = countPatientNotes(notes);
    const sections = patientNoteSections.map((section) => {
      const rows = notes[section.key] || [];
      const inputs = Array.from({ length: section.rows }, (_, index) => `
        <label class="tg-patient-note-row">
          <span>${index + 1}.</span>
          <input
            class="tg-patient-note-input"
            data-patient-note-input
            data-note-section="${escapeHtml(section.key)}"
            data-note-index="${index}"
            type="text"
            autocomplete="off"
            placeholder="Ա.Ա.Հ."
            value="${escapeHtml(rows[index] || "")}"
          >
        </label>
      `).join("");

      return `
        <section class="tg-patient-note-section">
          <h3>${escapeHtml(section.title)}</h3>
          <div class="tg-patient-note-lines">${inputs}</div>
        </section>
      `;
    }).join("");

    return `
      <details class="tg-patient-notes" data-patient-notes>
        <summary class="tg-patient-notes-summary">
          <div class="tg-patient-notes-head">
            <div>
              <p class="tg-form-kicker">ՏԵՂԱՅԻՆ ԳՐԱՌՈՒՄՆԵՐ</p>
              <h2>Հիվանդների գրառումներ</h2>
            </div>
            <span class="tg-patient-notes-badge" data-patient-notes-badge>
              ${filledCount ? `Լրացված է ${filledCount}` : "Տեղային գրառում չկա"}
            </span>
          </div>
        </summary>
        <p class="tg-patient-notes-help">
          Այս մասը պահվում է այս սարքում և ուղարկվելիս կտեղադրվի PDF բլանկում։
        </p>
        <div class="tg-patient-notes-grid">${sections}</div>
        <div class="tg-patient-notes-actions">
          <button type="button" class="tg-patient-notes-save" data-save-patient-notes>Պահպանել տեղում</button>
          <button type="button" class="tg-patient-notes-clear" data-clear-patient-notes>Մաքրել գրառումները</button>
          <span data-patient-notes-status>Պահվում է այս սարքում և ուղարկվելիս կտեղադրվի PDF բլանկում։</span>
        </div>
      </details>
    `;
  }

  function renderFieldCard(field) {
    const isControl = field.key === "presentTotal";
    const isReadOnly = readOnlyKeys.has(field.key);
    const controlHtml = isControl
      ? '<span class="tg-sheet-field-value" data-control-total>0</span>'
      : `
        <input
          class="tg-form-input tg-sheet-field-input${isReadOnly ? " tg-form-input--readonly" : ""}"
          data-field="${escapeHtml(field.key)}"
          inputmode="numeric"
          pattern="[0-9]*"
          type="text"
          autocomplete="off"
          maxlength="3"
          value="${getInitialValue(field.key)}"
          ${isReadOnly ? 'readonly aria-readonly="true" title="Ստացվել է գլխավոր աղյուսակից"' : ""}
        >
      `;

    return `
      <label class="tg-sheet-field${isReadOnly ? " is-readonly" : ""}">
        <span class="tg-sheet-field-top">
          <span class="tg-sheet-field-index">${field.cell}</span>
          <span class="tg-sheet-field-label">${escapeHtml(field.label)}</span>
        </span>
        ${controlHtml}
      </label>
    `;
  }

  function renderSection(section) {
    return `
      <section class="tg-sheet-section${section.columns >= 4 ? " tg-sheet-section--wide" : ""}">
        <div class="tg-sheet-section-head">
          <div>
            <p class="tg-form-kicker">${escapeHtml(section.title)}</p>
            ${section.note ? `<p class="tg-sheet-section-note">${escapeHtml(section.note)}</p>` : ""}
          </div>
        </div>
        <div class="tg-sheet-grid tg-sheet-grid--${section.columns}">
          ${section.keys.map((key) => renderFieldCard(fieldByKey[key])).join("")}
        </div>
      </section>
    `;
  }

  function renderFieldCard(field) {
    const isControl = field.key === "presentTotal";
    const isReadOnly = readOnlyKeys.has(field.key);
    return `
      <label class="tg-sheet-field${isReadOnly ? " is-readonly" : ""}">
        <span class="tg-sheet-field-top">
          <span class="tg-sheet-field-index">${field.cell}</span>
          <span class="tg-sheet-field-label">${escapeHtml(field.label)}</span>
        </span>
        <input
          class="tg-form-input tg-sheet-field-input${isReadOnly ? " tg-form-input--readonly" : ""}"
          ${isControl ? 'data-control-total' : ""}
          data-field="${escapeHtml(field.key)}"
          inputmode="numeric"
          pattern="[0-9]*"
          type="text"
          autocomplete="off"
          maxlength="3"
          value="${getInitialValue(field.key)}"
          ${isReadOnly ? 'readonly aria-readonly="true" title="Ստացվել է գլխավոր աղյուսակից"' : ""}
        >
      </label>
    `;
  }

  function syncFieldLockState() {
    root.querySelectorAll("[data-field]").forEach((input) => {
      const key = input.getAttribute("data-field");
      const shouldLock = !fullEditUnlocked;
      input.readOnly = shouldLock;
      input.setAttribute("aria-readonly", shouldLock ? "true" : "false");
      input.classList.toggle("tg-form-input--readonly", shouldLock);
      input.closest(".tg-sheet-field")?.classList.toggle("is-readonly", shouldLock);
      if (shouldLock) {
        input.setAttribute("title", "Ստացվել է գլխավոր աղյուսակից");
      } else {
        input.setAttribute("title", "Խմբագրումը միացված է");
      }
      if (key === "presentTotal" && shouldLock) {
        updateControl();
      }
    });

    const lockInput = root.querySelector("[data-full-edit-toggle]");
    const lockText = root.querySelector("[data-full-edit-status]");
    if (lockInput) {
      lockInput.checked = fullEditUnlocked;
    }
    if (lockText) {
      lockText.textContent = fullEditUnlocked
        ? "Խմբագրումը միացված է․ կարող եք փոխել 1-22 բոլոր բջիջները։"
        : "Խմբագրումը անջատված է․ բջիջները միայն դիտման համար են։";
    }
  }

  function getExpected(values) {
    return (values.beenTotal + values.admittedTotal + values.transferToDepartment)
      - (values.dgTotal + values.transferFromDepartment);
  }

  function getActual(values) {
    return presentKeys.reduce((sum, key) => sum + toNumber(values[key]), 0);
  }

  function shouldCheckExtraControls(values) {
    return toNumber(values.transferFromDepartment) === 0 && toNumber(values.transferToDepartment) === 0;
  }

  function getValidationChecks(values) {
    const checks = [];
    const actual = getActual(values);
    const expected = getExpected(values);
    checks.push({
      id: "present-balance",
      name: "Առկա է",
      ruleText: "13-22 = (1 + 4 + 11) - (7 + 10)",
      actual,
      expected,
      isValid: actual === expected
    });

    if (shouldCheckExtraControls(values)) {
      const soldierActual = (values.beenSeries + values.admittedSeries) - values.dgSeries;
      const soldierExpected = values.currentShar + values.leaveSharq;
      checks.push({
        id: "soldier-count",
        name: "Շարքայիններ",
        ruleText: "(3 + 6) - 9 = 13 + 20",
        actual: soldierActual,
        expected: soldierExpected,
        isValid: soldierActual === soldierExpected
      });

      const militaryActual = (values.beenSoldier + values.admittedSoldier) - values.dgSoldier;
      const militaryExpected = values.currentShar
        + values.currentSpa
        + values.currentPaym
        + values.leaveSharq
        + values.leaveSpa
        + values.leavePaym;
      checks.push({
        id: "military-count",
        name: "Զինծառայողներ",
        ruleText: "(2 + 5) - 8 = 13 + 14 + 15 + 20 + 21 + 22",
        actual: militaryActual,
        expected: militaryExpected,
        isValid: militaryActual === militaryExpected
      });
    }

    return checks;
  }

  function getValidationResult(values) {
    const checks = getValidationChecks(values);
    return {
      checks,
      isValid: checks.every((check) => check.isValid)
    };
  }

  function formatValidationLine(check) {
    return check.isValid
      ? `${check.name}: ${check.actual} = ${check.expected}`
      : `${check.name}: հիմա ${check.actual}, պետք է ${check.expected}`;
  }

  function isUsingCopiedValues(values) {
    return editableKeys.every((key) => toNumber(values[key]) === getInitialValue(key));
  }

  function updateControl() {
    const values = readValues();
    const validation = getValidationResult(values);
    const primaryCheck = validation.checks[0];
    const copiedState = isUsingCopiedValues(values);
    const control = root.querySelector("[data-control-total]");
    const status = root.querySelector("[data-status]");
    const submit = root.querySelector("[data-submit]");

    if (control) {
      control.textContent = String(copiedState || !primaryCheck
        ? getInitialValue("presentTotal")
        : primaryCheck.expected);
    }
    if (status) {
      status.classList.toggle("bad", !validation.isValid);
      status.innerHTML = getInitData()
        ? `
          <div class="tg-form-status-head">
            <strong>${validation.isValid ? "Բոլոր վերահսկիչները համընկնում են" : "Ստուգեք վերահսկիչ գումարները"}</strong>
            <span>${escapeHtml(copiedState
              ? "Բոլոր բջիջները բերվել են գլխավոր աղյուսակից։"
              : "Փոփոխված տվյալները ստուգվում են ընթացիկ մուտքի հիման վրա։")}</span>
          </div>
          <div class="tg-validation-list">
            ${validation.checks.map((check) => `
              <div class="tg-validation-item${check.isValid ? "" : " is-bad"}">
                <span class="tg-validation-bullet">${check.isValid ? "✓" : "!"}</span>
                <span>${escapeHtml(formatValidationLine(check))}</span>
              </div>
            `).join("")}
            ${!shouldCheckExtraControls(values)
              ? `<div class="tg-validation-note">${escapeHtml("«Շարքայիններ» և «Զինծառայողներ» ստուգումները միանում են, երբ 10 և 11 բջիջներում արժեքը 0 է։")}</div>`
              : ""}
          </div>
        `
        : `<div class="tg-form-status-head"><strong>${escapeHtml("Բացեք ձևը Telegram բոտի կոճակով։")}</strong></div>`;
    }
    if (submit) {
      submit.disabled = !validation.isValid || !getInitData();
    }
  }

  function getInitData() {
    return telegram && typeof telegram.initData === "string" ? telegram.initData : "";
  }

  function updateControl() {
    const values = readValues();
    const validation = getValidationResult(values);
    const primaryCheck = validation.checks[0];
    const copiedState = isUsingCopiedValues(values);
    const control = root.querySelector("[data-control-total]");
    const status = root.querySelector("[data-status]");
    const submit = root.querySelector("[data-submit]");

    if (control && !fullEditUnlocked) {
      control.value = String(copiedState || !primaryCheck
        ? getInitialValue("presentTotal")
        : primaryCheck.expected);
    }
    if (status) {
      status.classList.toggle("bad", !validation.isValid);
      status.innerHTML = getInitData()
        ? `
          <div class="tg-form-status-head">
            <strong>${validation.isValid ? "Բոլոր վերահսկիչները համընկնում են" : "Ստուգեք վերահսկիչ գումարները"}</strong>
            <span>${escapeHtml(copiedState
              ? "Բոլոր բջիջները բերվել են գլխավոր աղյուսակից։"
              : "Փոփոխված տվյալները ստուգվում են ընթացիկ մուտքի հիման վրա։")}</span>
          </div>
          <div class="tg-validation-list">
            ${validation.checks.map((check) => `
              <div class="tg-validation-item${check.isValid ? "" : " is-bad"}">
                <span class="tg-validation-bullet">${check.isValid ? "✓" : "!"}</span>
                <span>${escapeHtml(formatValidationLine(check))}</span>
              </div>
            `).join("")}
            ${!shouldCheckExtraControls(values)
              ? `<div class="tg-validation-note">${escapeHtml("«Շարքայիններ» և «Զինծառայողներ» ստուգումները միանում են, երբ 10 և 11 բջիջներում արժեքը 0 է։")}</div>`
              : ""}
          </div>
        `
        : `<div class="tg-form-status-head"><strong>${escapeHtml("Բացեք ձևը Telegram բոտի կոճակով։")}</strong></div>`;
    }
    if (submit) {
      submit.disabled = !validation.isValid || !getInitData();
    }
  }

  function getEndpoint() {
    const baseUrl = String(runtime.supabaseUrl || "https://ywecvlapdlaojpvijaqy.supabase.co").replace(/\/+$/, "");
    return `${baseUrl}/functions/v1/Mainflow-telegram?action=web-form-submit`;
  }

  async function submitForm(event) {
    event.preventDefault();
    const submit = root.querySelector("[data-submit]");
    const message = root.querySelector("[data-message]");
    const department = getDepartment();
    if (!department) {
      return;
    }

    const values = readValues();
    const validation = getValidationResult(values);
    if (!validation.isValid) {
      updateControl();
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = "Отправляю...";
    }
    if (message) {
      message.className = "tg-form-message";
      message.textContent = "Ստուգում եմ և ուղարկում տվյալները...";
    }

    try {
      const response = await fetch(getEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(),
          departmentId: department.id,
          reportDate: getReportDate(),
          values,
          patientNotes: readPatientNotes()
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(payload && payload.error ? payload.error : "Չհաջողվեց ուղարկել ձևը։");
      }
      if (message) {
        message.className = "tg-form-message success";
        message.textContent = "Տվյալները ստուգվել են և պահպանվել գլխավոր աղյուսակում։";
      }
      if (telegram) {
        telegram.HapticFeedback && telegram.HapticFeedback.notificationOccurred("success");
        telegram.MainButton && telegram.MainButton.setText("Փակել").show().onClick(() => telegram.close());
      }
    } catch (error) {
      if (message) {
        message.className = "tg-form-message error";
        message.textContent = error instanceof Error ? error.message : "Չհաջողվեց ուղարկել ձևը։";
      }
      if (telegram && telegram.HapticFeedback) {
        telegram.HapticFeedback.notificationOccurred("error");
      }
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Ստուգել և ուղարկել";
      }
    }
  }

  function render() {
    const department = getDepartment();
    const reportDate = getReportDate();
    if (!department) {
      root.innerHTML = `
        <section class="tg-form-card">
          <p class="tg-form-kicker">SARSH_KKZH</p>
          <h1 class="tg-form-title">Բաժանմունքը չի գտնվել</h1>
          <p class="tg-form-muted">Փակեք պատուհանը և կրկին բացեք ձևը Telegram բոտի կոճակով։</p>
        </section>
      `;
      return;
    }

    root.innerHTML = `
      <section class="tg-form-card">
        <header class="tg-form-head">
          <div>
            <p class="tg-form-kicker">${escapeHtml(department.marker || department.id)}</p>
            <h1 class="tg-form-title">${escapeHtml(department.department)}</h1>
          </div>
          <div class="tg-form-meta">
            <span class="tg-form-pill">Ամսաթիվ: ${escapeHtml(reportDate)}</span>
            <span class="tg-form-pill">Telegram ձև</span>
          </div>
        </header>

        <form data-form>
          <div class="tg-sheet-layout" aria-label="Բաժանմունքի ձև">
            ${renderCombinedCalculator()}
            ${sectionDefinitions.map((section) => renderSection(section)).join("")}
          </div>

          ${renderPatientNotesMobileBlock(department, reportDate)}

          <div class="tg-form-status" data-status></div>
          <div class="tg-form-actions">
            <button class="tg-form-submit" data-submit type="submit">Ստուգել և ուղարկել</button>
            <div class="tg-form-message${getInitData() ? "" : " error"}" data-message>
              ${getInitData() ? "Ձևը բացվել է գլխավոր աղյուսակից բերված տվյալներով։" : "Բացեք ձևը Telegram բոտի կոճակով։"}
            </div>
          </div>
          <div class="tg-inline-lock-panel">
            <label class="department-top-lock-toggle">
              <input type="checkbox" data-full-edit-toggle>
              <span class="department-top-lock-toggle-slider"></span>
            </label>
            <div class="department-top-lock-meta">
              <strong>Խմբագրել բոլոր բջիջները</strong>
              <span data-full-edit-status>Խմբագրումը անջատված է․ բջիջները միայն դիտման համար են։</span>
            </div>
          </div>
        </form>
      </section>
    `;

    const initialMessage = root.querySelector("[data-message]");
    if (initialMessage && getInitData()) {
      initialMessage.textContent = "Բջիջները բերվել են գլխավոր աղյուսակից։ Փոփոխելուց հետո ստուգումը կթարմացվի ավտոմատ։";
    }

    root.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const digitsOnly = input.value.replace(/\D+/g, "").slice(0, 3);
        if (input.value !== digitsOnly) {
          input.value = digitsOnly;
        }
        updateControl();
        refreshCalculatorUi();
      });
      input.addEventListener("focus", () => input.select());
    });
    root.querySelectorAll("[data-calc-key]").forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.getAttribute("data-calc-key");
        if (!key || !Object.prototype.hasOwnProperty.call(calculatorState, key)) {
          return;
        }
        const digitsOnly = input.value.replace(/\D+/g, "").slice(0, 4);
        calculatorState[key] = toNumber(digitsOnly);
        if (input.value !== digitsOnly) {
          input.value = digitsOnly;
        }
        refreshCalculatorUi();
      });
      input.addEventListener("focus", () => input.select());
    });
    root.querySelectorAll("[data-leave-calc-key]").forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.getAttribute("data-leave-calc-key");
        if (!key || !Object.prototype.hasOwnProperty.call(leaveCalculatorState, key)) {
          return;
        }
        const digitsOnly = input.value.replace(/\D+/g, "").slice(0, 4);
        leaveCalculatorState[key] = toNumber(digitsOnly);
        if (input.value !== digitsOnly) {
          input.value = digitsOnly;
        }
        refreshCalculatorUi();
      });
      input.addEventListener("focus", () => input.select());
    });
    const applyCalculators = root.querySelector("[data-apply-calculators]");
    if (applyCalculators) {
      applyCalculators.addEventListener("click", applyCombinedCalculator);
    }
    const fullEditToggle = root.querySelector("[data-full-edit-toggle]");
    if (fullEditToggle) {
      fullEditToggle.addEventListener("change", () => {
        fullEditUnlocked = Boolean(fullEditToggle.checked);
        syncFieldLockState();
      });
    }
    root.querySelectorAll("[data-patient-note-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const notes = readPatientNotes();
        const saved = savePatientNotes(department, reportDate, notes);
        updatePatientNotesUi(notes, saved ? "Պահված է տեղում։" : "Չհաջողվեց պահել այս սարքում։");
      });
    });
    const patientNotesSave = root.querySelector("[data-save-patient-notes]");
    if (patientNotesSave) {
      patientNotesSave.addEventListener("click", () => {
        const notes = readPatientNotes();
        const saved = savePatientNotes(department, reportDate, notes);
        updatePatientNotesUi(notes, saved ? "Պահված է տեղում։" : "Չհաջողվեց պահել այս սարքում։");
      });
    }
    const patientNotesClear = root.querySelector("[data-clear-patient-notes]");
    if (patientNotesClear) {
      patientNotesClear.addEventListener("click", () => {
        const confirmed = window.confirm("Մաքրե՞լ այս բաժանմունքի տեղային գրառումները։");
        if (!confirmed) {
          return;
        }
        clearPatientNotes(department, reportDate);
        root.querySelectorAll("[data-patient-note-input]").forEach((input) => {
          input.value = "";
        });
        updatePatientNotesUi(createEmptyPatientNotes(), "Գրառումները մաքրված են։");
      });
    }
    const form = root.querySelector("[data-form]");
    if (form) {
      form.addEventListener("submit", submitForm);
    }
    refreshCalculatorUi();
    updateControl();
    syncFieldLockState();
  }

  if (telegram) {
    telegram.ready();
    telegram.expand();
  }

  render();
})();
