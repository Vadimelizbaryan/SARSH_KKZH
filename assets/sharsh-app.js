(function () {
  const config = window.SHARSH_CONFIG;
  const sync = window.SHARSH_SYNC;
  const auth = window.SHARSH_AUTH || null;
  const app = document.getElementById("app");

  if (!config || !sync || !app) {
    return;
  }

  const mode = document.body.dataset.view === "department"
    ? "department"
    : (document.body.dataset.view === "archive" ? "archive" : "main");
  const departmentId = document.body.dataset.departmentId || "";
  const basePath = document.body.dataset.basePath || ".";
  const queryParams = new URLSearchParams(window.location.search);
  const archiveKeyFromQuery = queryParams.get("archive") || "";
  const archiveAutoPrint = queryParams.get("autoprint") !== "0";
  const PRINT_REPORT_TITLE = "ԿԿԶՀ-Շարժ․";
  const SAVE_RULE_TEXT = "13-22 = (1 + 4 + 11) - (7 + 10)";
  const SAVE_RULE_TEXT_SHORT = "сумма блока АРКА Э = (1 + 4 + 11) - (7 + 10)";
  const ARCHIVE_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:main-archive:v1`;
  const ARCHIVE_TIMEZONE = "Asia/Yerevan";
  const ARCHIVE_CAPTURE_HOUR = 10;
  const MAX_ARCHIVE_RECORDS = 60;
  const DEPARTMENT_UNLOCK_STORAGE_PREFIX = `${config.STORAGE_NAMESPACE}:department-unlock:`;
  const PHOTO_MAX_DIMENSION = 1800;
  const PHOTO_JPEG_QUALITY = 0.88;
  const MAIN_PHOTO_ROUTE_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:main-photo-route:v1`;
  const MAIN_PHOTO_ROUTE_MAX_AGE_MS = 15 * 60 * 1000;
  const MAIN_SAVE_NOTICE_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:main-save-notice:v1`;
  const SAVE_VERIFICATION_ATTEMPTS = 3;
  const SAVE_VERIFICATION_DELAY_MS = 700;
  const PHOTO_FIELD_DEFINITIONS = [
    { cell: 1, key: "beenTotal", label: "1" },
    { cell: 2, key: "beenSoldier", label: "2" },
    { cell: 3, key: "beenSeries", label: "3" },
    { cell: 4, key: "admittedTotal", label: "4" },
    { cell: 5, key: "admittedSoldier", label: "5" },
    { cell: 6, key: "admittedSeries", label: "6" },
    { cell: 7, key: "dgTotal", label: "7" },
    { cell: 8, key: "dgSoldier", label: "8" },
    { cell: 9, key: "dgSeries", label: "9" },
    { cell: 10, key: "transferFromDepartment", label: "10" },
    { cell: 11, key: "transferToDepartment", label: "11" },
    { cell: 12, key: "presentTotal", label: "12", computed: true },
    { cell: 13, key: "currentShar", label: "13" },
    { cell: 14, key: "currentSpa", label: "14" },
    { cell: 15, key: "currentPaym", label: "15" },
    { cell: 16, key: "currentZh", label: "16" },
    { cell: 17, key: "family", label: "17" },
    { cell: 18, key: "officer", label: "18" },
    { cell: 19, key: "civil", label: "19" },
    { cell: 20, key: "leaveSharq", label: "20" },
    { cell: 21, key: "leaveSpa", label: "21" },
    { cell: 22, key: "leavePaym", label: "22" }
  ];

  function buildInitialPhotoImportState() {
    return {
      imageName: "",
      imageDataUrl: "",
      notes: [],
      cellReviews: [],
      queueMode: false,
      queueRemainingCount: 0,
      queueNextDepartmentName: "",
      lastReportDate: "",
      lastAppliedKeys: [],
      draftMode: false,
      isProcessing: false,
      isError: false,
      status: ""
    };
  }

  function buildInitialMainPhotoRouteState() {
    return {
      imageName: "",
      imageDataUrl: "",
      notes: [],
      detectedDepartmentId: "",
      detectedBy: "",
      batchItems: [],
      batchTotalCount: 0,
      batchDetectedCount: 0,
      batchFailedCount: 0,
      isProcessing: false,
      isError: false,
      status: ""
    };
  }

  const state = {
    snapshot: config.buildDefaultSnapshot(),
    loadedSnapshot: config.buildDefaultSnapshot(),
    source: "local-only",
    warning: "",
    info: "",
    infoIsError: false,
    saveTimer: 0,
    dateTimer: 0,
    saveSequence: 0,
    printHandlersAttached: false,
    refreshIntervalId: 0,
    freshnessIntervalId: 0,
    clockIntervalId: 0,
    updateAudioContext: null,
    updateAudioBound: false,
    updateAttentionIntervalId: 0,
    updateAttentionTimeoutId: 0,
    updateAttentionBound: false,
    archiveRecords: [],
    selectedArchiveKey: "",
    initialized: false,
    photoImport: buildInitialPhotoImportState(),
    mainPhotoRoute: buildInitialMainPhotoRouteState()
  };

  function deepCopy(value) {
    return config.deepCopy(value);
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function getSnapshotUpdateSignature(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.rows)) {
      return "";
    }

    return [
      snapshot.updatedAt || "",
      ...snapshot.rows.map((row) => `${row.id}:${row.updatedAt || ""}`)
    ].join("|");
  }

  function getRowValueSignature(row) {
    if (!row || !row.values || typeof row.values !== "object") {
      return "";
    }

    return config.valueKeys
      .map((key) => `${key}:${row.values[key] === null || typeof row.values[key] === "undefined" ? "" : row.values[key]}`)
      .join("|");
  }

  function getUpdateAudioContext() {
    if (state.updateAudioContext) {
      return state.updateAudioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    state.updateAudioContext = new AudioContextClass();
    return state.updateAudioContext;
  }

  async function unlockUpdateAudio() {
    const audioContext = getUpdateAudioContext();
    if (!audioContext) {
      return;
    }

    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch (_error) {
      }
    }
  }

  function bindUpdateAudioUnlock() {
    if (state.updateAudioBound) {
      return;
    }

    const unlock = () => {
      unlockUpdateAudio();
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    state.updateAudioBound = true;
  }

  function stopUpdateAttention() {
    window.clearInterval(state.updateAttentionIntervalId);
    window.clearTimeout(state.updateAttentionTimeoutId);
    state.updateAttentionIntervalId = 0;
    state.updateAttentionTimeoutId = 0;
    document.title = getAppDocumentTitle();
  }

  function bindUpdateAttentionReset() {
    if (state.updateAttentionBound) {
      return;
    }

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        stopUpdateAttention();
      }
    });

    state.updateAttentionBound = true;
  }

  function triggerBackgroundUpdateAttention(kind) {
    if (!document.hidden) {
      return;
    }

    bindUpdateAttentionReset();
    stopUpdateAttention();

    const baseTitle = getAppDocumentTitle();
    const alertTitle = kind === "complete"
      ? "🔔 Все отделения обновлены"
      : "🔔 Есть обновление";
    let showAlert = true;

    document.title = alertTitle;
    state.updateAttentionIntervalId = window.setInterval(() => {
      document.title = showAlert ? alertTitle : baseTitle;
      showAlert = !showAlert;
    }, 900);

    state.updateAttentionTimeoutId = window.setTimeout(() => {
      stopUpdateAttention();
    }, 12000);
  }

  async function prepareUpdateAudioContext() {
    if (mode === "archive") {
      return null;
    }

    const audioContext = getUpdateAudioContext();
    if (!audioContext) {
      return null;
    }

    try {
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
    } catch (_error) {
      return null;
    }

    return audioContext;
  }

  function scheduleBellStrike(audioContext, startTime, baseFrequency, peakGain) {
    const partials = [
      { ratio: 1.0, gain: 1.0, duration: 1.35, detune: 0 },
      { ratio: 2.0, gain: 0.52, duration: 1.1, detune: 3 },
      { ratio: 2.42, gain: 0.34, duration: 0.92, detune: -5 },
      { ratio: 3.16, gain: 0.22, duration: 0.78, detune: 4 },
      { ratio: 4.83, gain: 0.14, duration: 0.58, detune: -7 }
    ];

    partials.forEach((partial) => {
      const gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.linearRampToValueAtTime(peakGain * partial.gain, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + partial.duration);

      const oscillator = audioContext.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(baseFrequency * partial.ratio, startTime);
      oscillator.detune.setValueAtTime(partial.detune, startTime);
      oscillator.connect(gainNode);
      oscillator.start(startTime);
      oscillator.stop(startTime + partial.duration);
    });
  }

  async function playUpdateSound() {
    const audioContext = await prepareUpdateAudioContext();
    if (!audioContext) {
      return false;
    }

    const now = audioContext.currentTime;
    scheduleBellStrike(audioContext, now, 1046.5, 0.105);
    return true;
  }

  async function playCompleteUpdateSound() {
    const audioContext = await prepareUpdateAudioContext();
    if (!audioContext) {
      return false;
    }

    const now = audioContext.currentTime;
    scheduleBellStrike(audioContext, now, 1046.5, 0.11);
    scheduleBellStrike(audioContext, now + 0.42, 1318.5, 0.115);
    return true;
  }

  function applyLoadedSnapshot(result) {
    state.snapshot = deepCopy(result.snapshot);
    state.loadedSnapshot = deepCopy(result.snapshot);
    state.source = result.source;
    state.warning = result.warning || "";
  }

  function getRecognizablePhotoFields(row) {
    if (!row) {
      return [];
    }

    const allowedKeys = new Set([
      "transferFromDepartment",
      "transferToDepartment",
      ...(Array.isArray(row.editableKeys) ? row.editableKeys : [])
    ]);

    return PHOTO_FIELD_DEFINITIONS.filter((item) => item.key === "presentTotal" || allowedKeys.has(item.key));
  }

  function getPhotoFieldMetaByKey(key) {
    return PHOTO_FIELD_DEFINITIONS.find((item) => item.key === key) || null;
  }

  function normalizePhotoCellReviews(payload) {
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.cellReviews)) {
      return [];
    }

    return payload.cellReviews
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const key = typeof item.key === "string" ? item.key.trim() : "";
        const status = item.status === "recognized" || item.status === "review"
          ? item.status
          : "";
        const meta = getPhotoFieldMetaByKey(key);
        const left = Number(item.left);
        const top = Number(item.top);
        const width = Number(item.width);
        const height = Number(item.height);
        if (!key || !status || !meta || ![left, top, width, height].every(Number.isFinite)) {
          return null;
        }

        return {
          key,
          cell: Number.isFinite(Number(item.cell)) ? Number(item.cell) : meta.cell,
          label: meta.label || String(meta.cell),
          status,
          valueText: typeof item.valueText === "string" ? item.valueText.trim() : "",
          reason: typeof item.reason === "string" ? item.reason.trim() : "",
          left: Math.max(0, Math.min(1000, left)),
          top: Math.max(0, Math.min(1000, top)),
          width: Math.max(1, Math.min(1000, width)),
          height: Math.max(1, Math.min(1000, height))
        };
      })
      .filter(Boolean);
  }

  function renderPhotoReviewOverlay(photoState) {
    return "";
  }

  function hasPhotoImportDraft() {
    return mode === "department" && Boolean(state.photoImport && state.photoImport.draftMode);
  }

  function blockPhotoImportDraftAction(message) {
    if (!hasPhotoImportDraft()) {
      return false;
    }

    setInfo(
      message || "Распознанные значения пока сохранены только локально. Сначала проверьте их и нажмите Сохранить.",
      false
    );
    return true;
  }

  function setPhotoImportStatus(message, isError) {
    state.photoImport.status = String(message || "");
    state.photoImport.isError = Boolean(isError);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Не удалось прочитать файл изображения."));
      reader.readAsDataURL(file);
    });
  }

  function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Не удалось подготовить изображение для распознавания."));
      image.src = dataUrl;
    });
  }

  async function compressImageFile(file) {
    const sourceDataUrl = await readFileAsDataUrl(file);
    if (!sourceDataUrl.startsWith("data:image/")) {
      throw new Error("Нужен файл изображения.");
    }

    const image = await loadImageFromDataUrl(sourceDataUrl);
    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;
    if (!originalWidth || !originalHeight) {
      throw new Error("Не удалось определить размер изображения.");
    }

    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Браузер не поддерживает подготовку фото.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
  }

  function setMainPhotoRouteStatus(message, isError) {
    state.mainPhotoRoute.status = String(message || "");
    state.mainPhotoRoute.isError = Boolean(isError);
  }

  function setPendingMainSaveNotice(message, isError) {
    const normalizedMessage = String(message || "").trim();
    if (!normalizedMessage) {
      localStorage.removeItem(MAIN_SAVE_NOTICE_STORAGE_KEY);
      return;
    }

    try {
      localStorage.setItem(MAIN_SAVE_NOTICE_STORAGE_KEY, JSON.stringify({
        message: normalizedMessage,
        isError: Boolean(isError),
        createdAt: Date.now()
      }));
    } catch (_error) {
    }
  }

  function consumePendingMainSaveNotice() {
    try {
      const raw = localStorage.getItem(MAIN_SAVE_NOTICE_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      localStorage.removeItem(MAIN_SAVE_NOTICE_STORAGE_KEY);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
      if (!message) {
        return null;
      }

      return {
        message,
        isError: Boolean(parsed.isError)
      };
    } catch (_error) {
      localStorage.removeItem(MAIN_SAVE_NOTICE_STORAGE_KEY);
      return null;
    }
  }

  function restorePendingMainSaveNotice() {
    if (mode !== "main") {
      return false;
    }

    const notice = consumePendingMainSaveNotice();
    if (!notice) {
      return false;
    }

    state.info = notice.message;
    state.infoIsError = notice.isError;
    return true;
  }

  function wait(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  function normalizePendingMainPhotoRouteItem(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const departmentId = typeof payload.departmentId === "string" ? payload.departmentId.trim() : "";
    const imageName = typeof payload.imageName === "string" ? payload.imageName.trim() : "";
    const imageDataUrl = typeof payload.imageDataUrl === "string" ? payload.imageDataUrl : "";
    const detectedBy = typeof payload.detectedBy === "string" ? payload.detectedBy.trim() : "";
    const notes = Array.isArray(payload.notes)
      ? payload.notes.filter((item) => typeof item === "string" && item.trim()).map((item) => String(item).trim())
      : [];

    if (!departmentId || !imageDataUrl.startsWith("data:image/")) {
      return null;
    }

    return {
      departmentId,
      imageName,
      imageDataUrl,
      detectedBy,
      notes
    };
  }

  function readPendingMainPhotoRouteQueue() {
    try {
      const raw = sessionStorage.getItem(MAIN_PHOTO_ROUTE_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      const createdAt = Number(parsed.createdAt || 0);
      if (!Number.isFinite(createdAt) || (Date.now() - createdAt) > MAIN_PHOTO_ROUTE_MAX_AGE_MS) {
        sessionStorage.removeItem(MAIN_PHOTO_ROUTE_STORAGE_KEY);
        return null;
      }

      const rawItems = Array.isArray(parsed.items)
        ? parsed.items
        : [parsed];
      const items = rawItems
        .map((item) => normalizePendingMainPhotoRouteItem(item))
        .filter(Boolean);

      if (!items.length) {
        sessionStorage.removeItem(MAIN_PHOTO_ROUTE_STORAGE_KEY);
        return null;
      }

      return {
        createdAt,
        items
      };
    } catch (_error) {
      sessionStorage.removeItem(MAIN_PHOTO_ROUTE_STORAGE_KEY);
      return null;
    }
  }

  function writePendingMainPhotoRouteQueue(items) {
    const normalizedItems = Array.isArray(items)
      ? items.map((item) => normalizePendingMainPhotoRouteItem(item)).filter(Boolean)
      : [];

    if (!normalizedItems.length) {
      sessionStorage.removeItem(MAIN_PHOTO_ROUTE_STORAGE_KEY);
      return;
    }

    try {
      sessionStorage.setItem(MAIN_PHOTO_ROUTE_STORAGE_KEY, JSON.stringify({
        createdAt: Date.now(),
        items: normalizedItems
      }));
    } catch (_error) {
    }
  }

  function storePendingMainPhotoRoute(payload) {
    writePendingMainPhotoRouteQueue([payload]);
  }

  function storePendingMainPhotoRoutes(items) {
    writePendingMainPhotoRouteQueue(items);
  }

  function peekPendingMainPhotoRoute() {
    const queue = readPendingMainPhotoRouteQueue();
    return queue && queue.items.length ? queue.items[0] : null;
  }

  function getPendingMainPhotoRouteCount() {
    const queue = readPendingMainPhotoRouteQueue();
    return queue ? queue.items.length : 0;
  }

  function takePendingMainPhotoRoute(departmentIdToMatch) {
    const queue = readPendingMainPhotoRouteQueue();
    if (!queue || !queue.items.length) {
      return null;
    }

    const [nextItem, ...restItems] = queue.items;
    if (!nextItem || !nextItem.departmentId || nextItem.departmentId !== departmentIdToMatch) {
      return null;
    }

    writePendingMainPhotoRouteQueue(restItems);
    return nextItem;
  }

  function getCurrentDepartmentDefinition() {
    return mode === "department" ? config.getDepartmentById(departmentId) : null;
  }

  function getDepartmentUnlockStorageKey() {
    return `${DEPARTMENT_UNLOCK_STORAGE_PREFIX}${departmentId}`;
  }

  function migrateLegacyAccessCodeStorage() {
    if (mode !== "department" || !departmentId) {
      return;
    }

    const storageKey = config.getAccessCodeStorageKey(departmentId);
    const sessionValue = sessionStorage.getItem(storageKey);
    const legacyValue = localStorage.getItem(storageKey);

    if (!sessionValue && legacyValue) {
      sessionStorage.setItem(storageKey, legacyValue);
    }
    if (legacyValue) {
      localStorage.removeItem(storageKey);
    }
  }

  function getStoredAccessCode() {
    if (mode !== "department" || !departmentId) {
      return "";
    }
    return sessionStorage.getItem(config.getAccessCodeStorageKey(departmentId)) || "";
  }

  function setStoredAccessCode(value) {
    if (mode !== "department" || !departmentId) {
      return;
    }

    const storageKey = config.getAccessCodeStorageKey(departmentId);
    const normalized = String(value || "").trim();
    if (normalized) {
      sessionStorage.setItem(storageKey, normalized);
    } else {
      sessionStorage.removeItem(storageKey);
    }
    localStorage.removeItem(storageKey);
  }

  function isDepartmentAccessProtected() {
    return Boolean(sync.runtime && sync.runtime.requireAccessCode && sync.hasRemoteSync());
  }

  function isDepartmentUnlocked() {
    return !isDepartmentAccessProtected() || sessionStorage.getItem(getDepartmentUnlockStorageKey()) === "1";
  }

  function unlockCurrentDepartment() {
    if (mode !== "department" || !departmentId) {
      return;
    }
    sessionStorage.setItem(getDepartmentUnlockStorageKey(), "1");
  }

  function clearCurrentDepartmentUnlock() {
    if (mode !== "department" || !departmentId) {
      return;
    }
    sessionStorage.removeItem(getDepartmentUnlockStorageKey());
    setStoredAccessCode("");
  }

  function formatTimestamp(value) {
    if (!value) {
      return "еще не отправлялось";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "еще не отправлялось";
    }
    return date.toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getArchiveContext(value = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: ARCHIVE_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const parts = Object.fromEntries(
      formatter
        .formatToParts(value)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );

    const key = `${parts.year}-${parts.month}-${parts.day}`;
    return {
      key,
      label: `${parts.day}.${parts.month}.${parts.year}`,
      timeLabel: `${parts.hour}:${parts.minute}`,
      totalMinutes: (Number(parts.hour) * 60) + Number(parts.minute)
    };
  }

  function normalizeArchiveRecord(record) {
    if (!record || typeof record !== "object" || typeof record.archiveKey !== "string") {
      return null;
    }

    return {
      archiveKey: record.archiveKey,
      archiveLabel: typeof record.archiveLabel === "string" && record.archiveLabel.trim()
        ? record.archiveLabel.trim()
        : record.archiveKey,
      capturedAt: typeof record.capturedAt === "string" ? record.capturedAt : new Date().toISOString(),
      reportDate: typeof record.reportDate === "string" && record.reportDate.trim()
        ? record.reportDate.trim()
        : config.DEFAULT_DATE,
      source: typeof record.source === "string" ? record.source : "local-only",
      snapshot: config.buildSnapshotFromSaved(record.snapshot)
    };
  }

  function readArchiveRecords() {
    try {
      const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map(normalizeArchiveRecord)
        .filter(Boolean)
        .sort((left, right) => right.archiveKey.localeCompare(left.archiveKey))
        .slice(0, MAX_ARCHIVE_RECORDS);
    } catch (_error) {
      return [];
    }
  }

  function writeArchiveRecords(records) {
    const normalized = records
      .map(normalizeArchiveRecord)
      .filter(Boolean)
      .sort((left, right) => right.archiveKey.localeCompare(left.archiveKey))
      .slice(0, MAX_ARCHIVE_RECORDS);

    state.archiveRecords = normalized;
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function ensureArchiveRecordsLoaded() {
    if (!Array.isArray(state.archiveRecords) || !state.archiveRecords.length) {
      state.archiveRecords = readArchiveRecords();
    }
    return state.archiveRecords;
  }

  function getArchiveRecordByKey(archiveKey) {
    if (!archiveKey) {
      return null;
    }
    return ensureArchiveRecordsLoaded().find((record) => record.archiveKey === archiveKey) || null;
  }

  function maybeCaptureDailyArchive() {
    if (mode !== "main" || !state.initialized) {
      return null;
    }

    const context = getArchiveContext();
    if (context.totalMinutes < ARCHIVE_CAPTURE_HOUR * 60) {
      return null;
    }

    const existing = ensureArchiveRecordsLoaded().find((record) => record.archiveKey === context.key);
    if (existing) {
      return existing;
    }

    const nextRecord = {
      archiveKey: context.key,
      archiveLabel: context.label,
      capturedAt: new Date().toISOString(),
      reportDate: state.snapshot.reportDate,
      source: state.source,
      snapshot: deepCopy(state.snapshot)
    };

    writeArchiveRecords([nextRecord, ...ensureArchiveRecordsLoaded()]);
    return nextRecord;
  }

  function buildArchiveItem(record) {
    return `
      <div class="archive-item">
        <div class="archive-item-main">
          <strong>${escapeHtml(record.archiveLabel)}</strong>
          <span>${escapeHtml(formatTimestamp(record.capturedAt))}</span>
        </div>
        <div class="archive-item-subtext">Снимок главного файла: ${escapeHtml(record.reportDate)}</div>
        <div class="archive-item-actions">
          <a href="${escapeHtml(getArchivePrintPath(record.archiveKey))}" target="_blank" rel="noopener">PDF</a>
        </div>
      </div>
    `;
  }

  function getSelectedArchiveRecord(records = ensureArchiveRecordsLoaded()) {
    if (!Array.isArray(records) || !records.length) {
      state.selectedArchiveKey = "";
      return null;
    }

    const selected = state.selectedArchiveKey
      ? records.find((record) => record.archiveKey === state.selectedArchiveKey) || null
      : null;

    if (selected) {
      return selected;
    }

    state.selectedArchiveKey = records[0].archiveKey;
    return records[0];
  }

  function getArchiveSummaryText(records) {
    if (!Array.isArray(records) || !records.length) {
      return "Архивов пока нет. Первый снимок появится автоматически после 10:00 по Еревану.";
    }

    const latestArchive = records[0];
    return `Архивов: ${records.length}. Последний снимок: ${latestArchive.archiveLabel}, сохранён ${formatTimestamp(latestArchive.capturedAt)}.`;
  }

  function getArchiveSelectionText(record) {
    if (!record) {
      return "Выбери дату архива, чтобы открыть документ в PDF.";
    }
    return `Выбран архив ${record.archiveLabel}. Дата документа: ${record.reportDate}. Сохранён: ${formatTimestamp(record.capturedAt)}.`;
  }

  function buildArchiveOptions(records, selectedArchiveKey) {
    return records.map((record) => `
      <option value="${escapeHtml(record.archiveKey)}"${record.archiveKey === selectedArchiveKey ? " selected" : ""}>
        ${escapeHtml(`${record.archiveLabel} — ${formatTimestamp(record.capturedAt)}`)}
      </option>
    `).join("");
  }

  function buildArchivePicker(records) {
    const selectedRecord = getSelectedArchiveRecord(records);
    if (!selectedRecord) {
      return '<div class="archive-empty">Пока нет сохранённых дат.</div>';
    }

    return `
      <div class="archive-selector">
        <div class="archive-selector-row">
          <label class="archive-picker" for="archiveSelect">
            <span>Дата архива</span>
            <select id="archiveSelect">
              ${buildArchiveOptions(records, selectedRecord.archiveKey)}
            </select>
          </label>
          <a class="archive-open-link" id="archivePdfLink" href="${escapeHtml(getArchivePrintPath(selectedRecord.archiveKey))}" target="_blank" rel="noopener">PDF</a>
        </div>
        <div class="archive-selected-meta" id="archiveSelectedMeta">${escapeHtml(getArchiveSelectionText(selectedRecord))}</div>
      </div>
    `;
  }

  function syncArchivePickerUi() {
    const records = ensureArchiveRecordsLoaded();
    const select = document.getElementById("archiveSelect");
    const link = document.getElementById("archivePdfLink");
    const meta = document.getElementById("archiveSelectedMeta");
    const selectedRecord = getSelectedArchiveRecord(records);

    if (select && selectedRecord) {
      select.value = selectedRecord.archiveKey;
    }
    if (link) {
      if (selectedRecord) {
        link.href = getArchivePrintPath(selectedRecord.archiveKey);
        link.removeAttribute("aria-disabled");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
      }
    }
    if (meta) {
      meta.textContent = getArchiveSelectionText(selectedRecord);
    }
  }

  function getCurrentDateTimeParts() {
    const now = new Date();
    const date = now.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const time = now.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    });
    return {
      date,
      time,
      full: `${date} ${time}`
    };
  }

  function syncCurrentReportDate() {
    const parts = getCurrentDateTimeParts();
    state.snapshot.reportDate = parts.full;
    return parts;
  }

  function parseTimestamp(value) {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatAge(value) {
    const date = parseTimestamp(value);
    if (!date) {
      return "нет отправки";
    }

    const diffMs = Math.max(0, Date.now() - date.getTime());
    const totalMinutes = Math.floor(diffMs / 60000);

    if (totalMinutes < 1) {
      return "меньше минуты назад";
    }
    if (totalMinutes < 60) {
      return `${totalMinutes} мин назад`;
    }

    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (totalHours < 24) {
      return minutes ? `${totalHours} ч ${minutes} мин назад` : `${totalHours} ч назад`;
    }

    const totalDays = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return hours ? `${totalDays} д ${hours} ч назад` : `${totalDays} д назад`;
  }

  function rowHasSubmittedData(row) {
    if (!row || !row.values || typeof row.values !== "object") {
      return false;
    }

    return Object.values(row.values).some((value) =>
      value !== null && value !== "" && typeof value !== "undefined"
    );
  }

  function getFreshnessMeta(updatedAt, hasData = true) {
    if (!hasData) {
      return {
        level: "missing",
        label: "Нет данных",
        timestamp: "еще не отправлялось",
        age: "Отделение еще не присылало данные."
      };
    }

    const date = parseTimestamp(updatedAt);
    if (!date) {
      return {
        level: "missing",
        label: "Нет данных",
        timestamp: "еще не отправлялось",
        age: "Отделение еще не присылало данные."
      };
    }

    const diffMs = Math.max(0, Date.now() - date.getTime());
    const twoHours = 2 * 60 * 60 * 1000;
    const twelveHours = 12 * 60 * 60 * 1000;

    if (diffMs <= twoHours) {
      return {
        level: "fresh",
        label: "Свежие",
        timestamp: formatTimestamp(updatedAt),
        age: `Обновлено ${formatAge(updatedAt)}`
      };
    }

    if (diffMs <= twelveHours) {
      return {
        level: "warning",
        label: "Проверить",
        timestamp: formatTimestamp(updatedAt),
        age: `Последнее обновление ${formatAge(updatedAt)}`
      };
    }

    return {
      level: "stale",
      label: "Старые",
      timestamp: formatTimestamp(updatedAt),
      age: `Данные не обновлялись ${formatAge(updatedAt)}`
    };
  }

  function getRowFreshnessMeta(row) {
    return getFreshnessMeta(row && row.updatedAt, rowHasSubmittedData(row));
  }

  function buildFreshnessStats(rows) {
    const counts = {
      fresh: 0,
      warning: 0,
      stale: 0,
      missing: 0
    };

    let oldestRow = null;
    let newestRow = null;

    rows.forEach((row) => {
      const meta = getRowFreshnessMeta(row);
      counts[meta.level] += 1;

      const time = parseTimestamp(row.updatedAt);
      if (!time || !rowHasSubmittedData(row)) {
        return;
      }

      if (!oldestRow || time.getTime() < parseTimestamp(oldestRow.updatedAt).getTime()) {
        oldestRow = row;
      }
      if (!newestRow || time.getTime() > parseTimestamp(newestRow.updatedAt).getTime()) {
        newestRow = row;
      }
    });

    return {
      counts,
      oldestRow,
      newestRow
    };
  }

  function getOverallUpdateStatus(stats, totalRows) {
    const freshCount = stats && stats.counts ? stats.counts.fresh : 0;
    const warningCount = stats && stats.counts ? stats.counts.warning : 0;
    const staleCount = stats && stats.counts ? stats.counts.stale : 0;
    const missingCount = stats && stats.counts ? stats.counts.missing : 0;
    const allUpdated = totalRows > 0 && freshCount === totalRows;

    return {
      level: allUpdated ? "fresh" : "stale",
      label: allUpdated ? "Все отделения обновлены" : "Не все отделения обновлены",
      detail: allUpdated
        ? `Свежие данные есть у всех ${totalRows} отделений.`
        : `Свежие: ${freshCount} из ${totalRows}. Проверить: ${warningCount}, старые: ${staleCount}, нет данных: ${missingCount}.`
    };
  }

  function getDepartmentRow(snapshot, rowId) {
    return snapshot.rows.find((row) => row.id === rowId) || null;
  }

  function getLinkedSource(row, key) {
    return config.linkedCells[`${row.id}:${key}`] || null;
  }

  function getEffectiveValue(snapshot, row, key) {
    const linkedSource = getLinkedSource(row, key);
    if (!linkedSource) {
      return row.values[key];
    }
    const sourceRow = getDepartmentRow(snapshot, linkedSource.rowId);
    return sourceRow ? sourceRow.values[linkedSource.key] : null;
  }

  function getNumber(snapshot, row, key) {
    const value = getEffectiveValue(snapshot, row, key);
    return value === null || value === "" || typeof value === "undefined" ? 0 : Number(value);
  }

  function getDisplayValue(value) {
    return value === null || value === "" || typeof value === "undefined" ? "" : String(value);
  }

  function getPhotoPreviewValue(row, key) {
    if (!row) {
      return "";
    }
    if (key === "presentTotal") {
      return calcPresentTotal(state.snapshot, row);
    }
    if (key === "leaveTotal") {
      return calcLeaveTotal(state.snapshot, row);
    }
    return getEffectiveValue(state.snapshot, row, key);
  }

  function calcPresentTotal(snapshot, row) {
    return row.presentKeys.reduce((sum, key) => sum + getNumber(snapshot, row, key), 0);
  }

  function calcLeaveTotal(snapshot, row) {
    if (!row.hasLeaveTotal) {
      return null;
    }
    return getNumber(snapshot, row, "leaveSharq")
      + getNumber(snapshot, row, "leaveSpa")
      + getNumber(snapshot, row, "leavePaym");
  }

  function hasDepartmentSaveRule(row) {
    return Boolean(
      row
      && Array.isArray(row.presentKeys)
      && row.presentKeys.length >= 6
    );
  }

  function getDepartmentSaveRuleText(row) {
    if (!row) {
      return SAVE_RULE_TEXT;
    }
    return row.hasLeaveTotal ? SAVE_RULE_TEXT : SAVE_RULE_TEXT_SHORT;
  }

  function getDepartmentValidationState() {
    const row = getCurrentRow();
    if (mode !== "department" || !hasDepartmentSaveRule(row)) {
      return {
        applicable: false,
        isValid: true,
        actual: 0,
        expected: 0,
        message: ""
      };
    }

    const actual = calcPresentTotal(state.snapshot, row);
    const expected = (
      getNumber(state.snapshot, row, "beenTotal")
      + getNumber(state.snapshot, row, "admittedTotal")
      + getNumber(state.snapshot, row, "transferToDepartment")
    ) - (
      getNumber(state.snapshot, row, "dgTotal")
      + getNumber(state.snapshot, row, "transferFromDepartment")
    );
    const isValid = actual === expected;
    const ruleText = getDepartmentSaveRuleText(row);

    return {
      applicable: true,
      isValid,
      actual,
      expected,
      message: isValid
        ? `Проверка пройдена: ${SAVE_RULE_TEXT}.`
        : `Сохранение заблокировано: сумма 13-22 = ${actual}, а по формуле ${SAVE_RULE_TEXT} должно быть ${expected}.`
    };
  }

  function verifySavedDepartmentResult(expectedValues, resultSnapshot) {
    const savedRow = getDepartmentRow(resultSnapshot, departmentId);
    if (!savedRow) {
      return {
        ok: false,
        reason: "Сервер не вернул сохранённую строку отделения."
      };
    }

    const expectedNormalized = config.normalizeRowValues(expectedValues);
    const savedNormalized = config.normalizeRowValues(savedRow.values);

    for (const key of config.valueKeys) {
      if (expectedNormalized[key] !== savedNormalized[key]) {
        return {
          ok: false,
          reason: `После сохранения поле ${key} вернулось как ${savedNormalized[key] ?? ""}, ожидалось ${expectedNormalized[key] ?? ""}.`
        };
      }
    }

    if (!savedRow.updatedAt) {
      return {
        ok: false,
        reason: "Сервер не прислал время успешного обновления отделения."
      };
    }

    return {
      ok: true,
      savedRow
    };
  }

  function getSummaryValue(snapshot, rows, key) {
    return rows.reduce((sum, row) => {
      if (key === "presentTotal") {
        return sum + calcPresentTotal(snapshot, row);
      }
      if (key === "leaveTotal") {
        return sum + (calcLeaveTotal(snapshot, row) || 0);
      }
      return sum + getNumber(snapshot, row, key);
    }, 0);
  }

  function supportsValue(row, key) {
    if (key === "presentTotal" || key === "leaveTotal") {
      return true;
    }
    if (key === "transferFromDepartment" || key === "transferToDepartment") {
      return true;
    }
    return row.editableKeys.includes(key) || Boolean(getLinkedSource(row, key));
  }

  function isEditable(row, key) {
    if (key === "transferFromDepartment" || key === "transferToDepartment") {
      return true;
    }
    if (getLinkedSource(row, key)) {
      return false;
    }
    return row.editableKeys.includes(key);
  }

  function getCellClasses(key, row, type) {
    const classes = ["data-cell"];

    if (key === "beenSeries" || key === "admittedSeries" || key === "dgSeries" || key === "transferToDepartment") {
      classes.push("group-end");
    }
    if (key === "transferFromDepartment" || key === "presentTotal" || key === "leaveSharq" || key === "leaveTotal") {
      classes.push("major-left");
    }
    if (key === "presentTotal") {
      classes.push("calc-cell");
    }
    if (key === "leaveTotal" && row && row.hasLeaveTotal) {
      classes.push("calc-cell");
    }
    if ((type === "summary" || type === "grand") && config.summaryAccentKeys.has(key)) {
      classes.push("accent-total");
    }

    return classes.join(" ");
  }

  function renderColgroup() {
    const dataCols = config.columns
      .map((key) => `<col class="${key === "leaveTotal" ? "wide-col" : "num-col"}">`)
      .join("");

    return `
      <colgroup>
        <col class="dept-col">
        ${dataCols}
      </colgroup>
    `;
  }

  function getHeaderDateTimeParts(value) {
    if (typeof value !== "string") {
      return null;
    }

    const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
    if (!match) {
      return null;
    }

    return {
      date: `${match[1]}.${match[2]}.${match[3]}`,
      time: `${match[4]}:${match[5]}`,
      full: `${match[1]}.${match[2]}.${match[3]} ${match[4]}:${match[5]}`
    };
  }

  function renderHead(headerDateTime) {
    const currentDateTime = headerDateTime || getCurrentDateTimeParts();
    return `
      <thead>
        <tr>
          <th rowspan="2" class="hdr-peach dept-head">Բաժանմունք</th>
          <th colspan="3" rowspan="2" class="hdr-peach group-end">ԵՂԵԼ է</th>
          <th colspan="3" rowspan="2" class="hdr-peach group-end">ԸՆՈՒՆՎԵԼ Է</th>
          <th colspan="3" rowspan="2" class="hdr-peach group-end">Դ/Գ</th>
          <th colspan="2" rowspan="2" class="hdr-peach group-end major-left">Տեղափոխ</th>
          <th colspan="8" class="hdr-peach major-left">ԱՌԿԱ Է</th>
          <th colspan="3" class="hdr-peach major-left">որոնցից բուժական</th>
          <th class="hdr-yellow major-left">&nbsp;</th>
        </tr>
        <tr>
          <th rowspan="2" class="hdr-yellow major-left">ԸՆԴԱՄ</th>
          <th colspan="3" class="hdr-peach">Զինծառայող</th>
          <th rowspan="2" class="hdr-peach">Զ/Հ</th>
          <th rowspan="2" class="hdr-peach">Զ/Ծ ԸՆՏ</th>
          <th rowspan="2" class="hdr-peach">Զ/Պ</th>
          <th rowspan="2" class="hdr-peach">Ք-ի</th>
          <th colspan="3" class="hdr-peach major-left">արձակուրդում</th>
          <th rowspan="2" class="hdr-yellow major-left">Ընդհանուր</th>
        </tr>
        <tr>
          <th class="hdr-peach dept-head">
            <div class="sheet-datetime" id="sheetDateDisplay" aria-label="Текущая дата и время">
              <span class="sheet-datetime-date" id="sheetDateText">${escapeHtml(currentDateTime.date)}</span>
              <span class="sheet-datetime-time" id="sheetTimeText">${escapeHtml(currentDateTime.time)}</span>
            </div>
          </th>
          <th class="hdr-peach">ԸՆԴ</th>
          <th class="hdr-peach-dark">Զ/Ծ</th>
          <th class="hdr-peach group-end">ՇԱՐ</th>
          <th class="hdr-peach">ԸՆԴ</th>
          <th class="hdr-peach-dark">Զ/Ծ</th>
          <th class="hdr-peach group-end">ՇԱՐ</th>
          <th class="hdr-peach">ԸՆԴ</th>
          <th class="hdr-peach-dark">Զ/Ծ</th>
          <th class="hdr-peach group-end">ՇԱՐ</th>
          <th class="hdr-peach major-left">Տեղափ բաժնից</th>
          <th class="hdr-peach group-end">Տեղափ բաժին</th>
          <th class="hdr-peach">ՇԱՐ</th>
          <th class="hdr-peach">ՍՊԱ</th>
          <th class="hdr-peach">ՊԱՅՄ</th>
          <th class="hdr-peach major-left">ՇԱՐՔ</th>
          <th class="hdr-peach">ՍՊԱ</th>
          <th class="hdr-peach">ՊԱՅՄ</th>
        </tr>
      </thead>
    `;
  }

  function renderDetailCell(snapshot, row, key, interactive) {
    const recognizedFields = mode === "department" && state.photoImport
      ? new Set(state.photoImport.lastAppliedKeys || [])
      : null;
    const classes = [
      getCellClasses(key, row, "detail"),
      recognizedFields && recognizedFields.has(key) ? "recognized-cell" : ""
    ]
      .filter(Boolean)
      .join(" ");

    if (key === "presentTotal") {
      return `<td class="${classes}"><span data-output="presentTotal" data-row="${row.id}"></span></td>`;
    }

    if (key === "leaveTotal") {
      if (!row.hasLeaveTotal) {
        return `<td class="${classes} blank-cell"><span></span></td>`;
      }
      return `<td class="${classes}"><span data-output="leaveTotal" data-row="${row.id}"></span></td>`;
    }

    const linkedSource = getLinkedSource(row, key);
    if (linkedSource) {
      return `<td class="${classes}"><span data-linked="${row.id}:${key}"></span></td>`;
    }

    if (!supportsValue(row, key)) {
      return `<td class="${classes} blank-cell"><span></span></td>`;
    }

    if (!interactive || !isEditable(row, key)) {
      return `<td class="${classes}"><span data-value="${row.id}:${key}">${escapeHtml(getDisplayValue(getEffectiveValue(snapshot, row, key)))}</span></td>`;
    }

    return `
      <td class="${classes}">
        <input
          type="text"
          inputmode="numeric"
          aria-label="${escapeHtml(row.department)} ${escapeHtml(key)}"
          data-row="${row.id}"
          data-key="${key}"
          value="${escapeHtml(getDisplayValue(row.values[key]))}"
        >
      </td>
    `;
  }

  function renderDetailRow(snapshot, row, interactive) {
    return `
      <tr class="detail-row ${row.group === "extra" ? "extra-row" : "primary-row"}" data-row-id="${row.id}">
        <td class="dept-cell">${escapeHtml(row.department)}</td>
        ${config.columns.map((key) => renderDetailCell(snapshot, row, key, interactive)).join("")}
      </tr>
    `;
  }

  function renderSummaryRow(summaryId, label, rowClass) {
    return `
      <tr class="${rowClass}">
        <td class="dept-cell">${escapeHtml(label)}</td>
        ${config.columns.map((key) => `
          <td class="${getCellClasses(key, null, rowClass === "grand-row" ? "grand" : "summary")}">
            <span data-summary="${summaryId}" data-key="${key}"></span>
          </td>
        `).join("")}
      </tr>
    `;
  }

  function renderTable(snapshot, rows, options) {
    const interactive = Boolean(options.interactive);
    const headerDateTime = options.headerDateTime || getCurrentDateTimeParts();
    let bodyHtml = "";

    if (options.viewMode === "main") {
      const primaryRows = rows.filter((row) => row.group === "primary");
      const extraRows = rows.filter((row) => row.group === "extra");
      bodyHtml = [
        ...primaryRows.map((row) => renderDetailRow(snapshot, row, interactive)),
        renderSummaryRow("subtotal", "Ընդամենը", "subtotal-row"),
        ...extraRows.map((row) => renderDetailRow(snapshot, row, interactive)),
        renderSummaryRow("grand", "Ընդամենը", "grand-row")
      ].join("");
    } else {
      bodyHtml = [
        ...rows.map((row) => renderDetailRow(snapshot, row, interactive)),
        renderSummaryRow("single", "Итог отделения", "single-total-row")
      ].join("");
    }

    return `
      <table class="sheet" id="sheetTable" aria-label="SARSH KKZH">
        ${renderColgroup()}
        ${renderHead(headerDateTime)}
        <tbody id="sheetBody">${bodyHtml}</tbody>
      </table>
    `;
  }

  function getCurrentRow() {
    return mode === "department" ? getDepartmentRow(state.snapshot, departmentId) : null;
  }

  function getCurrentLoadedRow() {
    return mode === "department" ? getDepartmentRow(state.loadedSnapshot, departmentId) : null;
  }

  function hasDepartmentPendingLocalChanges() {
    if (mode !== "department") {
      return false;
    }

    if (hasPhotoImportDraft()) {
      return true;
    }

    const currentRow = getCurrentRow();
    const loadedRow = getCurrentLoadedRow();
    return getRowValueSignature(currentRow) !== getRowValueSignature(loadedRow);
  }

  function buildCopyCard(definition) {
    const row = getDepartmentRow(state.snapshot, definition.id);
    const freshness = getRowFreshnessMeta(row);
    const relativePath = appendShareQuery(config.getDepartmentPagePath(basePath, definition.id));
    return `
      <div class="link-card">
        <strong>${escapeHtml(definition.department)}</strong>
        <div class="link-card-meta">
          <span class="status-chip status-chip--${freshness.level}" data-department-status="${definition.id}">${escapeHtml(freshness.label)}</span>
          <span class="link-card-time" data-department-updated="${definition.id}">${escapeHtml(freshness.timestamp)}</span>
        </div>
        <p class="link-card-subtext" data-department-age="${definition.id}">${escapeHtml(freshness.age)}</p>
        <div class="link-card-actions">
          <a href="${escapeHtml(relativePath)}" target="_blank" rel="noopener">Открыть</a>
          <button type="button" data-copy-link="${escapeHtml(relativePath)}">Копировать ссылку</button>
        </div>
      </div>
    `;
  }

  function appendShareQuery(path) {
    const shareQuery = sync.getShareQuery();
    if (!shareQuery) {
      return path;
    }
    return path.includes("?") ? `${path}${shareQuery.replace("?", "&")}` : `${path}${shareQuery}`;
  }

  function getArchivePrintPath(archiveKey) {
    if (basePath === "@site") {
      return appendShareQuery(`${window.location.origin}/functions/v1/site?path=${encodeURIComponent("archive-print.html")}&archive=${encodeURIComponent(archiveKey)}&autoprint=1`);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return `${prefix}archive-print.html?archive=${encodeURIComponent(archiveKey)}&autoprint=1`;
  }

  function getSetupPath() {
    return appendShareQuery(config.getSetupPagePath(basePath));
  }

  function buildDepartmentUpdateItem(row) {
    const freshness = getRowFreshnessMeta(row);
    return `
      <div class="update-item" data-update-row="${row.id}">
        <div class="update-item-main">
          <strong>${escapeHtml(row.department)}</strong>
          <span class="status-chip status-chip--${freshness.level}" data-update-status="${row.id}">${escapeHtml(freshness.label)}</span>
        </div>
        <div class="update-item-time" data-update-time="${row.id}">${escapeHtml(freshness.timestamp)}</div>
        <div class="update-item-age" data-update-age="${row.id}">${escapeHtml(freshness.age)}</div>
      </div>
    `;
  }

  function getSourceClass() {
    return state.source === "remote" ? "remote" : "local";
  }

  function getSyncDescription() {
    if (state.source === "remote") {
      return "Данные объединяются между компьютерами через интернет.";
    }
    if (state.source === "local-cache") {
      return "Сейчас показан локальный кэш. Сервер временно недоступен.";
    }
    return "Сейчас включен локальный режим. Между разными компьютерами данные еще не объединяются.";
  }

  function showOwnerAuthTools() {
    return Boolean(auth && typeof auth.requiresOwnerAuth === "function" && auth.requiresOwnerAuth());
  }

  function buildOwnerAuthActions() {
    if (!showOwnerAuthTools()) {
      return "";
    }

    const email = auth && typeof auth.getUserEmail === "function"
      ? auth.getUserEmail()
      : "";

    return `
      <span class="pill remote">${escapeHtml(email || "Владелец")}</span>
      <button type="button" data-owner-signout>Выйти</button>
    `;
  }

  function getPrintDocumentTitle() {
    if (mode === "department") {
      const row = getCurrentRow();
      return row ? `${PRINT_REPORT_TITLE} ${row.department}` : PRINT_REPORT_TITLE;
    }
    if (mode === "archive") {
      const record = getArchiveRecordByKey(archiveKeyFromQuery);
      return record ? `${PRINT_REPORT_TITLE} ${record.archiveLabel}` : PRINT_REPORT_TITLE;
    }
    return PRINT_REPORT_TITLE;
  }

  function getAppDocumentTitle() {
    if (mode === "department") {
      const definition = getCurrentDepartmentDefinition();
      return definition ? `${definition.department} | SARSH_KKZH` : "SARSH_KKZH";
    }
    if (mode === "archive") {
      const record = getArchiveRecordByKey(archiveKeyFromQuery);
      return record ? `Архив ${record.archiveLabel} | SARSH_KKZH` : "Архив | SARSH_KKZH";
    }
    return "MAINFLOW";
  }

  function renderMainPage() {
    const sourceLabel = sync.getSourceLabel(state.source);
    const freshnessStats = buildFreshnessStats(state.snapshot.rows);
    const overallUpdateStatus = getOverallUpdateStatus(freshnessStats, state.snapshot.rows.length);
    const summaryFreshness = getFreshnessMeta(state.snapshot.updatedAt);
    const currentDateTime = getCurrentDateTimeParts();
    const archiveRecords = ensureArchiveRecordsLoaded();
    const latestArchive = archiveRecords[0] || null;
    const mainBlankPdfPath = config.getMainBlankPdfPath
      ? config.getMainBlankPdfPath(basePath)
      : null;
    const downloadMainPdfButtonHtml = mainBlankPdfPath
      ? `<a class="button-link" href="${escapeHtml(mainBlankPdfPath)}" download target="_blank" rel="noopener">Скачать PDF</a>`
      : "";

    app.innerHTML = `
      <div class="page">
        <div class="print-title print-only">
          <h1>${escapeHtml(PRINT_REPORT_TITLE)}</h1>
        </div>
        <div class="toolbar no-print">
          <div>
            <h1>SARSH_KKZH</h1>
            <p>Главный файл собирает данные всех отделений, показывает общий документ и готов для печати в PDF.</p>
          </div>
          <div class="toolbar-actions">
            <span class="pill ${getSourceClass()}" id="syncModeLabel">${escapeHtml(sourceLabel)}</span>
            ${buildOwnerAuthActions()}
            ${downloadMainPdfButtonHtml}
            <div class="zoom-control">
              <label for="zoomRange">Масштаб</label>
              <input type="range" id="zoomRange" min="60" max="140" step="5" value="100">
              <span class="zoom-value" id="zoomValue">100%</span>
            </div>
            <a class="button-link" href="${escapeHtml(getSetupPath())}">Настройка</a>
            <button type="button" id="refreshBtn">Обновить</button>
            <button type="button" id="printBtn">Печать</button>
          </div>
        </div>

        <div class="layout-grid split">
          <div class="info-stack">
            <div class="panel no-print">
              <h2>Сводка и дата</h2>
              <div class="meta-row">
                <div class="inline-field static-field">
                  <span>Дата и время</span>
                  <strong id="reportDateField">${escapeHtml(currentDateTime.full)}</strong>
                </div>
                <span class="pill ${getSourceClass()}" id="sheetSourcePill">${escapeHtml(sourceLabel)}</span>
              </div>
              <p id="syncStatusText">${escapeHtml(getSyncDescription())}</p>
              <p class="hint${state.infoIsError ? " warning-note" : ""}" id="syncInfoText">${escapeHtml(state.info || "Главный файл можно печатать сразу, а PDF создается через кнопку Печать в браузере.")}</p>
              <p class="hint${state.warning ? " warning-note" : ""}" id="warningText">${escapeHtml(state.warning)}</p>
              <div class="update-health-banner update-health-banner--${overallUpdateStatus.level}" id="overallUpdateBanner">
                <strong id="overallUpdateLabel">${escapeHtml(overallUpdateStatus.label)}</strong>
                <span id="overallUpdateDetail">${escapeHtml(overallUpdateStatus.detail)}</span>
              </div>
              <div class="freshness-overview">
                <div class="freshness-stat freshness-stat--fresh">
                  <span>Свежие</span>
                  <strong id="freshCount">${freshnessStats.counts.fresh}</strong>
                </div>
                <div class="freshness-stat freshness-stat--warning">
                  <span>Проверить</span>
                  <strong id="warningCount">${freshnessStats.counts.warning}</strong>
                </div>
                <div class="freshness-stat freshness-stat--stale">
                  <span>Старые</span>
                  <strong id="staleCount">${freshnessStats.counts.stale}</strong>
                </div>
                <div class="freshness-stat freshness-stat--missing">
                  <span>Нет данных</span>
                  <strong id="missingCount">${freshnessStats.counts.missing}</strong>
                </div>
              </div>
              <p class="hint" id="freshnessOldestText">${
                freshnessStats.oldestRow
                  ? escapeHtml(`Самые старые данные: ${freshnessStats.oldestRow.department} — ${formatTimestamp(freshnessStats.oldestRow.updatedAt)} (${formatAge(freshnessStats.oldestRow.updatedAt)})`)
                  : "Нет ни одного отделения с отправленными данными."
              }</p>
            </div>

            ${renderMainPhotoRoutePanel()}

            <div class="zoom-target">
              <div class="sheet-shell">
                <p class="status-line no-print">
                  <strong>Последнее обновление сводки:</strong>
                  <span id="lastUpdatedText">${escapeHtml(formatTimestamp(state.snapshot.updatedAt))}</span>
                  <span class="status-chip status-chip--${summaryFreshness.level}" id="lastUpdatedBadge">${escapeHtml(summaryFreshness.label)}</span>
                </p>
                <div class="table-wrap">
                  ${renderTable(state.snapshot, state.snapshot.rows, { interactive: false, viewMode: "main" })}
                </div>
              </div>
            </div>

            <section class="panel no-print updates-panel">
              <h2>Обновления отделений</h2>
              <p>Точный список по каждому отделению: когда именно пришли последние данные.</p>
              <div class="updates-list" id="departmentUpdatesList">
                ${state.snapshot.rows.map((row) => buildDepartmentUpdateItem(row)).join("")}
              </div>
            </section>
            <section class="panel no-print archive-panel">
              <h2>Ежедневный архив 10:00</h2>
              <p id="archiveSummaryText">${
                latestArchive
                  ? escapeHtml(`Последний снимок: ${latestArchive.archiveLabel}, сохранён ${formatTimestamp(latestArchive.capturedAt)}.`)
                  : "Архивов пока нет. Первый снимок появится автоматически после 10:00 по Еревану."
              }</p>
              <p class="hint">Снимок сохраняется в этом браузере один раз в день после 10:00 по времени Еревана.</p>
              <div class="archive-list" id="archiveList">
                ${
                  archiveRecords.length
                    ? buildArchivePicker(archiveRecords)
                    : '<div class="archive-empty">Пока нет сохранённых дат.</div>'
                }
              </div>
            </section>
          </div>

          <aside class="panel no-print">
            <h2>Ссылки отделений</h2>
            <p>У каждого отделения своя отдельная HTML-страница. Им можно отправлять только свою ссылку.</p>
            <div class="link-grid">
              ${config.departmentDefinitions.map(buildCopyCard).join("")}
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  function renderDepartmentAccessGate(message = "", isError = false) {
    const definition = getCurrentDepartmentDefinition();
    const departmentName = definition ? definition.department : "Отделение";
    const mainPath = appendShareQuery(config.getMainPagePath(basePath));
    const canVerifyAccess = sync.hasRemoteSync();
    const statusText = message || (canVerifyAccess
      ? "Введите код отделения, чтобы открыть этот HTML-бланк."
      : "Защищённый вход работает только при включённой онлайн-синхронизации Supabase.");

    app.innerHTML = `
      <div class="page page--narrow">
        <div class="panel access-gate-panel">
          <span class="pill ${canVerifyAccess ? "remote" : "local"}">Защищённый вход</span>
          <h1>${escapeHtml(departmentName)}</h1>
          <p>Бланк отделения откроется только после проверки кода доступа.</p>
          <form id="departmentAccessForm" class="setup-form access-gate-form">
            <label class="setup-field">
              <span>Код доступа</span>
              <input
                type="password"
                id="departmentAccessCode"
                value="${escapeHtml(getStoredAccessCode())}"
                aria-label="Код доступа отделения"
                autocomplete="current-password"
                ${canVerifyAccess ? "" : "disabled"}
              >
            </label>
            <div class="setup-actions access-gate-actions">
              <button type="submit" id="departmentAccessSubmit" ${canVerifyAccess ? "" : "disabled"}>Войти</button>
              <a class="button-link access-gate-link" href="${escapeHtml(mainPath)}">К главному</a>
            </div>
          </form>
          <p class="hint${isError ? " warning-note" : ""}" id="gateStatusText">${escapeHtml(statusText)}</p>
        </div>
      </div>
    `;
  }


  function renderPhotoImportPanel(row) {
    const canRecognize = sync.hasRemoteSync() && typeof sync.recognizeDepartmentPhoto === "function";
    const photoState = state.photoImport || buildInitialPhotoImportState();
    const queueInfoText = photoState.queueMode
      ? (photoState.queueRemainingCount > 0
        ? `Это фото пришло из общей очереди. После сохранения автоматически откроется следующее фото. Осталось после текущего: ${photoState.queueRemainingCount}.${photoState.queueNextDepartmentName ? ` Следующее отделение: ${photoState.queueNextDepartmentName}.` : ""}`
        : "Это последнее фото из общей очереди. После сохранения очередь завершится.")
      : "";
    const recognizedFields = new Set(photoState.lastAppliedKeys || []);
    const reviewByKey = new Map(
      (Array.isArray(photoState.cellReviews) ? photoState.cellReviews : []).map((item) => [item.key, item])
    );
    const previewItems = getRecognizablePhotoFields(row)
      .filter((item) => reviewByKey.has(item.key) || recognizedFields.has(item.key))
      .map((item) => {
        const review = reviewByKey.get(item.key) || null;
        const status = review?.status === "review"
          ? "review"
          : (review?.status === "recognized" || recognizedFields.has(item.key) ? "recognized" : "neutral");
        const statusText = status === "review"
          ? (review?.reason || "Проверьте вручную")
          : "Распознано уверенно";
        return `
          <div class="photo-import-result-item photo-import-result-item--${status}">
            <span>Ячейка ${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(getDisplayValue(getPhotoPreviewValue(row, item.key)) || "—")}</strong>
            <small>${escapeHtml(statusText)}</small>
          </div>
        `;
      })
      .join("");

    return `
      <section class="panel no-print photo-import-panel">
        <h2>Загрузка фото бланка</h2>
        <p>Загрузите фото верхней части бланка. На странице отделения фото всегда относится к текущему отделению: маркер SR здесь не проверяется и не нужен. Значения подставятся в ячейки локально, потом вы их проверите и сохраните обычной кнопкой.</p>
        <div class="photo-import-actions">
          <label class="button-link photo-file-label${photoState.isProcessing ? " is-disabled" : ""}">
            <input type="file" id="photoImportFile" accept="image/*" capture="environment" ${photoState.isProcessing ? "disabled" : ""}>
            Выбрать фото
          </label>
          <button type="button" id="photoRecognizeBtn" ${!photoState.imageDataUrl || photoState.isProcessing || !canRecognize ? "disabled" : ""}>
            ${photoState.isProcessing ? "Распознаю..." : "Распознать"}
          </button>
          <button type="button" id="photoRecheckBtn" ${!photoState.imageDataUrl || photoState.isProcessing || !canRecognize ? "disabled" : ""}>
            Проверить заново
          </button>
          <button type="button" id="photoClearBtn" ${!photoState.imageDataUrl || photoState.isProcessing ? "disabled" : ""}>Очистить</button>
        </div>
        <p class="hint${photoState.isError ? " warning-note" : ""}" id="photoImportStatus">${
          escapeHtml(
            photoState.status
            || (canRecognize
              ? "Лучше всего работает фото сверху, без сильного наклона и с чёткими цифрами. На этой странице система читает цифры только для текущего отделения и не использует SR."
              : "Распознавание фото доступно только в онлайн-режиме владельца.")
          )
        }</p>
        ${queueInfoText ? `<p class="hint"><strong>${escapeHtml(queueInfoText)}</strong></p>` : ""}
        ${photoState.imageDataUrl ? `
          <div class="photo-import-preview">
            <div class="photo-import-preview-frame">
              <img src="${escapeHtml(photoState.imageDataUrl)}" alt="Загруженный бланк">
              ${renderPhotoReviewOverlay(photoState)}
            </div>
          </div>
        ` : ""}
        ${previewItems || photoState.lastReportDate || (photoState.notes && photoState.notes.length) ? `
          <div class="photo-import-results">
            ${photoState.lastReportDate ? `<p class="hint">Дата на фото: <strong>${escapeHtml(photoState.lastReportDate)}</strong></p>` : ""}
            ${previewItems ? `<div class="photo-import-result-grid">${previewItems}</div>` : ""}
            ${photoState.notes && photoState.notes.length ? `
              <div class="photo-import-notes">
                ${photoState.notes.map((note) => `<p class="hint warning-note">${escapeHtml(note)}</p>`).join("")}
              </div>
            ` : ""}
            ${photoState.draftMode ? `<p class="hint"><strong>Автоотправка временно приостановлена.</strong> Проверьте ячейки и нажмите Сохранить.</p>` : ""}
          </div>
        ` : ""}
      </section>
    `;
  }

  function renderDepartmentPage() {
    if (isDepartmentAccessProtected() && !isDepartmentUnlocked()) {
      renderDepartmentAccessGate();
      return;
    }

    const row = getCurrentRow();
    const sourceLabel = sync.getSourceLabel(state.source);
    const rowFreshness = getRowFreshnessMeta(row);
    const currentDateTime = getCurrentDateTimeParts();

    if (!row) {
      app.innerHTML = `
        <div class="page">
          <div class="panel">
            <h2>Отделение не найдено</h2>
            <p>Для этой страницы не найдено нужное отделение. Вернись в главный файл и открой ссылку снова.</p>
          </div>
        </div>
      `;
      return;
    }

    const mainPath = appendShareQuery(config.getMainPagePath(basePath));
    const blankPdfPath = config.getDepartmentBlankPdfPath
      ? config.getDepartmentBlankPdfPath(basePath, departmentId)
      : null;
    const accessCodeValue = getStoredAccessCode();
    const downloadPdfButtonHtml = blankPdfPath
      ? `<a class="button-link" href="${escapeHtml(blankPdfPath)}" download target="_blank" rel="noopener">Скачать PDF</a>`
      : "";

    app.innerHTML = `
      <div class="page">
        <div class="print-title print-only">
          <h1>${escapeHtml(PRINT_REPORT_TITLE)}</h1>
          <p>${escapeHtml(row.department)}</p>
        </div>
        <div class="toolbar no-print">
          <div>
            <h1>${escapeHtml(row.department)}</h1>
            <p>Эта страница заполняет только одно отделение и отправляет его данные в общий SARSH_KKZH.</p>
          </div>
          <div class="toolbar-actions">
            <span class="pill ${getSourceClass()}" id="syncModeLabel">${escapeHtml(sourceLabel)}</span>
            ${buildOwnerAuthActions()}
            ${downloadPdfButtonHtml}
            <div class="zoom-control">
              <label for="zoomRange">Масштаб</label>
              <input type="range" id="zoomRange" min="60" max="140" step="5" value="100">
              <span class="zoom-value" id="zoomValue">100%</span>
            </div>
            <a class="button-link" href="${escapeHtml(getSetupPath())}">Настройка</a>
            <button type="button" id="saveBtn">Сохранить</button>
            <button type="button" id="refreshBtn">Обновить</button>
            <button type="button" id="resetBtn">Сбросить</button>
            <button type="button" id="printBtn">Печать</button>
            <a class="button-link" href="${escapeHtml(mainPath)}">К главному</a>
          </div>
        </div>

        <div class="info-stack">
          <div class="panel no-print">
            <h2>Синхронизация отделения</h2>
            <div class="meta-row">
              <div class="inline-field static-field">
                <span>Дата и время</span>
                <strong id="reportDateField">${escapeHtml(currentDateTime.full)}</strong>
              </div>
              ${isDepartmentAccessProtected() ? `
                <label class="inline-field access-code">
                  <span>Код</span>
                  <input type="password" id="accessCodeField" value="${escapeHtml(accessCodeValue)}" aria-label="Код отделения">
                </label>
              ` : ""}
            </div>
            <p id="syncStatusText">${escapeHtml(getSyncDescription())}</p>
            <p class="hint${state.infoIsError ? " warning-note" : ""}" id="syncInfoText">${escapeHtml(state.info || "Изменения сохраняются локально. В общий файл они отправятся только после нажатия Сохранить.")}</p>
            <p class="hint${state.warning ? " warning-note" : ""}" id="warningText">${escapeHtml(state.warning)}</p>
            <p class="hint save-rule-note" id="saveRuleText"></p>
          </div>

          ${renderPhotoImportPanel(row)}

          <div class="zoom-target">
            <div class="sheet-shell">
              <p class="status-line no-print">
                <strong>Последняя отправка:</strong>
                <span id="lastUpdatedText">${escapeHtml(formatTimestamp(row.updatedAt))}</span>
                <span class="status-chip status-chip--${rowFreshness.level}" id="lastUpdatedBadge">${escapeHtml(rowFreshness.label)}</span>
              </p>
              <div class="table-wrap">
                ${renderTable(state.snapshot, [row], { interactive: true, viewMode: "department" })}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderArchivePage() {
    const record = getArchiveRecordByKey(archiveKeyFromQuery);

    if (!record) {
      app.innerHTML = `
        <div class="page">
          <div class="panel">
            <h2>Архив не найден</h2>
            <p>Для этой даты архивный снимок в текущем браузере не найден. Открой главный файл, дождись появления даты в архиве и попробуй снова.</p>
            <p><a href="${escapeHtml(config.getMainPagePath(basePath))}">Вернуться к главному файлу</a></p>
          </div>
        </div>
      `;
      return;
    }

    const headerDateTime = getHeaderDateTimeParts(record.reportDate) || getCurrentDateTimeParts();
    state.snapshot = deepCopy(record.snapshot);
    state.loadedSnapshot = deepCopy(record.snapshot);
    state.source = record.source || "local-only";

    app.innerHTML = `
      <div class="page">
        <div class="print-title">
          <h1>${escapeHtml(PRINT_REPORT_TITLE)}</h1>
        </div>
        <div class="toolbar no-print">
          <div>
            <h1>Архив ${escapeHtml(record.archiveLabel)}</h1>
            <p>Архивная копия главного файла для печати и сохранения в PDF.</p>
          </div>
          <div class="toolbar-actions">
            <button type="button" id="printBtn">Печать</button>
            <a class="button-link" href="${escapeHtml(config.getMainPagePath(basePath))}">К главному</a>
          </div>
        </div>

        <div class="info-stack">
          <div class="panel no-print">
            <h2>Данные архива</h2>
            <p><strong>Архивная дата:</strong> ${escapeHtml(record.archiveLabel)}</p>
            <p><strong>Снимок создан:</strong> ${escapeHtml(formatTimestamp(record.capturedAt))}</p>
            <p><strong>Дата документа:</strong> ${escapeHtml(record.reportDate)}</p>
          </div>

          <div class="zoom-target">
            <div class="sheet-shell">
              <div class="table-wrap">
                ${renderTable(state.snapshot, state.snapshot.rows, { interactive: false, viewMode: "main", headerDateTime })}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPage() {
    if (mode === "department") {
      renderDepartmentPage();
    } else if (mode === "archive") {
      renderArchivePage();
    } else {
      renderMainPage();
    }

    document.title = getAppDocumentTitle();
    attachCommonEvents();
    applyZoom(loadZoom());
    if (mode === "archive") {
      refreshComputedCells();
      return;
    }
    refreshTableData();
  }

  function refreshComputedCells() {
    const body = document.getElementById("sheetBody");
    if (!body) {
      return;
    }

    const rows = mode === "department" ? [getCurrentRow()].filter(Boolean) : state.snapshot.rows;
    rows.forEach((row) => {
      const presentEl = body.querySelector(`[data-output="presentTotal"][data-row="${row.id}"]`);
      if (presentEl) {
        presentEl.textContent = String(calcPresentTotal(state.snapshot, row));
      }

      const leaveEl = body.querySelector(`[data-output="leaveTotal"][data-row="${row.id}"]`);
      if (leaveEl) {
        leaveEl.textContent = String(calcLeaveTotal(state.snapshot, row) || 0);
      }

      config.columns.forEach((key) => {
        const span = body.querySelector(`[data-value="${row.id}:${key}"]`);
        if (span) {
          span.textContent = getDisplayValue(getEffectiveValue(state.snapshot, row, key));
        }
      });
    });

    Object.keys(config.linkedCells).forEach((linkedKey) => {
      const [targetRowId, targetKey] = linkedKey.split(":");
      const linkedEl = body.querySelector(`[data-linked="${linkedKey}"]`);
      if (linkedEl) {
        const targetRow = getDepartmentRow(state.snapshot, targetRowId);
        linkedEl.textContent = targetRow ? getDisplayValue(getEffectiveValue(state.snapshot, targetRow, targetKey)) : "";
      }
    });

    if (mode === "main") {
      refreshSummary("subtotal", state.snapshot.rows.filter((row) => row.group === "primary"));
      refreshSummary("grand", state.snapshot.rows);
    } else {
      const row = getCurrentRow();
      if (row) {
        refreshSummary("single", [row]);
      }
    }
  }

  function refreshSummary(summaryId, rows) {
    const body = document.getElementById("sheetBody");
    if (!body) {
      return;
    }
    config.columns.forEach((key) => {
      const el = body.querySelector(`[data-summary="${summaryId}"][data-key="${key}"]`);
      if (el) {
        el.textContent = String(getSummaryValue(state.snapshot, rows, key));
      }
    });
  }

  function refreshTableData() {
    const headerDateText = document.getElementById("sheetDateText");
    const headerTimeText = document.getElementById("sheetTimeText");
    const reportDateField = document.getElementById("reportDateField");
    const syncStatusText = document.getElementById("syncStatusText");
    const syncInfoText = document.getElementById("syncInfoText");
    const warningText = document.getElementById("warningText");
    const lastUpdatedText = document.getElementById("lastUpdatedText");
    const lastUpdatedBadge = document.getElementById("lastUpdatedBadge");
    const pills = Array.from(document.querySelectorAll("#syncModeLabel, #sheetSourcePill"));
    const currentDateTime = syncCurrentReportDate();

    if (headerDateText) {
      headerDateText.textContent = currentDateTime.date;
    }
    if (headerTimeText) {
      headerTimeText.textContent = currentDateTime.time;
    }
    if (reportDateField) {
      reportDateField.textContent = currentDateTime.full;
    }
    if (syncStatusText) {
      syncStatusText.textContent = getSyncDescription();
    }
    if (syncInfoText) {
      syncInfoText.textContent = state.info || (mode === "department"
        ? "Изменения сохраняются локально. В общий файл они отправятся только после нажатия Сохранить."
        : "Главный файл можно печатать сразу, а PDF создается через кнопку Печать в браузере.");
      syncInfoText.className = `hint${state.infoIsError ? " warning-note" : ""}`;
    }
    if (warningText) {
      warningText.textContent = state.warning || "";
      warningText.classList.toggle("warning-note", Boolean(state.warning));
    }
    pills.forEach((pill) => {
      pill.textContent = sync.getSourceLabel(state.source);
      pill.classList.toggle("remote", state.source === "remote");
      pill.classList.toggle("local", state.source !== "remote");
    });

    if (lastUpdatedText) {
      if (mode === "department") {
        const row = getCurrentRow();
        const meta = getRowFreshnessMeta(row);
        lastUpdatedText.textContent = meta.timestamp;
        if (lastUpdatedBadge) {
          lastUpdatedBadge.textContent = meta.label;
          lastUpdatedBadge.className = `status-chip status-chip--${meta.level}`;
        }
      } else {
        lastUpdatedText.textContent = formatTimestamp(state.snapshot.updatedAt);
        if (lastUpdatedBadge) {
          const meta = getFreshnessMeta(state.snapshot.updatedAt);
          lastUpdatedBadge.textContent = meta.label;
          lastUpdatedBadge.className = `status-chip status-chip--${meta.level}`;
        }
      }
    }

    if (mode === "main") {
      maybeCaptureDailyArchive();
      const stats = buildFreshnessStats(state.snapshot.rows);
      const overallUpdateStatus = getOverallUpdateStatus(stats, state.snapshot.rows.length);
      const freshCount = document.getElementById("freshCount");
      const warningCount = document.getElementById("warningCount");
      const staleCount = document.getElementById("staleCount");
      const missingCount = document.getElementById("missingCount");
      const oldestText = document.getElementById("freshnessOldestText");
      const overallUpdateBanner = document.getElementById("overallUpdateBanner");
      const overallUpdateLabel = document.getElementById("overallUpdateLabel");
      const overallUpdateDetail = document.getElementById("overallUpdateDetail");
      const archiveSummaryText = document.getElementById("archiveSummaryText");
      const archiveList = document.getElementById("archiveList");
      const archiveRecords = ensureArchiveRecordsLoaded();

      if (freshCount) {
        freshCount.textContent = String(stats.counts.fresh);
      }
      if (warningCount) {
        warningCount.textContent = String(stats.counts.warning);
      }
      if (staleCount) {
        staleCount.textContent = String(stats.counts.stale);
      }
      if (missingCount) {
        missingCount.textContent = String(stats.counts.missing);
      }
      if (oldestText) {
        oldestText.textContent = stats.oldestRow
          ? `Самые старые данные: ${stats.oldestRow.department} — ${formatTimestamp(stats.oldestRow.updatedAt)} (${formatAge(stats.oldestRow.updatedAt)})`
          : "Нет ни одного отделения с отправленными данными.";
      }
      if (overallUpdateBanner) {
        overallUpdateBanner.className = `update-health-banner update-health-banner--${overallUpdateStatus.level}`;
      }
      if (overallUpdateLabel) {
        overallUpdateLabel.textContent = overallUpdateStatus.label;
      }
      if (overallUpdateDetail) {
        overallUpdateDetail.textContent = overallUpdateStatus.detail;
      }

      if (archiveSummaryText) {
        const latestArchive = archiveRecords[0] || null;
        archiveSummaryText.textContent = latestArchive
          ? `Последний снимок: ${latestArchive.archiveLabel}, сохранён ${formatTimestamp(latestArchive.capturedAt)}.`
          : "Архивов пока нет. Первый снимок появится автоматически после 10:00 по Еревану.";
      }
      if (archiveList) {
        archiveList.innerHTML = archiveRecords.length
          ? archiveRecords.map((record) => buildArchiveItem(record)).join("")
          : '<div class="archive-empty">Пока нет сохранённых дат.</div>';
      }

      if (archiveSummaryText) {
        archiveSummaryText.textContent = getArchiveSummaryText(archiveRecords);
      }
      if (archiveList) {
        archiveList.innerHTML = buildArchivePicker(archiveRecords);
      }
      syncArchivePickerUi();

      state.snapshot.rows.forEach((row) => {
        const meta = getRowFreshnessMeta(row);
        const statusEl = document.querySelector(`[data-department-status="${row.id}"]`);
        const updatedEl = document.querySelector(`[data-department-updated="${row.id}"]`);
        const ageEl = document.querySelector(`[data-department-age="${row.id}"]`);
        const listStatusEl = document.querySelector(`[data-update-status="${row.id}"]`);
        const listTimeEl = document.querySelector(`[data-update-time="${row.id}"]`);
        const listAgeEl = document.querySelector(`[data-update-age="${row.id}"]`);

        if (statusEl) {
          statusEl.textContent = meta.label;
          statusEl.className = `status-chip status-chip--${meta.level}`;
        }
        if (updatedEl) {
          updatedEl.textContent = meta.timestamp;
        }
        if (ageEl) {
          ageEl.textContent = meta.age;
        }
        if (listStatusEl) {
          listStatusEl.textContent = meta.label;
          listStatusEl.className = `status-chip status-chip--${meta.level}`;
        }
        if (listTimeEl) {
          listTimeEl.textContent = meta.timestamp;
        }
        if (listAgeEl) {
          listAgeEl.textContent = meta.age;
        }
      });
    }

    refreshComputedCells();
    refreshDepartmentSaveState();
  }

  function refreshDepartmentSaveState() {
    const saveBtn = document.getElementById("saveBtn");
    const ruleText = document.getElementById("saveRuleText");

    if (!saveBtn) {
      return;
    }

    const validation = getDepartmentValidationState();
    saveBtn.classList.remove("save-ready", "save-blocked");

    if (!validation.applicable) {
      saveBtn.disabled = false;
      saveBtn.removeAttribute("aria-disabled");
      saveBtn.removeAttribute("title");
      if (ruleText) {
        ruleText.textContent = "";
        ruleText.className = "hint save-rule-note";
      }
      return;
    }

    saveBtn.disabled = !validation.isValid;
    saveBtn.setAttribute("aria-disabled", String(!validation.isValid));
    saveBtn.title = validation.isValid
      ? "Формула совпадает, можно сохранять."
      : "Исправь данные: кнопка станет активной, когда сумма 13-22 совпадет с формулой.";
    saveBtn.classList.add(validation.isValid ? "save-ready" : "save-blocked");

    if (ruleText) {
      ruleText.textContent = validation.message;
      ruleText.className = `hint save-rule-note ${validation.isValid ? "save-rule-note--valid" : "save-rule-note--invalid"}`;
    }
  }

  function applyRecognizedDepartmentValues(payload) {
    const row = getCurrentRow();
    if (!row || !payload || typeof payload !== "object") {
      return 0;
    }

    const values = payload.values && typeof payload.values === "object" ? payload.values : {};
    const recognizedKeys = new Set(
      Array.isArray(payload.recognizedKeys)
        ? payload.recognizedKeys.filter((item) => typeof item === "string")
        : []
    );
    const applicableFields = getRecognizablePhotoFields(row);
    const appliedKeys = [];
    const previewKeys = [];

    applicableFields.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(values, field.key) || !recognizedKeys.has(field.key)) {
        return;
      }

      const normalized = config.normalizeCellValue(values[field.key]);
      row.values[field.key] = normalized;
      if (normalized !== null) {
        appliedKeys.push(field.key);
        previewKeys.push(field.key);
      }
    });

    if (appliedKeys.length > 0 && applicableFields.some((field) => field.key === "presentTotal")) {
      previewKeys.push("presentTotal");
    }

    state.photoImport.lastAppliedKeys = previewKeys;
    state.photoImport.lastReportDate = typeof payload.reportDate === "string" ? payload.reportDate : "";
    state.photoImport.notes = Array.isArray(payload.notes)
      ? payload.notes.filter((item) => typeof item === "string" && item.trim()).map((item) => String(item).trim())
      : [];
    state.photoImport.cellReviews = normalizePhotoCellReviews(payload);
    state.photoImport.draftMode = appliedKeys.length > 0;

    return appliedKeys.length;
  }

  async function handlePhotoImportSelection(file) {
    if (!file) {
      return;
    }

    state.photoImport.isProcessing = true;
    state.photoImport.imageName = file.name || "";
    state.photoImport.imageDataUrl = "";
    state.photoImport.lastAppliedKeys = [];
    state.photoImport.lastReportDate = "";
    state.photoImport.notes = [];
    state.photoImport.cellReviews = [];
    state.photoImport.queueMode = false;
    state.photoImport.queueRemainingCount = 0;
    state.photoImport.queueNextDepartmentName = "";
    setPhotoImportStatus("Подготавливаю фото для распознавания...", false);
    renderPage();

    try {
      state.photoImport.imageDataUrl = await compressImageFile(file);
      state.photoImport.isProcessing = false;
      const canAutoRecognize = sync.hasRemoteSync() && typeof sync.recognizeDepartmentPhoto === "function";
      if (canAutoRecognize) {
        setPhotoImportStatus(`Фото готово: ${file.name || "image"}. Автоматически распознаю цифры...`, false);
        renderPage();
        await handlePhotoRecognition();
        return;
      }
      setPhotoImportStatus(`Фото готово: ${file.name || "image"}. Нажмите "Распознать".`, false);
      renderPage();
    } catch (error) {
      state.photoImport = buildInitialPhotoImportState();
      setPhotoImportStatus(
        error instanceof Error ? error.message : "Не удалось подготовить фото.",
        true
      );
      renderPage();
    }
  }

  async function handlePhotoRecognition() {
    const row = getCurrentRow();
    if (!row) {
      return;
    }

    if (!sync.hasRemoteSync() || typeof sync.recognizeDepartmentPhoto !== "function") {
      setInfo("Распознавание фото доступно только в онлайн-режиме владельца.", true);
      return;
    }

    if (!state.photoImport.imageDataUrl) {
      setPhotoImportStatus("Сначала выберите фото бланка.", true);
      renderPage();
      return;
    }

    state.photoImport.isProcessing = true;
    setPhotoImportStatus("Распознаю цифры на бланке для текущего отделения. Маркер SR здесь игнорируется.", false);
    setPhotoImportStatus(
      state.photoImport.queueRemainingCount > 0
        ? `Фото перенесено с главного файла. Начинаю распознавание для этого отделения. После сохранения откроется следующее фото, осталось: ${state.photoImport.queueRemainingCount}.`
        : "Фото перенесено с главного файла. Начинаю распознавание для этого отделения. Это последнее фото из очереди.",
      false
    );
    if (!state.photoImport.queueMode) {
      setPhotoImportStatus("Распознаю цифры на бланке для текущего отделения. Маркер SR здесь игнорируется.", false);
    }
    renderPage();

    try {
      const result = await sync.recognizeDepartmentPhoto(departmentId, state.photoImport.imageDataUrl);
      const appliedCount = applyRecognizedDepartmentValues(result);
      state.photoImport.isProcessing = false;

      if (!appliedCount) {
        setPhotoImportStatus("Не удалось уверенно распознать цифры. Попробуйте другое фото или введите значения вручную.", true);
        renderPage();
        return;
      }

      setPhotoImportStatus("Значения подставлены локально. Проверьте ячейки и нажмите Сохранить.", false);
      renderPage();
      refreshTableData();
      setInfo("Распознанные значения подставлены локально. После проверки нажмите Сохранить.", false);
    } catch (error) {
      state.photoImport.isProcessing = false;
      setPhotoImportStatus(
        error instanceof Error ? error.message : "Не удалось распознать фото бланка.",
        true
      );
      renderPage();
    }
  }
  function clearPhotoImportSelection() {
    const keepDraft = hasPhotoImportDraft();
    const next = buildInitialPhotoImportState();
    next.draftMode = keepDraft;
    if (keepDraft && state.photoImport) {
      next.lastAppliedKeys = Array.isArray(state.photoImport.lastAppliedKeys)
        ? [...state.photoImport.lastAppliedKeys]
        : [];
      next.lastReportDate = state.photoImport.lastReportDate || "";
      next.notes = Array.isArray(state.photoImport.notes) ? [...state.photoImport.notes] : [];
      next.cellReviews = Array.isArray(state.photoImport.cellReviews) ? [...state.photoImport.cellReviews] : [];
      next.status = "Распознанные значения остаются в таблице локально. Проверьте их и нажмите Сохранить.";
    }
    state.photoImport = next;
    renderPage();
  }
  function buildMainPhotoRouteBatchItem(file, index) {
    return {
      id: `batch-${Date.now()}-${index}`,
      imageName: file && file.name ? String(file.name) : `image-${index + 1}`,
      imageDataUrl: "",
      detectedDepartmentId: "",
      detectedBy: "",
      notes: [],
      stage: "queued"
    };
  }

  function buildMainPhotoRouteBatchSummary(routeState) {
    const items = Array.isArray(routeState.batchItems) ? routeState.batchItems : [];
    if (!items.length) {
      return "";
    }

    return items.map((item, index) => {
      const department = item.detectedDepartmentId
        ? config.getDepartmentById(item.detectedDepartmentId)
        : null;
      const title = department
        ? `${department.marker || item.detectedDepartmentId} - ${department.department}`
        : ({
          queued: "В очереди",
          preparing: "Подготавливается",
          ready: "Готово к отправке",
          detecting: "Определяется",
          detected: "Определено",
          failed: "Не распознано"
        }[item.stage] || "Ожидание");

      return `
        <div class="photo-import-result-item">
          <span>${escapeHtml(`${index + 1}. ${item.imageName || "image"}`)}</span>
          <strong>${escapeHtml(title)}</strong>
        </div>
      `;
    }).join("");
  }

  function navigateToQueuedDepartment(item) {
    if (!item || !item.departmentId) {
      return false;
    }

    const department = config.getDepartmentById(item.departmentId);
    if (!department) {
      return false;
    }

    renderPage();
    window.location.href = appendShareQuery(config.getDepartmentPagePath(basePath, item.departmentId));
    return true;
  }

  function isSupportedMainPhotoFile(file) {
    if (!file || typeof file !== "object") {
      return false;
    }

    const fileName = typeof file.name === "string" ? file.name.toLowerCase() : "";
    const fileType = typeof file.type === "string" ? file.type.toLowerCase() : "";
    if (fileType.startsWith("image/")) {
      return true;
    }

    return /\.(jpg|jpeg|png|webp|bmp|gif|tif|tiff|heic|heif)$/i.test(fileName);
  }

  function normalizeMainPhotoRouteSelection(files) {
    const rawFiles = Array.isArray(files)
      ? files.filter(Boolean)
      : (files ? [files] : []);
    const imageFiles = rawFiles.filter((file) => isSupportedMainPhotoFile(file));

    return imageFiles.sort((leftFile, rightFile) => {
      const leftPath = String(leftFile.webkitRelativePath || leftFile.name || "").toLowerCase();
      const rightPath = String(rightFile.webkitRelativePath || rightFile.name || "").toLowerCase();
      return leftPath.localeCompare(rightPath, undefined, { numeric: true, sensitivity: "base" });
    });
  }

  async function handleMainPhotoRouteSelection(files) {
    const rawSelectedFiles = Array.isArray(files)
      ? files.filter(Boolean)
      : (files ? [files] : []);
    const selectedFiles = normalizeMainPhotoRouteSelection(rawSelectedFiles);
    const file = selectedFiles[0] || null;
    const isFolderSelection = rawSelectedFiles.some((item) => typeof item?.webkitRelativePath === "string" && item.webkitRelativePath);
    const skippedFilesCount = Math.max(0, rawSelectedFiles.length - selectedFiles.length);
    const folderName = isFolderSelection
      ? String((rawSelectedFiles.find((item) => typeof item?.webkitRelativePath === "string" && item.webkitRelativePath)?.webkitRelativePath || "").split("/")[0] || "").trim()
      : "";
    const selectionNotes = [];

    if (isFolderSelection && folderName) {
      selectionNotes.push(`Папка проверена: ${folderName}.`);
    }
    if (skippedFilesCount > 0) {
      selectionNotes.push(`Пропущено файлов без подходящего изображения: ${skippedFilesCount}.`);
    }

    if (!selectedFiles.length) {
      state.mainPhotoRoute = buildInitialMainPhotoRouteState();
      state.mainPhotoRoute.notes = selectionNotes;
      setMainPhotoRouteStatus(
        isFolderSelection
          ? "В выбранной папке не найдено подходящих фотографий бланков."
          : "Не найдено подходящих файлов изображений.",
        true
      );
      renderPage();
      return;
    }

    if (selectedFiles.length > 1) {
      state.mainPhotoRoute = buildInitialMainPhotoRouteState();
      state.mainPhotoRoute.isProcessing = true;
      state.mainPhotoRoute.imageName = selectedFiles[0].name || "";
      state.mainPhotoRoute.batchItems = selectedFiles.map((item, index) => buildMainPhotoRouteBatchItem(item, index));
      state.mainPhotoRoute.batchTotalCount = selectedFiles.length;
      state.mainPhotoRoute.notes = selectionNotes;
      setMainPhotoRouteStatus(`Подготавливаю ${selectedFiles.length} фото для пакетной обработки...`, false);
      renderPage();
      if (isFolderSelection) {
        setMainPhotoRouteStatus(`Папка проверена: найдено ${selectedFiles.length} подходящих фото. Подготавливаю их к отправке...`, false);
        renderPage();
      }

      try {
        const preparedItems = [];
        for (let index = 0; index < selectedFiles.length; index += 1) {
          const currentFile = selectedFiles[index];
          const batchItem = state.mainPhotoRoute.batchItems[index];
          if (batchItem) {
            batchItem.stage = "preparing";
          }
          setMainPhotoRouteStatus(
            `Подготавливаю фото ${index + 1} из ${selectedFiles.length}: ${currentFile.name || "image"}`,
            false
          );
          renderPage();

          const imageDataUrl = await compressImageFile(currentFile);
          if (batchItem) {
            batchItem.imageDataUrl = imageDataUrl;
            batchItem.stage = "ready";
          }
          if (index === 0) {
            state.mainPhotoRoute.imageDataUrl = imageDataUrl;
          }
          preparedItems.push({
            imageName: currentFile.name || "",
            imageDataUrl
          });
        }

        state.mainPhotoRoute.isProcessing = false;
        const canAutoDetect = sync.hasRemoteSync() && typeof sync.detectDepartmentPhoto === "function";
        if (canAutoDetect) {
          setMainPhotoRouteStatus(
            `Фото готовы. Последовательно отправляю ${preparedItems.length} снимков на сервер...`,
            false
          );
          renderPage();
          await handleMainPhotoRouteDetection(preparedItems);
          return;
        }

        setMainPhotoRouteStatus("Пакетная отправка фото доступна только в онлайн-режиме владельца.", true);
        renderPage();
        return;
      } catch (error) {
        state.mainPhotoRoute = buildInitialMainPhotoRouteState();
        setMainPhotoRouteStatus(
          error instanceof Error ? error.message : "Не удалось подготовить фото для определения отделения.",
          true
        );
        renderPage();
        return;
      }
    }

    if (!file) {
      return;
    }

    state.mainPhotoRoute = buildInitialMainPhotoRouteState();
    state.mainPhotoRoute.isProcessing = true;
    state.mainPhotoRoute.imageName = file.name || "";
    state.mainPhotoRoute.notes = selectionNotes;
    setMainPhotoRouteStatus("Подготавливаю фото для определения отделения...", false);
    renderPage();

    try {
      state.mainPhotoRoute.imageDataUrl = await compressImageFile(file);
      state.mainPhotoRoute.isProcessing = false;
      const canAutoDetect = sync.hasRemoteSync() && typeof sync.detectDepartmentPhoto === "function";
      if (canAutoDetect) {
        setMainPhotoRouteStatus(`Фото готово: ${file.name || "image"}. Автоматически определяю отделение...`, false);
        renderPage();
        await handleMainPhotoRouteDetection();
        return;
      }

      setMainPhotoRouteStatus(`Фото готово: ${file.name || "image"}. Нажмите "Определить и открыть".`, false);
      renderPage();
    } catch (error) {
      state.mainPhotoRoute = buildInitialMainPhotoRouteState();
      setMainPhotoRouteStatus(
        error instanceof Error ? error.message : "Не удалось подготовить фото для определения отделения.",
        true
      );
      renderPage();
    }
  }


  function clearMainPhotoRouteSelection() {
    state.mainPhotoRoute = buildInitialMainPhotoRouteState();
    writePendingMainPhotoRouteQueue([]);
    renderPage();
  }

  function renderMainPhotoRoutePanel() {
    const canDetect = sync.hasRemoteSync() && typeof sync.detectDepartmentPhoto === "function";
    const routeState = state.mainPhotoRoute || buildInitialMainPhotoRouteState();
    const detectedDepartment = routeState.detectedDepartmentId
      ? config.getDepartmentById(routeState.detectedDepartmentId)
      : null;
    const batchPreviewItems = buildMainPhotoRouteBatchSummary(routeState);

    return `
      <section class="panel no-print photo-import-panel">
        <h2>Фото бланка в отделение</h2>
        <p>Загрузите фото бланка на главном файле. После загрузки система сама определит отделение по крупному маркеру отделения или по шапке бланка, откроет нужную страницу и автоматически начнёт подстановку цифр в поля этого отделения.</p>
        <div class="photo-import-actions">
          <label class="button-link photo-file-label${routeState.isProcessing ? " is-disabled" : ""}">
            <input type="file" id="mainPhotoRouteFile" accept="image/*" capture="environment" multiple ${routeState.isProcessing ? "disabled" : ""}>
            Выбрать фото
          </label>
          <label class="button-link photo-file-label${routeState.isProcessing ? " is-disabled" : ""}">
            <input type="file" id="mainPhotoRouteFolder" accept="image/*" webkitdirectory directory multiple ${routeState.isProcessing ? "disabled" : ""}>
            Выбрать папку
          </label>
          <button type="button" id="mainPhotoRouteDetectBtn" ${!routeState.imageDataUrl || routeState.isProcessing || !canDetect ? "disabled" : ""}>
            ${routeState.isProcessing ? "Определяю..." : "Определить и открыть"}
          </button>
          <button type="button" id="mainPhotoRouteRecheckBtn" ${!routeState.imageDataUrl || routeState.isProcessing || !canDetect ? "disabled" : ""}>
            Проверить заново
          </button>
          <button type="button" id="mainPhotoRouteClearBtn" ${!routeState.imageDataUrl || routeState.isProcessing ? "disabled" : ""}>Очистить</button>
        </div>
        <p class="hint${routeState.isError ? " warning-note" : ""}" id="mainPhotoRouteStatus">${
          escapeHtml(
            routeState.status
            || (canDetect
              ? "Лучше всего работает фото всего бланка с видимым маркером отделения и четкой шапкой."
              : "Определение отделения доступно только в онлайн-режиме владельца.")
          )
        }</p>
        ${routeState.imageDataUrl ? `
          <div class="photo-import-preview">
            <img src="${escapeHtml(routeState.imageDataUrl)}" alt="Фото для определения отделения">
          </div>
        ` : ""}
        ${detectedDepartment || batchPreviewItems || (routeState.notes && routeState.notes.length) ? `
          <div class="photo-import-results">
            ${detectedDepartment ? `
              <div class="photo-import-result-grid">
                <div class="photo-import-result-item">
                  <span>Определённое отделение</span>
                  <strong>${escapeHtml(detectedDepartment.department)}</strong>
                </div>
                ${detectedDepartment.marker ? `
                  <div class="photo-import-result-item">
                    <span>Маркер</span>
                    <strong>${escapeHtml(detectedDepartment.marker)}</strong>
                  </div>
                ` : ""}
              </div>
            ` : ""}
            ${batchPreviewItems ? `<div class="photo-import-result-grid">${batchPreviewItems}</div>` : ""}
            ${routeState.notes && routeState.notes.length ? `
              <div class="photo-import-notes">
                ${routeState.notes.map((note) => `<p class="hint warning-note">${escapeHtml(note)}</p>`).join("")}
              </div>
            ` : ""}
          </div>
        ` : ""}
      </section>
    `;
  }

  async function handleMainPhotoRouteDetection(preparedItemsOverride) {
    const preparedItems = Array.isArray(preparedItemsOverride)
      ? preparedItemsOverride.filter((item) => item && typeof item.imageDataUrl === "string" && item.imageDataUrl.startsWith("data:image/"))
      : [];

    if (preparedItems.length > 1) {
      if (!sync.hasRemoteSync() || typeof sync.detectDepartmentPhoto !== "function") {
        setMainPhotoRouteStatus("Определение отделения доступно только в онлайн-режиме владельца.", true);
        renderPage();
        return;
      }

      state.mainPhotoRoute.isProcessing = true;
      state.mainPhotoRoute.notes = [];
      state.mainPhotoRoute.detectedDepartmentId = "";
      state.mainPhotoRoute.detectedBy = "";
      state.mainPhotoRoute.batchTotalCount = preparedItems.length;
      state.mainPhotoRoute.batchDetectedCount = 0;
      state.mainPhotoRoute.batchFailedCount = 0;
      state.mainPhotoRoute.batchItems = preparedItems.map((item, index) => ({
        id: `prepared-${Date.now()}-${index}`,
        imageName: item.imageName || `image-${index + 1}`,
        imageDataUrl: item.imageDataUrl || "",
        detectedDepartmentId: "",
        detectedBy: "",
        notes: [],
        stage: "ready"
      }));
      setMainPhotoRouteStatus(`Определяю отделения по ${preparedItems.length} фото...`, false);
      renderPage();

      try {
        const recognizedQueue = [];
        const batchNotes = [];

        for (let index = 0; index < preparedItems.length; index += 1) {
          const preparedItem = preparedItems[index];
          const batchItem = state.mainPhotoRoute.batchItems[index];
          if (batchItem) {
            batchItem.stage = "detecting";
          }
          setMainPhotoRouteStatus(
            `Отправляю фото ${index + 1} из ${preparedItems.length}: ${preparedItem.imageName || "image"}`,
            false
          );
          renderPage();

          const detection = await sync.detectDepartmentPhoto(preparedItem.imageDataUrl);
          const detectedDepartmentId = detection && typeof detection.departmentId === "string"
            ? detection.departmentId
            : "";
          const notes = Array.isArray(detection?.notes)
            ? detection.notes.filter((item) => typeof item === "string" && item.trim()).map((item) => String(item).trim())
            : [];
          const department = detectedDepartmentId
            ? config.getDepartmentById(detectedDepartmentId)
            : null;

          if (batchItem) {
            batchItem.detectedDepartmentId = department ? detectedDepartmentId : "";
            batchItem.detectedBy = department ? "vision" : "";
            batchItem.notes = notes;
            batchItem.stage = department ? "detected" : "failed";
          }

          if (department) {
            recognizedQueue.push({
              departmentId: detectedDepartmentId,
              imageName: preparedItem.imageName,
              imageDataUrl: preparedItem.imageDataUrl,
              detectedBy: "vision",
              notes
            });
            state.mainPhotoRoute.batchDetectedCount += 1;
          } else {
            state.mainPhotoRoute.batchFailedCount += 1;
            batchNotes.push(`${preparedItem.imageName || `Фото ${index + 1}`}: отделение не определилось уверенно.`);
          }
        }

        state.mainPhotoRoute.isProcessing = false;
        state.mainPhotoRoute.notes = batchNotes;
        state.mainPhotoRoute.detectedDepartmentId = recognizedQueue.length === 1 ? recognizedQueue[0].departmentId : "";
        state.mainPhotoRoute.detectedBy = recognizedQueue.length === 1 ? "vision" : "";

        if (!recognizedQueue.length) {
          setMainPhotoRouteStatus(
            "Не удалось уверенно определить отделения по выбранным фото. Попробуйте более чёткие снимки с видимым SR и шапкой.",
            true
          );
          renderPage();
          return;
        }

        storePendingMainPhotoRoutes(recognizedQueue);
        const firstItem = peekPendingMainPhotoRoute();
        const firstDepartment = firstItem ? config.getDepartmentById(firstItem.departmentId) : null;
        if (!firstItem || !firstDepartment) {
          setMainPhotoRouteStatus("Очередь фото подготовилась, но открыть отделение не удалось.", true);
          renderPage();
          return;
        }

        setMainPhotoRouteStatus(
          `Пакет готов: распознано ${recognizedQueue.length} из ${preparedItems.length}. Открываю первое отделение: ${firstDepartment.department}.`,
          false
        );
        renderPage();
        navigateToQueuedDepartment(firstItem);
        return;
      } catch (error) {
        state.mainPhotoRoute.isProcessing = false;
        setMainPhotoRouteStatus(
          error instanceof Error ? error.message : "Не удалось определить отделение по фото.",
          true
        );
        renderPage();
        return;
      }
    }
    if (!state.mainPhotoRoute.imageDataUrl) {
      setMainPhotoRouteStatus("Сначала выберите фото бланка.", true);
      renderPage();
      return;
    }

    if (!sync.hasRemoteSync() || typeof sync.detectDepartmentPhoto !== "function") {
      setMainPhotoRouteStatus("Определение отделения доступно только в онлайн-режиме владельца.", true);
      renderPage();
      return;
    }

    state.mainPhotoRoute.isProcessing = true;
    state.mainPhotoRoute.notes = [];
    state.mainPhotoRoute.detectedDepartmentId = "";
    state.mainPhotoRoute.detectedBy = "";
    setMainPhotoRouteStatus("Определяю отделение по маркеру и шапке бланка...", false);
    renderPage();

    try {
      const detection = await sync.detectDepartmentPhoto(state.mainPhotoRoute.imageDataUrl);
      const detectedDepartmentId = detection && typeof detection.departmentId === "string"
        ? detection.departmentId
        : "";
      const detectedBy = detectedDepartmentId ? "vision" : "";
      const notes = Array.isArray(detection?.notes)
        ? detection.notes.filter((item) => typeof item === "string" && item.trim()).map((item) => String(item).trim())
        : [];

      state.mainPhotoRoute.isProcessing = false;
      state.mainPhotoRoute.detectedDepartmentId = detectedDepartmentId;
      state.mainPhotoRoute.detectedBy = detectedBy;
      state.mainPhotoRoute.notes = notes;

      if (!detectedDepartmentId) {
        setMainPhotoRouteStatus("Не удалось уверенно определить отделение. Попробуйте фото с более чётким маркером и шапкой.", true);
        renderPage();
        return;
      }

      const department = config.getDepartmentById(detectedDepartmentId);
      if (!department) {
        setMainPhotoRouteStatus("Определилось неизвестное отделение. Попробуйте ещё раз.", true);
        renderPage();
        return;
      }

      storePendingMainPhotoRoute({
        departmentId: detectedDepartmentId,
        imageName: state.mainPhotoRoute.imageName,
        imageDataUrl: state.mainPhotoRoute.imageDataUrl
      });

      setMainPhotoRouteStatus(`Открываю страницу отделения: ${department.department}.`, false);
      renderPage();
      window.location.href = appendShareQuery(config.getDepartmentPagePath(basePath, detectedDepartmentId));
    } catch (error) {
      state.mainPhotoRoute.isProcessing = false;
      setMainPhotoRouteStatus(
        error instanceof Error ? error.message : "Не удалось определить отделение по фото.",
        true
      );
      renderPage();
    }
  }

  async function maybeResumeTransferredPhotoImport() {
    if (mode !== "department") {
      return;
    }

    const pending = takePendingMainPhotoRoute(departmentId);
    if (!pending) {
      return;
    }

    state.photoImport = buildInitialPhotoImportState();
    state.photoImport.imageName = pending.imageName || "";
    state.photoImport.imageDataUrl = pending.imageDataUrl || "";
    state.photoImport.queueMode = true;
    state.photoImport.queueRemainingCount = getPendingMainPhotoRouteCount();
    const nextPendingRoute = peekPendingMainPhotoRoute();
    const nextDepartment = nextPendingRoute ? config.getDepartmentById(nextPendingRoute.departmentId) : null;
    state.photoImport.queueNextDepartmentName = nextDepartment ? nextDepartment.department : "";
    setPhotoImportStatus("Фото перенесено с главного файла. Начинаю распознавание для этого отделения...", false);
    renderPage();

    if (!sync.hasRemoteSync() || typeof sync.recognizeDepartmentPhoto !== "function") {
      setPhotoImportStatus("Фото перенесено на страницу отделения. Для распознавания нужен онлайн-режим владельца.", true);
      renderPage();
      return;
    }

    await handlePhotoRecognition();
  }

  function getStylesheetUrl() {
    if (basePath === "@site") {
      return `${window.location.origin}/functions/v1/site?path=${encodeURIComponent("assets/sharsh.css")}`;
    }
    return new URL(`${basePath === "." ? "" : `${basePath}/`}assets/sharsh.css`, window.location.href).toString();
  }

  function buildArchivePrintHtml(record) {
    const headerDateTime = getHeaderDateTimeParts(record.reportDate) || getCurrentDateTimeParts();
    return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(`${PRINT_REPORT_TITLE} ${record.archiveLabel}`)}</title>
  <link rel="stylesheet" href="${escapeHtml(getStylesheetUrl())}">
  <style>
    body { background: #ffffff; padding: 16px; }
    .archive-print-wrap { max-width: 1700px; margin: 0 auto; }
    .archive-print-meta { margin: 0 0 12px; color: #444; font: 600 14px/1.4 "Segoe UI", Tahoma, sans-serif; }
    .archive-print-meta p { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="archive-print-wrap">
    <div class="print-title">
      <h1>${escapeHtml(PRINT_REPORT_TITLE)}</h1>
    </div>
    <div class="archive-print-meta">
      <p><strong>Архивная дата:</strong> ${escapeHtml(record.archiveLabel)}</p>
      <p><strong>Снимок создан:</strong> ${escapeHtml(formatTimestamp(record.capturedAt))}</p>
      <p><strong>Дата документа:</strong> ${escapeHtml(record.reportDate)}</p>
    </div>
    <div class="sheet-shell">
      <div class="table-wrap">
        ${renderTable(record.snapshot, record.snapshot.rows, { interactive: false, viewMode: "main", headerDateTime })}
      </div>
    </div>
  </div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 250);
    });
  </script>
