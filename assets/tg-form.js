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
  const readOnlyKeys = new Set(["beenTotal", "beenSoldier", "beenSeries"]);

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

  const groupSpans = [
    { title: "Եղել է", span: 3 },
    { title: "Ընդունվել է", span: 3 },
    { title: "Դ/Գ", span: 3 },
    { title: "Տեղափոխ", span: 2 },
    { title: "Հսկիչ", span: 1 },
    { title: "Առկա է", span: 7 },
    { title: "Արձակուրդ", span: 3 }
  ];

  const patientNoteSections = [
    { key: "admitted", title: "Ընդունված հիվանդներ", rows: 6 },
    { key: "discharged", title: "Դուրս գրված հիվանդներ", rows: 6 },
    { key: "transferred", title: "Տեղափոխված հիվանդներ", rows: 5 },
    { key: "dischargedNotTaken", title: "Դուրսգրված-չտարված", rows: 5 },
    { key: "returnedFromLeave", title: "Վերադարձել են արձակուրդից", rows: 5 },
    { key: "wentOnLeave", title: "Գնացել են արձակուրդ", rows: 5 }
  ];

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
    const paramByKey = {
      beenTotal: "c1",
      beenSoldier: "c2",
      beenSeries: "c3"
    };
    return toNumber(query.get(paramByKey[key] || ""));
  }

  function getInitialValue(key) {
    return readOnlyKeys.has(key) ? getCarryoverValue(key) : 0;
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
    editableKeys.forEach((key) => {
      const input = root.querySelector(`[data-field="${key}"]`);
      values[key] = toNumber(input ? input.value : 0);
    });
    return values;
  }

  function getExpected(values) {
    return (values.beenTotal + values.admittedTotal + values.transferToDepartment)
      - (values.dgTotal + values.transferFromDepartment);
  }

  function getActual(values) {
    return presentKeys.reduce((sum, key) => sum + toNumber(values[key]), 0);
  }

  function updateControl() {
    const values = readValues();
    const actual = getActual(values);
    const expected = getExpected(values);
    const isValid = actual === expected;
    const control = root.querySelector("[data-control-total]");
    const status = root.querySelector("[data-status]");
    const submit = root.querySelector("[data-submit]");

    if (control) {
      control.textContent = String(expected);
    }
    if (status) {
      status.classList.toggle("bad", !isValid);
      status.innerHTML = isValid
        ? `Контроль пройден: сумма 13-22 = ${actual}.`
        : `Контроль не пройден: сумма 13-22 = ${actual}, должно быть ${expected}.`;
    }
    if (submit) {
      submit.disabled = !isValid || !getInitData();
    }
  }

  function getInitData() {
    return telegram && typeof telegram.initData === "string" ? telegram.initData : "";
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
    const actual = getActual(values);
    const expected = getExpected(values);
    if (actual !== expected) {
      updateControl();
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = "Отправляю...";
    }
    if (message) {
      message.className = "tg-form-message";
      message.textContent = "Проверяю и отправляю данные...";
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
        throw new Error(payload && payload.error ? payload.error : "Не удалось отправить форму.");
      }
      if (message) {
        message.className = "tg-form-message success";
        message.textContent = "Спасибо. Отличная работа. Данные отправлены на проверку.";
      }
      if (telegram) {
        telegram.HapticFeedback && telegram.HapticFeedback.notificationOccurred("success");
        telegram.MainButton && telegram.MainButton.setText("Закрыть").show().onClick(() => telegram.close());
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
        submit.textContent = "Отправить на проверку";
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
          <h1 class="tg-form-title">Отделение не найдено</h1>
          <p class="tg-form-muted">Закройте окно и запросите форму у бота ещё раз.</p>
        </section>
      `;
      return;
    }

    const groupRow = groupSpans
      .map((group) => `<th colspan="${group.span}">${escapeHtml(group.title)}</th>`)
      .join("");
    const labelRow = fields
      .map((field) => `
        <th>
          <span class="tg-form-cell-number">${field.cell}</span>
          <span class="tg-form-cell-label">${escapeHtml(field.label)}</span>
        </th>
      `)
      .join("");
    const inputRow = fields
      .map((field) => {
        if (field.key === "presentTotal") {
          return '<td><span class="tg-form-control-value" data-control-total>0</span></td>';
        }
        const isReadOnly = readOnlyKeys.has(field.key);
        return `
          <td>
            <input
              class="tg-form-input${isReadOnly ? " tg-form-input--readonly" : ""}"
              data-field="${escapeHtml(field.key)}"
              inputmode="numeric"
              pattern="[0-9]*"
              type="text"
              autocomplete="off"
              maxlength="3"
              value="${getInitialValue(field.key)}"
              ${isReadOnly ? 'readonly aria-readonly="true" title="Заполнено из основной таблицы"' : ""}
            >
          </td>
        `;
      })
      .join("");

    root.innerHTML = `
      <section class="tg-form-card">
        <header class="tg-form-head">
          <div>
            <p class="tg-form-kicker">${escapeHtml(department.marker || department.id)}</p>
            <h1 class="tg-form-title">${escapeHtml(department.department)}</h1>
          </div>
          <div class="tg-form-meta">
            <span class="tg-form-pill">Дата: ${escapeHtml(reportDate)}</span>
            <span class="tg-form-pill">Форма Telegram</span>
          </div>
        </header>

        <form data-form>
          <div class="tg-form-table-wrap" aria-label="Таблица отделения">
            <table class="tg-form-table">
              <thead>
                <tr>${groupRow}</tr>
                <tr>${labelRow}</tr>
              </thead>
              <tbody>
                <tr>${inputRow}</tr>
              </tbody>
            </table>
          </div>

          ${renderPatientNotesBlock(department, reportDate)}

          <div class="tg-form-status" data-status></div>
          <div class="tg-form-actions">
            <button class="tg-form-submit" data-submit type="submit">Отправить на проверку</button>
            <div class="tg-form-message${getInitData() ? "" : " error"}" data-message>
              ${getInitData() ? "Ячейки 1-3 заполнены из основной таблицы и закрыты. Остальные пустые значения оставьте 0." : "Откройте форму через кнопку бота в Telegram."}
            </div>
          </div>
        </form>
      </section>
    `;

    root.querySelectorAll(".tg-form-input").forEach((input) => {
      input.addEventListener("input", () => {
        const digitsOnly = input.value.replace(/\D+/g, "").slice(0, 3);
        if (input.value !== digitsOnly) {
          input.value = digitsOnly;
        }
        updateControl();
      });
      input.addEventListener("focus", () => input.select());
    });
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
    updateControl();
  }

  if (telegram) {
    telegram.ready();
    telegram.expand();
  }

  render();
})();
