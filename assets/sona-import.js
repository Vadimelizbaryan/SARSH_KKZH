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
  const ALLOWED_EXTENSIONS = new Set(["docx", "rtf", "doc", "pdf", "xlsx"]);
  const EXTRACTABLE_EXTENSIONS = new Set(["docx", "rtf"]);
  const MAX_PROCESS_PER_RUN = 25;

  const state = {
    batches: [],
    batch: null,
    selectedFiles: [],
    records: [],
    selectedRecordIds: new Set(),
    registryFilter: "",
    reviewFilter: "",
    busy: false,
    filterLoading: false,
    progress: null,
    status: "Войдите как владелец, затем выберите первую папку SONA для пилотной загрузки.",
    statusType: "",
    uploadClientPromise: null
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fileExtension(name) {
    const match = String(name || "").toLowerCase().match(/\.([a-z0-9]{1,10})$/);
    return match ? match[1] : "";
  }

  function formatSize(value) {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("ru-RU");
  }

  function statusLabel(status) {
    const labels = {
      draft: "черновик",
      uploading: "загрузка",
      ready: "готово к обработке",
      processing: "обработка",
      completed: "готово",
      completed_with_review: "есть проверка",
      failed: "ошибка",
      registered: "загружен",
      processed: "распознан",
      unsupported: "нужна конвертация",
      pending_review: "на проверке",
      approved: "утверждён",
      rejected: "отклонён"
    };
    return labels[status] || status || "—";
  }

  function setStatus(message, type) {
    state.status = message || "";
    state.statusType = type || "";
    render();
  }

  function getAuth() {
    return window.SHARSH_AUTH || null;
  }

  async function api(type, data, options) {
    if (window.SHARSH_AUTH_READY) {
      await window.SHARSH_AUTH_READY;
    }
    const auth = getAuth();
    const token = auth && typeof auth.getAccessToken === "function" ? auth.getAccessToken() : "";
    if (!runtime.supabaseUrl || !runtime.supabaseAnonKey || !token) {
      throw new Error("Вход владельца Supabase ещё не готов. Войдите заново и обновите страницу.");
    }
    const controller = new AbortController();
    const timeoutMs = Number(options?.timeoutMs) || 120000;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
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
        throw new Error("Сервер не ответил за отведённое время. Нажмите «Применить» ещё раз — обработка документов не будет запущена повторно.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.error) {
      throw new Error(payload && payload.error ? payload.error : `Ошибка сервера (${response.status}).`);
    }
    return payload;
  }

  async function getUploadClient() {
    if (!state.uploadClientPromise) {
      state.uploadClientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
        .then(({ createClient }) => createClient(runtime.supabaseUrl, runtime.supabaseAnonKey));
    }
    return state.uploadClientPromise;
  }

  function sourcePathFor(file) {
    return String(file.webkitRelativePath || file.name || "").replace(/\\/g, "/");
  }

  function suggestedBatchName(files) {
    const firstPath = files.length ? sourcePathFor(files[0]).split("/") : [];
    return firstPath.length > 1 ? firstPath[0] : "Папка SONA";
  }

  function renderRegistryOptions(selected) {
    return `<option value="">Все реестры</option>${Object.entries(REGISTRIES)
      .map(([key, label]) => `<option value="${key}" ${key === selected ? "selected" : ""}>${escapeHtml(label)}</option>`)
      .join("")}`;
  }

  function batchFileCounters(files) {
    return files.reduce((counts, file) => {
      counts.total += 1;
      counts[file.upload_status] = (counts[file.upload_status] || 0) + 1;
      return counts;
    }, { total: 0 });
  }

  function renderProgress() {
    const progress = state.progress;
    if (!progress || !progress.total) return "";
    const percent = Math.max(0, Math.min(100, Math.round((progress.current / progress.total) * 100)));
    return `<div class="sona-progress" role="status"><div class="sona-progress-copy"><strong>${escapeHtml(progress.label || "Выполняю операцию")}</strong><span>${progress.current} из ${progress.total}</span></div><div class="sona-progress-track"><span style="--sona-progress:${percent}%"></span></div></div>`;
  }

  function renderBatches() {
    if (!state.batches.length) {
      return '<p class="sona-empty">Папок ещё нет. Начните с одной небольшой папки SONA.</p>';
    }
    return `<div class="sona-batch-list">${state.batches.map((batch) => `
      <button class="sona-batch-item ${state.batch?.id === batch.id ? "active" : ""}" type="button" data-action="select-batch" data-batch-id="${escapeHtml(batch.id)}">
        <span><strong>${escapeHtml(batch.batch_name)}</strong><small>${escapeHtml(batch.source_folder || "Без пути")} · ${formatDate(batch.created_at)}</small></span>
        <span class="sona-pill ${escapeHtml(batch.status)}">${escapeHtml(statusLabel(batch.status))}</span>
      </button>`).join("")}</div>`;
  }

  function renderFiles() {
    const files = state.batch?.files || [];
    if (!files.length) {
      return '<p class="sona-empty">В этой папке ещё нет зарегистрированных файлов.</p>';
    }
    const visible = files.slice(0, 180);
    return `
      <div class="sona-table-wrap"><table class="sona-table"><thead><tr>
        <th>Источник</th><th>Тип / размер</th><th>Состояние</th><th>Действия</th>
      </tr></thead><tbody>${visible.map((file) => {
        const canProcess = EXTRACTABLE_EXTENSIONS.has(file.extension) && ["registered", "failed"].includes(file.upload_status);
        return `<tr>
          <td class="file-name"><strong>${escapeHtml(file.original_name)}</strong><br><small>${escapeHtml(file.source_path)}</small></td>
          <td>.${escapeHtml(file.extension)}<br><small>${formatSize(file.byte_size)}</small></td>
          <td><span class="sona-pill ${escapeHtml(file.upload_status)}">${escapeHtml(statusLabel(file.upload_status))}</span>${file.processing_error ? `<br><small>${escapeHtml(file.processing_error)}</small>` : ""}</td>
          <td class="row-actions"><button class="sona-mini-button" type="button" data-action="open-file" data-file-id="${escapeHtml(file.id)}">Открыть</button>${canProcess ? ` · <button class="sona-mini-button" type="button" data-action="process-file" data-file-id="${escapeHtml(file.id)}">Распознать</button>` : ""}</td>
        </tr>`;
      }).join("")}</tbody></table></div>
      ${files.length > visible.length ? `<p class="sona-empty">Показаны первые ${visible.length} из ${files.length} файлов. Все файлы остаются в закрытом архиве.</p>` : ""}`;
  }

  function recordDescription(record) {
    const parts = [record.medical_center, record.military_unit, record.rank, record.diagnosis].filter(Boolean);
    return parts.length ? parts.join(" · ") : "—";
  }

  function renderRecords() {
    const records = state.records || [];
    if (!state.batch) return "";
    if (!records.length) {
      const filterHint = state.reviewFilter === "pending_review"
        ? " В этой партии нет записей на проверке: они уже утверждены или отложены. Выберите «Все» или «Утверждённые» и нажмите «Применить»."
        : "";
      return `<p class="sona-empty">По текущему фильтру записей нет.${filterHint}</p>`;
    }
    return `<div class="sona-table-wrap"><table class="sona-table"><thead><tr>
      <th><input aria-label="Выбрать все" type="checkbox" data-action="select-all-records"></th><th>Пациент / источник</th><th>Реестр</th><th>Данные</th><th>Проверка</th>
    </tr></thead><tbody>${records.map((record) => `
      <tr>
        <td>${record.review_status === "pending_review" ? `<input aria-label="Выбрать запись" type="checkbox" data-action="toggle-record" data-record-id="${escapeHtml(record.id)}" ${state.selectedRecordIds.has(record.id) ? "checked" : ""}>` : ""}</td>
        <td><strong>${escapeHtml(record.patient_name || "Без ФИО")}</strong><br><small>${escapeHtml(record.source?.originalName || "Источник SONA")}${record.source_row ? `, строка ${escapeHtml(record.source_row)}` : ""}</small></td>
        <td>${escapeHtml(REGISTRIES[record.registry_type] || record.registry_type)}</td>
        <td>${escapeHtml(recordDescription(record))}<br><small>${escapeHtml(record.admission_date || record.discharge_date || record.referral_date || record.event_date || "Дата не указана")}</small></td>
        <td><span class="sona-pill ${escapeHtml(record.review_status)}">${escapeHtml(statusLabel(record.review_status))}</span><br><small>уверенность: ${escapeHtml(record.confidence || "low")}</small></td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function renderWorkspace() {
    if (!state.batch) {
      return "";
    }
    const files = state.batch.files || [];
    const counters = batchFileCounters(files);
    const processable = files.filter((file) => EXTRACTABLE_EXTENSIONS.has(file.extension) && ["registered", "failed"].includes(file.upload_status)).length;
    const recordSummary = (state.batch.records || []).reduce((counts, record) => {
      counts[record.review_status] = (counts[record.review_status] || 0) + 1;
      return counts;
    }, {});
    return `<section id="sona-workspace" class="sona-workspace">
      <section id="sona-records" class="sona-card">
        <div class="sona-actions"><div><p class="sona-kicker">Текущая папка</p><h2>${escapeHtml(state.batch.batch_name)}</h2></div><span class="sona-pill ${escapeHtml(state.batch.status)}">${escapeHtml(statusLabel(state.batch.status))}</span></div>
        <div class="sona-summary">
          <div class="sona-summary-card"><strong>${counters.total || 0}</strong><span>файлов</span></div>
          <div class="sona-summary-card"><strong>${counters.processed || 0}</strong><span>распознано</span></div>
          <div class="sona-summary-card"><strong>${recordSummary.pending_review || 0}</strong><span>на проверке</span></div>
          <div class="sona-summary-card"><strong>${recordSummary.approved || 0}</strong><span>утверждено</span></div>
        </div>
        <div class="sona-actions">
          <label class="sona-consent"><input id="sona-ai-consent" type="checkbox"> Я подтверждаю отправку текста выбранных документов в OpenAI для распознавания.</label>
          <button class="sona-button primary" type="button" data-action="process-batch" ${processable ? "" : "disabled"}>Распознать до ${Math.min(processable, MAX_PROCESS_PER_RUN)} файлов</button>
          <button class="sona-button" type="button" data-action="refresh-batch">Обновить</button>
        </div>
        <p class="sona-safety-note">Обработка запускается только этой кнопкой. Результаты не попадают в утверждённые реестры, пока вы не выберете и не подтвердите записи ниже.</p>
        ${renderFiles()}
      </section>
      <section class="sona-card">
        <div class="sona-actions"><div><p class="sona-kicker">Проверка перед записью</p><h2>Реестры SONA</h2></div></div>
        <div class="sona-filters">
          <label class="sona-field">Реестр<select data-action="registry-filter">${renderRegistryOptions(state.registryFilter)}</select></label>
          <label class="sona-field">Статус<select data-action="review-filter">
            <option value="" ${state.reviewFilter === "" ? "selected" : ""}>Все статусы</option>
            <option value="pending_review" ${state.reviewFilter === "pending_review" ? "selected" : ""}>На проверке</option>
            <option value="approved" ${state.reviewFilter === "approved" ? "selected" : ""}>Утверждённые</option>
            <option value="rejected" ${state.reviewFilter === "rejected" ? "selected" : ""}>Отклонённые</option>
          </select></label>
          <button class="sona-button" type="button" data-action="load-records" ${state.filterLoading ? "disabled" : ""}>${state.filterLoading ? "Применяю…" : "Применить"}</button>
        </div>
        <p class="sona-filter-result">Найдено записей: <strong>${state.records.length}</strong>. ${state.reviewFilter === "" ? "Показаны все статусы." : `Показан статус: ${escapeHtml(statusLabel(state.reviewFilter))}.`}</p>
        <div class="sona-review-actions"><button class="sona-button primary" type="button" data-action="approve-records" ${state.selectedRecordIds.size ? "" : "disabled"}>Утвердить выбранные (${state.selectedRecordIds.size})</button><button class="sona-button danger" type="button" data-action="reject-records" ${state.selectedRecordIds.size ? "" : "disabled"}>Отклонить</button></div>
        ${renderRecords()}
      </section>
    </section>`;
  }

  function render() {
    if (!app) return;
    const supportedSelection = state.selectedFiles.filter((file) => ALLOWED_EXTENSIONS.has(fileExtension(file.name)));
    const suggestedName = state.selectedFiles.length ? suggestedBatchName(state.selectedFiles) : "";
    app.innerHTML = `
      <section class="sona-topbar">
        <div><p class="sona-kicker">Защищённый модуль</p><h1>SONA: импорт документов в реестры</h1><p class="sona-subtitle">Загружайте папку, сохраняйте оригиналы в закрытом архиве, запускайте распознавание только по своему подтверждению и утверждайте результаты вручную.</p></div>
        <div class="sona-actions"><a class="sona-link" href="sona-registry.html">Базы SONA</a><a class="sona-link" href="index.html">← Главная</a></div>
      </section>
      ${renderProgress()}
      <p class="sona-status ${escapeHtml(state.statusType)}">${escapeHtml(state.status)}</p>
      <section class="sona-grid">
        <section class="sona-card">
          <p class="sona-kicker">Шаг 1</p><h2>Новая папка SONA</h2><p>Для первого запуска выберите одну небольшую папку. Вложенная структура будет сохранена как путь источника.</p>
          <div class="sona-form-grid">
            <label class="sona-field wide">Папка с Word-документами<input id="sona-folder-input" type="file" webkitdirectory directory multiple accept=".docx,.rtf,.doc,.pdf,.xlsx"></label>
            <label class="sona-field">Название партии<input id="sona-batch-name" value="${escapeHtml(suggestedName)}" placeholder="Например: 01.04.2026 Сона"></label>
            <label class="sona-field">Дата из папки (необязательно)<input id="sona-source-date" placeholder="01.04.2026"></label>
            <label class="sona-field wide">Комментарий<input id="sona-batch-notes" placeholder="Например: данные от коллеги Соны"></label>
          </div>
          <div class="sona-file-choice"><strong>${state.selectedFiles.length ? `Выбрано файлов: ${state.selectedFiles.length}` : "Папка пока не выбрана"}</strong><small>${state.selectedFiles.length ? `Допустимы: ${supportedSelection.length}; будут пропущены: ${state.selectedFiles.length - supportedSelection.length}. DOCX и RTF можно распознать сейчас; старые DOC сохранятся и будут отмечены для конвертации.` : "Оригиналы сохраняются в приватном хранилище. Ссылки на них не публикуются."}</small></div>
          <div class="sona-actions"><button class="sona-button primary" type="button" data-action="create-upload" ${supportedSelection.length ? "" : "disabled"}>Создать партию и загрузить</button></div>
          <p class="sona-safety-note">Не загружайте одну и ту же многолетнюю папку несколько раз: система вычисляет хэш файла, но дубликат всё равно займёт место в закрытом архиве до последующей очистки.</p>
        </section>
        <section class="sona-card"><p class="sona-kicker">Шаг 2</p><h2>Загруженные партии</h2><p>Выберите партию, чтобы посмотреть состояние файлов и проверить извлечённые записи.</p>${renderBatches()}</section>
      </section>
      ${renderWorkspace()}`;
  }

  async function loadBatches(selectBatchId) {
    const payload = await api("list_batches");
    state.batches = payload.batches || [];
    const preferred = selectBatchId || state.batch?.id;
    if (preferred && state.batches.some((batch) => batch.id === preferred)) {
      await loadBatch(preferred, false);
    } else {
      render();
    }
  }

  async function loadBatch(batchId, refreshBatches, focusWorkspace) {
    const payload = await api("get_batch", { batchId });
    state.batch = { ...payload.batch, files: payload.files || [], records: payload.records || [] };
    state.selectedRecordIds.clear();
    await loadRecords(false);
    if (refreshBatches) {
      const batches = await api("list_batches");
      state.batches = batches.batches || [];
    }
    render();
    if (focusWorkspace) {
      window.requestAnimationFrame(() => {
        document.getElementById("sona-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  async function loadRecords(renderAfter) {
    if (!state.batch) return;
    const payload = await api("list_records", {
      batchId: state.batch.id,
      registryType: state.registryFilter,
      reviewStatus: state.reviewFilter,
      limit: 500
    }, { timeoutMs: 20000 });
    state.records = payload.records || [];
    if (renderAfter) render();
  }

  async function createAndUpload() {
    const input = document.getElementById("sona-folder-input");
    const nameInput = document.getElementById("sona-batch-name");
    const dateInput = document.getElementById("sona-source-date");
    const notesInput = document.getElementById("sona-batch-notes");
    const pickedNow = input instanceof HTMLInputElement ? Array.from(input.files || []) : [];
    const selected = pickedNow.length ? pickedNow : state.selectedFiles;
    const files = selected.filter((file) => ALLOWED_EXTENSIONS.has(fileExtension(file.name)) && file.size > 0 && file.size <= 50 * 1024 * 1024);
    if (!files.length) {
      throw new Error("В выбранной папке нет подходящих файлов размером до 50 МБ.");
    }
    const batchName = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : "";
    const sourceFolder = suggestedBatchName(files);
    const batchPayload = await api("create_batch", {
      batchName: batchName || sourceFolder,
      sourceFolder,
      sourceDate: dateInput instanceof HTMLInputElement ? dateInput.value.trim() : "",
      notes: notesInput instanceof HTMLInputElement ? notesInput.value.trim() : ""
    });
    const batch = batchPayload.batch;
    state.batch = { ...batch, files: [], records: [] };
    render();
    const storage = await getUploadClient();
    let uploaded = 0;
    const failed = [];
    state.progress = { current: 0, total: files.length, label: "Загрузка документов в закрытый архив" };
    render();
    for (const [index, file] of files.entries()) {
      const sourcePath = sourcePathFor(file);
      try {
        state.progress = { current: index + 1, total: files.length, label: `Загрузка: ${file.name}` };
        setStatus(`Загружаю ${uploaded + 1} из ${files.length}: ${file.name}`, "");
        const ticket = await api("create_upload_url", {
          batchId: batch.id,
          sourcePath,
          originalName: file.name,
          byteSize: file.size,
          mimeType: file.type || "application/octet-stream"
        });
        const { error: uploadError } = await storage.storage.from(ticket.bucket).uploadToSignedUrl(
          ticket.storagePath,
          ticket.token,
          file,
          { contentType: ticket.file.mimeType }
        );
        if (uploadError) throw uploadError;
        await api("register_file", {
          batchId: batch.id,
          sourcePath,
          originalName: file.name,
          byteSize: file.size,
          mimeType: ticket.file.mimeType,
          storagePath: ticket.storagePath
        });
        uploaded += 1;
      } catch (error) {
        failed.push(`${file.name}: ${error instanceof Error ? error.message : "ошибка"}`);
      }
    }
    state.selectedFiles = [];
    state.progress = null;
    await loadBatches(batch.id);
    setStatus(`Загрузка завершена: ${uploaded} из ${files.length}. ${failed.length ? `Ошибок: ${failed.length}. ${failed.slice(0, 2).join("; ")}` : "Можно открыть файлы или начать распознавание DOCX/RTF."}`, failed.length ? "error" : "success");
  }

  async function processOne(fileId, quiet) {
    const result = await api("process_file", { fileId });
    if (!quiet) {
      setStatus(result.unsupported ? result.message : `Готово: создано записей ${result.recordsCreated || 0}. Они ожидают проверки.`, result.unsupported ? "" : "success");
    }
    return result;
  }

  async function processBatch() {
    if (!state.batch) return;
    const consent = document.getElementById("sona-ai-consent");
    if (!(consent instanceof HTMLInputElement) || !consent.checked) {
      throw new Error("Подтвердите отправку текста выбранных документов в OpenAI.");
    }
    const files = state.batch.files.filter((file) => EXTRACTABLE_EXTENSIONS.has(file.extension) && ["registered", "failed"].includes(file.upload_status)).slice(0, MAX_PROCESS_PER_RUN);
    if (!files.length) {
      throw new Error("В этой партии нет ожидающих DOCX/RTF для распознавания.");
    }
    if (!window.confirm(`Запустить распознавание ${files.length} документов? Результаты останутся на ручной проверке.`)) return;
    let completed = 0;
    const errors = [];
    state.progress = { current: 0, total: files.length, label: "Запущено распознавание документов" };
    render();
    for (const [index, file] of files.entries()) {
      try {
        state.progress = { current: index + 1, total: files.length, label: `Распознаю: ${file.original_name}` };
        setStatus(`Распознаю ${index + 1} из ${files.length}: ${file.original_name}`, "");
        await processOne(file.id, true);
        completed += 1;
      } catch (error) {
        errors.push({
          fileId: file.id,
          fileName: file.original_name,
          message: error instanceof Error ? error.message : "ошибка"
        });
      }
    }
    state.progress = null;
    await loadBatch(state.batch.id, true);
    const serverFiles = new Map((state.batch?.files || []).map((file) => [file.id, file]));
    const reconciled = errors.filter((entry) => ["processed", "unsupported"].includes(serverFiles.get(entry.fileId)?.upload_status));
    const stillProcessing = errors.filter((entry) => serverFiles.get(entry.fileId)?.upload_status === "processing");
    const realErrors = errors.filter((entry) => !reconciled.includes(entry) && !stillProcessing.includes(entry));
    completed += reconciled.length;
    const recoveredText = reconciled.length
      ? ` Браузер потерял ответ для ${reconciled.length} файла, но сервер завершил его обработку.`
      : "";
    const pendingText = stillProcessing.length
      ? ` ${stillProcessing.length} файл ещё обрабатывается на сервере — нажмите «Обновить» через минуту.`
      : "";
    const errorText = realErrors.length
      ? ` Ошибок: ${realErrors.length}. ${realErrors.slice(0, 2).map((entry) => `${entry.fileName}: ${entry.message}`).join("; ")}`
      : "";
    setStatus(
      `Распознано документов: ${completed} из ${files.length}.${recoveredText}${pendingText}${errorText || (!pendingText ? " Проверьте записи и утвердите нужные." : "")}`,
      realErrors.length ? "error" : (stillProcessing.length ? "" : "success")
    );
  }

  async function reviewSelected(reviewStatus) {
    if (!state.selectedRecordIds.size) {
      throw new Error("Сначала отметьте записи для проверки.");
    }
    const label = reviewStatus === "approved" ? "утвердить" : "отклонить";
    if (!window.confirm(`${label[0].toUpperCase()}${label.slice(1)} ${state.selectedRecordIds.size} записей?`)) return;
    const result = await api("review_records", { recordIds: [...state.selectedRecordIds], reviewStatus });
    state.selectedRecordIds.clear();
    await loadBatch(state.batch.id, true);
    setStatus(`Обновлено записей: ${result.updated}.`, "success");
  }

  async function openFile(fileId) {
    const tab = window.open("", "_blank", "noopener");
    const result = await api("get_download_url", { fileId });
    if (tab) {
      tab.location.href = result.url;
    } else {
      window.location.assign(result.url);
    }
  }

  async function runAction(action, target) {
    if (state.busy) return;
    state.busy = true;
    try {
      switch (action) {
        case "create-upload":
          await createAndUpload();
          break;
        case "select-batch":
          await loadBatch(target.dataset.batchId, false, true);
          break;
        case "refresh-batch":
          await loadBatch(state.batch.id, true);
          setStatus("Состояние партии обновлено.", "success");
          break;
        case "process-file":
          try {
            await processOne(target.dataset.fileId, false);
          } catch (error) {
            await loadBatch(state.batch.id, true);
            const currentFile = (state.batch?.files || []).find((file) => file.id === target.dataset.fileId);
            if (["processed", "unsupported"].includes(currentFile?.upload_status)) {
              setStatus("Браузер не получил ответ вовремя, но сервер завершил обработку файла.", "success");
              break;
            }
            throw error;
          }
          await loadBatch(state.batch.id, true);
          break;
        case "process-batch":
          await processBatch();
          break;
        case "open-file":
          await openFile(target.dataset.fileId);
          break;
        case "load-records":
          state.filterLoading = true;
          setStatus("Применяю фильтр и получаю записи с сервера…", "");
          await loadRecords(true);
          setStatus(`Фильтр применён. Найдено записей: ${state.records.length}.`, "success");
          window.requestAnimationFrame(() => {
            document.getElementById("sona-records")?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          break;
        case "approve-records":
          await reviewSelected("approved");
          break;
        case "reject-records":
          await reviewSelected("rejected");
          break;
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Операция не выполнена.", "error");
    } finally {
      state.busy = false;
      state.filterLoading = false;
      render();
    }
  }

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.id === "sona-folder-input" && target instanceof HTMLInputElement) {
      state.selectedFiles = Array.from(target.files || []);
      render();
      return;
    }
    if (target.dataset.action === "registry-filter") {
      state.registryFilter = target.value;
    }
    if (target.dataset.action === "review-filter") {
      state.reviewFilter = target.value;
    }
    if (target.dataset.action === "toggle-record" && target instanceof HTMLInputElement) {
      if (target.checked) state.selectedRecordIds.add(target.dataset.recordId);
      else state.selectedRecordIds.delete(target.dataset.recordId);
      render();
    }
    if (target.dataset.action === "select-all-records" && target instanceof HTMLInputElement) {
      const pending = state.records.filter((record) => record.review_status === "pending_review").map((record) => record.id);
      if (target.checked) pending.forEach((id) => state.selectedRecordIds.add(id));
      else pending.forEach((id) => state.selectedRecordIds.delete(id));
      render();
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-action]") : null;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.action;
    if (!action || ["registry-filter", "review-filter", "toggle-record", "select-all-records"].includes(action)) return;
    event.preventDefault();
    runAction(action, target);
  });

  async function init() {
    render();
    try {
      if (window.SHARSH_AUTH_READY) await window.SHARSH_AUTH_READY;
      await loadBatches();
      setStatus(state.batches.length ? "Выберите партию или загрузите новую папку SONA." : "Войдите как владелец, затем выберите первую папку SONA для пилотной загрузки.", "");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось подключить модуль SONA.", "error");
    }
  }

  init();
})();
