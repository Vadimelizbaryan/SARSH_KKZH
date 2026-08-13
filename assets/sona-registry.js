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
  const DISPLAYED_REGISTRIES = Object.keys(REGISTRIES).filter((key) => !["archive_only", "unclassified"].includes(key));
  const query = new URLSearchParams(window.location.search);
  const initialRegistry = REGISTRIES[query.get("registry")] ? query.get("registry") : "civil_hospitals";
  const state = { registryType: initialRegistry, reviewStatus: "approved", summary: [], records: [], loading: false, status: "Загружаю базу данных…", statusType: "" };

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function statusLabel(status) {
    return ({ pending_review: "На проверке", approved: "Утверждённые", rejected: "Отклонённые" })[status] || "Все статусы";
  }

  function recordDescription(record) {
    return [record.medical_center, record.military_unit, record.rank, record.department_name].filter(Boolean).join(" · ") || "—";
  }

  async function api(type, data) {
    if (window.SHARSH_AUTH_READY) await window.SHARSH_AUTH_READY;
    const auth = window.SHARSH_AUTH || null;
    const token = auth && typeof auth.getAccessToken === "function" ? auth.getAccessToken() : "";
    if (!runtime.supabaseUrl || !runtime.supabaseAnonKey || !token) throw new Error("Войдите как владелец Supabase и обновите страницу.");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);
    let response;
    try {
      response = await fetch(`${runtime.supabaseUrl.replace(/\/+$/, "")}/functions/v1/sona-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: runtime.supabaseAnonKey, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, ...(data || {}) }),
        signal: controller.signal
      });
    } catch (error) {
      if (error && error.name === "AbortError") throw new Error("Сервер не ответил за 20 секунд. Нажмите «Показать» ещё раз.");
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.error) throw new Error(payload?.error || `Ошибка сервера (${response.status}).`);
    return payload;
  }

  function summaryFor(registryType) {
    return state.summary.filter((item) => item.registry_type === registryType).reduce((total, item) => total + Number(item.record_count || 0), 0);
  }

  function approvedFor(registryType) {
    return Number(state.summary.find((item) => item.registry_type === registryType && item.review_status === "approved")?.record_count || 0);
  }

  function registryCards() {
    return `<section class="sona-registry-cards">${DISPLAYED_REGISTRIES.map((key) => `<button type="button" class="sona-registry-card ${key === state.registryType ? "active" : ""}" data-registry="${key}"><strong>${escapeHtml(REGISTRIES[key])}</strong><span><b>${summaryFor(key)}</b> всего · ${approvedFor(key)} утверждено</span></button>`).join("")}</section>`;
  }

  function recordsTable() {
    if (!state.records.length) return `<p class="sona-empty">В выбранной базе пока нет записей со статусом «${escapeHtml(statusLabel(state.reviewStatus))}».</p>`;
    return `<div class="sona-table-wrap"><table class="sona-table sona-registry-table"><thead><tr><th>ФИО</th><th>Больница / часть</th><th>Событие</th><th>Диагноз / примечание</th><th>Источник</th><th>Статус</th></tr></thead><tbody>${state.records.map((record) => `<tr><td><strong>${escapeHtml(record.patient_name || "Без ФИО")}</strong><br><small>${record.birth_year || ""}${record.draft_year ? ` · призыв ${escapeHtml(record.draft_year)}` : ""}</small></td><td>${escapeHtml(recordDescription(record))}</td><td>${escapeHtml(record.admission_date || record.discharge_date || record.referral_date || record.event_date || "Дата не указана")}${record.transfer_destination ? `<br><small>${escapeHtml(record.transfer_destination)}</small>` : ""}</td><td>${escapeHtml(record.diagnosis || record.notes || "—")}</td><td><small>${escapeHtml(record.source_name || "Источник SONA")}${record.source_row ? `, строка ${escapeHtml(record.source_row)}` : ""}</small></td><td><span class="sona-pill ${escapeHtml(record.review_status)}">${escapeHtml(statusLabel(record.review_status))}</span></td></tr>`).join("")}</tbody></table></div>`;
  }

  function render() {
    if (!app) return;
    app.innerHTML = `<section class="sona-topbar"><div><p class="sona-kicker">Рабочие реестры</p><h1>Базы данных SONA</h1><p class="sona-subtitle">Здесь собраны утверждённые записи из всех загруженных папок. Исходные документы остаются в закрытом архиве.</p></div><div class="sona-actions"><a class="sona-link" href="sona-import.html">Импорт SONA</a><a class="sona-link" href="index.html">← Главная</a></div></section><p class="sona-status ${escapeHtml(state.statusType)}">${escapeHtml(state.status)}</p>${registryCards()}<section class="sona-card sona-registry-workspace"><p class="sona-kicker">Выбранная база</p><h2>${escapeHtml(REGISTRIES[state.registryType])}</h2><div class="sona-filters"><label class="sona-field">Статус<select id="registry-review-status"><option value="approved" ${state.reviewStatus === "approved" ? "selected" : ""}>Утверждённые</option><option value="pending_review" ${state.reviewStatus === "pending_review" ? "selected" : ""}>На проверке</option><option value="rejected" ${state.reviewStatus === "rejected" ? "selected" : ""}>Отклонённые</option><option value="" ${state.reviewStatus === "" ? "selected" : ""}>Все статусы</option></select></label><button class="sona-button primary" type="button" id="show-registry-btn" ${state.loading ? "disabled" : ""}>${state.loading ? "Загружаю…" : "Показать"}</button></div><p class="sona-filter-result">Найдено записей: <strong>${state.records.length}</strong>.</p>${recordsTable()}</section>`;
  }

  async function loadData() {
    state.loading = true;
    state.status = `Загружаю: ${REGISTRIES[state.registryType]}…`;
    state.statusType = "";
    render();
    try {
      const [summaryPayload, recordsPayload] = await Promise.all([api("list_registry_summary"), api("list_registry_records", { registryType: state.registryType, reviewStatus: state.reviewStatus, limit: 500 })]);
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

  document.addEventListener("click", (event) => {
    const card = event.target instanceof Element ? event.target.closest("[data-registry]") : null;
    if (card instanceof HTMLElement) {
      state.registryType = card.dataset.registry;
      loadData();
      return;
    }
    if (event.target instanceof Element && event.target.closest("#show-registry-btn")) {
      const select = document.getElementById("registry-review-status");
      state.reviewStatus = select instanceof HTMLSelectElement ? select.value : "approved";
      loadData();
    }
  });

  loadData();
})();
