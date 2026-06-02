(function () {
  const config = window.SHARSH_CONFIG;
  const sync = window.SHARSH_SYNC;
  const app = document.getElementById("app");

  if (!config || !sync || !app) {
    return;
  }

  const SESSION_STORAGE_PREFIX = `${config.STORAGE_NAMESPACE}:android-intake-hub:v1`;
  const PREVIEW_TAP_DELAY_MS = 260;
  const POLL_INTERVAL_MS = 60 * 1000;
  const query = new URLSearchParams(window.location.search);
  const deviceId = String(query.get("androidDeviceId") || "").trim();
  const deviceName = String(query.get("androidDeviceName") || "").trim();
  const fallbackReportDate = String(query.get("date") || "").trim();
  const departments = Array.isArray(config.departmentDefinitions)
    ? config.departmentDefinitions
      .filter((item) => item && typeof item.id === "string")
      .map((item) => ({
        id: String(item.id),
        marker: String(item.marker || item.id),
        name: String(item.department || item.id)
      }))
    : [];

  const state = {
    reportDate: fallbackReportDate,
    sessionKey: "",
    sessionLabel: "",
    sessionStartIso: "",
    sessionEndIso: "",
    slots: [],
    isLoading: true,
    isSending: false,
    message: "Загружаю список отделений и последние фото...",
    messageTone: "info",
    preview: null,
    pendingDepartmentId: "",
    tapSlotId: "",
    tapTimerId: 0,
    pollTimerId: 0,
    hiddenFeedbackIds: []
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getTelegramFunctionEndpoint() {
    const baseUrl = String(sync.runtime?.supabaseUrl || "").replace(/\/+$/, "");
    return baseUrl ? `${baseUrl}/functions/v1/Mainflow-telegram` : "";
  }

  function getStateUrl() {
    const url = new URL(getTelegramFunctionEndpoint());
    url.searchParams.set("action", "android-intake-state");
    url.searchParams.set("deviceId", deviceId);
    url.searchParams.set("deviceName", deviceName);
    return url.toString();
  }

  function getSubmitUrl() {
    const url = new URL(getTelegramFunctionEndpoint());
    url.searchParams.set("action", "android-intake-photo-submit");
    return url.toString();
  }

  function getFeedbackPhotoUrl(feedbackId, departmentId) {
    const url = new URL(getTelegramFunctionEndpoint());
    url.searchParams.set("action", "feedback-photo");
    url.searchParams.set("id", feedbackId);
    url.searchParams.set("departmentId", departmentId);
    return url.toString();
  }

  function getStorageKey(sessionKey) {
    return `${SESSION_STORAGE_PREFIX}:${deviceId}:${sessionKey || "pending"}`;
  }

  function getManualSessionStorageKey(sessionKey) {
    return `${getStorageKey(sessionKey)}:manual-session`;
  }

  function readManualSession(sessionKey) {
    if (!sessionKey) {
      return { hiddenFeedbackIds: [] };
    }
    try {
      const raw = localStorage.getItem(getManualSessionStorageKey(sessionKey));
      if (!raw) {
        return { hiddenFeedbackIds: [] };
      }
      const parsed = JSON.parse(raw);
      const hiddenFeedbackIds = Array.isArray(parsed?.hiddenFeedbackIds)
        ? parsed.hiddenFeedbackIds.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      return { hiddenFeedbackIds };
    } catch (_error) {
      return { hiddenFeedbackIds: [] };
    }
  }

  function writeManualSession(sessionKey, hiddenFeedbackIds) {
    if (!sessionKey) {
      return;
    }
    const uniqueIds = Array.from(new Set(
      (Array.isArray(hiddenFeedbackIds) ? hiddenFeedbackIds : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    ));
    localStorage.setItem(getManualSessionStorageKey(sessionKey), JSON.stringify({
      hiddenFeedbackIds: uniqueIds,
      updatedAt: new Date().toISOString()
    }));
  }

  function readLocalDrafts(sessionKey) {
    if (!sessionKey) {
      return {};
    }
    try {
      const raw = localStorage.getItem(getStorageKey(sessionKey));
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function writeLocalDrafts() {
    if (!state.sessionKey) {
      return;
    }
    const payload = {};
    state.slots.forEach((slot) => {
      if (slot.localDraft) {
        payload[slot.departmentId] = slot.localDraft;
      }
    });
    localStorage.setItem(getStorageKey(state.sessionKey), JSON.stringify(payload));
  }

  function formatTimestamp(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }
    const shifted = new Date(parsed.getTime() + (4 * 60 * 60 * 1000));
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
    const day = String(shifted.getUTCDate()).padStart(2, "0");
    const hour = String(shifted.getUTCHours()).padStart(2, "0");
    const minute = String(shifted.getUTCMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hour}:${minute}`;
  }

  function getSlotByDepartmentId(departmentId) {
    return state.slots.find((slot) => slot.departmentId === departmentId) || null;
  }

  function getSlotDisplayPhoto(slot) {
    if (!slot) {
      return null;
    }
    return slot.localDraft || slot.serverPhoto || null;
  }

  function hasPhotoImageData(photo) {
    return typeof photo?.imageDataUrl === "string" && photo.imageDataUrl.startsWith("data:image/");
  }

  function isSlotComplete(slot) {
    return Boolean(getSlotDisplayPhoto(slot));
  }

  function getMissingCount() {
    return state.slots.filter((slot) => !isSlotComplete(slot)).length;
  }

  function getPendingUploadCount() {
    return state.slots.filter((slot) => slot.localDraft).length;
  }

  function canSendAll() {
    return !state.isSending
      && state.slots.length > 0
      && getMissingCount() === 0
      && getPendingUploadCount() > 0;
  }

  function setMessage(text, tone = "info") {
    state.message = String(text || "");
    state.messageTone = tone;
    render();
  }

  function normalizeServerPhoto(record) {
    if (!record || typeof record !== "object") {
      return null;
    }
    const imageDataUrl = typeof record.imageDataUrl === "string" ? record.imageDataUrl : "";
    const hasImageDataUrl = imageDataUrl.startsWith("data:image/");
    const feedbackId = String(record.feedbackId || record.id || "").trim();
    if (!feedbackId && !hasImageDataUrl) {
      return null;
    }
    return {
      feedbackId,
      imageDataUrl: hasImageDataUrl ? imageDataUrl : "",
      hasImageDataUrl: Boolean(hasImageDataUrl || record.hasImageDataUrl),
      imageName: String(record.imageName || ""),
      createdAt: String(record.createdAt || ""),
      reportDate: String(record.reportDate || ""),
      sourceLabel: String(record.sourceLabel || "")
    };
  }

  function normalizeLocalDraft(photo) {
    if (!photo || typeof photo !== "object") {
      return null;
    }
    const imageDataUrl = typeof photo.imageDataUrl === "string" ? photo.imageDataUrl : "";
    if (!imageDataUrl.startsWith("data:image/")) {
      return null;
    }
    return {
      imageDataUrl,
      imageName: String(photo.imageName || "android-intake-photo.jpg"),
      createdAt: String(photo.createdAt || new Date().toISOString()),
      reportDate: String(photo.reportDate || state.reportDate || "")
    };
  }

  function mergeStatePayload(payload) {
    state.reportDate = String(payload?.reportDate || fallbackReportDate || "");
    state.sessionKey = String(payload?.sessionKey || "");
    state.sessionLabel = String(payload?.sessionLabel || "");
    state.sessionStartIso = String(payload?.sessionStartIso || "");
    state.sessionEndIso = String(payload?.sessionEndIso || "");
    const storedDrafts = readLocalDrafts(state.sessionKey);
    const manualSession = readManualSession(state.sessionKey);
    const hiddenFeedbackIds = new Set(manualSession.hiddenFeedbackIds);
    state.hiddenFeedbackIds = Array.from(hiddenFeedbackIds);
    const serverDepartments = Array.isArray(payload?.departments) ? payload.departments : [];
    state.slots = departments.map((department) => {
      const serverDepartment = serverDepartments.find((item) => String(item.departmentId || "") === department.id) || {};
      const previousSlot = getSlotByDepartmentId(department.id);
      const serverPhoto = normalizeServerPhoto(serverDepartment.latestPhoto);
      if (serverPhoto?.feedbackId && hiddenFeedbackIds.has(serverPhoto.feedbackId)) {
        return {
          departmentId: department.id,
          marker: department.marker,
          departmentName: department.name,
          serverPhoto: null,
          localDraft: normalizeLocalDraft(storedDrafts[department.id])
        };
      }
      if (
        serverPhoto
        && previousSlot?.serverPhoto
        && serverPhoto.feedbackId
        && serverPhoto.feedbackId === previousSlot.serverPhoto.feedbackId
        && hasPhotoImageData(previousSlot.serverPhoto)
      ) {
        serverPhoto.imageDataUrl = previousSlot.serverPhoto.imageDataUrl;
        serverPhoto.hasImageDataUrl = true;
      }
      return {
        departmentId: department.id,
        marker: department.marker,
        departmentName: department.name,
        serverPhoto,
        localDraft: normalizeLocalDraft(storedDrafts[department.id])
      };
    });
    writeLocalDrafts();
  }

  async function loadState(showLoadingMessage = true) {
    if (!deviceId) {
      setMessage("Откройте страницу через Android MAINFORM.", "error");
      return;
    }

    state.isLoading = true;
    if (showLoadingMessage) {
      render();
    }
    try {
      const response = await fetch(getStateUrl(), { method: "GET" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Не удалось загрузить состояние фотосессии.");
      }
      mergeStatePayload(payload);
      state.isLoading = false;
      if (!state.message || state.messageTone === "info") {
        state.message = "Снимайте фото по отделениям. Один тап открывает снимок, двойной тап по готовому фото делает пересъёмку.";
        state.messageTone = "info";
      }
      render();
    } catch (error) {
      state.isLoading = false;
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить состояние фотосессии.", "error");
    }
  }

  function openFilePicker(departmentId) {
    state.pendingDepartmentId = departmentId;
    const input = document.getElementById("androidIntakeFileInput");
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    input.value = "";
    input.click();
  }

  function closePreview() {
    state.preview = null;
    render();
  }

  function openPreview(departmentId) {
    const slot = getSlotByDepartmentId(departmentId);
    const photo = getSlotDisplayPhoto(slot);
    if (!slot || !photo) {
      return;
    }
    state.preview = {
      departmentId: slot.departmentId,
      departmentName: slot.departmentName,
      marker: slot.marker,
      imageDataUrl: photo.imageDataUrl,
      imageName: photo.imageName,
      createdAt: photo.createdAt,
      sourceLabel: slot.localDraft ? "Локальное фото перед отправкой" : (photo.sourceLabel || "Отправленное фото")
    };
    render();
  }

  async function openPreviewDeferred(departmentId) {
    const slot = getSlotByDepartmentId(departmentId);
    const photo = getSlotDisplayPhoto(slot);
    if (!slot || !photo) {
      return;
    }
    if (slot.localDraft || hasPhotoImageData(photo)) {
      openPreview(departmentId);
      return;
    }
    if (!photo.feedbackId) {
      setMessage("Не удалось открыть фото: нет номера снимка.", "error");
      return;
    }

    try {
      setMessage(`Загружаю фото: ${slot.departmentName}...`, "info");
      const response = await fetch(getFeedbackPhotoUrl(photo.feedbackId, slot.departmentId), { method: "GET" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Не удалось загрузить фото.");
      }

      const loadedPhoto = normalizeServerPhoto(payload.record);
      if (!loadedPhoto || !hasPhotoImageData(loadedPhoto)) {
        throw new Error("Сервер вернул фото без изображения.");
      }

      slot.serverPhoto = {
        ...photo,
        ...loadedPhoto,
        feedbackId: photo.feedbackId || loadedPhoto.feedbackId,
        sourceLabel: loadedPhoto.sourceLabel || photo.sourceLabel || ""
      };
      openPreview(departmentId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить фото.", "error");
    }
  }

  function handleSlotTap(departmentId) {
    const slot = getSlotByDepartmentId(departmentId);
    if (!slot) {
      return;
    }
    if (!getSlotDisplayPhoto(slot)) {
      openFilePicker(departmentId);
      return;
    }
    if (state.tapSlotId === departmentId && state.tapTimerId) {
      window.clearTimeout(state.tapTimerId);
      state.tapTimerId = 0;
      state.tapSlotId = "";
      openFilePicker(departmentId);
      return;
    }
    state.tapSlotId = departmentId;
    state.tapTimerId = window.setTimeout(() => {
      state.tapTimerId = 0;
      state.tapSlotId = "";
      void openPreviewDeferred(departmentId);
    }, PREVIEW_TAP_DELAY_MS);
  }

  async function resizeImageFile(file) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Не удалось прочитать фото."));
      reader.readAsDataURL(file);
    });

    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Не удалось открыть фото."));
      img.src = dataUrl;
    });

    const maxDimension = 1600;
    const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Не удалось подготовить фото.");
    }
    context.drawImage(image, 0, 0, width, height);
    const normalizedDataUrl = canvas.toDataURL("image/jpeg", 0.86);
    const safeName = String(file.name || "android-intake-photo.jpg").trim() || "android-intake-photo.jpg";
    const fileName = safeName.toLowerCase().endsWith(".jpg") || safeName.toLowerCase().endsWith(".jpeg")
      ? safeName
      : `${safeName}.jpg`;
    return {
      imageDataUrl: normalizedDataUrl,
      imageName: fileName,
      createdAt: new Date().toISOString(),
      reportDate: state.reportDate
    };
  }

  async function handleFileChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const departmentId = state.pendingDepartmentId;
    const [file] = Array.from(input.files || []);
    input.value = "";
    state.pendingDepartmentId = "";
    if (!departmentId || !file) {
      return;
    }

    try {
      setMessage("Подготавливаю фото к отправке...", "info");
      const slot = getSlotByDepartmentId(departmentId);
      if (!slot) {
        return;
      }
      slot.localDraft = await resizeImageFile(file);
      writeLocalDrafts();
      render();
      setMessage(`Фото для ${slot.departmentName} готово. Если нужно, сделайте пересъёмку двойным тапом.`, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось подготовить фото.", "error");
    }
  }

  function syncServerPhotoIntoSlot(departmentId, record) {
    const slot = getSlotByDepartmentId(departmentId);
    if (!slot) {
      return;
    }
    slot.serverPhoto = normalizeServerPhoto(record);
    slot.localDraft = null;
    writeLocalDrafts();
  }

  function startManualNewSession() {
    if (state.isSending) {
      return;
    }
    if (!state.sessionKey) {
      setMessage("Сначала обновите страницу, чтобы получить текущую сессию.", "error");
      return;
    }

    const hiddenFeedbackIds = new Set(readManualSession(state.sessionKey).hiddenFeedbackIds);
    state.slots.forEach((slot) => {
      if (slot.serverPhoto?.feedbackId) {
        hiddenFeedbackIds.add(slot.serverPhoto.feedbackId);
      }
      slot.serverPhoto = null;
      slot.localDraft = null;
    });
    state.preview = null;
    state.pendingDepartmentId = "";
    state.tapSlotId = "";
    if (state.tapTimerId) {
      window.clearTimeout(state.tapTimerId);
      state.tapTimerId = 0;
    }
    state.hiddenFeedbackIds = Array.from(hiddenFeedbackIds);
    writeManualSession(state.sessionKey, state.hiddenFeedbackIds);
    writeLocalDrafts();
    setMessage("Новая сессия начата. Сделайте фото новых бланков.", "success");
  }

  async function sendPendingPhotos() {
    if (!canSendAll()) {
      if (getMissingCount() > 0) {
        setMessage(`Сначала сделайте фото для всех отделений. Не хватает: ${getMissingCount()}.`, "error");
      }
      return;
    }

    const queue = state.slots.filter((slot) => slot.localDraft);
    if (!queue.length) {
      return;
    }

    state.isSending = true;
    render();

    try {
      for (let index = 0; index < queue.length; index += 1) {
        const slot = queue[index];
        const draft = slot.localDraft;
        if (!draft) {
          continue;
        }
        setMessage(`Отправляю ${index + 1} из ${queue.length}: ${slot.departmentName}. OCR обрабатывает фото...`, "info");
        const response = await fetch(getSubmitUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            androidDeviceId: deviceId,
            androidDeviceName: deviceName,
            departmentId: slot.departmentId,
            reportDate: state.reportDate,
            imageName: draft.imageName,
            imageDataUrl: draft.imageDataUrl
          })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || `Не удалось отправить фото: ${slot.departmentName}.`);
        }
        syncServerPhotoIntoSlot(slot.departmentId, payload.record || {
          id: payload.feedbackId,
          imageName: draft.imageName,
          imageDataUrl: draft.imageDataUrl,
          createdAt: new Date().toISOString(),
          reportDate: state.reportDate,
          sourceLabel: "Ընդունարան"
        });
        render();
      }
      state.isSending = false;
      render();
      setMessage("Все новые фото отправлены. OCR обработал снимки. На веб-странице откройте блок «Фото бланков текущей таблицы» и проверьте результаты.", "success");
      void loadState(false);
    } catch (error) {
      state.isSending = false;
      render();
      setMessage(error instanceof Error ? error.message : "Не удалось отправить фото.", "error");
    }
  }

  function buildSlotCard(slot) {
    const photo = getSlotDisplayPhoto(slot);
    const isLocal = Boolean(slot.localDraft);
    const hasPhotoImage = hasPhotoImageData(photo);
    const statusClass = isLocal ? " android-intake__card-status--local" : "";
    const statusText = photo
      ? (isLocal ? "Готово к отправке" : "Фото уже есть")
      : "Фото ещё не сделано";
    const statusMeta = photo && photo.createdAt
      ? formatTimestamp(photo.createdAt)
      : "";
    return `
      <article class="android-intake__card${isLocal ? " is-local" : ""}${photo && !isLocal ? " is-complete" : ""}">
        <div class="android-intake__thumb">
          <button type="button" class="android-intake__thumb-button" data-slot-open="${escapeHtml(slot.departmentId)}">
            ${photo
              ? (hasPhotoImage ? `<img src="${escapeHtml(photo.imageDataUrl)}" alt="${escapeHtml(slot.departmentName)}">` : `<div class="android-intake__server-photo"><div class="android-intake__server-photo-icon">&#10003;</div><div class="android-intake__camera-text">Фото есть</div><small>Тап - открыть</small></div>`)
              : `<div><div class="android-intake__camera-icon">📷</div><div class="android-intake__camera-text">Снять фото</div></div>`}
          </button>
        </div>
        <div class="android-intake__card-meta">
          <div class="android-intake__card-title">${escapeHtml(slot.marker)}<small>${escapeHtml(slot.departmentName)}</small></div>
          <div class="android-intake__card-status${statusClass}"><strong>${escapeHtml(statusText)}</strong>${statusMeta ? ` · ${escapeHtml(statusMeta)}` : ""}</div>
          ${photo && photo.sourceLabel ? `<div class="android-intake__card-status">${escapeHtml(photo.sourceLabel)}</div>` : ""}
        </div>
        <div class="android-intake__card-actions">
          <button type="button" class="android-intake__mini-button" data-slot-open="${escapeHtml(slot.departmentId)}">${photo ? "Открыть / переснять" : "Снять фото"}</button>
        </div>
      </article>
    `;
  }

  function render() {
    const missingCount = getMissingCount();
    const pendingUploads = getPendingUploadCount();
    const sendLabel = state.isSending
      ? "Отправляю..."
      : (pendingUploads > 0 ? `Ուղարկել (${pendingUploads})` : "Все фото уже отправлены");
    app.innerHTML = `
      <main class="android-intake">
        <section class="android-intake__head">
          <div>
            <h1 class="android-intake__title">Ընդունարան</h1>
            <div class="android-intake__meta">
              <span class="android-intake__pill">Ամսաթիվ: ${escapeHtml(state.reportDate || fallbackReportDate || "—")}</span>
              <span class="android-intake__pill">Սեսիա: ${escapeHtml(state.sessionLabel || "—")}</span>
            </div>
          </div>
          <div class="android-intake__controls">
            <button type="button" class="android-intake__button android-intake__button--secondary" data-refresh>Обновить</button>
            <button type="button" class="android-intake__button android-intake__button--secondary" data-new-session ${state.isSending ? "disabled" : ""}>Сделать новую сессию</button>
            <button type="button" class="android-intake__button android-intake__button--primary" data-send ${canSendAll() ? "" : "disabled"}>${escapeHtml(sendLabel)}</button>
          </div>
        </section>
        <p class="android-intake__hint">Один тап по готовому фото открывает просмотр. Двойной тап по готовому фото делает пересъёмку. Старые фото автоматически сбрасываются при новой вечерней сессии в 19:00.</p>
        <p class="android-intake__message${state.messageTone === "error" ? " android-intake__message--error" : (state.messageTone === "success" ? " android-intake__message--success" : "")}">${escapeHtml(state.message)}</p>
        <section class="android-intake__grid">
          ${state.slots.map(buildSlotCard).join("")}
        </section>
        <input id="androidIntakeFileInput" type="file" accept="image/*" capture="environment" hidden>
        <div class="android-intake__modal" id="androidIntakePreviewModal" ${state.preview ? "" : "hidden"}>
          ${state.preview ? `
            <div class="android-intake__modal-dialog">
              <button type="button" class="android-intake__modal-close" data-preview-close>×</button>
              <img src="${escapeHtml(state.preview.imageDataUrl)}" alt="${escapeHtml(state.preview.departmentName)}">
              <div class="android-intake__modal-meta">
                <strong>${escapeHtml(state.preview.marker)} · ${escapeHtml(state.preview.departmentName)}</strong>
                ${state.preview.createdAt ? `<span>${escapeHtml(formatTimestamp(state.preview.createdAt))}</span>` : ""}
                ${state.preview.sourceLabel ? `<span>${escapeHtml(state.preview.sourceLabel)}</span>` : ""}
              </div>
            </div>
          ` : ""}
        </div>
      </main>
    `;

    const fileInput = document.getElementById("androidIntakeFileInput");
    if (fileInput instanceof HTMLInputElement) {
      fileInput.addEventListener("change", handleFileChange, { once: false });
    }

    app.querySelectorAll("[data-slot-open]").forEach((button) => {
      button.addEventListener("click", () => {
        handleSlotTap(String(button.getAttribute("data-slot-open") || ""));
      });
    });

    const sendButton = app.querySelector("[data-send]");
    if (sendButton) {
      sendButton.addEventListener("click", () => {
        void sendPendingPhotos();
      });
    }

    const newSessionButton = app.querySelector("[data-new-session]");
    if (newSessionButton) {
      newSessionButton.addEventListener("click", startManualNewSession);
    }

    const refreshButton = app.querySelector("[data-refresh]");
    if (refreshButton) {
      refreshButton.addEventListener("click", () => {
        void loadState(false);
      });
    }

    const closeButton = app.querySelector("[data-preview-close]");
    if (closeButton) {
      closeButton.addEventListener("click", closePreview);
    }

    const modal = document.getElementById("androidIntakePreviewModal");
    if (modal) {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closePreview();
        }
      });
    }
  }

  function startPolling() {
    if (state.pollTimerId) {
      window.clearInterval(state.pollTimerId);
    }
    state.pollTimerId = window.setInterval(() => {
      void loadState(false);
    }, POLL_INTERVAL_MS);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void loadState(false);
    }
  });

  render();
  void loadState(true);
  startPolling();
})();
