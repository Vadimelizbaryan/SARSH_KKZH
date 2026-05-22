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

  function getInitData() {
    return telegram && typeof telegram.initData === "string" ? telegram.initData : "";
  }

  function getEndpoint() {
    const baseUrl = String(runtime.supabaseUrl || "https://ywecvlapdlaojpvijaqy.supabase.co").replace(/\/+$/, "");
    return `${baseUrl}/functions/v1/Mainflow-telegram?action=web-qh-form-submit`;
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

    return {
      ...remaining,
      finalValues: {
        beenTotal: columns.reduce((sum, column) => sum + state[column.baseKey], 0) + preserved.leaveSharq + preserved.leaveSpa + preserved.leavePaym,
        beenSoldier: state.qhBaseSoldier + state.qhBaseOfficer + state.qhBaseContract,
        beenSeries: state.qhBaseSoldier,
        admittedTotal,
        admittedSoldier: admittedMilitary,
        admittedSeries: state.qhIncomingSoldier,
        dgTotal: dischargedTotal,
        dgSoldier: dischargedMilitary,
        dgSeries: state.qhDischargedSoldier,
        transferFromDepartment: preserved.transferFromDepartment,
        transferToDepartment: preserved.transferToDepartment,
        currentShar: remaining.remainingSoldier,
        currentSpa: remaining.remainingOfficer,
        currentPaym: remaining.remainingContract,
        currentZh: remaining.remainingZh,
        family: remaining.remainingFamily,
        officer: remaining.remainingReserve,
        civil: remaining.remainingCivil,
        leaveSharq: preserved.leaveSharq,
        leaveSpa: preserved.leaveSpa,
        leavePaym: preserved.leavePaym
      }
    };
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
        name: "Հսկիչ 13-22",
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
        name: "Ժամկետայինների քանակ",
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
        name: "Զինծառայողների քանակ",
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
    const checks = getValidationChecks(computed.finalValues);
    const hasNegativeRemaining = outputCells.some((cell) => computed[cell.key] < 0);
    return {
      ...computed,
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
            <span class="tg-qh-marker">${escapeHtml(cell.marker)}</span>
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
        <th scope="row" class="tg-qh-row-title">Մնացել է</th>
        ${outputCells.map((cell) => `
          <td class="tg-qh-cell tg-qh-cell--output">
            <span class="tg-qh-marker">${escapeHtml(cell.marker)}</span>
            <span class="tg-form-control-value tg-qh-output" data-qh-output="${escapeHtml(cell.key)}">0</span>
          </td>
        `).join("")}
      </tr>
    `;
  }

  function renderPreviewCard(title, items) {
    return `
      <section class="tg-qh-preview-card">
        <h3>${escapeHtml(title)}</h3>
        <div class="tg-qh-preview-items">
          ${items.map((item) => `
            <div class="tg-qh-preview-item">
              <span>${escapeHtml(item.label)}</span>
              <strong data-preview-key="${escapeHtml(item.key)}">0</strong>
            </div>
          `).join("")}
        </div>
      </section>
    `;
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
            <h1 class="tg-form-title">${escapeHtml(department.department)} — հաշվարկային աղյուսակ</h1>
          </div>
          <div class="tg-form-meta">
            <span class="tg-form-pill">Ամսաթիվ: ${escapeHtml(getReportDate())}</span>
            <span class="tg-form-pill">Telegram ձև</span>
          </div>
        </header>

        <p class="tg-form-muted">
          O-U սյունակները լռելյայն վերցված են գլխավոր աղյուսակի 13-19 բջիջներից։
          A-N լրացրեք ձեռքով, իսկ V-AB հաշվարկվում են ավտոմատ։
        </p>

        <form data-qh-form>
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

          <div class="tg-qh-formulas">
            ${columns.map((column) => (
              `<span>${escapeHtml(`${column.outputMarker} = (${column.baseMarker} + ${column.incomingMarker}) - ${column.dischargedMarker}`)}</span>`
            )).join("")}
          </div>

          <section class="tg-qh-preview">
            <h2>Կպահպանվի գլխավոր աղյուսակում</h2>
            <div class="tg-qh-preview-grid">
              ${renderPreviewCard("Եղել է (1-3)", [
                { label: "1", key: "beenTotal" },
                { label: "2", key: "beenSoldier" },
                { label: "3", key: "beenSeries" }
              ])}
              ${renderPreviewCard("Ընդունվել է (4-6)", [
                { label: "4", key: "admittedTotal" },
                { label: "5", key: "admittedSoldier" },
                { label: "6", key: "admittedSeries" }
              ])}
              ${renderPreviewCard("Դ/Գ (7-9)", [
                { label: "7", key: "dgTotal" },
                { label: "8", key: "dgSoldier" },
                { label: "9", key: "dgSeries" }
              ])}
              ${renderPreviewCard("Առկա է (13-19)", [
                { label: "13", key: "currentShar" },
                { label: "14", key: "currentSpa" },
                { label: "15", key: "currentPaym" },
                { label: "16", key: "currentZh" },
                { label: "17", key: "family" },
                { label: "18", key: "officer" },
                { label: "19", key: "civil" }
              ])}
            </div>
          </section>

          <div class="tg-form-status" data-status></div>
          <div class="tg-form-actions">
            <button class="tg-form-submit" data-submit type="submit">Ուղարկել ստուգման</button>
            <div class="tg-form-message${getInitData() ? "" : " error"}" data-message>
              ${getInitData() ? "Ստուգեք հաշվարկը և ուղարկեք ձևը գլխավոր աղյուսակ գրանցելու համար։" : "Բացեք ձևը Telegram բոտի կոճակով։"}
            </div>
          </div>
        </form>
      </section>
    `;
  }

  function refreshUi() {
    const validation = getValidationState();
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

    Object.entries(validation.finalValues).forEach(([key, value]) => {
      const target = root.querySelector(`[data-preview-key="${key}"]`);
      if (target) {
        target.textContent = String(value);
      }
    });

    const status = root.querySelector("[data-status]");
    if (status) {
      const lines = [];
      if (validation.hasNegativeRemaining) {
        lines.push("V-AB սյունակներում չի կարող բացասական արժեք լինել։ Ստուգեք A-N և O-U արժեքները։");
      }
      validation.checks.forEach((check) => {
        lines.push(`${check.isValid ? "✓" : "✕"} ${check.name}: ${check.actual} ${check.isValid ? "=" : "≠"} ${check.expected} (${check.ruleText})`);
      });
      status.className = `tg-form-status${validation.isValid ? "" : " bad"}`;
      status.innerHTML = lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("");
    }

    const submit = root.querySelector("[data-submit]");
    if (submit) {
      submit.disabled = !validation.isValid || !getInitData();
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
        refreshUi();
      });
    });
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

    const submit = root.querySelector("[data-submit]");
    const message = root.querySelector("[data-message]");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Ուղարկվում է...";
    }
    if (message) {
      message.className = "tg-form-message";
      message.textContent = "Պահպանում եմ հաշվարկային աղյուսակի տվյալները...";
    }

    try {
      const response = await fetch(getEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(),
          departmentId: department.id,
          reportDate: getReportDate(),
          qhValues: { ...state },
          preservedValues: getPreservedValues()
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
        submit.textContent = "Ուղարկել ստուգման";
      }
    }
  }

  seedStateFromQuery();
  render();
  bindEvents();
  refreshUi();

  if (telegram) {
    telegram.ready();
    telegram.expand();
    if (telegram.MainButton) {
      telegram.MainButton.hide();
    }
  }
})();
