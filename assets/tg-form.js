(function () {
  const config = window.SHARSH_CONFIG || {};
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const telegram = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const root = document.getElementById("tg-form-root");

  const fields = [
    { cell: 1, key: "beenTotal", label: "ընդ." },
    { cell: 2, key: "beenSoldier", label: "զ/ծ" },
    { cell: 3, key: "beenSeries", label: "շարք" },
    { cell: 4, key: "admittedTotal", label: "ընդ." },
    { cell: 5, key: "admittedSoldier", label: "զ/ծ" },
    { cell: 6, key: "admittedSeries", label: "շարք" },
    { cell: 7, key: "dgTotal", label: "ընդ." },
    { cell: 8, key: "dgSoldier", label: "զ/ծ" },
    { cell: 9, key: "dgSeries", label: "շարք" },
    { cell: 10, key: "transferFromDepartment", label: "գնաց" },
    { cell: 11, key: "transferToDepartment", label: "եկավ" },
    { cell: 12, key: "presentTotal", label: "հաշվ." },
    { cell: 13, key: "currentShar", label: "շարք" },
    { cell: 14, key: "currentSpa", label: "սպա" },
    { cell: 15, key: "currentPaym", label: "պայմ." },
    { cell: 16, key: "currentZh", label: "զ/հ" },
    { cell: 17, key: "family", label: "զ/ծ ընտ" },
    { cell: 18, key: "officer", label: "զ/պ" },
    { cell: 19, key: "civil", label: "քաղ." },
    { cell: 20, key: "leaveSharq", label: "շարք" },
    { cell: 21, key: "leaveSpa", label: "սպա" },
    { cell: 22, key: "leavePaym", label: "պայմ." }
  ];

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

  const patientNoteSections = [
    { key: "admitted", title: "Ընդունված հիվանդներ", rows: 6 },
    { key: "discharged", title: "Դուրս գրված հիվանդներ", rows: 6 },
    { key: "transferred", title: "Տեղափոխված հիվանդներ", rows: 5 },
    { key: "dischargedNotTaken", title: "Դուրսգրված-չտարված", rows: 5 },
    { key: "returnedFromLeave", title: "Վերադարձել են արձակուրդից", rows: 5 },
    { key: "wentOnLeave", title: "Գնացել են արձակուրդ", rows: 5 }
  ];

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

  function toNumber(value) {
    const parsed = Number.parseInt(String(value ?? "").replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 999) : 0;
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

  function getApkDownloadUrl() {
    return new URL("android/releases/MAINFORM.apk", window.location.href).href;
  }

  function getEndpoint() {
    const baseUrl = String(runtime.supabaseUrl || "https://ywecvlapdlaojpvijaqy.supabase.co").replace(/\/+$/, "");
    return `${baseUrl}/functions/v1/Mainflow-telegram?action=web-form-submit`;
  }

  function getInitialValue(key) {
    return toNumber(getQuery().get(carryoverQueryParamByKey[key] || ""));
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

  function getPatientNoteRows(notes, sectionKey) {
    return Array.isArray(notes && notes[sectionKey]) ? notes[sectionKey] : [];
  }

  function countPatientNotes(notes) {
    return patientNoteSections.reduce((total, section) => (
      total + getPatientNoteRows(notes, section.key).filter((value) => String(value).trim()).length
    ), 0);
  }

  function readPatientNotes() {
    const notes = createEmptyPatientNotes();
    if (!root) {
      return notes;
    }
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
    if (!root) {
      return;
    }
    const badge = root.querySelector("[data-patient-notes-badge]");
    const status = root.querySelector("[data-patient-notes-status]");
    const count = countPatientNotes(notes);
    if (badge) {
      badge.textContent = count ? `Լրացված է ${count}` : "Տեղային գրառում չկա";
    }
    if (status) {
      status.textContent = message || "Պահվում է այս սարքում և ուղարկելիս կտեղադրվի PDF բլանկում։";
    }
  }

  function renderPatientNotesMobileBlock(department, reportDate) {
    const notes = loadPatientNotes(department, reportDate);
    const filledCount = countPatientNotes(notes);
    const sections = patientNoteSections.map((section) => {
      const rows = getPatientNoteRows(notes, section.key);
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
          Այս մասը պահվում է այս սարքում և ուղարկելիս կտեղադրվի PDF բլանկում։
        </p>
        <div class="tg-patient-notes-grid">${sections}</div>
        <div class="tg-patient-notes-actions">
          <button type="button" class="tg-patient-notes-save" data-save-patient-notes>Պահպանել տեղում</button>
          <button type="button" class="tg-patient-notes-clear" data-clear-patient-notes>Մաքրել գրառումները</button>
          <span data-patient-notes-status>Պահվում է այս սարքում և ուղարկելիս կտեղադրվի PDF բլանկում։</span>
        </div>
      </details>
    `;
  }

  function readValues() {
    const values = {};
    fields.forEach((field) => {
      const input = root ? root.querySelector(`[data-field="${field.key}"]`) : null;
      values[field.key] = toNumber(input ? input.value : 0);
    });
    return values;
  }

  function renderFieldCard(field) {
    return `
      <label class="tg-sheet-field is-readonly">
        <span class="tg-sheet-field-top">
          <span class="tg-sheet-field-index">${field.cell}</span>
          <span class="tg-sheet-field-label">${escapeHtml(field.label)}</span>
        </span>
        <input
          class="tg-form-input tg-sheet-field-input tg-form-input--readonly"
          ${field.key === "presentTotal" ? 'data-control-total' : ""}
          data-field="${escapeHtml(field.key)}"
          inputmode="numeric"
          pattern="[0-9]*"
          type="text"
          autocomplete="off"
          maxlength="3"
          value="${getInitialValue(field.key)}"
          readonly
          aria-readonly="true"
          title="Ստացվել է գլխավոր աղյուսակից"
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

  function syncFieldLockState() {
    if (!root) {
      return;
    }

    root.querySelectorAll("[data-field]").forEach((input) => {
      const fieldKey = input.getAttribute("data-field") || "";
      const shouldLock = fieldKey === "presentTotal" ? true : !fullEditUnlocked;
      input.readOnly = shouldLock;
      input.setAttribute("aria-readonly", shouldLock ? "true" : "false");
      input.classList.toggle("tg-form-input--readonly", shouldLock);
      input.closest(".tg-sheet-field")?.classList.toggle("is-readonly", shouldLock);
      if (shouldLock) {
        input.setAttribute("title", "Ստացվել է գլխավոր աղյուսակից");
      } else {
        input.setAttribute("title", "Խմբագրումը միացված է");
      }
    });

    const lockInput = root.querySelector("[data-full-edit-toggle]");
    const lockText = root.querySelector("[data-full-edit-status]");
    if (lockInput) {
      lockInput.checked = fullEditUnlocked;
    }
    if (lockText) {
      lockText.textContent = fullEditUnlocked
        ? "Խմբագրումը միացված է. կարող եք փոխել 1-11 և 13-22 բջիջները, իսկ 12-ը միայն ընթերցման համար է։"
        : "Խմբագրումը անջատված է. բջիջները միայն դիտման համար են։";
    }

    updateControl();
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
    return fields.every((field) => toNumber(values[field.key]) === getInitialValue(field.key));
  }

  function updateControl() {
    if (!root) {
      return;
    }

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
      status.innerHTML = hasSubmitAccess()
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
        : `<div class="tg-form-status-head"><strong>${escapeHtml("Բացեք ձևը Telegram բոտի կամ Android հավելվածի միջոցով։")}</strong></div>`;
    }

    if (submit) {
      submit.disabled = !validation.isValid || !hasSubmitAccess() || !hasRequiredAndroidPhoto();
    }
  }

  async function submitForm(event) {
    event.preventDefault();
    if (!root) {
      return;
    }

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
    if (!hasRequiredAndroidPhoto()) {
      if (message) {
        message.className = "tg-form-message error";
        message.textContent = getAndroidPhotoMessage();
      }
      updateControl();
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = "Отправляю...";
    }
    if (message) {
      message.className = "tg-form-message";
      message.textContent = "Сохраняю данные формы...";
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
          values,
          patientNotes: readPatientNotes(),
          photoImageDataUrl: getAndroidPhotoState() && getAndroidPhotoState().imageDataUrl ? getAndroidPhotoState().imageDataUrl : "",
          photoImageName: getAndroidPhotoState() && getAndroidPhotoState().imageName ? getAndroidPhotoState().imageName : "",
          photoDetectedDepartmentId: getAndroidPhotoState() && getAndroidPhotoState().detectedDepartmentId ? getAndroidPhotoState().detectedDepartmentId : ""
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(payload && payload.error ? payload.error : "Не удалось отправить форму.");
      }
      if (message) {
        message.className = "tg-form-message success";
        message.textContent = payload.message || "Данные сохранены.";
      }
      if (telegram) {
        telegram.HapticFeedback && telegram.HapticFeedback.notificationOccurred("success");
        telegram.MainButton && telegram.MainButton.setText("Փակել").show().onClick(() => telegram.close());
      }
    } catch (error) {
      if (message) {
        message.className = "tg-form-message error";
        message.textContent = error instanceof Error ? error.message : "Не удалось отправить форму.";
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
    if (!root) {
      return;
    }

    const department = getDepartment();
    const reportDate = getReportDate();
    if (!department) {
      root.innerHTML = `
        <section class="tg-form-card">
          <p class="tg-form-kicker">SARSH_KKZH</p>
          <h1 class="tg-form-title">Բաժանմունքը չի գտնվել</h1>
          <p class="tg-form-muted">Փակեք պատուհանը և կրկին բացեք ձևը Telegram բոտի կամ Android հավելվածի միջոցով։</p>
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
            ${sectionDefinitions.map((section) => renderSection(section)).join("")}
          </div>

          ${renderPatientNotesMobileBlock(department, reportDate)}

          <div class="tg-form-status" data-status></div>
          <div class="tg-form-actions">
            <button class="tg-form-submit" data-submit type="submit">Ստուգել և ուղարկել</button>
            <div class="tg-form-message${hasSubmitAccess() ? "" : " error"}" data-message>
              ${hasSubmitAccess() ? "Բջիջները բացվել են գլխավոր աղյուսակից բերված տվյալներով։" : "Բացեք ձևը Telegram բոտի կամ Android հավելվածի միջոցով։"}
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
              <span data-full-edit-status>Խմբագրումը անջատված է. բջիջները միայն դիտման համար են։</span>
            </div>
          </div>
        </form>
      </section>
    `;
  }

  function bindEvents() {
    if (!root) {
      return;
    }

    root.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const digitsOnly = input.value.replace(/\D+/g, "").slice(0, 3);
        if (input.value !== digitsOnly) {
          input.value = digitsOnly;
        }
        updateControl();
      });
      input.addEventListener("focus", () => input.select());
    });

    const fullEditToggle = root.querySelector("[data-full-edit-toggle]");
    if (fullEditToggle) {
      fullEditToggle.addEventListener("change", () => {
        fullEditUnlocked = Boolean(fullEditToggle.checked);
        syncFieldLockState();
      });
    }

    const department = getDepartment();
    const reportDate = getReportDate();
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
  }

  render();
  bindEvents();
  syncFieldLockState();

  const initialAndroidMessage = root && root.querySelector ? root.querySelector("[data-message]") : null;
  if (initialAndroidMessage && isAndroidMode()) {
    initialAndroidMessage.className = `tg-form-message${hasRequiredAndroidPhoto() ? "" : " error"}`;
    initialAndroidMessage.textContent = getAndroidPhotoMessage();
    updateControl();
  }

  window.addEventListener("mainform-android-state-changed", () => {
    const currentMessage = root && root.querySelector ? root.querySelector("[data-message]") : null;
    if (currentMessage && isAndroidMode()) {
      currentMessage.className = `tg-form-message${hasRequiredAndroidPhoto() ? "" : " error"}`;
      currentMessage.textContent = getAndroidPhotoMessage();
    }
    updateControl();
  });

  if (telegram) {
    telegram.ready();
    telegram.expand();
  }
})();