</body>
</html>`;
  }

  function printArchiveRecord(archiveKey) {
    const record = ensureArchiveRecordsLoaded().find((item) => item.archiveKey === archiveKey);
    if (!record) {
      setInfo("Не удалось найти сохранённый архив.", true);
      return;
    }

    const blob = new Blob([buildArchivePrintHtml(record)], {
      type: "text/html;charset=utf-8"
    });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, "_blank");
    if (printWindow) {
      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 60000);
      setInfo(`Архив ${record.archiveLabel} открыт для сохранения в PDF.`, false);
      return;
    }
    if (!printWindow) {
      setInfo("Браузер заблокировал окно печати архива.", true);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildArchivePrintHtml(record));
    printWindow.document.close();
    setInfo(`Архив ${record.archiveLabel} открыт для сохранения в PDF.`, false);
  }

  function setInfo(message, isError) {
    state.info = message || "";
    state.infoIsError = Boolean(isError);
    refreshTableData();
  }

  function sanitizeNumericInput(rawValue) {
    const cleaned = String(rawValue).replace(/[^\d]/g, "");
    if (!cleaned) {
      return { text: "", value: null };
    }
    const parsed = Math.max(0, Number(cleaned));
    return { text: String(parsed), value: parsed };
  }

  function getDetailRows() {
    return Array.from(document.querySelectorAll("tr.detail-row"));
  }

  function getRowInputMeta(rowElement) {
    return Array.from(rowElement.querySelectorAll("input[data-row][data-key]"))
      .map((input) => ({
        input,
        columnIndex: config.columnOrder.get(input.dataset.key)
      }))
      .filter((item) => Number.isInteger(item.columnIndex))
      .sort((a, b) => a.columnIndex - b.columnIndex);
  }

  function focusAndSelect(input) {
    input.focus();
    input.select();
    input.scrollIntoView({
      block: "nearest",
      inline: "nearest"
    });
  }

  function findHorizontalTarget(rowElement, currentColumnIndex, direction) {
    const inputs = getRowInputMeta(rowElement);
    const candidates = inputs.filter((item) =>
      direction < 0 ? item.columnIndex < currentColumnIndex : item.columnIndex > currentColumnIndex
    );

    if (!candidates.length) {
      return null;
    }

    return direction < 0 ? candidates[candidates.length - 1].input : candidates[0].input;
  }

  function findVerticalTarget(startRowIndex, currentColumnIndex, direction) {
    const rows = getDetailRows();

    for (let rowIndex = startRowIndex + direction; rowIndex >= 0 && rowIndex < rows.length; rowIndex += direction) {
      const inputs = getRowInputMeta(rows[rowIndex]);
      if (!inputs.length) {
        continue;
      }

      const exactMatch = inputs.find((item) => item.columnIndex === currentColumnIndex);
      if (exactMatch) {
        return exactMatch.input;
      }

      let nearest = inputs[0];
      for (const item of inputs) {
        if (Math.abs(item.columnIndex - currentColumnIndex) < Math.abs(nearest.columnIndex - currentColumnIndex)) {
          nearest = item;
        }
      }
      return nearest.input;
    }

    return null;
  }

  function getAccessCode() {
    const input = document.getElementById("accessCodeField");
    return input ? input.value.trim() : getStoredAccessCode();
  }

  function persistAccessCode() {
    if (!isDepartmentAccessProtected()) {
      return;
    }
    setStoredAccessCode(getAccessCode());
  }

  function setGateStatusText(message, isError) {
    const status = document.getElementById("gateStatusText");
    if (!status) {
      return;
    }

    status.textContent = message || "";
    status.className = `hint${isError ? " warning-note" : ""}`;
  }

  async function loadWorkingSnapshot() {
    const result = await sync.loadSnapshot();
    applyLoadedSnapshot(result);
    state.archiveRecords = readArchiveRecords();
    state.initialized = true;
    state.info = "";
    state.infoIsError = false;
    state.photoImport = buildInitialPhotoImportState();
    restorePendingMainSaveNotice();
  }

  async function handleDepartmentAccessSubmit(event) {
    event.preventDefault();

    if (!sync.hasRemoteSync()) {
      setGateStatusText("Защищённый вход работает только при включённой онлайн-синхронизации Supabase.", true);
      return;
    }

    const input = document.getElementById("departmentAccessCode");
    const submitButton = document.getElementById("departmentAccessSubmit");
    const accessCode = input instanceof HTMLInputElement ? input.value.trim() : "";

    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
    }
    setGateStatusText("Проверяю код доступа...", false);

    try {
      await sync.verifyDepartmentAccess(departmentId, accessCode);
      setStoredAccessCode(accessCode);
      unlockCurrentDepartment();
      await loadWorkingSnapshot();
      renderPage();
      startAutoRefreshIfNeeded();
      startFreshnessTicker();
      startClockTicker();
      await maybeResumeTransferredPhotoImport();
    } catch (error) {
      clearCurrentDepartmentUnlock();
      setGateStatusText(
        error instanceof Error ? error.message : "Не удалось проверить код доступа.",
        true
      );
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
      }
    }
  }

  async function persistDepartment(manual) {
    const row = getCurrentRow();
    if (!row) {
      return;
    }

    syncCurrentReportDate();
    persistAccessCode();

    const validation = getDepartmentValidationState();
    if (validation.applicable && !validation.isValid) {
      setInfo(validation.message, true);
      return;
    }

    if (isDepartmentAccessProtected() && !getAccessCode()) {
      setInfo("Для сохранения нужен код отделения.", true);
      return;
    }

    const expectedValues = config.normalizeRowValues(row.values);
    const payloadValues = deepCopy(expectedValues);
    const previousRows = state.snapshot.rows || [];
    const previousStats = buildFreshnessStats(previousRows);
    const previousOverall = getOverallUpdateStatus(previousStats, previousRows.length);
    const saveId = ++state.saveSequence;
    setInfo(manual ? "Сохраняю данные отделения..." : "Отправляю изменения в общий файл...", false);

    try {
      let lastError = null;
      let lastVerificationReason = "";

      for (let attempt = 1; attempt <= SAVE_VERIFICATION_ATTEMPTS; attempt += 1) {
        let result = null;

        try {
          result = await sync.saveDepartment(departmentId, state.snapshot.reportDate, payloadValues, getAccessCode());
        } catch (error) {
          lastError = error;
        }

        if (saveId !== state.saveSequence) {
          return;
        }

        if (result) {
          const verification = verifySavedDepartmentResult(expectedValues, result.snapshot);
          if (verification.ok) {
            applyLoadedSnapshot(result);
            setPendingMainSaveNotice("", false);

            const nextRows = result.snapshot.rows || [];
            const nextStats = buildFreshnessStats(nextRows);
            const nextOverall = getOverallUpdateStatus(nextStats, nextRows.length);
            const nextPendingRoute = manual ? peekPendingMainPhotoRoute() : null;
            const openNextPendingRoute = () => {
              if (!nextPendingRoute || !nextPendingRoute.departmentId) {
                return false;
              }

              const nextDepartment = config.getDepartmentById(nextPendingRoute.departmentId);
              if (!nextDepartment) {
                return false;
              }

              setInfo(`Данные сохранены. Открываю следующее отделение: ${nextDepartment.department}.`, false);
              navigateToQueuedDepartment(nextPendingRoute);
              return true;
            };

            state.photoImport.draftMode = false;

            if (nextOverall.level === "fresh" && previousOverall.level !== "fresh") {
              await playCompleteUpdateSound();
            } else {
              await playUpdateSound();
            }

            setInfo(manual ? "Данные отделения сохранены. Проверка записи пройдена." : "Изменения отправлены и проверка записи пройдена.", false);
            refreshTableData();
            if (openNextPendingRoute()) {
              return;
            }
            if (manual && state.photoImport.queueMode) {
              setInfo("Данные отделения сохранены, проверка записи пройдена. Очередь фото завершена.", false);
            }
            return;
          }

          lastVerificationReason = verification.reason;
          lastError = null;
        }

        if (attempt < SAVE_VERIFICATION_ATTEMPTS) {
          setInfo(
            `Подтверждение записи не прошло. Повторяю сохранение (${attempt + 1}/${SAVE_VERIFICATION_ATTEMPTS})...`,
            false
          );
          await wait(SAVE_VERIFICATION_DELAY_MS);
        }
      }

      const failureMessage = lastError
        ? `Не удалось сохранить данные отделения после ${SAVE_VERIFICATION_ATTEMPTS} попыток: ${lastError instanceof Error ? lastError.message : "ошибка синхронизации"}.`
        : `Не удалось подтвердить сохранение данных после ${SAVE_VERIFICATION_ATTEMPTS} попыток: ${lastVerificationReason || "сервер вернул неподтверждённый результат"}.`;

      setPendingMainSaveNotice(`${row.department}: ${failureMessage}`, true);
      setInfo(failureMessage, true);
      refreshTableData();
    } catch (error) {
      setInfo(error instanceof Error ? error.message : "Не удалось сохранить данные отделения.", true);
    }
  }

  async function persistReportDate() {
    syncCurrentReportDate();
    setInfo("Сохраняю дату документа...", false);
    try {
      const result = await sync.saveReportDate(state.snapshot.reportDate);
      state.snapshot = deepCopy(result.snapshot);
      state.loadedSnapshot.reportDate = result.snapshot.reportDate;
      state.source = result.source;
      state.warning = "";
      setInfo("Дата документа сохранена.", false);
      refreshTableData();
    } catch (error) {
      setInfo(error instanceof Error ? error.message : "Не удалось сохранить дату.", true);
    }
  }

  function queueDepartmentSave() {
    window.clearTimeout(state.saveTimer);
    const validation = getDepartmentValidationState();
    if (validation.applicable && !validation.isValid) {
      return;
    }
    if (hasPhotoImportDraft()) {
      setInfo("Распознанные значения пока сохранены только локально. Проверьте их и нажмите Сохранить.", false);
      return;
    }
    setInfo("Изменения сохранены локально. Нажми Сохранить для отправки.", false);
  }

  function loadZoom() {
    const zoomScope = mode === "department" ? departmentId : "main";
    const ownValue = Number(localStorage.getItem(config.getZoomStorageKey(zoomScope)));
    if (Number.isFinite(ownValue)) {
      return Math.min(140, Math.max(60, ownValue));
    }

    if (mode === "main") {
      const legacyValue = Number(localStorage.getItem(config.LEGACY_ZOOM_STORAGE_KEY));
      if (Number.isFinite(legacyValue)) {
        return Math.min(140, Math.max(60, legacyValue));
      }
    }

    return 100;
  }

  function applyZoom(value) {
    const normalized = Math.min(140, Math.max(60, Number(value) || 100));
    document.documentElement.style.setProperty("--sheet-zoom", String(normalized / 100));

    const range = document.getElementById("zoomRange");
    const label = document.getElementById("zoomValue");
    if (range) {
      range.value = String(normalized);
    }
    if (label) {
      label.textContent = `${normalized}%`;
    }

    const zoomScope = mode === "department" ? departmentId : "main";
    localStorage.setItem(config.getZoomStorageKey(zoomScope), String(normalized));
  }

  async function refreshFromSource() {
    if (blockPhotoImportDraftAction("Сначала сохраните распознанные значения, потом обновите данные с сервера.")) {
      return;
    }

    syncCurrentReportDate();
    setInfo("Обновляю данные...", false);
    const result = await sync.loadSnapshot();
    applyLoadedSnapshot(result);
    state.photoImport = buildInitialPhotoImportState();
    if (restorePendingMainSaveNotice()) {
      refreshTableData();
    } else {
      setInfo("Данные обновлены.", false);
    }
    renderPage();
  }

  function handleResetDepartment() {
    const currentRow = getCurrentRow();
    if (!currentRow) {
      return;
    }

    currentRow.values = deepCopy(config.zeroValues());
    state.photoImport = buildInitialPhotoImportState();
    renderPage();
    setInfo("Поля сброшены в 0. Нажми Сохранить для отправки.", false);
    return;
  }

  function attachCommonEvents() {
    const zoomRange = document.getElementById("zoomRange");
    const printBtn = document.getElementById("printBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const resetBtn = document.getElementById("resetBtn");
    const saveBtn = document.getElementById("saveBtn");
    const accessCodeField = document.getElementById("accessCodeField");
    const accessForm = document.getElementById("departmentAccessForm");
    const sheetBody = document.getElementById("sheetBody");

    bindUpdateAudioUnlock();

    if (zoomRange) {
      zoomRange.addEventListener("input", () => {
        applyZoom(zoomRange.value);
      });
    }

    if (printBtn) {
      printBtn.addEventListener("click", () => {
        window.print();
      });
    }

    if (!state.printHandlersAttached) {
      window.addEventListener("beforeprint", () => {
        document.title = getPrintDocumentTitle();
      });

      window.addEventListener("afterprint", () => {
        document.title = getAppDocumentTitle();
      });

      state.printHandlersAttached = true;
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        try {
          await refreshFromSource();
        } catch (error) {
          state.warning = error instanceof Error ? error.message : "Не удалось обновить данные.";
          setInfo("Не удалось обновить данные.", true);
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        persistDepartment(true);
      });
    }

    if (accessForm) {
      accessForm.addEventListener("submit", handleDepartmentAccessSubmit);
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        handleResetDepartment();
      });
    }

    if (accessCodeField) {
      accessCodeField.addEventListener("input", () => {
        persistAccessCode();
      });
    }

    document.querySelectorAll("[data-copy-link]").forEach((button) => {
      button.addEventListener("click", async () => {
        const relativeLink = button.getAttribute("data-copy-link") || "";
        const absoluteLink = new URL(relativeLink, window.location.href).toString();
        try {
          await navigator.clipboard.writeText(absoluteLink);
          setInfo(`Ссылка скопирована: ${relativeLink}`, false);
        } catch (error) {
          window.prompt("Скопируйте ссылку вручную", absoluteLink);
        }
      });
    });

    const mainPhotoRouteFile = document.getElementById("mainPhotoRouteFile");
    if (mainPhotoRouteFile instanceof HTMLInputElement) {
      mainPhotoRouteFile.addEventListener("change", () => {
        const files = Array.from(mainPhotoRouteFile.files || []);
        handleMainPhotoRouteSelection(files);
      });
    }

    const mainPhotoRouteFolder = document.getElementById("mainPhotoRouteFolder");
    if (mainPhotoRouteFolder instanceof HTMLInputElement) {
      mainPhotoRouteFolder.addEventListener("change", () => {
        const files = Array.from(mainPhotoRouteFolder.files || []);
        handleMainPhotoRouteSelection(files);
      });
    }

    const mainPhotoRouteDetectBtn = document.getElementById("mainPhotoRouteDetectBtn");
    if (mainPhotoRouteDetectBtn) {
      mainPhotoRouteDetectBtn.addEventListener("click", () => {
        handleMainPhotoRouteDetection();
      });
    }

    const mainPhotoRouteRecheckBtn = document.getElementById("mainPhotoRouteRecheckBtn");
    if (mainPhotoRouteRecheckBtn) {
      mainPhotoRouteRecheckBtn.addEventListener("click", () => {
        handleMainPhotoRouteDetection();
      });
    }

    const mainPhotoRouteClearBtn = document.getElementById("mainPhotoRouteClearBtn");
    if (mainPhotoRouteClearBtn) {
      mainPhotoRouteClearBtn.addEventListener("click", () => {
        clearMainPhotoRouteSelection();
      });
    }

    const photoImportFile = document.getElementById("photoImportFile");
    if (photoImportFile instanceof HTMLInputElement) {
      photoImportFile.addEventListener("change", () => {
        const [file] = Array.from(photoImportFile.files || []);
        handlePhotoImportSelection(file || null);
      });
    }

    const photoRecognizeBtn = document.getElementById("photoRecognizeBtn");
    if (photoRecognizeBtn) {
      photoRecognizeBtn.addEventListener("click", () => {
        handlePhotoRecognition();
      });
    }

    const photoRecheckBtn = document.getElementById("photoRecheckBtn");
    if (photoRecheckBtn) {
      photoRecheckBtn.addEventListener("click", () => {
        handlePhotoRecognition();
      });
    }

    const photoClearBtn = document.getElementById("photoClearBtn");
    if (photoClearBtn) {
      photoClearBtn.addEventListener("click", () => {
        clearPhotoImportSelection();
      });
    }
    const signOutButton = document.querySelector("[data-owner-signout]");
    if (signOutButton && auth && typeof auth.signOut === "function") {
      signOutButton.addEventListener("click", () => {
        auth.signOut();
      });
    }

    const archiveSelect = document.getElementById("archiveSelect");
    if (archiveSelect) {
      archiveSelect.addEventListener("change", () => {
        state.selectedArchiveKey = archiveSelect.value || "";
        syncArchivePickerUi();
      });
    }

    if (!app.dataset.archiveDownloadBound) {
      app.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const button = target.closest("[data-print-archive]");
        if (!(button instanceof HTMLElement)) {
          return;
        }

        const archiveKey = button.getAttribute("data-print-archive") || "";
        if (!archiveKey) {
          return;
        }

        printArchiveRecord(archiveKey);
      });
      app.dataset.archiveDownloadBound = "1";
    }

    if (!window.__sharshPhotoDraftGuardBound) {
      window.addEventListener("beforeunload", (event) => {
        if (!hasPhotoImportDraft()) {
          return;
        }

        event.preventDefault();
        event.returnValue = "";
      });
      window.__sharshPhotoDraftGuardBound = true;
    }

    if (mode !== "department" || !sheetBody) {
      return;
    }

    sheetBody.addEventListener("input", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      const rowId = input.dataset.row;
      const key = input.dataset.key;
      if (!rowId || !key) {
        return;
      }

      const row = getDepartmentRow(state.snapshot, rowId);
      if (!row) {
        return;
      }

      const sanitized = sanitizeNumericInput(input.value);
      input.value = sanitized.text;
      row.values[key] = sanitized.value;
      refreshTableData();
      queueDepartmentSave();
    });

    sheetBody.addEventListener("keydown", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.matches("input[data-row][data-key]")) {
        return;
      }

      const key = event.key;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) {
        return;
      }

      const rowElement = input.closest("tr.detail-row");
      const currentColumnIndex = config.columnOrder.get(input.dataset.key);
      if (!rowElement || !Number.isInteger(currentColumnIndex)) {
        return;
      }

      const rows = getDetailRows();
      const currentRowIndex = rows.indexOf(rowElement);
      if (currentRowIndex === -1) {
        return;
      }

      let target = null;
      if (key === "ArrowLeft") {
        target = findHorizontalTarget(rowElement, currentColumnIndex, -1);
      } else if (key === "ArrowRight") {
        target = findHorizontalTarget(rowElement, currentColumnIndex, 1);
      } else if (key === "ArrowUp") {
        target = findVerticalTarget(currentRowIndex, currentColumnIndex, -1);
      } else if (key === "ArrowDown") {
        target = findVerticalTarget(currentRowIndex, currentColumnIndex, 1);
      }

      if (!target) {
        return;
      }

      event.preventDefault();
      focusAndSelect(target);
    });
  }

  function startAutoRefreshIfNeeded() {
    window.clearInterval(state.refreshIntervalId);
    if (mode === "archive" || !sync.hasRemoteSync() || !Number.isFinite(sync.runtime.refreshIntervalMs) || sync.runtime.refreshIntervalMs <= 0) {
      return;
    }

    state.refreshIntervalId = window.setInterval(async () => {
      if (mode === "department" && hasDepartmentPendingLocalChanges()) {
        return;
      }

      try {
        const result = await sync.loadSnapshot();
        applyLoadedSnapshot(result);
        restorePendingMainSaveNotice();
        refreshTableData();
      } catch (error) {
        state.warning = error instanceof Error ? error.message : "Не удалось обновить данные.";
        refreshTableData();
      }
    }, sync.runtime.refreshIntervalMs);
  }

  function startFreshnessTicker() {
    window.clearInterval(state.freshnessIntervalId);
    state.freshnessIntervalId = window.setInterval(() => {
      refreshTableData();
    }, 60000);
  }

  function startClockTicker() {
    window.clearInterval(state.clockIntervalId);
    state.clockIntervalId = window.setInterval(() => {
      refreshTableData();
    }, 30000);
  }

  async function init() {
    if (window.SHARSH_AUTH_READY) {
      await window.SHARSH_AUTH_READY;
    }

    if (mode === "archive") {
      state.archiveRecords = readArchiveRecords();
      state.initialized = true;
      state.info = "";
      renderPage();
      if (archiveAutoPrint && getArchiveRecordByKey(archiveKeyFromQuery)) {
        window.setTimeout(() => {
          window.print();
        }, 350);
      }
      return;
    }

    migrateLegacyAccessCodeStorage();

    if (isDepartmentAccessProtected() && !isDepartmentUnlocked()) {
      state.info = "";
      state.warning = "";
      renderPage();
      return;
    }

    syncCurrentReportDate();
    setInfo("Загружаю данные...", false);
    await loadWorkingSnapshot();
    renderPage();
    startAutoRefreshIfNeeded();
    startFreshnessTicker();
    startClockTicker();
    await maybeResumeTransferredPhotoImport();
  }

  init().catch((error) => {
    app.innerHTML = `
      <div class="page">
        <div class="panel">
          <h2>Ошибка загрузки</h2>
          <p>${escapeHtml(error instanceof Error ? error.message : "Не удалось открыть систему SARSH_KKZH.")}</p>
        </div>
      </div>
    `;
  });
})();


