(function () {
  const config = window.SHARSH_CONFIG;
  const sync = window.SHARSH_SYNC;
  const app = document.getElementById("app");

  if (!config || !sync || !app) {
    return;
  }

  const SESSION_STORAGE_PREFIX = `${config.STORAGE_NAMESPACE}:android-intake-hub:v1`;
  const PREVIEW_TAP_DELAY_MS = 260;
  const POLL_INTERVAL_MS = 3 * 60 * 1000;
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
    pollTimerId: 0
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

  function getNativeBridge() {
    const bridge = window.MainflowAndroidBridge;
    return bridge && typeof bridge.captureAdmissionHubPhoto === "function"
      ? bridge
      : null;
  }

  function getStorageKey(sessionKey) {
    return `${SESSION_STORAGE_PREFIX}:${deviceId}:${sessionKey || "pending"}`;
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
    if (!imageDataUrl.startsWith("data:image/")) {
      return null;
    }
    return {
      feedbackId: String(record.feedbackId || record.id || ""),
      imageDataUrl,
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
    const serverDepartments = Array.isArray(payload?.departments) ? payload.departments : [];
    state.slots = departments.map((department) => {
      const serverDepartment = serverDepartments.find((item) => String(item.departmentId || "") === department.id) || {};
      return {
        departmentId: department.id,
        marker: department.marker,
        departmentName: department.name,
        serverPhoto: normalizeServerPhoto(serverDepartment.latestPhoto),
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
    const nativeBridge = getNativeBridge();
    if (nativeBridge) {
      try {
        setMessage("Открываю камеру...", "info");
        nativeBridge.captureAdmissionHubPhoto(String(departmentId || ""));
        return;
      } catch (_error) {
        // Fallback to standard file picker below.
      }
    }
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
      openPreview(departmentId);
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

  function handleNativeCapturedPhoto(payload) {
    const departmentId = String(payload?.departmentId || "").trim();
    const slot = getSlotByDepartmentId(departmentId);
    if (!slot) {
      return;
    }

    const photo = normalizeLocalDraft(payload?.photo);
    if (!photo) {
      setMessage("Не удалось получить фото с камеры.", "error");
      return;
    }

    slot.localDraft = photo;
    writeLocalDrafts();
    render();
    setMessage(`Фото для ${slot.departmentName} готово. Если нужно, сделайте пересъёмку двойным тапом.`, "success");
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
    const successDepartments = [];
    const failedDepartments = [];

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
        if (payload.controlPassed) {
          successDepartments.push(slot.departmentName);
        } else {
          failedDepartments.push(slot.departmentName);
        }
        render();
      }
      state.isSending = false;
      render();
      setMessage("Все новые фото отправлены. OCR обработал снимки. На веб-странице откройте блок «Фото бланков текущей таблицы» и проверьте результаты.", "success");
      const resultParts = [];
      if (successDepartments.length) {
        resultParts.push(`\u0412 \u043E\u0441\u043D\u043E\u0432\u043D\u0443\u044E \u0442\u0430\u0431\u043B\u0438\u0446\u0443 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B: ${successDepartments.join(", ")}.`);
      }
      if (failedDepartments.length) {
        resultParts.push(`\u041D\u0443\u0436\u043D\u0430 \u0440\u0443\u0447\u043D\u0430\u044F \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0430 \u0438\u0437 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u043E\u0442\u0434\u0435\u043B\u0435\u043D\u0438\u044F: ${failedDepartments.join(", ")}.`);
      }
      if (resultParts.length) {
        setMessage(resultParts.join(" "), failedDepartments.length ? "info" : "success");
      }
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
              ? `<img src="${escapeHtml(photo.imageDataUrl)}" alt="${escapeHtml(slot.departmentName)}">`
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
            <button type="button" class="android-intake__button android-intake__button--primary" data-send ${canSendAll() ? "" : "disabled"}>${escapeHtml(sendLabel)}</button>
          </div>
        </section>
        <p class="android-intake__hint">Один тап по готовому фото открывает просмотр. Двойной тап по готовому фото делает пересъёмку. Старые фото автоматически сбрасываются при новой вечерней сессии в 19:00.</p>
        <p class="android-intake__hint">Старые фото также автоматически сбрасываются утром в 10:05.</p>
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

  window.MAINFORM_ANDROID_INTAKE_HUB = {
    receiveCapturedPhoto(payload) {
      handleNativeCapturedPhoto(payload);
    }
  };

  window.addEventListener("mainform-android-intake-photo", (event) => {
    handleNativeCapturedPhoto(event?.detail || {});
  });

  render();
  void loadState(true);
  startPolling();
})();
