(function () {
  const app = document.getElementById("app");
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const REGISTRIES = {
    civil_hospitals: "Քաղաքացիական հիվանդանոցներ",
    admitted_military: "Ընդունված զինծառայողներ",
    discharged_transferred: "Դուրսգրված և տեղափոխվածներ",
    referrals_admissions: "Ուղեգրումներ / ընդունումներ",
    returned: "Վերադարձածներ",
    outpatient: "Ամբուլատոր բուժում",
    discharged_not_transferred: "Չտեղափոխված դուրսգրվածներ",
    archive_only: "Միայն արխիվ",
    unclassified: "Չդասակարգված"
  };
  const VISIBLE_REGISTRIES = Object.keys(REGISTRIES).filter((key) => !["archive_only", "unclassified"].includes(key));
  const query = new URLSearchParams(window.location.search);
  const initialRegistry = REGISTRIES[query.get("registry")] ? query.get("registry") : "civil_hospitals";
  const state = {
    registryType: initialRegistry,
    reviewStatus: "approved",
    summary: [],
    records: [],
    search: "",
    searchDraft: "",
    loading: false,
    status: "Загружаю базу данных…",
    statusType: ""
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeSearch(value) {
    return String(value || "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
  }

  function statusLabel(status) {
    return ({ pending_review: "На проверке", approved: "Утверждённые", rejected: "Отклонённые" })[status] || "Все статусы";
  }

  async function api(type, data) {
    if (window.SHARSH_AUTH_READY) {
      await window.SHARSH_AUTH_READY;
    }
    const auth = window.SHARSH_AUTH || null;
    const token = auth && typeof auth.getAccessToken === "function" ? auth.getAccessToken() : "";
    if (!runtime.supabaseUrl || !runtime.supabaseAnonKey || !token) {
      throw new Error("Войдите как владелец Supabase и обновите страницу.");
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);
    let response;
    try {
      response = await fetch(`${runtime.supabaseUrl.replace(/\/+$/, "")}/functions/v1/sona-import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: runtime.supabaseAnonKey,
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ type, ...(data || {}) }),
        signal: controller.signal
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("Сервер не ответил за 20 секунд. Нажмите «Обновить» ещё раз.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.error) {
      throw new Error(payload?.error || `Ошибка сервера (${response.status}).`);
    }
    return payload;
  }

  function registryCount(registryType, reviewStatus) {
    return state.summary
      .filter((item) => item.registry_type === registryType && (!reviewStatus || item.review_status === reviewStatus))
      .reduce((total, item) => total + Number(item.record_count || 0), 0);
  }

  function filteredRecords() {
    const queryText = normalizeSearch(state.search);
    if (!queryText) {
      return state.records;
    }
    return state.records.filter((record) => normalizeSearch([
      record.patient_name,
      record.medical_center,
      record.military_unit,
      record.rank,
      record.department_name,
      record.diagnosis,
      record.notes,
      record.admission_date,
      record.discharge_date,
      record.referral_date,
      record.event_date,
      record.source_name
    ].filter(Boolean).join(" ")).includes(queryText));
  }

  function renderRegistryOptions() {
    return VISIBLE_REGISTRIES.map((key) => `<option value="${key}" ${key === state.registryType ? "selected" : ""}>${escapeHtml(REGISTRIES[key])}</option>`).join("");
  }

  function recordDate(record) {
    return record.admission_date || record.discharge_date || record.referral_date || record.event_date || "—";
  }

  function renderTable(rows) {
    if (!rows.length) {
      return `<div class="civil-empty">По текущему поиску записей не найдено.</div>`;
    }
    return `<div class="civil-table-wrap"><table class="civil-table sona-base-table"><thead><tr>
      <th>#</th><th>Ֆ.Ա.Ա.</th><th>ԲԿ</th><th>Զ/Մ / կոչում</th><th>Ամսաթիվ</th><th>Ախտորոշում / նշում</th><th>Աղբյուր</th><th>Կարգավիճակ</th>
    </tr></thead><tbody>${rows.map((record, index) => `<tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(record.patient_name || "Без ФИО")}</strong>${record.birth_year || record.draft_year ? `<br><small>${record.birth_year || ""}${record.draft_year ? ` · զորակոչ ${escapeHtml(record.draft_year)}` : ""}</small>` : ""}</td>
      <td>${escapeHtml(record.medical_center || "—")}</td>
      <td>${escapeHtml([record.military_unit, record.rank, record.department_name].filter(Boolean).join(" · ") || "—")}</td>
      <td>${escapeHtml(recordDate(record))}${record.transfer_destination ? `<br><small>${escapeHtml(record.transfer_destination)}</small>` : ""}</td>
      <td>${escapeHtml(record.diagnosis || record.notes || "—")}</td>
      <td><small>${escapeHtml(record.source_name || "Источник SONA")}${record.source_row ? `, строка ${escapeHtml(record.source_row)}` : ""}</small></td>
      <td><span class="sona-pill ${escapeHtml(record.review_status)}">${escapeHtml(statusLabel(record.review_status))}</span></td>
    </tr>`).join("")}</tbody></table></div>`;
  }

  function render() {
    if (!app) {
      return;
    }
    const rows = filteredRecords();
    const totalInRegistry = registryCount(state.registryType, "");
    const approvedInRegistry = registryCount(state.registryType, "approved");
    app.innerHTML = `
      <div class="toolbar no-print">
        <div><h1>SONA բազաներ</h1><p>Отдельные рабочие реестры, собранные из утверждённых документов SONA.</p></div>
        <div class="toolbar-actions"><a class="button-link" href="sona-import.html">SONA արխիվ</a><a class="button-link" href="index.html">К главному</a><button type="button" id="sonaRegistryReloadBtn" ${state.loading ? "disabled" : ""}>Обновить</button></div>
      </div>
      <main class="civil-page sona-base-page">
        <section class="civil-hero">
          <div><div class="civil-kicker">Защищённый отдельный реестр</div><h2>${escapeHtml(REGISTRIES[state.registryType])}</h2><p>Утверждённые записи из всех импортированных папок. Выберите другую базу, чтобы увидеть её собственную таблицу.</p></div>
          <div class="civil-stats"><span>В реестре: <strong>${totalInRegistry}</strong></span><span>Утверждено: <strong>${approvedInRegistry}</strong></span><span>Показано: <strong>${rows.length}</strong></span></div>
        </section>
        <section class="panel civil-database-panel">
          <div class="civil-section-head"><div><h2>Загруженная база</h2><p class="hint">Данные сохранены на сервере. По умолчанию показаны утверждённые записи; записи «На проверке» можно открыть через фильтр.</p></div><div class="civil-section-actions"><span class="civil-count-pill">${escapeHtml(statusLabel(state.reviewStatus))}: ${state.records.length}</span></div></div>
          <div class="civil-database-tools sona-base-tools">
            <label class="sona-base-select"><span>База</span><select id="sonaRegistrySelect" ${state.loading ? "disabled" : ""}>${renderRegistryOptions()}</select></label>
            <label class="sona-base-select"><span>Статус</span><select id="sonaRegistryStatusSelect" ${state.loading ? "disabled" : ""}><option value="approved" ${state.reviewStatus === "approved" ? "selected" : ""}>Утверждённые</option><option value="pending_review" ${state.reviewStatus === "pending_review" ? "selected" : ""}>На проверке</option><option value="rejected" ${state.reviewStatus === "rejected" ? "selected" : ""}>Отклонённые</option><option value="" ${state.reviewStatus === "" ? "selected" : ""}>Все статусы</option></select></label>
            <input type="search" id="sonaRegistrySearchInput" placeholder="Поиск: ФИО, БК, զորամաս, диагноз, дата" value="${escapeHtml(state.searchDraft)}" ${state.loading ? "disabled" : ""}>
            <button type="button" id="sonaRegistrySearchBtn" class="civil-search-button" title="Поиск" aria-label="Поиск" ${state.loading ? "disabled" : ""}>&#128269;</button>
          </div>
          <p class="civil-search-note">Выберите базу или статус и нажмите «Обновить». Поиск работает по текущей таблице.</p>
          <div class="civil-status ${escapeHtml(state.statusType)}">${escapeHtml(state.status)}</div>
          ${renderTable(rows)}
        </section>
      </main>`;
  }

  async function loadData() {
    state.loading = true;
    state.status = `Загружаю: ${REGISTRIES[state.registryType]}…`;
    state.statusType = "";
    render();
    try {
      const [summaryPayload, recordsPayload] = await Promise.all([
        api("list_registry_summary"),
        api("list_registry_records", { registryType: state.registryType, reviewStatus: state.reviewStatus, limit: 500 })
      ]);
      state.summary = summaryPayload.summary || [];
      state.records = recordsPayload.records || [];
      state.status = `База загружена: ${state.records.length} записей.`;
      state.statusType = "success";
      const url = new URL(window.location.href);
      url.searchParams.set("registry", state.registryType);
      window.history.replaceState({}, "", url);
    } catch (error) {
      state.status = error instanceof Error ? error.message : "Не удалось загрузить базу SONA.";
      state.statusType = "error";
    } finally {
      state.loading = false;
      render();
    }
  }

  document.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.id === "sonaRegistrySearchInput") {
      state.searchDraft = event.target.value;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.id === "sonaRegistrySearchInput") {
      event.preventDefault();
      state.search = state.searchDraft;
      render();
    }
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    if (event.target.closest("#sonaRegistrySearchBtn")) {
      state.search = state.searchDraft;
      render();
      return;
    }
    if (event.target.closest("#sonaRegistryReloadBtn")) {
      const registry = document.getElementById("sonaRegistrySelect");
      const reviewStatus = document.getElementById("sonaRegistryStatusSelect");
      state.registryType = registry instanceof HTMLSelectElement ? registry.value : state.registryType;
      state.reviewStatus = reviewStatus instanceof HTMLSelectElement ? reviewStatus.value : state.reviewStatus;
      loadData();
    }
  });

  loadData();
})();
