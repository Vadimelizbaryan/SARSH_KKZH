(function () {
  const config = window.SHARSH_CONFIG || {};
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const telegram = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const root = document.getElementById("tg-qh-form-root");
  const qhDepartmentIds = new Set(["r19", "r20", "r21"]);

  const columns = [
    {
      type: "soldier",
      label: "ՇԱՐ",
      incomingKey: "qhIncomingSoldier",
      dischargedKey: "qhDischargedSoldier",
      baseKey: "qhBaseSoldier",
      outputKey: "remainingSoldier",
      currentKey: "currentShar",
      incomingMarker: "A",
      dischargedMarker: "H",
      baseMarker: "O",
      outputMarker: "V"
    },
    {
      type: "officer",
      label: "ՍՊԱ",
      incomingKey: "qhIncomingOfficer",
      dischargedKey: "qhDischargedOfficer",
      baseKey: "qhBaseOfficer",
      outputKey: "remainingOfficer",
      currentKey: "currentSpa",
      incomingMarker: "B",
      dischargedMarker: "I",
      baseMarker: "P",
      outputMarker: "W"
    },
    {
      type: "contract",
      label: "ՊԱՅՄ",
      incomingKey: "qhIncomingContract",
      dischargedKey: "qhDischargedContract",
      baseKey: "qhBaseContract",
      outputKey: "remainingContract",
      currentKey: "currentPaym",
      incomingMarker: "C",
      dischargedMarker: "J",
      baseMarker: "Q",
      outputMarker: "X"
    },
    {
      type: "zh",
      label: "Զ/Հ",
      incomingKey: "qhIncomingZh",
      dischargedKey: "qhDischargedZh",
      baseKey: "qhBaseZh",
      outputKey: "remainingZh",
      currentKey: "currentZh",
      incomingMarker: "D",
      dischargedMarker: "K",
      baseMarker: "R",
      outputMarker: "Y"
    },
    {
      type: "family",
      label: "Զ/Ծ ընտ",
      incomingKey: "qhIncomingFamily",
      dischargedKey: "qhDischargedFamily",
      baseKey: "qhBaseFamily",
      outputKey: "remainingFamily",
      currentKey: "family",
      incomingMarker: "E",
      dischargedMarker: "L",
      baseMarker: "S",
      outputMarker: "Z"
    },
    {
      type: "reserve",
      label: "Զ/Պ",
      incomingKey: "qhIncomingReserve",
      dischargedKey: "qhDischargedReserve",
      baseKey: "qhBaseReserve",
      outputKey: "remainingReserve",
      currentKey: "officer",
      incomingMarker: "F",
      dischargedMarker: "M",
      baseMarker: "T",
      outputMarker: "AA"
    },
    {
      type: "civil",
      label: "Ք-ի",
      incomingKey: "qhIncomingCivil",
      dischargedKey: "qhDischargedCivil",
      baseKey: "qhBaseCivil",
      outputKey: "remainingCivil",
      currentKey: "civil",
      incomingMarker: "G",
      dischargedMarker: "N",
      baseMarker: "U",
      outputMarker: "AB"
    }
  ];

  const editableRows = [
    {
      label: "Ընդունվել է",
      cells: columns.map((column) => ({ key: column.incomingKey, marker: column.incomingMarker }))
    },
    {
      label: "Դուրս է գրվել",
      cells: columns.map((column) => ({ key: column.dischargedKey, marker: column.dischargedMarker }))
    },
    {
      label: "Եղել է",
      cells: columns.map((column) => ({ key: column.baseKey, marker: column.baseMarker }))
    }
  ];

  const outputCells = columns.map((column) => ({ key: column.outputKey, marker: column.outputMarker }));

  const leaveColumns = [
    { type: "sharq", label: "ՇԱՐ", presentKey: "currentShar", leaveKey: "leaveSharq", sentKey: "leaveCalcSentSharq", returnedKey: "leaveCalcReturnedSharq" },
    { type: "spa", label: "ՍՊԱ", presentKey: "currentSpa", leaveKey: "leaveSpa", sentKey: "leaveCalcSentSpa", returnedKey: "leaveCalcReturnedSpa" },
    { type: "paym", label: "ՊԱՅՄ", presentKey: "currentPaym", leaveKey: "leavePaym", sentKey: "leaveCalcSentPaym", returnedKey: "leaveCalcReturnedPaym" }
  ];

  const leaveRows = [
    { label: "Ուղարկվել է բուժ. արձակուրդ", cells: leaveColumns.map((column) => ({ key: column.sentKey, role: "input" })) },
    { label: "Վերադարձել է արձակուրդից", cells: leaveColumns.map((column) => ({ key: column.returnedKey, role: "input" })) },
    { label: "Եղել է արձակուրդում", cells: leaveColumns.map((column) => ({ key: column.leaveKey, role: "linked" })) },
    { label: "Հաշվարկ", cells: leaveColumns.map((column) => ({ key: column.leaveKey, role: "output" })) }
  ];

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

  const fieldByKey = Object.fromEntries(fields.map((field) => [field.key, field]));
  const sectionDefinitions = [
    {
      title: "Եղել է",
      note: "Բերվում է գլխավոր աղյուսակից և մնում է միայն դիտման համար։",
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

  const preservedQueryMap = {
    transferFromDepartment: "c10",
    transferToDepartment: "c11",
    leaveSharq: "c20",
    leaveSpa: "c21",
    leavePaym: "c22"
  };

  const state = columns.reduce((accumulator, column) => {
    accumulator[column.incomingKey] = 0;
    accumulator[column.dischargedKey] = 0;
    accumulator[column.baseKey] = 0;
    return accumulator;
  }, {});

  const leaveState = leaveColumns.reduce((accumulator, column) => {
    accumulator[column.sentKey] = 0;
    accumulator[column.returnedKey] = 0;
    return accumulator;
  }, {});
  const admissionCalcLockKeys = [
    "admittedTotal",
    "admittedSoldier",
    "admittedSeries",
    "dgTotal",
    "dgSoldier",
    "dgSeries"
  ];
  let fullEditUnlocked = false;
  let calculatorsApplied = false;

  function getAdmissionDischargeCalcLockSum(values) {
    return admissionCalcLockKeys.reduce((sum, key) => sum + toNumber(values[key]), 0);
  }

  function isAdmissionDischargeCalcLocked(values) {
    return getAdmissionDischargeCalcLockSum(values) !== 0;
  }

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

  function toNumber(value) {
    const parsed = Number.parseInt(String(value ?? "").replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 9999) : 0;
  }

  function getDepartment() {
    const departmentId = getQuery().get("department") || "";
    return config.getDepartmentById ? config.getDepartmentById(departmentId) : null;
  }

  function getReportDate() {
    return getQuery().get("date") || (config.DEFAULT_DATE || "05.05.2026");
  }

  function getAndroidDeviceId() {
    return (getQuery().get("androidDeviceId") || "").trim();
  }

  function getAndroidDeviceName() {
    return (getQuery().get("androidDeviceName") || "").trim();
  }

  function getAndroidRuntimeState() {
    return window.MAINFORM_ANDROID && typeof window.MAINFORM_ANDROID === "object"
      ? window.MAINFORM_ANDROID
      : null;
  }

  function getAndroidPhotoState() {
    const state = getAndroidRuntimeState();
    return state && state.photo && typeof state.photo === "object" ? state.photo : null;
  }

  function isAndroidMode() {
    return Boolean(getAndroidDeviceId());
  }

  function hasRequiredAndroidPhoto() {
    if (!isAndroidMode()) {
      return true;
    }
    const photo = getAndroidPhotoState();
    return Boolean(photo && photo.exists && photo.matched && photo.imageDataUrl);
  }

  function getAndroidPhotoMessage() {
    if (!isAndroidMode()) {
      return "";
    }
    const photo = getAndroidPhotoState();
    if (!photo || !photo.exists) {
      return "Для отправки нужен снимок бланка этого отделения.";
    }
    if (photo.matched) {
      return photo.message || "Фото готово к отправке.";
    }
    return photo.message || "Отделение не опознано, сделайте повторное фото.";
  }

  function getInitData() {
    return telegram && typeof telegram.initData === "string" ? telegram.initData : "";
  }

  function hasSubmitAccess() {
    return Boolean(getInitData() || getAndroidDeviceId());
  }

  function getEndpoint() {
    const baseUrl = String(runtime.supabaseUrl || "https://ywecvlapdlaojpvijaqy.supabase.co").replace(/\/+$/, "");
    return `${baseUrl}/functions/v1/Mainflow-telegram?action=web-qh-form-submit`;
  }

  function getApkDownloadUrl() {
    return new URL("android/releases/MAINFORM.apk", window.location.href).href;
  }

  function getPreservedValues() {
    return Object.keys(preservedQueryMap).reduce((accumulator, key) => {
      accumulator[key] = toNumber(getQuery().get(preservedQueryMap[key] || ""));
      return accumulator;
    }, {});
  }

  function getBaseValue(queryKey, fallbackParam) {
    const explicitValue = toNumber(getQuery().get(queryKey));
    return explicitValue > 0 ? explicitValue : toNumber(getQuery().get(fallbackParam));
  }

  function seedStateFromQuery() {
    state.qhBaseSoldier = getBaseValue("qg", "c13");
    state.qhBaseOfficer = getBaseValue("qh", "c14");
    state.qhBaseContract = getBaseValue("qi", "c15");
    state.qhBaseZh = getBaseValue("qj", "c16");
    state.qhBaseFamily = getBaseValue("qk", "c17");
    state.qhBaseReserve = getBaseValue("ql", "c18");
    state.qhBaseCivil = getBaseValue("qm", "c19");
  }

  function getComputedValues() {
    const preserved = getPreservedValues();
    const remaining = columns.reduce((accumulator, column) => {
      accumulator[column.outputKey] = state[column.baseKey] + state[column.incomingKey] - state[column.dischargedKey];
      return accumulator;
    }, {});

    const admittedTotal = columns.reduce((sum, column) => sum + state[column.incomingKey], 0);
    const admittedMilitary = state.qhIncomingSoldier + state.qhIncomingOfficer + state.qhIncomingContract;
    const dischargedTotal = columns.reduce((sum, column) => sum + state[column.dischargedKey], 0);
    const dischargedMilitary = state.qhDischargedSoldier + state.qhDischargedOfficer + state.qhDischargedContract;
    const presentExpected = (columns.reduce((sum, column) => sum + state[column.baseKey], 0)
      + preserved.leaveSharq
      + preserved.leaveSpa
      + preserved.leavePaym
      + admittedTotal
      + preserved.transferToDepartment)
      - (dischargedTotal + preserved.transferFromDepartment);

    const leaveRemaining = {
      sharq: preserved.leaveSharq + leaveState.leaveCalcSentSharq - leaveState.leaveCalcReturnedSharq,
      spa: preserved.leaveSpa + leaveState.leaveCalcSentSpa - leaveState.leaveCalcReturnedSpa,
      paym: preserved.leavePaym + leaveState.leaveCalcSentPaym - leaveState.leaveCalcReturnedPaym
    };

    const leaveAdjustedPresent = {
      sharq: remaining.remainingSoldier - leaveState.leaveCalcSentSharq + leaveState.leaveCalcReturnedSharq,
      spa: remaining.remainingOfficer - leaveState.leaveCalcSentSpa + leaveState.leaveCalcReturnedSpa,
      paym: remaining.remainingContract - leaveState.leaveCalcSentPaym + leaveState.leaveCalcReturnedPaym
    };

    return {
      ...remaining,
      leaveRemaining,
      leaveAdjustedPresent,
      finalValues: {
        beenTotal: columns.reduce((sum, column) => sum + state[column.baseKey], 0) + preserved.leaveSharq + preserved.leaveSpa + preserved.leavePaym,
        beenSoldier: toNumber(getQuery().get("c2")),
        beenSeries: toNumber(getQuery().get("c3")),
        admittedTotal,
        admittedSoldier: admittedMilitary,
        admittedSeries: state.qhIncomingSoldier,
        dgTotal: dischargedTotal,
        dgSoldier: dischargedMilitary,
        dgSeries: state.qhDischargedSoldier,
        transferFromDepartment: preserved.transferFromDepartment,
        transferToDepartment: preserved.transferToDepartment,
        presentTotal: presentExpected,
        currentShar: leaveAdjustedPresent.sharq,
        currentSpa: leaveAdjustedPresent.spa,
        currentPaym: leaveAdjustedPresent.paym,
        currentZh: remaining.remainingZh,
        family: remaining.remainingFamily,
        officer: remaining.remainingReserve,
        civil: remaining.remainingCivil,
        leaveSharq: leaveRemaining.sharq,
        leaveSpa: leaveRemaining.spa,
        leavePaym: leaveRemaining.paym
      }
    };
  }

  function readFieldValues() {
    const values = {};
    fields.forEach((field) => {
      const input = root ? root.querySelector(`[data-field="${field.key}"]`) : null;
      values[field.key] = toNumber(input ? input.value : 0);
    });
    return values;
  }

  function getValidationChecks(values) {
    const presentActual = values.currentShar
      + values.currentSpa
      + values.currentPaym
      + values.currentZh
      + values.family
      + values.officer
      + values.civil
      + values.leaveSharq
      + values.leaveSpa
      + values.leavePaym;
    const presentExpected = (values.beenTotal + values.admittedTotal + values.transferToDepartment)
      - (values.dgTotal + values.transferFromDepartment);

    const checks = [
      {
        id: "present-balance",
        name: "Առկա է",
        ruleText: "13-22 = (1 + 4 + 11) - (7 + 10)",
        actual: presentActual,
        expected: presentExpected,
        isValid: presentActual === presentExpected
      }
    ];

    if (values.transferFromDepartment === 0 && values.transferToDepartment === 0) {
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

  function getValidationState() {
    const computed = getComputedValues();
    const finalValues = fullEditUnlocked ? readFieldValues() : computed.finalValues;
    const checks = getValidationChecks(finalValues);
    const hasNegativeRemaining = [
      finalValues.currentShar,
      finalValues.currentSpa,
      finalValues.currentPaym,
      finalValues.currentZh,
      finalValues.family,
      finalValues.officer,
      finalValues.civil,
      finalValues.leaveSharq,
      finalValues.leaveSpa,
      finalValues.leavePaym
    ].some((value) => Number(value) < 0);
    return {
      ...computed,
      finalValues,
      checks,
      hasNegativeRemaining,
      isValid: !hasNegativeRemaining && checks.every((check) => check.isValid)
    };
  }

  function renderEditableRow(row) {
    return `
      <tr>
        <th scope="row" class="tg-qh-row-title">${escapeHtml(row.label)}</th>
        ${row.cells.map((cell) => `
          <td class="tg-qh-cell">
            <input
              class="tg-form-input tg-qh-input"
              data-qh-key="${escapeHtml(cell.key)}"
              inputmode="numeric"
              pattern="[0-9]*"
              type="text"
              autocomplete="off"
              maxlength="4"
              value="${escapeHtml(state[cell.key] || 0)}"
            >
          </td>
        `).join("")}
      </tr>
    `;
  }

  function renderOutputRow() {
    return `
      <tr class="tg-qh-output-row">
        <th scope="row" class="tg-qh-row-title">Հաշվարկ</th>
        ${outputCells.map((cell) => `
          <td class="tg-qh-cell tg-qh-cell--output">
            <span class="tg-form-control-value tg-qh-output" data-qh-output="${escapeHtml(cell.key)}">0</span>
          </td>
        `).join("")}
      </tr>
    `;
  }

  function renderLeaveRow(row) {
    return `
      <tr>
        <th scope="row" class="tg-qh-row-title">${escapeHtml(row.label)}</th>
        ${row.cells.map((cell) => {
          if (cell.role === "input") {
            return `
              <td class="tg-qh-cell">
                <input
                  class="tg-form-input tg-qh-input"
                  data-leave-key="${escapeHtml(cell.key)}"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  type="text"
                  autocomplete="off"
                  maxlength="4"
                  value="${escapeHtml(leaveState[cell.key] || 0)}"
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
                    ${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${editableRows.map(renderEditableRow).join("")}
                  ${renderOutputRow()}
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
                    ${leaveColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${leaveRows.map(renderLeaveRow).join("")}
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

  function hasPendingCalculatorInput() {
    const hasMainInput = columns.some((column) => toNumber(state[column.incomingKey]) > 0 || toNumber(state[column.dischargedKey]) > 0);
    const hasLeaveInput = leaveColumns.some((column) => toNumber(leaveState[column.sentKey]) > 0 || toNumber(leaveState[column.returnedKey]) > 0);
    return hasMainInput || hasLeaveInput;
  }

  function applyCombinedCalculator() {
    if (isAdmissionDischargeCalcLocked(readFieldValues())) {
      refreshUi();
      return;
    }
    const validation = getValidationState();
    if (validation.hasNegativeRemaining) {
      refreshUi();
      return;
    }
    calculatorsApplied = true;
    writeFieldValues(validation.finalValues);
    refreshUi();
  }

  function writeFieldValues(values) {
    Object.entries(values).forEach(([key, value]) => {
      const target = root ? root.querySelector(`[data-field="${key}"]`) : null;
      if (target) {
        target.value = String(toNumber(value));
      }
    });
  }

  function renderFieldCard(field) {
    const isControl = field.key === "presentTotal";
    return `
      <label class="tg-sheet-field is-readonly">
        <span class="tg-sheet-field-top">
          <span class="tg-sheet-field-index">${field.cell}</span>
          <span class="tg-sheet-field-label">${escapeHtml(field.label)}</span>
        </span>
        <input
          class="tg-form-input tg-sheet-field-input tg-form-input--readonly"
          ${isControl ? 'data-control-total' : ""}
          data-field="${escapeHtml(field.key)}"
          inputmode="numeric"
          pattern="[0-9]*"
          type="text"
          autocomplete="off"
          maxlength="4"
          value="0"
          readonly
          title="Ստացվել է հաշվարկից"
          aria-readonly="true"
        >
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

  function syncFieldLockState(forceSyncValues = false) {
    root.querySelectorAll("[data-field]").forEach((input) => {
      const field = input.getAttribute("data-field");
      if (!field) {
        return;
      }
      input.readOnly = !fullEditUnlocked;
      input.setAttribute("aria-readonly", fullEditUnlocked ? "false" : "true");
      input.classList.toggle("tg-form-input--readonly", !fullEditUnlocked);
      input.closest(".tg-sheet-field")?.classList.toggle("is-readonly", !fullEditUnlocked);
      if (!fullEditUnlocked) {
        input.setAttribute("title", "Ստացվել է հաշվարկից");
      } else {
        input.removeAttribute("title");
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

    if (forceSyncValues) {
      refreshUi(true);
    }
  }

  function render() {
    if (!root) {
      return;
    }

    const department = getDepartment();
    if (!department || !qhDepartmentIds.has(department.id)) {
      root.innerHTML = `
        <section class="tg-form-card">
          <p class="tg-form-kicker">SARSH_KKZH</p>
          <h1 class="tg-form-title">Բաժանմունքը չի գտնվել</h1>
          <p class="tg-form-muted">Փակեք պատուհանը և կրկին բացեք ճիշտ Telegram կոճակից։</p>
        </section>
      `;
      return;
    }

    root.innerHTML = `
      <section class="tg-form-card tg-qh-card">
        <header class="tg-form-head">
          <div>
            <p class="tg-form-kicker">${escapeHtml(department.marker || department.id)}</p>
            <h1 class="tg-form-title">${escapeHtml(department.department)}</h1>
          </div>
          <div class="tg-form-meta">
            <span class="tg-form-pill">Ամսաթիվ: ${escapeHtml(getReportDate())}</span>
            <span class="tg-form-pill">Telegram ձև</span>
          </div>
        </header>

        <form data-qh-form>
          <div class="tg-sheet-layout tg-sheet-layout--single">
            ${renderCombinedCalculator()}
            ${sectionDefinitions.map((section) => renderSection(section)).join("")}
          </div>

          <div class="tg-form-status" data-status></div>
          <div class="tg-form-actions">
            <button class="tg-form-submit" data-submit type="submit">Ստուգել և ուղարկել</button>
            <div class="tg-form-message${hasSubmitAccess() ? "" : " error"}" data-message>
              ${hasSubmitAccess() ? "Ստուգեք հաշվարկը և ուղարկեք ձևը գլխավոր աղյուսակ պահպանելու համար։" : "Բացեք ձևը Telegram բոտի կամ Android հավելվածի միջոցով։"}
            </div>
          </div>
          <div class="tg-form-downloads">
            <a class="tg-form-download" href="${escapeHtml(getApkDownloadUrl())}" target="_blank" rel="noopener">Скачать MAINFORM.apk</a>
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
  }

  function refreshUi(forceFieldSync = false) {
    const validation = getValidationState();
    const currentValues = readFieldValues();
    const calcLocked = isAdmissionDischargeCalcLocked(currentValues);
    const lockSum = getAdmissionDischargeCalcLockSum(currentValues);
    const outputs = outputCells.reduce((accumulator, cell) => {
      accumulator[cell.key] = validation[cell.key];
      return accumulator;
    }, {});

    Object.entries(outputs).forEach(([key, value]) => {
      const target = root.querySelector(`[data-qh-output="${key}"]`);
      if (target) {
        target.textContent = String(value);
      }
    });

    if (!fullEditUnlocked || forceFieldSync) {
      Object.entries(validation.finalValues).forEach(([key, value]) => {
        const target = root.querySelector(`[data-field="${key}"]`);
        if (target) {
          target.value = String(value);
        }
      });
    }

    const preserved = getPreservedValues();
    leaveColumns.forEach((column) => {
      const baseTarget = root.querySelector(`[data-leave-base="${column.leaveKey}"]`);
      const outputTarget = root.querySelector(`[data-leave-output="${column.leaveKey}"]`);
      if (baseTarget) {
        baseTarget.textContent = String(preserved[column.leaveKey] || 0);
      }
      if (outputTarget) {
        outputTarget.textContent = String(validation.finalValues[column.leaveKey] || 0);
      }
    });

    const status = root.querySelector("[data-status]");
    const calcStatus = root.querySelector("[data-calc-status]");
    const applyButton = root.querySelector("[data-apply-calculators]");
    const pendingCalculatorInput = hasPendingCalculatorInput();
    if (calcStatus) {
      calcStatus.className = `tg-form-status${validation.hasNegativeRemaining ? " bad" : ""}`;
      calcStatus.innerHTML = validation.hasNegativeRemaining
        ? `
          <div class="tg-form-status-head">
            <strong>Ստուգեք հաշվարկը</strong>
            <span>Բացասական արժեք է ստացվում հաշվարկում։ Ստուգեք մուտքային դաշտերը և նորից սեղմեք «Հաշվել և տեղադրել»։</span>
          </div>
        `
        : `
          <div class="tg-form-status-head">
            <strong>${pendingCalculatorInput && !calculatorsApplied ? "Հաշվարկը պատրաստ է" : "Հաշվարկը կիրառված է"}</strong>
            <span>${pendingCalculatorInput && !calculatorsApplied
              ? "Սեղմեք «Հաշվել և տեղադրել», և հաշվարկված տվյալները կկիրառվեն ձևի բջիջներում։"
              : "Ձևի բջիջները թարմացվել են հաշվարկված տվյալներով։ Կարող եք ստուգել և ուղարկել ձևը։"}</span>
          </div>
        `;
    }
    if (calcLocked && calcStatus) {
      calcStatus.className = "tg-form-status bad";
      calcStatus.innerHTML = `
        <div class="tg-form-status-head">
          <strong>Հաշվիչը արգելափակված է</strong>
          <span>${escapeHtml(`4, 5, 6, 7, 8, 9 բջիջների գումարը պետք է լինի 0, հիմա՝ ${lockSum}։`)}</span>
        </div>
      `;
    }
    if (applyButton) {
      applyButton.disabled = validation.hasNegativeRemaining || calcLocked;
    }
    root.querySelectorAll("[data-qh-key], [data-leave-key]").forEach((input) => {
      if (input instanceof HTMLInputElement) {
        input.disabled = calcLocked;
      }
    });
    if (status) {
      status.className = `tg-form-status${validation.isValid ? "" : " bad"}`;
      status.innerHTML = `
        <div class="tg-form-status-head">
          <strong>${validation.isValid ? "Բոլոր վերահսկիչները համընկնում են" : "Ստուգեք հաշվարկը"}</strong>
          <span>${escapeHtml(validation.hasNegativeRemaining
            ? "Հաշվարկում բացասական արժեք կա։"
            : "Արժեքները կհամեմատվեն գլխավոր աղյուսակի վերահսկիչների հետ։")}</span>
        </div>
        <div class="tg-validation-list">
          ${validation.hasNegativeRemaining
            ? `<div class="tg-validation-item is-bad"><span class="tg-validation-bullet">!</span><span>${escapeHtml("Հաշվարկի արդյունքում բացասական արժեք ստացվեց։ Ստուգեք մուտքային և ելքային արժեքները։")}</span></div>`
            : ""}
          ${validation.checks.map((check) => `
            <div class="tg-validation-item${check.isValid ? "" : " is-bad"}">
              <span class="tg-validation-bullet">${check.isValid ? "✓" : "!"}</span>
              <span>${escapeHtml(check.isValid
                ? `${check.name}: ${check.actual} = ${check.expected}`
                : `${check.name}: հիմա ${check.actual}, պետք է ${check.expected}`)}</span>
            </div>
          `).join("")}
        </div>
      `;
    }

    const submit = root.querySelector("[data-submit]");
    if (submit) {
      submit.disabled = !validation.isValid || !hasSubmitAccess() || !hasRequiredAndroidPhoto() || (pendingCalculatorInput && !calculatorsApplied);
    }
  }

  function bindEvents() {
    const form = root.querySelector("[data-qh-form]");
    if (form) {
      form.addEventListener("submit", submitForm);
    }

    root.querySelectorAll("[data-qh-key]").forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.getAttribute("data-qh-key");
        if (!key || !Object.prototype.hasOwnProperty.call(state, key)) {
          return;
        }
        state[key] = toNumber(input.value);
        input.value = String(state[key]);
        calculatorsApplied = false;
        refreshUi();
      });
    });

    root.querySelectorAll("[data-leave-key]").forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.getAttribute("data-leave-key");
        if (!key || !Object.prototype.hasOwnProperty.call(leaveState, key)) {
          return;
        }
        leaveState[key] = toNumber(input.value);
        input.value = String(leaveState[key]);
        calculatorsApplied = false;
        refreshUi();
      });
    });

    root.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        if (!fullEditUnlocked) {
          return;
        }
        input.value = String(toNumber(input.value));
        calculatorsApplied = false;
        refreshUi();
      });
    });

    const applyCalculators = root.querySelector("[data-apply-calculators]");
    if (applyCalculators) {
      applyCalculators.addEventListener("click", applyCombinedCalculator);
    }

    const fullEditToggle = root.querySelector("[data-full-edit-toggle]");
    if (fullEditToggle) {
      fullEditToggle.addEventListener("change", () => {
        fullEditUnlocked = Boolean(fullEditToggle.checked);
        syncFieldLockState(true);
      });
    }
  }

  async function submitForm(event) {
    event.preventDefault();
    const department = getDepartment();
    if (!department) {
      return;
    }

    const validation = getValidationState();
    if (!validation.isValid) {
      return;
    }
    if (!hasRequiredAndroidPhoto()) {
      if (message) {
        message.className = "tg-form-message error";
        message.textContent = getAndroidPhotoMessage();
      }
      refreshUi();
      return;
    }

    const submit = root.querySelector("[data-submit]");
    const message = root.querySelector("[data-message]");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Ստուգվում է...";
    }
    if (message) {
      message.className = "tg-form-message";
      message.textContent = "Ստուգում եմ և պահպանում հաշվարկի տվյալները...";
    }

    try {
      const response = await fetch(getEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(),
          androidDeviceId: getAndroidDeviceId(),
          androidDeviceName: getAndroidDeviceName(),
          departmentId: department.id,
          reportDate: getReportDate(),
          values: validation.finalValues,
          qhValues: { ...state },
          preservedValues: getPreservedValues(),
          photoImageDataUrl: getAndroidPhotoState() && getAndroidPhotoState().imageDataUrl ? getAndroidPhotoState().imageDataUrl : "",
          photoImageName: getAndroidPhotoState() && getAndroidPhotoState().imageName ? getAndroidPhotoState().imageName : "",
          photoDetectedDepartmentId: getAndroidPhotoState() && getAndroidPhotoState().detectedDepartmentId ? getAndroidPhotoState().detectedDepartmentId : ""
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(payload && payload.error ? payload.error : "Չհաջողվեց ուղարկել հաշվարկային ձևը։");
      }
      if (message) {
        message.className = "tg-form-message success";
        message.textContent = payload.message || "Տվյալները պահպանվել են։";
      }
      if (telegram) {
        telegram.HapticFeedback && telegram.HapticFeedback.notificationOccurred("success");
        telegram.MainButton && telegram.MainButton.setText("Փակել").show().onClick(() => telegram.close());
      }
    } catch (error) {
      if (message) {
        message.className = "tg-form-message error";
        message.textContent = error instanceof Error ? error.message : "Չհաջողվեց ուղարկել հաշվարկային ձևը։";
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

  seedStateFromQuery();
  render();
  bindEvents();
  refreshUi();
  syncFieldLockState();
  const initialAndroidMessage = root && root.querySelector ? root.querySelector("[data-message]") : null;
  if (initialAndroidMessage && isAndroidMode()) {
    initialAndroidMessage.className = `tg-form-message${hasRequiredAndroidPhoto() ? "" : " error"}`;
    initialAndroidMessage.textContent = getAndroidPhotoMessage();
    refreshUi();
  }
  window.addEventListener("mainform-android-state-changed", () => {
    const currentMessage = root && root.querySelector ? root.querySelector("[data-message]") : null;
    if (currentMessage && isAndroidMode()) {
      currentMessage.className = `tg-form-message${hasRequiredAndroidPhoto() ? "" : " error"}`;
      currentMessage.textContent = getAndroidPhotoMessage();
    }
    refreshUi();
  });

  if (telegram) {
    telegram.ready();
    telegram.expand();
    if (telegram.MainButton) {
      telegram.MainButton.hide();
    }
  }
})();
