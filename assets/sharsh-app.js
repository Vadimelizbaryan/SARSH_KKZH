(function () {
  const config = window.SHARSH_CONFIG;
  const sync = window.SHARSH_SYNC;
  const auth = window.SHARSH_AUTH || null;
  const app = document.getElementById("app");

  if (!config || !sync || !app) {
    return;
  }

  const queryParams = new URLSearchParams(window.location.search);
  if (["night", "day"].includes(queryParams.get("view") || "")) {
    return;
  }

  const mode = document.body.dataset.view === "department"
    ? "department"
    : (document.body.dataset.view === "archive"
      ? "archive"
      : (document.body.dataset.view === "feedback"
        ? "feedback"
        : (document.body.dataset.view === "hospital-report" ? "hospital-report" : "main")));
  const departmentId = document.body.dataset.departmentId || "";
  const basePath = document.body.dataset.basePath || ".";
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
  const MAIN_PHOTO_ROUTE_TRANSFER_STORAGE_PREFIX = `${config.STORAGE_NAMESPACE}:main-photo-route-transfer:`;
  const MAIN_SAVE_NOTICE_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:main-save-notice:v1`;
  const SAVE_VERIFICATION_ATTEMPTS = 3;
  const SAVE_VERIFICATION_DELAY_MS = 700;
  const HOSPITAL_REPORT_FILENAME = "hospital-report.html";
  const NIGHT_SHIFT_FILENAME = "index.html";
  const DAY_SHIFT_FILENAME = "index.html";
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
  const QH_CALC_DEPARTMENT_IDS = new Set(["r19", "r20", "r21"]);
  const QH_CALC_FIELD_ROWS = [
    {
      label: "Ընդունվել է",
      cells: [
        { key: "qhIncomingSoldier", marker: "A", role: "input" },
        { key: "qhIncomingOfficer", marker: "B", role: "input" },
        { key: "qhIncomingContract", marker: "C", role: "input" }
      ]
    },
    {
      label: "Դուրս է գրվել",
      cells: [
        { key: "qhDischargedSoldier", marker: "D", role: "input" },
        { key: "qhDischargedOfficer", marker: "E", role: "input" },
        { key: "qhDischargedContract", marker: "F", role: "input" }
      ]
    },
    {
      label: "Եղել է",
      cells: [
        { key: "qhBaseSoldier", marker: "G", role: "input" },
        { key: "qhBaseOfficer", marker: "H", role: "input" },
        { key: "qhBaseContract", marker: "I", role: "input" }
      ]
    },
    {
      label: "Մնացել է",
      cells: [
        { key: "qhRemainingSoldier", marker: "J", role: "output" },
        { key: "qhRemainingOfficer", marker: "K", role: "output" },
        { key: "qhRemainingContract", marker: "L", role: "output" }
      ]
    }
  ];
  const QH_CALC_INPUT_KEYS = new Set([
    "qhIncomingSoldier",
    "qhIncomingOfficer",
    "qhIncomingContract",
    "qhDischargedSoldier",
    "qhDischargedOfficer",
    "qhDischargedContract"
  ]);
  const QH_CALC_OPTIONAL_INPUT_KEYS = new Set([
    "qhBaseSoldier",
    "qhBaseOfficer",
    "qhBaseContract"
  ]);
  const HOSPITAL_REPORT_PRIMARY_ITEMS = [
    { key: "beenTotal", cell: 1, label: "Հոսպիտալում եղել է" },
    { key: "admittedTotal", cell: 4, label: "Ընդունվել է" },
    { key: "dgTotal", cell: 7, label: "Դուրս է գրվել" },
    { key: "presentTotal", cell: 12, label: "Առկա է" },
    { divider: true, label: "Որից" },
    { key: "currentShar", cell: 13, label: "Ժամկետային զ/ծ" },
    { key: "currentSpa", cell: 14, label: "Սպա" },
    { key: "currentPaym", cell: 15, label: "Պայմանագր" },
    { key: "currentZh", cell: 16, label: "Զինհաշմանդամ" },
    { key: "family", cell: 17, label: "Զինծառայ․ընտ․անդ․" },
    { key: "officer", cell: 18, label: "Զինապարտ" },
    { key: "civil", cell: 19, label: "Քաղաքացի" },
    { divider: true, label: "Արձակուրդում առկա է", totalKey: "leaveTotal" },
    { key: "leaveSharq", cell: 20, label: "Ժամկետային զ/ծ" },
    { key: "leaveSpa", cell: 21, label: "Սպա" },
    { key: "leavePaym", cell: 22, label: "Պայմանագրային" }
  ];
  const HOSPITAL_REPORT_SPECIAL_GROUPS = [
    {
      rowId: "r19",
      title: "ԻՆֆ-ում առկա է",
      items: [
        { key: "presentTotal", cell: 12, label: "ԻՆֆ-ում առկա է" },
        { key: "currentShar", cell: 13, label: "Ժամկետային" },
        { key: "currentSpa", cell: 14, label: "Սպա" },
        { key: "currentPaym", cell: 15, label: "Պայմ" }
      ]
    },
    {
      rowId: "r21",
      title: "Քաղաքացիական  հիվանդան․ առկա է",
      items: [
        { key: "presentTotal", cell: 12, label: "Քաղաքացիական  հիվանդան․ առկա է" },
        { key: "currentShar", cell: 13, label: "Ժամկետային զ/ծ" },
        { key: "currentSpa", cell: 14, label: "Սպա" },
        { key: "currentPaym", cell: 15, label: "Պայմանագրային" }
      ]
    },
    {
      rowId: "r20",
      title: "ԱՏԴ-ում առկա է",
      items: [
        { key: "presentTotal", cell: 12, label: "ԱՏԴ-ում առկա է" },
        { key: "currentShar", cell: 13, label: "Ժամկետային" },
        { key: "currentSpa", cell: 14, label: "Սպա" },
        { key: "currentPaym", cell: 15, label: "Պայմանագրային" }
      ]
    }
  ];
  function resetQhCalcInputs(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.rows)) {
      return snapshot;
    }

    snapshot.rows.forEach((row) => {
      if (!isQhCalcDepartment(row) || !row.values || typeof row.values !== "object") {
        return;
      }
      QH_CALC_INPUT_KEYS.forEach((key) => {
        row.values[key] = 0;
      });
    });

    return snapshot;
  }

  function buildInitialPhotoImportState() {
    return {
      feedbackId: "",
      workflowStatus: "idle",
      imageName: "",
      imageDataUrl: "",
      recognizedValues: {},
      notes: [],
      cellReviews: [],
      structureOk: null,
      structureCellCount: null,
      structureMissingCells: [],
      structureReason: "",
      suspectKeys: [],
      suspectReason: "",
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

  function buildInitialPhotoLightboxState() {
    return {
      open: false,
      imageDataUrl: "",
      alt: "Фото бланка"
    };
  }

  function buildInitialFeedbackState() {
    return {
      records: [],
      isLoading: false,
      error: "",
      loaded: false
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
    photoLightbox: buildInitialPhotoLightboxState(),
    mainPhotoSaveDirectoryHandle: null,
    mainPhotoSaveDirectoryName: "",
    mainPhotoRoute: buildInitialMainPhotoRouteState(),
    feedback: buildInitialFeedbackState()
  };
  const autoRecognizedTelegramFeedbackIds = new Set();
  let printLinkHrefBackups = [];

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

  function shortenText(value, maxLength = 8) {
    const chars = Array.from(String(value ?? "").trim());
    return chars.length > maxLength ? chars.slice(0, maxLength).join("") : chars.join("");
  }

  function renderResponsiveDepartmentName(value) {
    return `<span class="dept-name-short">${escapeHtml(shortenText(value))}</span>`;
  }

  function translateOcrNote(note) {
    let text = String(note || "").trim();
    if (!text) {
      return "";
    }

    text = text
      .replace(
        /^Cell (\d+) is cut off at the far left in the filled crop and unreadable; cell 12 not returned\.?$/i,
        (_match, cell) => `Ячейка ${cell} обрезана слева на заполненном фрагменте и не читается; ячейка 12 не возвращается.`
      )
      .replace(
        /^Cell (\d+) is cut off at the far left and unreadable\.?$/i,
        (_match, cell) => `Ячейка ${cell} обрезана слева и не читается.`
      )
      .replace(
        /^Cell (\d+) appears blank in the provided crop; the visible (.+?) is read as cell (\d+), and cell 12 is ignored\.?$/i,
        (_match, cell, valueText, targetCell) => `Ячейка ${cell} выглядит пустой на вырезанном фрагменте; видимое значение ${String(valueText).trim()} читается как ячейка ${targetCell}, а ячейка 12 игнорируется.`
      )
      .replace(
        /^Cell (\d+) appears blank in the provided crop and unreadable\.?$/i,
        (_match, cell) => `Ячейка ${cell} выглядит пустой на вырезанном фрагменте и не читается.`
      )
      .replace(
        /^Cell (\d+) appears blank in the provided crop\.?$/i,
        (_match, cell) => `Ячейка ${cell} выглядит пустой на вырезанном фрагменте.`
      )
      .replace(
        /^Cell (\d+) is unreadable\.?$/i,
        (_match, cell) => `Ячейка ${cell} не читается.`
      )
      .replace(
        /^Cell (\d+) was not returned\.?$/i,
        (_match, cell) => `Ячейка ${cell} не возвращается.`
      )
      .replace(
        /^Cell (\d+) not returned\.?$/i,
        (_match, cell) => `Ячейка ${cell} не возвращается.`
      );

    text = text
      .replace(/cell 12 not returned/gi, "ячейка 12 не возвращается")
      .replace(/cell 12 is ignored/gi, "ячейка 12 игнорируется")
      .replace(/appears blank in the provided crop/gi, "выглядит пустой на вырезанном фрагменте")
      .replace(/is cut off at the far left/gi, "обрезана слева")
      .replace(/and unreadable/gi, "и не читается")
      .replace(/is unreadable/gi, "не читается")
      .replace(/not returned/gi, "не возвращается");

    return text;
  }

  function normalizeOcrNotes(notes) {
    if (!Array.isArray(notes)) {
      return [];
    }

    return notes
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => translateOcrNote(item))
      .filter(Boolean);
  }

  function hasRotatedTelegramPhotoHint(notes) {
    if (!Array.isArray(notes)) {
      return false;
    }

    return notes.some((item) => {
      const text = String(item || "").toLowerCase();
      return /\brotated\b/.test(text)
        || text.includes("перевер")
        || text.includes("повернут")
        || text.includes("повёрнут");
    });
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

  async function playPhotoReceivedSound() {
    const audioContext = await prepareUpdateAudioContext();
    if (!audioContext) {
      return false;
    }

    scheduleBellStrike(audioContext, audioContext.currentTime, 880, 0.095);
    return true;
  }

  async function playDepartmentDetectedSound() {
    const audioContext = await prepareUpdateAudioContext();
    if (!audioContext) {
      return false;
    }

    const now = audioContext.currentTime;
    scheduleBellStrike(audioContext, now, 987.77, 0.1);
    scheduleBellStrike(audioContext, now + 0.28, 1174.66, 0.095);
    return true;
  }

  function getPendingPhotoWorkflowSignature(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.rows)) {
      return "";
    }

    return snapshot.rows
      .filter((row) => row && row.photoWorkflowStatus === "pending" && row.photoFeedbackId)
      .map((row) => `${row.id}:${row.photoFeedbackId}:${row.photoFeedbackUpdatedAt || ""}`)
      .sort()
      .join("|");
  }

  function applyLoadedSnapshot(result) {
    state.snapshot = syncQhCalculatedTargets(primeQhBaseInputs(resetQhCalcInputs(deepCopy(result.snapshot))));
    state.loadedSnapshot = syncQhCalculatedTargets(primeQhBaseInputs(resetQhCalcInputs(deepCopy(result.snapshot))));
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

    return PHOTO_FIELD_DEFINITIONS.filter((item) => allowedKeys.has(item.key));
  }

  function getPhotoFieldMetaByKey(key) {
    return PHOTO_FIELD_DEFINITIONS.find((item) => item.key === key) || null;
  }

  function getPhotoFieldReviewStatus(key) {
    if (mode !== "department" || !state.photoImport) {
      return "";
    }

    const suspectKeys = new Set(Array.isArray(state.photoImport.suspectKeys) ? state.photoImport.suspectKeys : []);
    if (suspectKeys.has(key)) {
      return "suspect-cell";
    }

    const review = Array.isArray(state.photoImport.cellReviews)
      ? state.photoImport.cellReviews.find((item) => item && item.key === key)
      : null;
    if (review?.status === "review") {
      return "review-cell";
    }
    if (review?.status === "recognized") {
      return "recognized-cell";
    }

    const recognizedFields = new Set(state.photoImport.lastAppliedKeys || []);
    return recognizedFields.has(key) ? "recognized-cell" : "";
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
          reason: typeof item.reason === "string" ? translateOcrNote(item.reason) : "",
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

  const OCR_FOCUS_CROP = {
    leftRatio: 0.03,
    topRatio: 0.06,
    rightRatio: 0.03,
    bottomRatio: 0.60
  };

  const OCR_RIGHT_FOCUS_CROP = {
    leftRatio: 0.48,
    topRatio: 0.18,
    rightRatio: 0.0,
    bottomRatio: 0.58
  };

  const OCR_RIGHT_CELL_REGION = {
    startRatio: 0.08,
    endRatio: 0.98,
    totalCellSlots: 11,
    firstTargetSlotIndex: 0,
    targetCellCount: 11,
    innerXPaddingRatio: 0.08,
    topRatio: 0.12,
    bottomRatio: 0.90
  };

  const OCR_ALIGNMENT_ANALYSIS_MAX_WIDTH = 1200;
  const OCR_ALIGNMENT_MARKER_WINDOW_RATIO = 0.018;
  const OCR_ALIGNMENT_MARKER_INSET_RATIO = 0.35;
  const SR_BADGE_CORNER_WINDOWS = {
    topLeft: { leftRatio: 0.02, rightRatio: 0.20, topRatio: 0.01, bottomRatio: 0.14 },
    topRight: { leftRatio: 0.80, rightRatio: 0.98, topRatio: 0.01, bottomRatio: 0.14 },
    bottomLeft: { leftRatio: 0.02, rightRatio: 0.20, topRatio: 0.86, bottomRatio: 0.99 },
    bottomRight: { leftRatio: 0.80, rightRatio: 0.98, topRatio: 0.86, bottomRatio: 0.99 }
  };
  const OCR_TABLE_MARKER_WINDOWS = {
    upright: [
      { leftRatio: 0.04, rightRatio: 0.12, topRatio: 0.13, bottomRatio: 0.23 },
      { leftRatio: 0.035, rightRatio: 0.115, topRatio: 0.31, bottomRatio: 0.42 },
      { leftRatio: 0.92, rightRatio: 0.995, topRatio: 0.31, bottomRatio: 0.42 }
    ],
    inverted: [
      { leftRatio: 0.88, rightRatio: 0.96, topRatio: 0.77, bottomRatio: 0.87 },
      { leftRatio: 0.885, rightRatio: 0.965, topRatio: 0.58, bottomRatio: 0.69 },
      { leftRatio: 0.005, rightRatio: 0.08, topRatio: 0.58, bottomRatio: 0.69 }
    ]
  };
  const OCR_TOP_TABLE_BAND_CROP = {
    leftRatio: 0.06,
    rightRatio: 0.06,
    topRatio: 0.06,
    bottomRatio: 0.38
  };
  const OCR_BOTTOM_TABLE_BAND_CROP = {
    leftRatio: 0.06,
    rightRatio: 0.06,
    topRatio: 0.62,
    bottomRatio: 0.94
  };
  const OCR_ALIGNMENT_CORNER_WINDOWS = {
    topLeft: { leftRatio: 0.0, rightRatio: 0.18, topRatio: 0.18, bottomRatio: 0.52 },
    topRight: { leftRatio: 0.82, rightRatio: 1.0, topRatio: 0.18, bottomRatio: 0.52 },
    bottomLeft: { leftRatio: 0.0, rightRatio: 0.18, topRatio: 0.42, bottomRatio: 0.84 },
    bottomRight: { leftRatio: 0.82, rightRatio: 1.0, topRatio: 0.42, bottomRatio: 0.84 }
  };

  const OCR_ALIGNED_RIGHT_FOCUS_CROP = {
    leftRatio: 0.50,
    topRatio: 0.40,
    rightRatio: 0.0,
    bottomRatio: 0.98
  };

  const OCR_ALIGNED_RIGHT_CELL_REGION = {
    startRatio: 0.02,
    endRatio: 0.98,
    totalCellSlots: 11,
    firstTargetSlotIndex: 0,
    targetCellCount: 11,
    innerXPaddingRatio: 0.08,
    topRatio: 0.12,
    bottomRatio: 0.94
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function interpolatePoint(start, end, progress) {
    return {
      x: start.x + ((end.x - start.x) * progress),
      y: start.y + ((end.y - start.y) * progress)
    };
  }

  function measurePointDistance(first, second) {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    return Math.sqrt((dx * dx) + (dy * dy));
  }

  function shouldRotateImageToLandscape(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return false;
    }

    return height > width;
  }

  function buildRotatedCanvasFromImage(image, rotation) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const swapSides = normalizedRotation === 90 || normalizedRotation === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swapSides ? sourceHeight : sourceWidth;
    canvas.height = swapSides ? sourceWidth : sourceHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Браузер не поддерживает подготовку фото.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (normalizedRotation === 90) {
      context.translate(canvas.width, 0);
      context.rotate(Math.PI / 2);
      context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
    } else if (normalizedRotation === 180) {
      context.translate(canvas.width, canvas.height);
      context.rotate(Math.PI);
      context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
    } else if (normalizedRotation === 270) {
      context.translate(0, canvas.height);
      context.rotate(-Math.PI / 2);
      context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
    } else {
      context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
    }

    return canvas;
  }

  async function rotateImageDataUrl(sourceDataUrl, rotation = 90) {
    if (typeof sourceDataUrl !== "string" || !sourceDataUrl.startsWith("data:image/")) {
      throw new Error("Нужно подготовленное изображение для поворота.");
    }

    const image = await loadImageFromDataUrl(sourceDataUrl);
    const rotatedCanvas = buildRotatedCanvasFromImage(image, rotation);
    return rotatedCanvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
  }

  function measureCanvasRegionDarkness(imageData, left, top, width, height) {
    const { data } = imageData;
    const xStart = Math.max(0, Math.min(imageData.width - 1, Math.floor(left)));
    const yStart = Math.max(0, Math.min(imageData.height - 1, Math.floor(top)));
    const xEnd = Math.max(xStart + 1, Math.min(imageData.width, Math.ceil(left + width)));
    const yEnd = Math.max(yStart + 1, Math.min(imageData.height, Math.ceil(top + height)));
    let darkness = 0;

    for (let y = yStart; y < yEnd; y += 1) {
      for (let x = xStart; x < xEnd; x += 1) {
        const offset = ((y * imageData.width) + x) * 4;
        const alpha = data[offset + 3] / 255;
        if (alpha <= 0) {
          continue;
        }

        const luminance = ((data[offset] * 0.299) + (data[offset + 1] * 0.587) + (data[offset + 2] * 0.114)) / 255;
        darkness += (1 - luminance) * alpha;
      }
    }

    return darkness;
  }

  function measureCanvasRegionDarknessDensity(imageData, left, top, width, height) {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    return measureCanvasRegionDarkness(imageData, left, top, safeWidth, safeHeight) / (safeWidth * safeHeight);
  }

  function measureCanvasRegionEdgeDensity(imageData, left, top, width, height) {
    const xStart = Math.max(0, Math.min(imageData.width - 2, Math.floor(left)));
    const yStart = Math.max(0, Math.min(imageData.height - 2, Math.floor(top)));
    const xEnd = Math.max(xStart + 1, Math.min(imageData.width - 1, Math.ceil(left + width)));
    const yEnd = Math.max(yStart + 1, Math.min(imageData.height - 1, Math.ceil(top + height)));
    const data = imageData.data;
    let total = 0;
    let samples = 0;

    for (let y = yStart; y < yEnd; y += 1) {
      for (let x = xStart; x < xEnd; x += 1) {
        const offset = ((y * imageData.width) + x) * 4;
        const rightOffset = ((y * imageData.width) + Math.min(imageData.width - 1, x + 1)) * 4;
        const downOffset = (((Math.min(imageData.height - 1, y + 1)) * imageData.width) + x) * 4;
        const current = ((data[offset] * 0.299) + (data[offset + 1] * 0.587) + (data[offset + 2] * 0.114)) / 255;
        const right = ((data[rightOffset] * 0.299) + (data[rightOffset + 1] * 0.587) + (data[rightOffset + 2] * 0.114)) / 255;
        const down = ((data[downOffset] * 0.299) + (data[downOffset + 1] * 0.587) + (data[downOffset + 2] * 0.114)) / 255;
        total += Math.abs(current - right) + Math.abs(current - down);
        samples += 2;
      }
    }

    return samples > 0 ? total / samples : 0;
  }

  function scoreCanvasForTopTablePosition(imageData) {
    const topBounds = buildCropBounds(imageData.width, imageData.height, OCR_TOP_TABLE_BAND_CROP);
    const bottomBounds = buildCropBounds(imageData.width, imageData.height, OCR_BOTTOM_TABLE_BAND_CROP);
    const topDensity = measureCanvasRegionDarknessDensity(
      imageData,
      topBounds.left,
      topBounds.top,
      topBounds.width,
      topBounds.height
    );
    const bottomDensity = measureCanvasRegionDarknessDensity(
      imageData,
      bottomBounds.left,
      bottomBounds.top,
      bottomBounds.width,
      bottomBounds.height
    );
    const topEdgeDensity = measureCanvasRegionEdgeDensity(
      imageData,
      topBounds.left,
      topBounds.top,
      topBounds.width,
      topBounds.height
    );
    const bottomEdgeDensity = measureCanvasRegionEdgeDensity(
      imageData,
      bottomBounds.left,
      bottomBounds.top,
      bottomBounds.width,
      bottomBounds.height
    );

    return ((topDensity - bottomDensity) * 85000) + ((topEdgeDensity - bottomEdgeDensity) * 180000);
  }

  function buildActualRatioBounds(imageData, searchWindow) {
    return buildCropBounds(imageData.width, imageData.height, {
      leftRatio: searchWindow.leftRatio,
      rightRatio: 1 - searchWindow.rightRatio,
      topRatio: searchWindow.topRatio,
      bottomRatio: searchWindow.bottomRatio
    });
  }

  function scoreCanvasWindowFeature(imageData, searchWindow) {
    const bounds = buildActualRatioBounds(imageData, searchWindow);
    const darkness = measureCanvasRegionDarknessDensity(
      imageData,
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height
    );
    const edgeDensity = measureCanvasRegionEdgeDensity(
      imageData,
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height
    );

    return (edgeDensity * 1000) + (darkness * 180);
  }

  function scoreCanvasForExpectedTableMarkers(imageData) {
    const scoreMarkerSet = (windows) => windows.reduce(
      (sum, searchWindow) => sum + scoreCanvasWindowFeature(imageData, searchWindow),
      0
    ) / Math.max(1, windows.length);
    const uprightScore = scoreMarkerSet(OCR_TABLE_MARKER_WINDOWS.upright);
    const invertedScore = scoreMarkerSet(OCR_TABLE_MARKER_WINDOWS.inverted);

    return (uprightScore - invertedScore) * 900;
  }

  function detectSrBadgeCorner(imageData) {
    const candidates = Object.entries(SR_BADGE_CORNER_WINDOWS)
      .map(([corner, searchWindow]) => {
        return {
          corner,
          score: scoreCanvasWindowFeature(imageData, searchWindow)
        };
      })
      .filter(Boolean);

    if (!candidates.length) {
      return null;
    }

    candidates.sort((first, second) => second.score - first.score);
    const best = candidates[0];
    const second = candidates[1] || null;

    return {
      corner: best.corner,
      score: best.score,
      confidence: second ? (best.score / Math.max(0.001, second.score)) : 2
    };
  }

  function scoreCanvasForSrTopRight(canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return Number.NEGATIVE_INFINITY;
    }

    const width = canvas.width;
    const height = canvas.height;
    const imageData = context.getImageData(0, 0, width, height);
    const srWindowWidth = width * 0.16;
    const srWindowHeight = height * 0.18;
    const topInset = height * 0.02;
    const sideInset = width * 0.02;

    const topRightDarkness = measureCanvasRegionDarkness(
      imageData,
      width - srWindowWidth - sideInset,
      topInset,
      srWindowWidth,
      srWindowHeight
    );
    const topLeftDarkness = measureCanvasRegionDarkness(imageData, sideInset, topInset, srWindowWidth, srWindowHeight);
    const bottomLeftDarkness = measureCanvasRegionDarkness(
      imageData,
      sideInset,
      height - srWindowHeight - topInset,
      srWindowWidth,
      srWindowHeight
    );
    const bottomRightDarkness = measureCanvasRegionDarkness(
      imageData,
      width - srWindowWidth - sideInset,
      height - srWindowHeight - topInset,
      srWindowWidth,
      srWindowHeight
    );
    const landscapeBonus = width >= height ? 5000 : -5000;
    const topTablePositionScore = scoreCanvasForTopTablePosition(imageData);
    const tableMarkerScore = scoreCanvasForExpectedTableMarkers(imageData);
    const srBadge = detectSrBadgeCorner(imageData);
    const srBadgeCornerScore = srBadge
      ? ({
          topRight: 32000,
          topLeft: -12000,
          bottomRight: -22000,
          bottomLeft: -32000
        }[srBadge.corner] || 0) + Math.min(12000, Math.max(0, (srBadge.confidence - 1) * 14000))
      : 0;

    return (topRightDarkness * 4) - (topLeftDarkness * 1.5) - (bottomLeftDarkness * 3) - (bottomRightDarkness * 1.5) + landscapeBonus + topTablePositionScore + tableMarkerScore + srBadgeCornerScore;
  }

  function detectCanvasSrBadgeCorner(canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    return detectSrBadgeCorner(context.getImageData(0, 0, canvas.width, canvas.height));
  }

  function flipCanvasIfSrIsBottomLeft(canvas, rotation) {
    const srBadge = detectCanvasSrBadgeCorner(canvas);
    if (!srBadge || srBadge.corner !== "bottomLeft") {
      return { canvas, rotation };
    }

    return {
      canvas: buildRotatedCanvasFromImage(canvas, 180),
      rotation: (rotation + 180) % 360
    };
  }

  function buildPreparedPhotoResultFromCanvas(sourceCanvas, normalizedRotation) {
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(sourceCanvas.width, sourceCanvas.height));
    const width = Math.max(1, Math.round(sourceCanvas.width * scale));
    const height = Math.max(1, Math.round(sourceCanvas.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Браузер не поддерживает подготовку фото.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(sourceCanvas, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY),
      rotatedToLandscape: normalizedRotation !== 0,
      normalizedRotation
    };
  }

  async function normalizeImageDataUrl(sourceDataUrl) {
    if (!sourceDataUrl.startsWith("data:image/")) {
      throw new Error("Нужен файл изображения.");
    }

    const image = await loadImageFromDataUrl(sourceDataUrl);
    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;
    if (!originalWidth || !originalHeight) {
      throw new Error("Не удалось определить размер изображения.");
    }

    const candidateRotations = [0];
    let bestRotation = 0;
    let bestCanvas = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    candidateRotations.forEach((rotation) => {
      const candidateCanvas = buildRotatedCanvasFromImage(image, rotation);
      const score = scoreCanvasForSrTopRight(candidateCanvas);
      if (score > bestScore) {
        bestScore = score;
        bestRotation = rotation;
        bestCanvas = candidateCanvas;
      }
    });

    if (!bestCanvas) {
      throw new Error("Не удалось подготовить фото.");
    }

    return buildPreparedPhotoResultFromCanvas(bestCanvas, bestRotation);

  }

  async function normalizeTelegramFeedbackImageDataUrl(sourceDataUrl, notes) {
    void notes;
    return normalizeImageDataUrl(sourceDataUrl);
  }

  async function compressImageFile(file) {
    const sourceDataUrl = await readFileAsDataUrl(file);
    return normalizeImageDataUrl(sourceDataUrl);
  }

  function buildCropBounds(sourceWidth, sourceHeight, cropConfig) {
    const left = Math.max(0, Math.floor(sourceWidth * cropConfig.leftRatio));
    const top = Math.max(0, Math.floor(sourceHeight * cropConfig.topRatio));
    const right = Math.min(sourceWidth, Math.ceil(sourceWidth * (1 - cropConfig.rightRatio)));
    const bottom = Math.min(sourceHeight, Math.ceil(sourceHeight * cropConfig.bottomRatio));

    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top)
    };
  }

  function createCanvasFromImageCrop(image, cropConfig) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const bounds = buildCropBounds(sourceWidth, sourceHeight, cropConfig);
    const canvas = document.createElement("canvas");
    canvas.width = bounds.width;
    canvas.height = bounds.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Браузер не поддерживает подготовку OCR-изображения.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, bounds.width, bounds.height);
    context.drawImage(
      image,
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );

    return canvas;
  }

  function buildDarknessIntegral(imageData) {
    const { width, height, data } = imageData;
    const integral = new Float64Array((width + 1) * (height + 1));

    for (let y = 0; y < height; y += 1) {
      let rowSum = 0;
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = (y * width * 4) + (x * 4);
        const luminance = ((data[pixelIndex] * 299) + (data[pixelIndex + 1] * 587) + (data[pixelIndex + 2] * 114)) / 1000;
        rowSum += (255 - luminance);
        integral[((y + 1) * (width + 1)) + (x + 1)] = integral[(y * (width + 1)) + (x + 1)] + rowSum;
      }
    }

    return integral;
  }

  function sumIntegralRegion(integral, width, left, top, regionWidth, regionHeight) {
    const right = left + regionWidth;
    const bottom = top + regionHeight;
    return integral[(bottom * (width + 1)) + right]
      - integral[(top * (width + 1)) + right]
      - integral[(bottom * (width + 1)) + left]
      + integral[(top * (width + 1)) + left];
  }

  function findMarkerWindowCenter(integral, width, height, searchWindow, markerSize) {
    const startX = clamp(Math.floor(width * searchWindow.leftRatio), 0, Math.max(0, width - markerSize));
    const endX = clamp(Math.ceil(width * searchWindow.rightRatio) - markerSize, startX, Math.max(0, width - markerSize));
    const startY = clamp(Math.floor(height * searchWindow.topRatio), 0, Math.max(0, height - markerSize));
    const endY = clamp(Math.ceil(height * searchWindow.bottomRatio) - markerSize, startY, Math.max(0, height - markerSize));
    let best = null;

    for (let y = startY; y <= endY; y += 2) {
      for (let x = startX; x <= endX; x += 2) {
        const darkness = sumIntegralRegion(integral, width, x, y, markerSize, markerSize) / (markerSize * markerSize);
        if (!best || darkness > best.darkness) {
          best = {
            x: x + (markerSize / 2),
            y: y + (markerSize / 2),
            darkness
          };
        }
      }
    }

    if (!best || best.darkness < 45) {
      return null;
    }

    return best;
  }

  function sampleBilinearRgba(data, width, height, x, y) {
    const clampedX = clamp(x, 0, Math.max(0, width - 1));
    const clampedY = clamp(y, 0, Math.max(0, height - 1));
    const x0 = Math.floor(clampedX);
    const y0 = Math.floor(clampedY);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const tx = clampedX - x0;
    const ty = clampedY - y0;
    const index00 = (y0 * width * 4) + (x0 * 4);
    const index10 = (y0 * width * 4) + (x1 * 4);
    const index01 = (y1 * width * 4) + (x0 * 4);
    const index11 = (y1 * width * 4) + (x1 * 4);
    const rgba = [0, 0, 0, 0];

    for (let channel = 0; channel < 4; channel += 1) {
      const topValue = (data[index00 + channel] * (1 - tx)) + (data[index10 + channel] * tx);
      const bottomValue = (data[index01 + channel] * (1 - tx)) + (data[index11 + channel] * tx);
      rgba[channel] = Math.round((topValue * (1 - ty)) + (bottomValue * ty));
    }

    return rgba;
  }

  function warpQuadCanvas(sourceCanvas, corners) {
    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;
    const topEdgeLength = measurePointDistance(corners.topLeft, corners.topRight);
    const bottomEdgeLength = measurePointDistance(corners.bottomLeft, corners.bottomRight);
    const leftEdgeLength = measurePointDistance(corners.topLeft, corners.bottomLeft);
    const rightEdgeLength = measurePointDistance(corners.topRight, corners.bottomRight);
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(topEdgeLength, bottomEdgeLength, leftEdgeLength, rightEdgeLength));
    const destinationWidth = Math.max(1, Math.round(((topEdgeLength + bottomEdgeLength) / 2) * scale));
    const destinationHeight = Math.max(1, Math.round(((leftEdgeLength + rightEdgeLength) / 2) * scale));
    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) {
      throw new Error("Браузер не поддерживает подготовку OCR-изображения.");
    }

    const sourceImageData = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight);
    const destinationCanvas = document.createElement("canvas");
    destinationCanvas.width = destinationWidth;
    destinationCanvas.height = destinationHeight;
    const destinationContext = destinationCanvas.getContext("2d");
    if (!destinationContext) {
      throw new Error("Браузер не поддерживает подготовку OCR-изображения.");
    }

    const destinationImageData = destinationContext.createImageData(destinationWidth, destinationHeight);

    for (let y = 0; y < destinationHeight; y += 1) {
      const verticalProgress = destinationHeight > 1 ? y / (destinationHeight - 1) : 0;
      const leftPoint = interpolatePoint(corners.topLeft, corners.bottomLeft, verticalProgress);
      const rightPoint = interpolatePoint(corners.topRight, corners.bottomRight, verticalProgress);

      for (let x = 0; x < destinationWidth; x += 1) {
        const horizontalProgress = destinationWidth > 1 ? x / (destinationWidth - 1) : 0;
        const sourcePoint = interpolatePoint(leftPoint, rightPoint, horizontalProgress);
        const rgba = sampleBilinearRgba(sourceImageData.data, sourceWidth, sourceHeight, sourcePoint.x, sourcePoint.y);
        const destinationIndex = (y * destinationWidth * 4) + (x * 4);
        destinationImageData.data[destinationIndex] = rgba[0];
        destinationImageData.data[destinationIndex + 1] = rgba[1];
        destinationImageData.data[destinationIndex + 2] = rgba[2];
        destinationImageData.data[destinationIndex + 3] = rgba[3];
      }
    }

    destinationContext.putImageData(destinationImageData, 0, 0);
    return destinationCanvas;
  }

  async function buildAlignedTableImageDataUrl(sourceDataUrl) {
    if (typeof sourceDataUrl !== "string" || !sourceDataUrl.startsWith("data:image/")) {
      throw new Error("Нужен файл изображения.");
    }

    const image = await loadImageFromDataUrl(sourceDataUrl);
    const sourceCropCanvas = createCanvasFromImageCrop(image, OCR_FOCUS_CROP);
    const analysisScale = Math.min(1, OCR_ALIGNMENT_ANALYSIS_MAX_WIDTH / sourceCropCanvas.width);
    const analysisWidth = Math.max(1, Math.round(sourceCropCanvas.width * analysisScale));
    const analysisHeight = Math.max(1, Math.round(sourceCropCanvas.height * analysisScale));
    const analysisCanvas = document.createElement("canvas");
    analysisCanvas.width = analysisWidth;
    analysisCanvas.height = analysisHeight;
    const analysisContext = analysisCanvas.getContext("2d");
    if (!analysisContext) {
      throw new Error("Браузер не поддерживает подготовку OCR-изображения.");
    }

    analysisContext.fillStyle = "#ffffff";
    analysisContext.fillRect(0, 0, analysisWidth, analysisHeight);
    analysisContext.drawImage(sourceCropCanvas, 0, 0, analysisWidth, analysisHeight);

    const analysisImageData = analysisContext.getImageData(0, 0, analysisWidth, analysisHeight);
    const integral = buildDarknessIntegral(analysisImageData);
    const markerSize = clamp(Math.round(analysisWidth * OCR_ALIGNMENT_MARKER_WINDOW_RATIO), 12, 28);
    const topLeftMarker = findMarkerWindowCenter(integral, analysisWidth, analysisHeight, OCR_ALIGNMENT_CORNER_WINDOWS.topLeft, markerSize);
    const topRightMarker = findMarkerWindowCenter(integral, analysisWidth, analysisHeight, OCR_ALIGNMENT_CORNER_WINDOWS.topRight, markerSize);
    const bottomLeftMarker = findMarkerWindowCenter(integral, analysisWidth, analysisHeight, OCR_ALIGNMENT_CORNER_WINDOWS.bottomLeft, markerSize);
    const bottomRightMarker = findMarkerWindowCenter(integral, analysisWidth, analysisHeight, OCR_ALIGNMENT_CORNER_WINDOWS.bottomRight, markerSize);

    if (!topLeftMarker || !topRightMarker || !bottomLeftMarker || !bottomRightMarker) {
      return null;
    }

    const inverseScale = 1 / analysisScale;
    const markerInset = (markerSize * inverseScale) * OCR_ALIGNMENT_MARKER_INSET_RATIO;
    const corners = {
      topLeft: { x: (topLeftMarker.x * inverseScale) + markerInset, y: (topLeftMarker.y * inverseScale) + markerInset },
      topRight: { x: (topRightMarker.x * inverseScale) - markerInset, y: (topRightMarker.y * inverseScale) + markerInset },
      bottomLeft: { x: (bottomLeftMarker.x * inverseScale) + markerInset, y: (bottomLeftMarker.y * inverseScale) - markerInset },
      bottomRight: { x: (bottomRightMarker.x * inverseScale) - markerInset, y: (bottomRightMarker.y * inverseScale) - markerInset }
    };

    const alignedCanvas = warpQuadCanvas(sourceCropCanvas, corners);
    return alignedCanvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
  }

  async function buildAlignedRightOcrArtifacts(sourceDataUrl) {
    const alignedTableDataUrl = await buildAlignedTableImageDataUrl(sourceDataUrl);
    if (!alignedTableDataUrl) {
      return null;
    }

    return {
      rightCropDataUrl: await buildCroppedImageDataUrl(alignedTableDataUrl, OCR_ALIGNED_RIGHT_FOCUS_CROP),
      rightCellCropDataUrls: await buildRightCellCropDataUrls(
        alignedTableDataUrl,
        OCR_ALIGNED_RIGHT_FOCUS_CROP,
        OCR_ALIGNED_RIGHT_CELL_REGION
      )
    };
  }

  async function buildFocusedOcrImageDataUrl(sourceDataUrl) {
    if (typeof sourceDataUrl !== "string" || !sourceDataUrl.startsWith("data:image/")) {
      throw new Error("Нужен файл изображения.");
    }

    const image = await loadImageFromDataUrl(sourceDataUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error("Не удалось определить размер изображения для OCR.");
    }

    const bounds = buildCropBounds(sourceWidth, sourceHeight, OCR_FOCUS_CROP);
    const cropWidth = bounds.width;
    const cropHeight = bounds.height;

    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(cropWidth, cropHeight));
    const width = Math.max(1, Math.round(cropWidth * scale));
    const height = Math.max(1, Math.round(cropHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Браузер не поддерживает подготовку OCR-изображения.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(
      image,
      bounds.left,
      bounds.top,
      cropWidth,
      cropHeight,
      0,
      0,
      width,
      height
    );

    return canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
  }

  async function buildCroppedImageDataUrl(sourceDataUrl, cropConfig) {
    if (typeof sourceDataUrl !== "string" || !sourceDataUrl.startsWith("data:image/")) {
      throw new Error("Нужен файл изображения.");
    }

    const image = await loadImageFromDataUrl(sourceDataUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error("Не удалось определить размер изображения для OCR.");
    }

    const bounds = buildCropBounds(sourceWidth, sourceHeight, cropConfig);
    const cropWidth = bounds.width;
    const cropHeight = bounds.height;

    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(cropWidth, cropHeight));
    const width = Math.max(1, Math.round(cropWidth * scale));
    const height = Math.max(1, Math.round(cropHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Браузер не поддерживает подготовку OCR-изображения.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(
      image,
      bounds.left,
      bounds.top,
      cropWidth,
      cropHeight,
      0,
      0,
      width,
      height
    );

    return canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
  }

  async function buildRightCellCropDataUrls(sourceDataUrl, cropConfig = OCR_RIGHT_FOCUS_CROP, regionConfig = OCR_RIGHT_CELL_REGION) {
    const rightCropDataUrl = await buildCroppedImageDataUrl(sourceDataUrl, cropConfig);
    const image = await loadImageFromDataUrl(rightCropDataUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error("Не удалось определить размер правого OCR-фрагмента.");
    }

    const {
      startRatio,
      endRatio,
      totalCellSlots,
      firstTargetSlotIndex,
      targetCellCount,
      topRatio,
      bottomRatio,
      innerXPaddingRatio
    } = regionConfig;

    const regionLeft = Math.max(0, Math.floor(sourceWidth * startRatio));
    const regionRight = Math.min(sourceWidth, Math.ceil(sourceWidth * endRatio));
    const regionWidth = Math.max(1, regionRight - regionLeft);
    const slotWidth = regionWidth / totalCellSlots;
    const padX = slotWidth * innerXPaddingRatio;
    const cropTop = Math.max(0, Math.floor(sourceHeight * topRatio));
    const cropBottom = Math.min(sourceHeight, Math.ceil(sourceHeight * bottomRatio));
    const cropHeight = Math.max(1, cropBottom - cropTop);

    const items = [];

    for (let offset = 0; offset < targetCellCount; offset += 1) {
      const slotIndex = firstTargetSlotIndex + offset;
      const slotLeft = regionLeft + (slotIndex * slotWidth);
      const slotRight = regionLeft + ((slotIndex + 1) * slotWidth);
      const isLastTargetCell = offset === (targetCellCount - 1);
      const leftPad = padX;
      const rightPad = isLastTargetCell ? (padX * 0.2) : padX;
      const cropLeft = Math.max(0, Math.floor(slotLeft + leftPad));
      const cropRight = Math.min(sourceWidth, Math.ceil(slotRight - rightPad));
      const cropWidth = Math.max(1, cropRight - cropLeft);

      const canvas = document.createElement("canvas");
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Браузер не поддерживает подготовку OCR-ячейки.");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, cropWidth, cropHeight);
      context.drawImage(
        image,
        cropLeft,
        cropTop,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );

      items.push(canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY));
    }

    return items;
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

  async function loadFeedbackRecords(showLoading = true) {
    if (mode !== "feedback") {
      return;
    }

    if (!sync.hasRemoteSync() || typeof sync.listOcrFeedback !== "function") {
      state.feedback.records = [];
      state.feedback.loaded = true;
      state.feedback.error = "Журнал OCR feedback доступен только в онлайн-режиме владельца.";
      state.feedback.isLoading = false;
      return;
    }

    if (showLoading) {
      state.feedback.isLoading = true;
      state.feedback.error = "";
    }

    try {
      const loadedRecords = await sync.listOcrFeedback(120);
      state.feedback.records = Array.isArray(loadedRecords)
        ? loadedRecords.map((record) => {
          if (!record || typeof record !== "object") {
            return record;
          }

          return {
            ...record,
            notes: normalizeOcrNotes(record.notes)
          };
        })
        : [];
      state.feedback.loaded = true;
      state.feedback.error = "";
    } catch (error) {
      state.feedback.records = [];
      state.feedback.loaded = true;
      state.feedback.error = error instanceof Error ? error.message : "Не удалось загрузить OCR feedback.";
    } finally {
      state.feedback.isLoading = false;
    }
  }

  function normalizePendingMainPhotoRouteItem(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const departmentId = typeof payload.departmentId === "string" ? payload.departmentId.trim() : "";
    const imageName = typeof payload.imageName === "string" ? payload.imageName.trim() : "";
    const imageDataUrl = typeof payload.imageDataUrl === "string" ? payload.imageDataUrl : "";
    const detectedBy = typeof payload.detectedBy === "string" ? payload.detectedBy.trim() : "";
    const notes = normalizeOcrNotes(payload.notes);

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

  function buildMainPhotoRouteTransferStorageKey(transferId) {
    return `${MAIN_PHOTO_ROUTE_TRANSFER_STORAGE_PREFIX}${transferId}`;
  }

  function storePendingMainPhotoRouteTransfer(payload) {
    const normalized = normalizePendingMainPhotoRouteItem(payload);
    if (!normalized) {
      return "";
    }

    const transferId = `route-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(
        buildMainPhotoRouteTransferStorageKey(transferId),
        JSON.stringify({
          createdAt: Date.now(),
          item: normalized
        })
      );
      return transferId;
    } catch (_error) {
      return "";
    }
  }

  function takePendingMainPhotoRouteTransfer(transferId, departmentIdToMatch) {
    if (!transferId) {
      return null;
    }

    const storageKey = buildMainPhotoRouteTransferStorageKey(transferId);
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }

      localStorage.removeItem(storageKey);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      const createdAt = Number(parsed.createdAt || 0);
      if (!Number.isFinite(createdAt) || (Date.now() - createdAt) > MAIN_PHOTO_ROUTE_MAX_AGE_MS) {
        return null;
      }

      const normalized = normalizePendingMainPhotoRouteItem(parsed.item);
      if (!normalized || normalized.departmentId !== departmentIdToMatch) {
        return null;
      }

      return normalized;
    } catch (_error) {
      try {
        localStorage.removeItem(storageKey);
      } catch (_removeError) {
      }
      return null;
    }
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

  function getDepartmentPhotoWorkflowMeta(row) {
    if (!row) {
      return {
        tone: "neutral",
        label: "Без нового бланка"
      };
    }

    if (row.photoWorkflowStatus === "pending" && row.photoFeedbackId) {
      const isTelegramForm = row.photoName === "telegram-web-app-form";
      return {
        tone: "pending",
        label: isTelegramForm ? "Новая Telegram форма" : "Новый бланк"
      };
    }

    const freshness = getRowFreshnessMeta(row);
    if (row.photoWorkflowStatus === "processed" && row.photoFeedbackId && freshness.level !== "stale" && freshness.level !== "missing") {
      return {
        tone: "processed",
        label: "Проверено"
      };
    }

    return {
      tone: "neutral",
      label: "Без нового бланка"
    };
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

  function getRowDisplayValue(snapshot, row, key) {
    if (key === "presentTotal") {
      return getDisplayValue(calcPresentTotal(snapshot, row));
    }
    if (key === "leaveTotal") {
      const value = calcLeaveTotal(snapshot, row);
      return value === null ? "" : getDisplayValue(value);
    }
    return getDisplayValue(getEffectiveValue(snapshot, row, key));
  }

  function isQhCalcDepartment(row) {
    return Boolean(row && QH_CALC_DEPARTMENT_IDS.has(row.id));
  }

  function getQhCalcSourceValue(row, key, snapshot = state.snapshot) {
    if (!row) {
      return null;
    }
    return config.normalizeCellValue(getEffectiveValue(snapshot, row, key));
  }

  function calcQhRemainingValue(row, type, snapshot = state.snapshot) {
    if (!row) {
      return null;
    }

    const keyMap = {
      soldier: {
        previous: "qhBaseSoldier",
        incoming: "qhIncomingSoldier",
        discharged: "qhDischargedSoldier"
      },
      officer: {
        previous: "qhBaseOfficer",
        incoming: "qhIncomingOfficer",
        discharged: "qhDischargedOfficer"
      },
      contract: {
        previous: "qhBaseContract",
        incoming: "qhIncomingContract",
        discharged: "qhDischargedContract"
      }
    };

    const source = keyMap[type];
    if (!source) {
      return null;
    }

    const previous = getQhCalcSourceValue(row, source.previous, snapshot);
    const incoming = getQhCalcSourceValue(row, source.incoming, snapshot);
    const discharged = getQhCalcSourceValue(row, source.discharged, snapshot);

    if (previous === null && incoming === null && discharged === null) {
      return null;
    }

    return (previous || 0) + (incoming || 0) - (discharged || 0);
  }

  function primeQhBaseInputs(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.rows)) {
      return snapshot;
    }

    snapshot.rows.forEach((row) => {
      if (!isQhCalcDepartment(row) || !row.values || typeof row.values !== "object") {
        return;
      }

      const hasBaseValues =
        (row.values.qhBaseSoldier || 0) !== 0
        || (row.values.qhBaseOfficer || 0) !== 0
        || (row.values.qhBaseContract || 0) !== 0;
      const hasCurrentValues =
        (row.values.currentShar || 0) !== 0
        || (row.values.currentSpa || 0) !== 0
        || (row.values.currentPaym || 0) !== 0;

      if (!hasBaseValues && hasCurrentValues) {
        row.values.qhBaseSoldier = row.values.currentShar || 0;
        row.values.qhBaseOfficer = row.values.currentSpa || 0;
        row.values.qhBaseContract = row.values.currentPaym || 0;
      }
    });

    return snapshot;
  }

  function syncQhCalculatedTargets(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.rows)) {
      return snapshot;
    }

    snapshot.rows.forEach((row) => {
      if (!isQhCalcDepartment(row) || !row.values || typeof row.values !== "object") {
        return;
      }

      row.values.currentShar = calcQhRemainingValue(row, "soldier", snapshot) || 0;
      row.values.currentSpa = calcQhRemainingValue(row, "officer", snapshot) || 0;
      row.values.currentPaym = calcQhRemainingValue(row, "contract", snapshot) || 0;
    });

    return snapshot;
  }

  function getQhCalcDisplayValue(row, key) {
    if (!row) {
      return "";
    }

    if (key === "qhRemainingSoldier") {
      return getDisplayValue(calcQhRemainingValue(row, "soldier"));
    }
    if (key === "qhRemainingOfficer") {
      return getDisplayValue(calcQhRemainingValue(row, "officer"));
    }
    if (key === "qhRemainingContract") {
      return getDisplayValue(calcQhRemainingValue(row, "contract"));
    }

    const value = getQhCalcSourceValue(row, key);
    if ((QH_CALC_INPUT_KEYS.has(key) || QH_CALC_OPTIONAL_INPUT_KEYS.has(key))
      && (value === null || value === "" || typeof value === "undefined")) {
      return "0";
    }
    return getDisplayValue(value);
  }

  function syncDepartmentRowInput(rowId, key, value) {
    const input = document.querySelector(`input[data-row="${rowId}"][data-key="${key}"]`);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    input.value = value === null || value === "" || typeof value === "undefined" ? "0" : String(value);
  }

  function refreshQhCalcDisplay(row) {
    if (!row || !isQhCalcDepartment(row)) {
      return;
    }

    [
      "currentShar",
      "currentSpa",
      "currentPaym",
      "qhRemainingSoldier",
      "qhRemainingOfficer",
      "qhRemainingContract"
    ].forEach((key) => {
      document.querySelectorAll(`[data-qh-output="${key}"]`).forEach((element) => {
        element.textContent = getQhCalcDisplayValue(row, key);
      });
    });
  }

  function applyQhCalcToDepartment() {
    const row = getCurrentRow();
    if (!row || !isQhCalcDepartment(row)) {
      return;
    }

    const originalCell12 = calcPresentTotal(state.snapshot, row) || 0;
    const originalCell13 = getNumber(state.snapshot, row, "currentShar") || 0;
    const originalCell14 = getNumber(state.snapshot, row, "currentSpa") || 0;
    const originalCell15 = getNumber(state.snapshot, row, "currentPaym") || 0;

    const incomingSoldier = getQhCalcSourceValue(row, "qhIncomingSoldier") || 0;
    const incomingOfficer = getQhCalcSourceValue(row, "qhIncomingOfficer") || 0;
    const incomingContract = getQhCalcSourceValue(row, "qhIncomingContract") || 0;
    const dischargedSoldier = getQhCalcSourceValue(row, "qhDischargedSoldier") || 0;
    const dischargedOfficer = getQhCalcSourceValue(row, "qhDischargedOfficer") || 0;
    const dischargedContract = getQhCalcSourceValue(row, "qhDischargedContract") || 0;

    const cell4 = incomingSoldier + incomingOfficer + incomingContract;
    const cell5 = incomingSoldier + incomingOfficer + incomingContract;
    const cell6 = incomingSoldier;
    const cell7 = dischargedSoldier + dischargedOfficer + dischargedContract;
    const cell8 = dischargedSoldier + dischargedOfficer + dischargedContract;
    const cell9 = dischargedSoldier;
    const cell13 = calcQhRemainingValue(row, "soldier") || 0;
    const cell14 = calcQhRemainingValue(row, "officer") || 0;
    const cell15 = calcQhRemainingValue(row, "contract") || 0;

    row.values.currentShar = cell13;
    row.values.currentSpa = cell14;
    row.values.currentPaym = cell15;

    row.values.beenTotal = originalCell12;
    row.values.beenSoldier = originalCell13 + originalCell14 + originalCell15;
    row.values.beenSeries = originalCell13;
    row.values.admittedTotal = cell4;
    row.values.admittedSoldier = cell5;
    row.values.admittedSeries = cell6;
    row.values.dgTotal = cell7;
    row.values.dgSoldier = cell8;
    row.values.dgSeries = cell9;

    [
      ["beenTotal", row.values.beenTotal],
      ["beenSoldier", row.values.beenSoldier],
      ["beenSeries", row.values.beenSeries],
      ["admittedTotal", row.values.admittedTotal],
      ["admittedSoldier", row.values.admittedSoldier],
      ["admittedSeries", row.values.admittedSeries],
      ["dgTotal", row.values.dgTotal],
      ["dgSoldier", row.values.dgSoldier],
      ["dgSeries", row.values.dgSeries],
      ["currentShar", row.values.currentShar],
      ["currentSpa", row.values.currentSpa],
      ["currentPaym", row.values.currentPaym]
    ].forEach(([key, value]) => {
      syncDepartmentRowInput(row.id, key, value);
    });

    row.values.qhIncomingSoldier = 0;
    row.values.qhIncomingOfficer = 0;
    row.values.qhIncomingContract = 0;
    row.values.qhDischargedSoldier = 0;
    row.values.qhDischargedOfficer = 0;
    row.values.qhDischargedContract = 0;

    refreshTableData();
    queueDepartmentSave();
    setInfo("Հաշվարկային աղյուսակի արժեքները տեղափոխվել են հիմնական բջիջներ, իսկ A-F մուտքային դաշտերը զրոյացվել են։ Ուղարկելու համար սեղմեք «Պահպանել»։", false);
  }

  function getPhotoPreviewValue(row, key) {
    if (!row || !state.photoImport || !state.photoImport.recognizedValues || typeof state.photoImport.recognizedValues !== "object") {
      return "";
    }
    return Object.prototype.hasOwnProperty.call(state.photoImport.recognizedValues, key)
      ? state.photoImport.recognizedValues[key]
      : "";
  }

  function buildPhotoPreviewValuesFromRecord(record) {
    const recognizedSource = record && record.recognizedValues && typeof record.recognizedValues === "object"
      ? record.recognizedValues
      : null;
    const finalSource = record && record.finalValues && typeof record.finalValues === "object"
      ? record.finalValues
      : null;
    const output = {};
    if (!recognizedSource && !finalSource) {
      return output;
    }

    PHOTO_FIELD_DEFINITIONS.forEach((field) => {
      if (recognizedSource && Object.prototype.hasOwnProperty.call(recognizedSource, field.key)) {
        output[field.key] = config.normalizeCellValue(recognizedSource[field.key]);
      }
      if (finalSource && Object.prototype.hasOwnProperty.call(finalSource, field.key)) {
        output[field.key] = config.normalizeCellValue(finalSource[field.key]);
      }
    });

    return output;
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

  function getPhotoImportSuspectDetails(row, recognizedKeys) {
    if (!row || !hasDepartmentSaveRule(row)) {
      return {
        suspectKeys: [],
        suspectReason: ""
      };
    }

    const validation = getDepartmentValidationState();
    if (!validation.applicable || validation.isValid) {
      return {
        suspectKeys: [],
        suspectReason: ""
      };
    }

    const photoBlockFields = PHOTO_FIELD_DEFINITIONS
      .filter((item) => item.cell >= 13 && item.cell <= 22)
      .map((item) => item.key);
    const activeBlockKeys = photoBlockFields.filter((key) => getNumber(state.snapshot, row, key) !== 0);
    const reviewBlockKeys = Array.isArray(state.photoImport?.cellReviews)
      ? state.photoImport.cellReviews
        .filter((item) => item && item.status === "review" && photoBlockFields.includes(item.key))
        .map((item) => item.key)
      : [];
    const recognizedInBlock = photoBlockFields.filter((key) => recognizedKeys.has(key));
    const suspectKeys = activeBlockKeys.length
      ? activeBlockKeys
      : (reviewBlockKeys.length
        ? reviewBlockKeys
        : (recognizedInBlock.length ? recognizedInBlock : photoBlockFields));
    const labels = suspectKeys
      .map((key) => getPhotoFieldMetaByKey(key))
      .filter(Boolean)
      .map((item) => item.label);
    const suspectReason = labels.length
      ? `Формула не сошлась. Проверьте ячейки ${labels.join(", ")}.`
      : "Формула не сошлась. Проверьте блок ячеек 13-22.";

    return {
      suspectKeys,
      suspectReason
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
    const ignoredKeys = isQhCalcDepartment(savedRow)
      ? new Set(["qhBaseSoldier", "qhBaseOfficer", "qhBaseContract"])
      : null;

    for (const key of config.valueKeys) {
      if (ignoredKeys?.has(key)) {
        continue;
      }
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
    const classes = [
      getCellClasses(key, row, "detail"),
      getPhotoFieldReviewStatus(key)
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
        <td class="dept-cell" title="${escapeHtml(row.department)}">${renderResponsiveDepartmentName(row.department)}</td>
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
    const photoWorkflow = getDepartmentPhotoWorkflowMeta(row);
    const relativePath = appendShareQuery(config.getDepartmentPagePath(basePath, definition.id));
    const feedbackPath = row && row.photoFeedbackId
      ? appendQueryParams(config.getDepartmentPagePath(basePath, definition.id), { tgFeedback: row.photoFeedbackId })
      : "";
    return `
      <div class="link-card" data-department-open-card="${definition.id}" data-workflow-tone="${photoWorkflow.tone}" title="${escapeHtml(photoWorkflow.label)}">
        <strong>${escapeHtml(definition.department)}</strong>
        <div class="link-card-meta">
          <span class="status-chip status-chip--${freshness.level}" data-department-status="${definition.id}">${escapeHtml(freshness.label)}</span>
          <span class="link-card-time" data-department-updated="${definition.id}">${escapeHtml(freshness.timestamp)}</span>
        </div>
        <p class="link-card-subtext" data-department-age="${definition.id}">${escapeHtml(freshness.age)}</p>
        <div class="link-card-actions">
          <a href="${escapeHtml(relativePath)}" target="_blank" rel="noopener">Открыть</a>
          <a href="${escapeHtml(feedbackPath || relativePath)}" target="_blank" rel="noopener" data-department-feedback-link="${definition.id}"${feedbackPath ? "" : " hidden"}>Открыть отправленное</a>
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

  function appendQueryParams(path, params) {
    const url = new URL(appendShareQuery(path), window.location.href);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
    return url.toString();
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

  function getFeedbackPath() {
    return appendShareQuery(config.getFeedbackPagePath(basePath));
  }

  function getHospitalReportPath() {
    if (basePath === "@site") {
      return appendShareQuery(`${window.location.origin}/functions/v1/site?path=${encodeURIComponent(HOSPITAL_REPORT_FILENAME)}`);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return appendShareQuery(`${prefix}${HOSPITAL_REPORT_FILENAME}`);
  }

  function getNightShiftPath() {
    if (basePath === "@site") {
      return appendShareQuery(`${window.location.origin}/functions/v1/site?path=${encodeURIComponent(NIGHT_SHIFT_FILENAME)}&view=night`);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return appendShareQuery(`${prefix}${NIGHT_SHIFT_FILENAME}?view=night`);
  }

  function getDayShiftPath() {
    if (basePath === "@site") {
      return appendShareQuery(`${window.location.origin}/functions/v1/site?path=${encodeURIComponent(DAY_SHIFT_FILENAME)}&view=day`);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return appendShareQuery(`${prefix}${DAY_SHIFT_FILENAME}?view=day`);
  }

  function buildHospitalReportData(snapshot) {
    const primaryRows = snapshot.rows.filter((row) => row.group === "primary");
    const subtotal = (key) => getSummaryValue(snapshot, primaryRows, key);
    const currentDateTime = getHeaderDateTimeParts(snapshot.reportDate) || getCurrentDateTimeParts();

    return {
      reportDate: currentDateTime.full,
      updatedAt: snapshot.updatedAt,
      primaryItems: HOSPITAL_REPORT_PRIMARY_ITEMS.map((item) => {
        if (item.divider) {
          return {
            divider: true,
            label: item.label,
            totalValue: item.totalKey ? subtotal(item.totalKey) : null
          };
        }
        return {
          cell: item.cell,
          label: item.label,
          value: subtotal(item.key)
        };
      }),
      specialGroups: HOSPITAL_REPORT_SPECIAL_GROUPS.map((group) => {
        const row = getDepartmentRow(snapshot, group.rowId);
        return {
          title: group.title,
          department: row ? row.department : group.title,
          items: group.items.map((item) => ({
            cell: item.cell,
            label: item.label,
            value: row ? getRowDisplayValue(snapshot, row, item.key) : 0
          }))
        };
      })
    };
  }

  function renderHospitalReportPrimaryItems(items) {
    return items.map((item) => {
      if (item.divider) {
        return `
          <div class="hospital-report-divider">
            <div class="hospital-report-divider-title">${escapeHtml(item.label)}</div>
            <div class="hospital-report-divider-total">
              <strong>${escapeHtml(String(item.totalValue || 0))}</strong>
            </div>
          </div>
        `;
      }

      return `
        <div class="hospital-report-row">
          <div class="hospital-report-row-label">
            <span class="hospital-report-cellno">${escapeHtml(String(item.cell))}</span>
            <span>${escapeHtml(item.label)}</span>
          </div>
          <strong class="hospital-report-row-value">${escapeHtml(String(item.value || 0))}</strong>
        </div>
      `;
    }).join("");
  }

  function renderHospitalReportGroup(group) {
    return `
      <section class="hospital-report-card hospital-report-card--accent">
        <div class="hospital-report-card-head">
          <h2>${escapeHtml(group.title)}</h2>
          <span class="hospital-report-mini-pill">${escapeHtml(group.department)}</span>
        </div>
        <div class="hospital-report-rows">
          ${group.items.map((item) => `
            <div class="hospital-report-row hospital-report-row--compact">
              <div class="hospital-report-row-label">
                <span class="hospital-report-cellno">${escapeHtml(String(item.cell))}</span>
                <span>${escapeHtml(item.label)}</span>
              </div>
              <strong class="hospital-report-row-value">${escapeHtml(String(item.value || 0))}</strong>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderHospitalReportPrintTable(report) {
    const leftRows = report.primaryItems.map((item) => {
      if (item.divider) {
        return `
          <tr class="hospital-report-print-section">
            <td colspan="2">${escapeHtml(item.label)}</td>
            <td></td>
            <td>${item.totalValue === null || typeof item.totalValue === "undefined" ? "" : escapeHtml(String(item.totalValue || 0))}</td>
          </tr>
        `;
      }

      return `
        <tr>
          <td>${escapeHtml(String(item.cell))}</td>
          <td>${escapeHtml(item.label)}</td>
          <td></td>
          <td>${escapeHtml(String(item.value || 0))}</td>
        </tr>
      `;
    }).join("");

    const rightRows = report.specialGroups.map((group) => `
      <tr class="hospital-report-print-group">
        <td colspan="4">${escapeHtml(group.title)}</td>
      </tr>
      ${group.items.map((item) => `
        <tr>
          <td>${escapeHtml(String(item.cell))}</td>
          <td>${escapeHtml(item.label)}</td>
          <td></td>
          <td>${escapeHtml(String(item.value || 0))}</td>
        </tr>
      `).join("")}
    `).join("");

    return `
      <section class="hospital-report-print-sheet print-only">
        <div class="hospital-report-print-head">
          <div class="hospital-report-print-title">Օրվա շարժ․</div>
          <div class="hospital-report-print-meta">
            <span>Ամսաթիվ: ${escapeHtml(report.reportDate)}</span>
            <span>Թարմացվել է: ${escapeHtml(formatTimestamp(report.updatedAt))}</span>
          </div>
        </div>
        <div class="hospital-report-print-grid">
          <table class="hospital-report-print-table">
            <thead>
              <tr>
                <th>Բջ.</th>
                <th>Ցուցիչ</th>
                <th></th>
                <th>Թիվ</th>
              </tr>
            </thead>
            <tbody>
              ${leftRows}
            </tbody>
          </table>
          <table class="hospital-report-print-table">
            <thead>
              <tr>
                <th>Բջ.</th>
                <th>Բաժին / Ցուցիչ</th>
                <th></th>
                <th>Թիվ</th>
              </tr>
            </thead>
            <tbody>
              ${rightRows}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderHospitalReportPage() {
    const report = buildHospitalReportData(state.snapshot);
    const mainPath = appendShareQuery(config.getMainPagePath(basePath));
    const summaryFreshness = getFreshnessMeta(report.updatedAt);

    app.innerHTML = `
      <div class="page hospital-report-page">
        <div class="toolbar no-print">
          <div>
            <h1>Օրվա շարժ․</h1>
            <p>Отдельный отчётный лист по строке «Ընդամենը» и по строкам ԻՆՖ, Ք/Հ, ԱՏԴ.</p>
          </div>
          <div class="toolbar-actions">
            <span class="pill ${getSourceClass()}">${escapeHtml(sync.getSourceLabel(state.source))}</span>
            <button type="button" id="printBtn">Печать / PDF</button>
            <a class="button-link" href="${escapeHtml(mainPath)}">К главному</a>
          </div>
        </div>

        <article class="hospital-report-sheet">
          ${renderHospitalReportPrintTable(report)}
          <header class="hospital-report-header">
            <div>
              <p class="hospital-report-kicker">ԿԿԶՀ-Շարժ․</p>
              <h1>Օրվա շարժ․</h1>
              <p class="hospital-report-subtitle">Сводный отчёт по главной таблице</p>
            </div>
            <div class="hospital-report-meta">
              <div class="hospital-report-meta-card">
                <span>Дата документа</span>
                <strong>${escapeHtml(report.reportDate)}</strong>
              </div>
              <div class="hospital-report-meta-card">
                <span>Последнее обновление</span>
                <strong>${escapeHtml(formatTimestamp(report.updatedAt))}</strong>
                <em class="status-chip status-chip--${summaryFreshness.level}">${escapeHtml(summaryFreshness.label)}</em>
              </div>
            </div>
          </header>

          <section class="hospital-report-grid">
            <section class="hospital-report-card">
              <div class="hospital-report-card-head">
                <h2>Ընդամենը</h2>
                <span class="hospital-report-mini-pill">строка 15</span>
              </div>
              <div class="hospital-report-rows">
                ${renderHospitalReportPrimaryItems(report.primaryItems)}
              </div>
            </section>

            <section class="hospital-report-side">
              ${report.specialGroups.map(renderHospitalReportGroup).join("")}
            </section>
          </section>
        </article>
      </div>
    `;
  }

  function getFeedbackStatusLabel(status) {
    return status === "corrected_by_operator" ? "Исправлено оператором" : "Принято без правок";
  }

  function getFeedbackStatusClass(status) {
    return status === "corrected_by_operator" ? "review" : "accepted";
  }

  function getFeedbackChangedLabel(changedKeys) {
    const keys = Array.isArray(changedKeys) ? changedKeys.filter((item) => typeof item === "string" && item) : [];
    if (!keys.length) {
      return "Без исправлений";
    }

    return keys
      .map((key) => {
        const meta = getPhotoFieldMetaByKey(key);
        return meta ? `Яч.${meta.label}` : key;
      })
      .join(", ");
  }

  function buildFeedbackSummary(records) {
    const accepted = records.filter((item) => item.status === "accepted_as_is").length;
    const corrected = records.filter((item) => item.status === "corrected_by_operator").length;
    const withPhotos = records.filter((item) => typeof item.imageDataUrl === "string" && item.imageDataUrl.startsWith("data:image/")).length;

    return {
      total: records.length,
      accepted,
      corrected,
      withPhotos
    };
  }

  function buildFeedbackValueList(values, keys) {
    const list = Array.isArray(keys) && keys.length ? keys : config.valueKeys.filter((key) => values && values[key] !== null);
    if (!list.length) {
      return '<div class="feedback-value-empty">Нет значений</div>';
    }

    return list.map((key) => {
      const meta = getPhotoFieldMetaByKey(key);
      return `
        <div class="feedback-value-item">
          <span>${escapeHtml(meta ? `Ячейка ${meta.label}` : key)}</span>
          <strong>${escapeHtml(getDisplayValue(values?.[key]) || "—")}</strong>
        </div>
      `;
    }).join("");
  }

  function buildFeedbackCard(record) {
    const statusClass = getFeedbackStatusClass(record.status);
    const changedKeys = Array.isArray(record.changedKeys) ? record.changedKeys : [];
    const detailKeys = changedKeys.length ? changedKeys : (Array.isArray(record.recognizedKeys) ? record.recognizedKeys : []);

    return `
      <article class="feedback-card">
        <div class="feedback-card-head">
          <div>
            <strong>${escapeHtml(record.departmentName || record.departmentId || "Отделение")}</strong>
            <div class="feedback-card-meta">${escapeHtml(formatTimestamp(record.createdAt) || "—")} • ${escapeHtml(record.reportDate || "—")}</div>
          </div>
          <span class="status-chip status-chip--${statusClass}">${escapeHtml(getFeedbackStatusLabel(record.status))}</span>
        </div>
        <div class="feedback-card-submeta">
          <span><strong>Исправленные ячейки:</strong> ${escapeHtml(getFeedbackChangedLabel(changedKeys))}</span>
          ${record.photoReportDate ? `<span><strong>Дата на фото:</strong> ${escapeHtml(record.photoReportDate)}</span>` : ""}
          ${record.imageName ? `<span><strong>Файл:</strong> ${escapeHtml(record.imageName)}</span>` : ""}
        </div>
        ${record.imageDataUrl ? `
          <div class="feedback-card-preview">
            <img src="${escapeHtml(record.imageDataUrl)}" alt="OCR feedback photo preview">
          </div>
        ` : ""}
        <details class="feedback-card-details">
          <summary>Детали OCR</summary>
          <div class="feedback-values-grid">
            <div class="feedback-values-panel">
              <h3>OCR распознал</h3>
              <div class="feedback-value-list">
                ${buildFeedbackValueList(record.recognizedValues || {}, detailKeys)}
              </div>
            </div>
            <div class="feedback-values-panel">
              <h3>Сохранено в итоге</h3>
              <div class="feedback-value-list">
                ${buildFeedbackValueList(record.finalValues || {}, detailKeys)}
              </div>
            </div>
          </div>
          ${Array.isArray(record.notes) && record.notes.length ? `
            <div class="photo-import-notes">
              ${record.notes.map((note) => `<p class="hint warning-note">${escapeHtml(note)}</p>`).join("")}
            </div>
          ` : ""}
        </details>
      </article>
    `;
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
    if (mode === "hospital-report") {
      return "Report";
    }
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

  function removePrintableLinks() {
    restorePrintableLinks();
    printLinkHrefBackups = Array.from(document.querySelectorAll("a[href]")).map((link) => ({
      link,
      href: link.getAttribute("href") || ""
    }));
    printLinkHrefBackups.forEach(({ link }) => {
      link.removeAttribute("href");
    });
  }

  function restorePrintableLinks() {
    if (!printLinkHrefBackups.length) {
      return;
    }
    printLinkHrefBackups.forEach(({ link, href }) => {
      if (link && link.isConnected) {
        link.setAttribute("href", href);
      }
    });
    printLinkHrefBackups = [];
  }

  function getAppDocumentTitle() {
    if (mode === "department") {
      const definition = getCurrentDepartmentDefinition();
      return definition ? `${definition.department} | SARSH_KKZH` : "SARSH_KKZH";
    }
    if (mode === "feedback") {
      return "OCR feedback | SARSH_KKZH";
    }
    if (mode === "hospital-report") {
      return "Օրվա շարժ․ | SARSH_KKZH";
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
            <button type="button" id="sendTelegramPdfsBtn">Отправить PDF в Telegram</button>
            <div class="zoom-control">
              <label for="zoomRange">Масштаб</label>
              <input type="range" id="zoomRange" min="60" max="140" step="5" value="100">
              <span class="zoom-value" id="zoomValue">100%</span>
            </div>
            <a class="button-link" href="${escapeHtml(getFeedbackPath())}">OCR feedback</a>
            <a class="button-link" href="${escapeHtml(getNightShiftPath())}" target="_blank" rel="noopener">Ночная смена</a>
            <a class="button-link" href="${escapeHtml(getDayShiftPath())}" target="_blank" rel="noopener">Дневная смена</a>
            <a class="button-link" href="${escapeHtml(getHospitalReportPath())}" target="_blank" rel="noopener">Отчётный лист</a>
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
        ${renderPhotoLightbox()}
      </div>
    `;
  }

  function renderFeedbackPage() {
    const sourceLabel = sync.getSourceLabel(state.source);
    const records = Array.isArray(state.feedback.records) ? state.feedback.records : [];
    const summary = buildFeedbackSummary(records);
    const mainPath = appendShareQuery(config.getMainPagePath(basePath));

    app.innerHTML = `
      <div class="page">
        <div class="toolbar no-print">
          <div>
            <h1>OCR feedback</h1>
            <p>Отдельный журнал случаев распознавания: что было принято без правок и что исправил оператор перед подтверждённым сохранением.</p>
          </div>
          <div class="toolbar-actions">
            <span class="pill ${getSourceClass()}" id="syncModeLabel">${escapeHtml(sourceLabel)}</span>
            ${buildOwnerAuthActions()}
            <button type="button" id="refreshBtn">Обновить</button>
            <a class="button-link" href="${escapeHtml(mainPath)}">К главному</a>
          </div>
        </div>

        <div class="info-stack">
          <section class="panel no-print">
            <h2>Сводка OCR feedback</h2>
            <p class="hint${state.feedback.error ? " warning-note" : ""}">${
              escapeHtml(
                state.feedback.error
                  || (state.feedback.isLoading
                    ? "Загружаю OCR feedback..."
                    : "Записи сохраняются автоматически после успешного и подтверждённого сохранения данных отделения.")
              )
            }</p>
            <div class="freshness-overview">
              <div class="freshness-stat freshness-stat--fresh">
                <span>Всего</span>
                <strong>${summary.total}</strong>
              </div>
              <div class="freshness-stat freshness-stat--fresh">
                <span>Без правок</span>
                <strong>${summary.accepted}</strong>
              </div>
              <div class="freshness-stat freshness-stat--stale">
                <span>Исправлено</span>
                <strong>${summary.corrected}</strong>
              </div>
              <div class="freshness-stat freshness-stat--warning">
                <span>Фото сохранено</span>
                <strong>${summary.withPhotos}</strong>
              </div>
            </div>
          </section>

          <section class="panel no-print">
            <h2>Последние случаи</h2>
            ${records.length
              ? `<div class="feedback-list">${records.map((record) => buildFeedbackCard(record)).join("")}</div>`
              : `<div class="archive-empty">${escapeHtml(state.feedback.isLoading ? "Загружаю записи..." : "Пока нет сохранённых OCR feedback записей.")}</div>`}
          </section>
        </div>
      </div>
    `;
  }

  function renderPhotoLightbox() {
    const lightbox = state.photoLightbox || buildInitialPhotoLightboxState();
    if (!lightbox.open || !lightbox.imageDataUrl) {
      return "";
    }

    return `
      <div class="photo-lightbox" id="photoLightbox" aria-modal="true" role="dialog">
        <div class="photo-lightbox-backdrop" data-photo-lightbox-close="true"></div>
        <div class="photo-lightbox-dialog">
          <button type="button" class="photo-lightbox-close" id="photoLightboxClose" aria-label="Закрыть просмотр">×</button>
          <img src="${escapeHtml(lightbox.imageDataUrl)}" alt="${escapeHtml(lightbox.alt || "Фото бланка")}">
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

  function getTelegramFormReviewValue(values, key) {
    const sourceValues = values && typeof values === "object" ? values : {};
    const numberValue = (valueKey) => config.normalizeCellValue(sourceValues[valueKey]) || 0;
    if (key === "presentTotal") {
      return (
        numberValue("beenTotal")
        + numberValue("admittedTotal")
        + numberValue("transferToDepartment")
      ) - (
        numberValue("dgTotal")
        + numberValue("transferFromDepartment")
      );
    }
    return Object.prototype.hasOwnProperty.call(sourceValues, key) ? numberValue(key) : null;
  }

  function renderTelegramFormReviewPanel(row) {
    const photoState = state.photoImport || buildInitialPhotoImportState();
    const values = photoState.recognizedValues && typeof photoState.recognizedValues === "object"
      ? photoState.recognizedValues
      : null;
    const feedbackId = String(photoState.feedbackId || queryParams.get("tgFeedback") || "").trim();
    const imageName = String(photoState.imageName || "");
    const statusTextRaw = String(photoState.status || "");
    const isTelegramForm = !photoState.imageDataUrl
      && feedbackId
      && (
        queryParams.has("tgFeedback")
        || imageName === "telegram-web-app-form"
        || imageName.toLowerCase().includes("telegram")
        || statusTextRaw.includes("Telegram")
      );

    if (!row || !isTelegramForm) {
      return "";
    }

    const status = photoState.workflowStatus === "processed" ? "processed" : "pending";
    const statusText = status === "processed"
      ? "Данные уже сохранены в общую таблицу"
      : "Ждёт проверки и сохранения";
    const cells = PHOTO_FIELD_DEFINITIONS.map((field) => {
      const displayValue = getTelegramFormReviewValue(values, field.key);
      return `
        <td>
          <span>${escapeHtml(field.label)}</span>
          <strong>${escapeHtml(displayValue === null ? "-" : (getDisplayValue(displayValue) || "0"))}</strong>
        </td>
      `;
    }).join("");
    const note = photoState.isError
      ? (photoState.status || "Не удалось загрузить значения Telegram формы.")
      : "Проверьте эту таблицу. Если всё правильно, нажмите Сохранить, чтобы внести данные в общую таблицу.";

    return `
      <section class="panel no-print telegram-form-review-panel telegram-form-review-panel--${status}">
        <div class="telegram-form-review-head">
          <div>
            <h2>Данные из Telegram формы</h2>
            <p class="hint${photoState.isError ? " warning-note" : ""}">${escapeHtml(note)}</p>
          </div>
          <span class="status-chip status-chip--${status === "processed" ? "fresh" : "stale"}">${escapeHtml(statusText)}</span>
        </div>
        <div class="telegram-form-review-meta">
          <span>Feedback: ${escapeHtml(feedbackId)}</span>
          <span>Отделение: ${escapeHtml(row.department)}</span>
          ${photoState.lastReportDate ? `<span>Дата: ${escapeHtml(photoState.lastReportDate)}</span>` : ""}
        </div>
        <div class="telegram-form-review-table-wrap">
          <table class="telegram-form-review-table">
            <tbody>
              <tr>${cells}</tr>
            </tbody>
          </table>
        </div>
      </section>
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
    const suspectFields = new Set(Array.isArray(photoState.suspectKeys) ? photoState.suspectKeys : []);
    const reviewByKey = new Map(
      (Array.isArray(photoState.cellReviews) ? photoState.cellReviews : []).map((item) => [item.key, item])
    );
    const recognizedRawValues = photoState.recognizedValues && typeof photoState.recognizedValues === "object"
      ? photoState.recognizedValues
      : {};
    const previewFieldKeys = new Set(getRecognizablePhotoFields(row).map((item) => item.key));
    previewFieldKeys.add("presentTotal");
    const previewItems = PHOTO_FIELD_DEFINITIONS
      .filter((item) => previewFieldKeys.has(item.key))
      .filter((item) => {
        if (item.key === "presentTotal") {
          return true;
        }
        const hasRawValue = Object.prototype.hasOwnProperty.call(recognizedRawValues, item.key)
          && recognizedRawValues[item.key] !== null;
        return reviewByKey.has(item.key) || recognizedFields.has(item.key) || suspectFields.has(item.key) || hasRawValue;
      })
      .map((item) => {
        const review = reviewByKey.get(item.key) || null;
        const status = suspectFields.has(item.key)
          ? "suspect"
          : (review?.status === "review"
            ? "review"
            : (review?.status === "recognized" || recognizedFields.has(item.key) ? "recognized" : "neutral"));
        const statusText = status === "suspect"
          ? (photoState.suspectReason || "Проверьте вручную: формула не сошлась.")
          : (status === "review"
            ? (review?.reason || "Проверьте вручную")
            : "Распознано уверенно");
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
        <p class="hint">Нумерация ячеек для OCR: <strong>1-22</strong>, счёт идёт от <strong>1</strong>, не от 0. Ячейка 12 читается как расчётная карточка, а 13-22 это обычные переменные.</p>
        <div class="photo-import-actions">
          <label class="button-link photo-file-label${photoState.isProcessing ? " is-disabled" : ""}">
            <input type="file" id="photoImportFile" accept="image/*" capture="environment" ${photoState.isProcessing ? "disabled" : ""}>
            Выбрать фото
          </label>
          <button type="button" id="photoZoomBtn" ${!photoState.imageDataUrl ? "disabled" : ""}>Увеличить</button>
          <button type="button" id="photoRotateBtn" ${!photoState.imageDataUrl || photoState.isProcessing ? "disabled" : ""}>Повернуть 90°</button>
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
        ${previewItems || photoState.lastReportDate || (photoState.notes && photoState.notes.length) ? `
          <div class="photo-import-results">
            ${photoState.lastReportDate ? `<p class="hint">Дата на фото: <strong>${escapeHtml(photoState.lastReportDate)}</strong></p>` : ""}
            ${previewItems ? `<div class="photo-import-result-grid">${previewItems}</div>` : ""}
            ${photoState.notes && photoState.notes.length ? `
              <div class="photo-import-notes">
                ${photoState.notes.map((note) => `<p class="hint warning-note">${escapeHtml(note)}</p>`).join("")}
              </div>
            ` : ""}
            ${photoState.suspectReason ? `<p class="hint warning-note"><strong>${escapeHtml(photoState.suspectReason)}</strong></p>` : ""}
            ${photoState.draftMode ? `<p class="hint"><strong>Автоотправка временно приостановлена.</strong> Проверьте ячейки и нажмите Сохранить.</p>` : ""}
          </div>
        ` : ""}
        ${photoState.imageDataUrl ? `
          <div class="photo-import-preview">
            <div class="photo-import-preview-frame">
              <img
                src="${escapeHtml(photoState.imageDataUrl)}"
                alt="Загруженный бланк"
                class="photo-import-preview-image"
                data-photo-zoom-trigger="department"
              >
              ${renderPhotoReviewOverlay(photoState)}
            </div>
          </div>
        ` : ""}
      </section>
    `;
  }

  function renderQhCalcPanel(row) {
    if (!isQhCalcDepartment(row)) {
      return "";
    }

    const bodyRows = QH_CALC_FIELD_ROWS.map((definition, rowIndex) => `
      <tr>
        <th scope="row">${escapeHtml(definition.label)}</th>
        ${definition.cells.map((cell, columnIndex) => {
          if (cell.role === "output") {
            return `
              <td class="qh-calc-cell qh-calc-cell--output">
                <span class="qh-calc-marker">${escapeHtml(cell.marker)}</span>
                <strong data-qh-output="${escapeHtml(cell.key)}">${escapeHtml(getQhCalcDisplayValue(row, cell.key))}</strong>
              </td>
            `;
          }

          if (cell.role === "linked" || cell.role === "input") {
            return `
              <td class="qh-calc-cell${cell.role === "linked" ? " qh-calc-cell--linked" : ""}">
                <span class="qh-calc-marker">${escapeHtml(cell.marker)}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  value="${escapeHtml(getQhCalcDisplayValue(row, cell.key) || "0")}"
                  data-qh-calc-key="${escapeHtml(cell.key)}"
                  data-qh-calc-row="${rowIndex}"
                  data-qh-calc-col="${columnIndex}"
                  aria-label="${escapeHtml(`${definition.label} ${cell.marker}`)}"
                >
              </td>
            `;
          }

          return `
            <td class="qh-calc-cell">
              <span class="qh-calc-marker">${escapeHtml(cell.marker)}</span>
              <input
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                value="${escapeHtml(getQhCalcDisplayValue(row, cell.key))}"
                data-qh-calc-key="${escapeHtml(cell.key)}"
                data-qh-calc-row="${rowIndex}"
                data-qh-calc-col="${columnIndex}"
                aria-label="${escapeHtml(`${definition.label} ${cell.marker}`)}"
              >
            </td>
          `;
        }).join("")}
      </tr>
    `).join("");

    return `
      <div class="panel qh-calc-panel">
        <h2>Հաշվարկային աղյուսակ</h2>
        <p>Լրացուցիչ աղյուսակ այս էջի համար։ G, H և I արժեքները վերցվում են հիմնական աղյուսակի 13, 14 և 15 բջիջներից, իսկ J, K և L արժեքները հաշվարկվում են ավտոմատ։</p>
        <div class="qh-calc-wrap" id="qhCalcPanel">
          <table class="qh-calc-table">
            <thead>
              <tr>
                <th></th>
                <th>ՇԱՐ</th>
                <th>ՍՊԱ</th>
                <th>ՊԱՅՄ</th>
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>
          <div class="qh-calc-formulas">
            <span>J = (G + A) - D</span>
            <span>K = (H + B) - E</span>
            <span>L = (I + C) - F</span>
          </div>
          <div class="qh-calc-actions">
            <button type="button" id="qhCalcApplyBtn">Հաշվել և տեղադրել</button>
          </div>
        </div>
      </div>
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
            <a class="button-link" href="${escapeHtml(getFeedbackPath())}">OCR feedback</a>
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
          ${renderQhCalcPanel(row)}
          ${renderTelegramFormReviewPanel(row)}

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
        ${renderPhotoLightbox()}
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
    } else if (mode === "hospital-report") {
      renderHospitalReportPage();
    } else if (mode === "feedback") {
      renderFeedbackPage();
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

        const input = body.querySelector(`input[data-row="${row.id}"][data-key="${key}"]`);
        if (input instanceof HTMLInputElement) {
          const nextValue = getDisplayValue(getEffectiveValue(state.snapshot, row, key));
          input.value = nextValue === "" ? "0" : nextValue;
        }
      });

      if (isQhCalcDepartment(row)) {
        [...QH_CALC_INPUT_KEYS, ...QH_CALC_OPTIONAL_INPUT_KEYS].forEach((key) => {
          document.querySelectorAll(`[data-qh-calc-key="${key}"]`).forEach((element) => {
            if (element instanceof HTMLInputElement) {
              element.value = getQhCalcDisplayValue(row, key) || "0";
            }
          });
        });

        [
          "currentShar",
          "currentSpa",
          "currentPaym",
          "qhRemainingSoldier",
          "qhRemainingOfficer",
          "qhRemainingContract"
        ].forEach((key) => {
          document.querySelectorAll(`[data-qh-output="${key}"]`).forEach((element) => {
            element.textContent = getQhCalcDisplayValue(row, key);
          });
        });
      }
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
        const photoWorkflow = getDepartmentPhotoWorkflowMeta(row);
        const statusEl = document.querySelector(`[data-department-status="${row.id}"]`);
        const updatedEl = document.querySelector(`[data-department-updated="${row.id}"]`);
        const ageEl = document.querySelector(`[data-department-age="${row.id}"]`);
        const openCardEl = document.querySelector(`[data-department-open-card="${row.id}"]`);
        const feedbackLinkEl = document.querySelector(`[data-department-feedback-link="${row.id}"]`);
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
        if (openCardEl) {
          openCardEl.setAttribute("data-workflow-tone", photoWorkflow.tone);
          openCardEl.setAttribute("title", photoWorkflow.label);
        }
        if (feedbackLinkEl) {
          if (row.photoFeedbackId) {
            feedbackLinkEl.removeAttribute("hidden");
            feedbackLinkEl.setAttribute("href", appendQueryParams(config.getDepartmentPagePath(basePath, row.id), { tgFeedback: row.photoFeedbackId }));
          } else {
            feedbackLinkEl.setAttribute("hidden", "");
          }
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

    const structure = payload.structure && typeof payload.structure === "object"
      ? payload.structure
      : null;
    const structureOk = !structure
      || (structure.all22CellsVisible === true && Number(structure.gridCellCount) === 22);
    const structureCellCount = structure && Number.isFinite(Number(structure.gridCellCount))
      ? Number(structure.gridCellCount)
      : null;
    const structureMissingCells = structure && Array.isArray(structure.missingCells)
      ? structure.missingCells
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item))
        .map((item) => Math.trunc(item))
        .filter((item) => item >= 1 && item <= 22)
      : [];
    const structureReason = structure && typeof structure.reason === "string" ? structure.reason.trim() : "";

    const values = payload.values && typeof payload.values === "object" ? payload.values : {};
    const recognizedKeys = new Set(
      Array.isArray(payload.recognizedKeys)
        ? payload.recognizedKeys.filter((item) => typeof item === "string")
        : []
    );
    const applicableFields = getRecognizablePhotoFields(row);
    const appliedKeys = [];
    const previewKeys = [];

    if (structureOk) {
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
    }

    const suspectDetails = getPhotoImportSuspectDetails(row, recognizedKeys);

    state.photoImport.recognizedValues = {};
    PHOTO_FIELD_DEFINITIONS.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(values, field.key)) {
        return;
      }
      state.photoImport.recognizedValues[field.key] = config.normalizeCellValue(values[field.key]);
    });
    state.photoImport.lastAppliedKeys = previewKeys;
    state.photoImport.lastReportDate = typeof payload.reportDate === "string" ? payload.reportDate : "";
    state.photoImport.notes = normalizeOcrNotes(payload.notes);
    state.photoImport.cellReviews = normalizePhotoCellReviews(payload);
    state.photoImport.structureOk = structureOk;
    state.photoImport.structureCellCount = structureCellCount;
    state.photoImport.structureMissingCells = structureMissingCells;
    state.photoImport.structureReason = structureReason;
    state.photoImport.suspectKeys = suspectDetails.suspectKeys;
    state.photoImport.suspectReason = suspectDetails.suspectReason;
    state.photoImport.draftMode = structureOk && appliedKeys.length > 0;

    return appliedKeys.length;
  }

  function getPhotoStructureValidationMessage() {
    const photoState = state.photoImport || buildInitialPhotoImportState();
    if (photoState.structureOk !== false) {
      return "";
    }

    const countText = Number.isFinite(photoState.structureCellCount)
      ? `${photoState.structureCellCount}/22`
      : "меньше 22/22";
    const missingText = Array.isArray(photoState.structureMissingCells) && photoState.structureMissingCells.length
      ? ` Не найдены или не подтверждены позиции: ${photoState.structureMissingCells.join(", ")}.`
      : "";
    const reasonText = photoState.structureReason ? ` ${photoState.structureReason}` : "";
    return `Структура бланка не подтверждена: система увидела только ${countText} ячеек верхней строки. Проверьте фото и повторите распознавание.${missingText}${reasonText}`;
  }

  async function handlePhotoImportSelection(file) {
    if (!file) {
      return;
    }

    state.photoImport.isProcessing = true;
    state.photoImport.imageName = file.name || "";
    state.photoImport.imageDataUrl = "";
    state.photoImport.recognizedValues = {};
    state.photoImport.lastAppliedKeys = [];
    state.photoImport.lastReportDate = "";
    state.photoImport.notes = [];
    state.photoImport.cellReviews = [];
    state.photoImport.suspectKeys = [];
    state.photoImport.suspectReason = "";
    state.photoImport.queueMode = false;
    state.photoImport.queueRemainingCount = 0;
    state.photoImport.queueNextDepartmentName = "";
    setPhotoImportStatus("Подготавливаю фото для распознавания...", false);
    renderPage();

    try {
      const preparedPhoto = await compressImageFile(file);
      state.photoImport.imageDataUrl = preparedPhoto.dataUrl;
      state.photoImport.isProcessing = false;
      const canAutoRecognize = sync.hasRemoteSync() && typeof sync.recognizeDepartmentPhoto === "function";
      const orientationNote = preparedPhoto.rotatedToLandscape
        ? " Фото автоматически выровнено: надпись SR перемещена вправо вверх."
        : "";
      if (canAutoRecognize) {
        setPhotoImportStatus(`Фото готово: ${file.name || "image"}.${orientationNote} Автоматически распознаю цифры...`, false);
        renderPage();
        await handlePhotoRecognition();
        return;
      }
      setPhotoImportStatus(`Фото готово: ${file.name || "image"}.${orientationNote} Нажмите "Распознать".`, false);
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

  async function handlePhotoImportRotate() {
    if (!state.photoImport.imageDataUrl || state.photoImport.isProcessing) {
      return;
    }

    state.photoImport.isProcessing = true;
    setPhotoImportStatus("Поворачиваю фото для более удобной проверки...", false);
    renderPage();

    try {
      state.photoImport.imageDataUrl = await rotateImageDataUrl(state.photoImport.imageDataUrl, 90);
      state.photoImport.recognizedValues = {};
      state.photoImport.lastAppliedKeys = [];
      state.photoImport.lastReportDate = "";
      state.photoImport.notes = [];
      state.photoImport.cellReviews = [];
      state.photoImport.suspectKeys = [];
      state.photoImport.suspectReason = "";
      state.photoImport.draftMode = false;
      state.photoImport.isProcessing = false;
      setPhotoImportStatus("Фото вручную повернуто на 90°. Проверьте ориентацию и нажмите «Распознать».", false);
      renderPage();
    } catch (error) {
      state.photoImport.isProcessing = false;
      setPhotoImportStatus(
        error instanceof Error ? error.message : "Не удалось повернуть фото.",
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
      const ocrImageDataUrl = await buildFocusedOcrImageDataUrl(state.photoImport.imageDataUrl);
      const alignedArtifacts = await buildAlignedRightOcrArtifacts(state.photoImport.imageDataUrl);
      const rightOcrImageDataUrl = alignedArtifacts
        ? alignedArtifacts.rightCropDataUrl
        : await buildCroppedImageDataUrl(state.photoImport.imageDataUrl, OCR_RIGHT_FOCUS_CROP);
      const rightCellCropDataUrls = alignedArtifacts
        ? alignedArtifacts.rightCellCropDataUrls
        : await buildRightCellCropDataUrls(state.photoImport.imageDataUrl);
      const result = await sync.recognizeDepartmentPhoto(
        departmentId,
        ocrImageDataUrl,
        [rightOcrImageDataUrl, ...rightCellCropDataUrls]
      );
      const appliedCount = applyRecognizedDepartmentValues(result);
      state.photoImport.isProcessing = false;
      const structureMessage = getPhotoStructureValidationMessage();

      if (structureMessage) {
        setPhotoImportStatus(structureMessage, true);
        renderPage();
        return;
      }

      if (!appliedCount) {
        setPhotoImportStatus("Не удалось уверенно распознать цифры. Попробуйте другое фото или введите значения вручную.", true);
        renderPage();
        return;
      }

      setPhotoImportStatus(
        state.photoImport.suspectReason
          ? `Значения подставлены локально, но формула не сошлась. ${state.photoImport.suspectReason}`
          : "Значения подставлены локально. Проверьте ячейки и нажмите Сохранить.",
        false
      );
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
      next.recognizedValues = state.photoImport.recognizedValues && typeof state.photoImport.recognizedValues === "object"
        ? deepCopy(state.photoImport.recognizedValues)
        : {};
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
          ${item.savedFileName ? `<small>${escapeHtml(item.savedFileName)}</small>` : ""}
        </div>
      `;
    }).join("");
  }

  function canUseMainPhotoSaveDirectory() {
    return typeof window.showDirectoryPicker === "function";
  }

  async function ensureMainPhotoSaveDirectoryPermission(directoryHandle = state.mainPhotoSaveDirectoryHandle) {
    const handle = directoryHandle;
    if (!handle) {
      return false;
    }

    try {
      if (typeof handle.queryPermission === "function") {
        const currentPermission = await handle.queryPermission({ mode: "readwrite" });
        if (currentPermission === "granted") {
          return true;
        }
      }
      if (typeof handle.requestPermission === "function") {
        return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  async function getMainPhotoSaveDirectoryHandle(selectedDirectoryHandle) {
    if (!selectedDirectoryHandle) {
      return null;
    }
    if (selectedDirectoryHandle.name === "MFPictures") {
      return {
        handle: selectedDirectoryHandle,
        name: "MFPictures"
      };
    }

    if (!(await ensureMainPhotoSaveDirectoryPermission(selectedDirectoryHandle))) {
      return {
        handle: selectedDirectoryHandle,
        name: selectedDirectoryHandle.name || "выбранная папка",
        needsPermission: true
      };
    }

    if (typeof selectedDirectoryHandle.getDirectoryHandle !== "function") {
      return {
        handle: selectedDirectoryHandle,
        name: selectedDirectoryHandle.name || "выбранная папка"
      };
    }

    const mfPicturesHandle = await selectedDirectoryHandle.getDirectoryHandle("MFPictures", { create: true });
    return {
      handle: mfPicturesHandle,
      name: `${selectedDirectoryHandle.name || "Pictures"}/MFPictures`
    };
  }

  async function chooseMainPhotoSaveDirectory() {
    if (!canUseMainPhotoSaveDirectory()) {
      setMainPhotoRouteStatus("Браузер не поддерживает сохранение в выбранную папку. Используйте Chrome или Edge.", true);
      renderPage();
      return false;
    }

    try {
      const directoryHandle = await window.showDirectoryPicker({
        id: "sharsh-mf-pictures",
        mode: "readwrite",
        startIn: "pictures"
      });
      const saveDirectory = await getMainPhotoSaveDirectoryHandle(directoryHandle);
      state.mainPhotoSaveDirectoryHandle = saveDirectory?.handle || directoryHandle;
      state.mainPhotoSaveDirectoryName = saveDirectory?.name || (directoryHandle && directoryHandle.name
        ? directoryHandle.name
        : "MFPictures");
      const hasPermission = saveDirectory?.needsPermission
        ? false
        : await ensureMainPhotoSaveDirectoryPermission();
      state.mainPhotoSaveDirectoryName = state.mainPhotoSaveDirectoryName
        ? state.mainPhotoSaveDirectoryName
        : "MFPictures";
      setMainPhotoRouteStatus(
        hasPermission
          ? `Папка для копий выбрана: ${state.mainPhotoSaveDirectoryName}. После определения отделения фото будет сохранено туда.`
          : "Папка выбрана, но браузер не дал право записи. Выберите папку ещё раз и разрешите сохранение.",
        !hasPermission
      );
      renderPage();
      return hasPermission;
    } catch (error) {
      if (error && error.name === "AbortError") {
        setMainPhotoRouteStatus("Папка MFPictures не выбрана. Фото обработаются, но копии не сохранятся на диск.", true);
      } else {
        setMainPhotoRouteStatus(
          error instanceof Error ? error.message : "Не удалось выбрать папку для сохранения фото.",
          true
        );
      }
      renderPage();
      return false;
    }
  }

  function sanitizePhotoFileNamePart(value) {
    return String(value || "")
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  function formatPhotoFileTimestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    const shortYear = String(date.getFullYear()).slice(-2);
    return [
      pad(date.getDate()),
      pad(date.getMonth() + 1),
      shortYear
    ].join(",") + "_" + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join("-");
  }

  function dataUrlToBlob(dataUrl) {
    const [header, base64Payload] = String(dataUrl || "").split(",");
    if (!header || !base64Payload) {
      throw new Error("Не удалось подготовить фото для сохранения.");
    }

    const mimeMatch = header.match(/^data:([^;]+);base64$/i);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const binary = atob(base64Payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
  }

  async function saveMainPhotoRouteCopy(item, index = 0) {
    const handle = state.mainPhotoSaveDirectoryHandle;
    if (!handle || !item || !item.imageDataUrl) {
      return { ok: false, skipped: true, fileName: "" };
    }
    if (!(await ensureMainPhotoSaveDirectoryPermission())) {
      return { ok: false, skipped: true, fileName: "" };
    }

    const department = config.getDepartmentById(item.departmentId);
    const marker = sanitizePhotoFileNamePart(department?.marker || item.departmentId || "department");
    const suffix = Number(index) > 1 ? `_${String(index).padStart(2, "0")}` : "";
    const fileName = `${marker}_${formatPhotoFileTimestamp()}${suffix}.jpg`;
    const blob = dataUrlToBlob(item.imageDataUrl);
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { ok: true, skipped: false, fileName };
  }

  async function queueMainPhotoRouteDepartmentPhoto(item) {
    if (!item || !item.departmentId || !item.imageDataUrl) {
      return false;
    }
    if (typeof sync.queueDepartmentPhoto !== "function") {
      throw new Error("Очередь фото отделений недоступна в текущем режиме.");
    }

    const department = config.getDepartmentById(item.departmentId);
    const notes = [
      "Фото загружено с главной страницы после автоопределения отделения.",
      ...(Array.isArray(item.notes) ? item.notes : [])
    ];
    const result = await sync.queueDepartmentPhoto(
      item.departmentId,
      item.imageName || "",
      item.imageDataUrl,
      notes
    );
    applyLoadedSnapshot(result);

    if (department) {
      setInfo(`Новый бланк добавлен в очередь отделения: ${department.department}.`, false);
    }

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

    void playPhotoReceivedSound();

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

          const preparedPhoto = await compressImageFile(currentFile);
          const imageDataUrl = preparedPhoto.dataUrl;
          if (batchItem) {
            batchItem.imageDataUrl = imageDataUrl;
            batchItem.stage = "ready";
            batchItem.rotatedToLandscape = Boolean(preparedPhoto.rotatedToLandscape);
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
      const preparedPhoto = await compressImageFile(file);
      state.mainPhotoRoute.imageDataUrl = preparedPhoto.dataUrl;
      state.mainPhotoRoute.isProcessing = false;
      const canAutoDetect = sync.hasRemoteSync() && typeof sync.detectDepartmentPhoto === "function";
      const orientationNote = preparedPhoto.rotatedToLandscape
        ? " Фото автоматически выровнено: надпись SR перемещена вправо вверх."
        : "";
      if (canAutoDetect) {
        setMainPhotoRouteStatus(`Фото готово: ${file.name || "image"}.${orientationNote} Автоматически определяю отделение...`, false);
        renderPage();
        await handleMainPhotoRouteDetection();
        return;
      }

      setMainPhotoRouteStatus(`Фото готово: ${file.name || "image"}.${orientationNote} Нажмите "Определить".`, false);
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

  function openPhotoLightbox(imageDataUrl, alt) {
    if (!imageDataUrl) {
      return;
    }
    state.photoLightbox = {
      open: true,
      imageDataUrl,
      alt: alt || "Фото бланка"
    };
    renderPage();
  }

  function closePhotoLightbox() {
    if (!state.photoLightbox?.open) {
      return;
    }
    state.photoLightbox = buildInitialPhotoLightboxState();
    renderPage();
  }

  function renderMainPhotoRoutePanel() {
    const canDetect = sync.hasRemoteSync() && typeof sync.detectDepartmentPhoto === "function";
    const routeState = state.mainPhotoRoute || buildInitialMainPhotoRouteState();
    const detectedDepartment = routeState.detectedDepartmentId
      ? config.getDepartmentById(routeState.detectedDepartmentId)
      : null;
    const batchPreviewItems = buildMainPhotoRouteBatchSummary(routeState);
    const saveDirectoryLabel = state.mainPhotoSaveDirectoryName
      ? `Сохранять: ${state.mainPhotoSaveDirectoryName}`
      : "Сохранять: MFPictures";

    return `
      <section class="panel no-print photo-import-panel">
        <h2>Фото бланка в отделение</h2>
        <p>Сначала выберите папку сохранения, если нужны копии на диск. Потом загрузите фото бланка: система определит отделение и отметит его красной кнопкой, как после Telegram.</p>
        <div class="photo-import-save-actions">
          <button type="button" id="mainPhotoRouteSaveFolderBtn" ${!canUseMainPhotoSaveDirectory() || routeState.isProcessing ? "disabled" : ""}>
            ${escapeHtml(saveDirectoryLabel)}
          </button>
          <span>Выберите Pictures или MFPictures один раз перед загрузкой.</span>
        </div>
        <div class="photo-import-actions">
          <label class="button-link photo-file-label${routeState.isProcessing ? " is-disabled" : ""}">
            <input type="file" id="mainPhotoRouteFile" accept="image/*" capture="environment" multiple ${routeState.isProcessing ? "disabled" : ""}>
            Выбрать фото
          </label>
          <label class="button-link photo-file-label${routeState.isProcessing ? " is-disabled" : ""}">
            <input type="file" id="mainPhotoRouteFolder" accept="image/*" webkitdirectory directory multiple ${routeState.isProcessing ? "disabled" : ""}>
            Папка фото
          </label>
          <button type="button" id="mainPhotoRouteZoomBtn" ${!routeState.imageDataUrl ? "disabled" : ""}>Увеличить</button>
          <button type="button" id="mainPhotoRouteRotateBtn" ${!routeState.imageDataUrl || routeState.isProcessing ? "disabled" : ""}>Повернуть 90°</button>
          <button type="button" id="mainPhotoRouteDetectBtn" ${!routeState.imageDataUrl || routeState.isProcessing || !canDetect ? "disabled" : ""}>
            ${routeState.isProcessing ? "Определяю..." : "Определить"}
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
        ${routeState.imageDataUrl ? `
          <div class="photo-import-preview">
            <img
              src="${escapeHtml(routeState.imageDataUrl)}"
              alt="Фото для определения отделения"
              class="photo-import-preview-image"
              data-photo-zoom-trigger="main"
            >
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
        let savedCopyCount = 0;

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
          const notes = normalizeOcrNotes(detection?.notes);
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
            void playDepartmentDetectedSound();
            setMainPhotoRouteStatus(
              `Отделение найдено: ${department.department}. Сохраняю фото как новый бланк...`,
              false
            );
            renderPage();

            const queuedItem = {
              departmentId: detectedDepartmentId,
              imageName: preparedItem.imageName,
              imageDataUrl: preparedItem.imageDataUrl,
              detectedBy: "vision",
              notes
            };
            await queueMainPhotoRouteDepartmentPhoto(queuedItem);
            try {
              const saveResult = await saveMainPhotoRouteCopy(queuedItem, index + 1);
              if (saveResult.ok) {
                savedCopyCount += 1;
                if (batchItem) {
                  batchItem.savedFileName = saveResult.fileName;
                }
              }
            } catch (saveError) {
              batchNotes.push(
                `${preparedItem.imageName || `Фото ${index + 1}`}: отделение определено, но копия не сохранилась (${saveError instanceof Error ? saveError.message : "ошибка записи"}).`
              );
            }
            recognizedQueue.push({
              ...queuedItem
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

        const saveStatusText = state.mainPhotoSaveDirectoryHandle
          ? ` Сохранено копий в ${state.mainPhotoSaveDirectoryName || "выбранную папку"}: ${savedCopyCount}.`
          : " Копии на диск не сохранены: сначала нажмите «Сохранять: MFPictures» и выберите Pictures или MFPictures.";
        setMainPhotoRouteStatus(
          `Пакет готов: распознано ${recognizedQueue.length} из ${preparedItems.length}. Кнопки отделений с новыми бланками подсвечены красным, страницы не открывались.${saveStatusText}`,
          false
        );
        renderPage();
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
      const notes = normalizeOcrNotes(detection?.notes);

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

      void playDepartmentDetectedSound();

      const queuedItem = {
        departmentId: detectedDepartmentId,
        imageName: state.mainPhotoRoute.imageName,
        imageDataUrl: state.mainPhotoRoute.imageDataUrl,
        detectedBy,
        notes
      };
      await queueMainPhotoRouteDepartmentPhoto(queuedItem);

      let saveStatusText = state.mainPhotoSaveDirectoryHandle
        ? " Копия на диск не сохранена: нет разрешения записи."
        : " Копия на диск не сохранена: сначала нажмите «Сохранять: MFPictures» и выберите Pictures или MFPictures.";
      try {
        const saveResult = await saveMainPhotoRouteCopy(queuedItem, 1);
        if (saveResult.ok) {
          saveStatusText = ` Копия сохранена: ${saveResult.fileName}.`;
        }
      } catch (saveError) {
        saveStatusText = ` Копия на диск не сохранена: ${saveError instanceof Error ? saveError.message : "ошибка сохранения"}.`;
      }

      setMainPhotoRouteStatus(
        `Определено отделение: ${department.department}. Фото сохранено как новый бланк, кнопка отделения подсвечена красным.${saveStatusText}`,
        false
      );
      renderPage();
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

    const transferId = queryParams.get("photoTransfer") || "";
    const pending = transferId
      ? takePendingMainPhotoRouteTransfer(transferId, departmentId)
      : takePendingMainPhotoRoute(departmentId);
    if (!pending) {
      return;
    }

    state.photoImport = buildInitialPhotoImportState();
    state.photoImport.imageName = pending.imageName || "";
    state.photoImport.imageDataUrl = pending.imageDataUrl || "";
    state.photoImport.queueMode = !transferId;
    state.photoImport.queueRemainingCount = transferId ? 0 : getPendingMainPhotoRouteCount();
    const nextPendingRoute = !transferId ? peekPendingMainPhotoRoute() : null;
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

  async function maybeLoadTelegramFeedbackPhoto() {
    if (mode !== "department") {
      return;
    }

    const feedbackId = queryParams.get("tgFeedback") || "";
    if (!feedbackId || !sync.hasRemoteSync() || typeof sync.loadTelegramPhotoFeedback !== "function") {
      return;
    }

    try {
      const record = await sync.loadTelegramPhotoFeedback(feedbackId, departmentId);
      if (!record) {
        return;
      }

      const imageDataUrl = typeof record.imageDataUrl === "string" ? record.imageDataUrl : "";
      if (!imageDataUrl.startsWith("data:image/")) {
        return;
      }

      state.photoImport = buildInitialPhotoImportState();
      state.photoImport.imageName = typeof record.imageName === "string" ? record.imageName : "";
      state.photoImport.imageDataUrl = imageDataUrl;
      state.photoImport.lastReportDate = typeof record.photoReportDate === "string" && record.photoReportDate.trim()
        ? record.photoReportDate
        : (typeof record.reportDate === "string" ? record.reportDate : "");
      state.photoImport.lastAppliedKeys = Array.isArray(record.recognizedKeys)
        ? record.recognizedKeys.map((item) => String(item))
        : [];
      state.photoImport.recognizedValues = buildPhotoPreviewValuesFromRecord(record);
      state.photoImport.notes = normalizeOcrNotes(record.notes);
      state.photoImport.cellReviews = Array.isArray(record.cellReviews) ? record.cellReviews : [];
      state.photoImport.status = "Фото бланка загружено из Telegram. Проверьте значения и при необходимости сохраните.";
      state.photoImport.isError = false;
      renderPage();
    } catch (_error) {
    }
  }

  async function maybeLoadTelegramFeedbackPhotoAdjusted() {
    if (mode !== "department") {
      return;
    }

    const feedbackId = queryParams.get("tgFeedback") || "";
    if (!feedbackId || !sync.hasRemoteSync() || typeof sync.loadTelegramPhotoFeedback !== "function") {
      return;
    }

    try {
      const record = await sync.loadTelegramPhotoFeedback(feedbackId, departmentId);
      if (!record) {
        return;
      }

      const imageDataUrl = typeof record.imageDataUrl === "string" ? record.imageDataUrl : "";
      if (!imageDataUrl.startsWith("data:image/")) {
        return;
      }

      const recordNotes = Array.isArray(record.notes) ? record.notes : [];
      const preparedPhoto = await normalizeTelegramFeedbackImageDataUrl(imageDataUrl, recordNotes);

      state.photoImport = buildInitialPhotoImportState();
      state.photoImport.feedbackId = String(record.id || feedbackId);
      state.photoImport.workflowStatus = "pending";
      state.photoImport.imageName = typeof record.imageName === "string" ? record.imageName : "";
      state.photoImport.imageDataUrl = preparedPhoto.dataUrl;
      state.photoImport.lastReportDate = typeof record.photoReportDate === "string" && record.photoReportDate.trim()
        ? record.photoReportDate
        : (typeof record.reportDate === "string" ? record.reportDate : "");
      state.photoImport.lastAppliedKeys = Array.isArray(record.recognizedKeys)
        ? record.recognizedKeys.map((item) => String(item))
        : [];
      state.photoImport.recognizedValues = buildPhotoPreviewValuesFromRecord(record);
      state.photoImport.notes = normalizeOcrNotes(recordNotes);
      state.photoImport.cellReviews = Array.isArray(record.cellReviews) ? record.cellReviews : [];
      state.photoImport.status = preparedPhoto.rotatedToLandscape
        ? "Фото бланка загружено из Telegram и автоматически выровнено: SR сверху справа. Проверьте значения и при необходимости сохраните."
        : "Фото бланка загружено из Telegram. Проверьте значения и при необходимости сохраните.";
      state.photoImport.isError = false;
      void playPhotoReceivedSound();
      renderPage();
    } catch (_error) {
    }
  }

  async function maybeLoadTelegramFeedbackValues() {
    if (mode !== "department") {
      return;
    }

    const feedbackId = queryParams.get("tgFeedback") || "";
    if (!feedbackId || !sync.hasRemoteSync() || typeof sync.loadTelegramPhotoFeedback !== "function") {
      return;
    }

    try {
      const record = await sync.loadTelegramPhotoFeedback(feedbackId, departmentId);
      if (!record) {
        state.photoImport = buildInitialPhotoImportState();
        state.photoImport.feedbackId = String(feedbackId);
        state.photoImport.workflowStatus = "pending";
        state.photoImport.imageName = "telegram-web-app-form";
        state.photoImport.status = "Не удалось загрузить данные Telegram формы по этому feedback. Возможно, запись уже удалена или номер не найден.";
        state.photoImport.isError = true;
        renderPage();
        return;
      }

      const imageDataUrl = typeof record.imageDataUrl === "string" ? record.imageDataUrl : "";
      if (imageDataUrl.startsWith("data:image/")) {
        return;
      }

      const previewValues = buildPhotoPreviewValuesFromRecord(record);
      const recognizedKeys = Array.isArray(record.recognizedKeys) && record.recognizedKeys.length
        ? record.recognizedKeys.map((item) => String(item))
        : Object.keys(previewValues);
      const hasValues = recognizedKeys.some((key) => Object.prototype.hasOwnProperty.call(previewValues, key));
      if (!hasValues) {
        state.photoImport = buildInitialPhotoImportState();
        state.photoImport.feedbackId = String(record.id || feedbackId);
        state.photoImport.workflowStatus = "pending";
        state.photoImport.imageName = "telegram-web-app-form";
        state.photoImport.status = "Telegram форма найдена, но в ней нет значений для показа.";
        state.photoImport.isError = true;
        renderPage();
        return;
      }

      state.photoImport = buildInitialPhotoImportState();
      const appliedCount = applyRecognizedDepartmentValues({
        values: previewValues,
        recognizedKeys,
        reportDate: typeof record.reportDate === "string" ? record.reportDate : "",
        notes: Array.isArray(record.notes) ? record.notes : [],
        cellReviews: Array.isArray(record.cellReviews) ? record.cellReviews : [],
        structure: {
          all22CellsVisible: true,
          gridCellCount: 22,
          missingCells: []
        }
      });
      const hasAppliedValues = appliedCount > 0;

      const row = getCurrentRow();
      state.photoImport.feedbackId = String(record.id || feedbackId);
      state.photoImport.workflowStatus = row && typeof row.photoWorkflowStatus === "string"
        ? row.photoWorkflowStatus
        : "pending";
      state.photoImport.imageName = typeof record.imageName === "string" && record.imageName.trim()
        ? record.imageName
        : "Telegram Web App form";
      state.photoImport.imageDataUrl = "";
      state.photoImport.draftMode = hasAppliedValues;
      state.photoImport.status = "Открыта отправленная Telegram форма. Проверьте значения и нажмите Сохранить, чтобы внести их в общую таблицу.";
      state.photoImport.isError = false;
      setInfo("Отправленная Telegram форма подставлена в таблицу отделения. После проверки нажмите Сохранить.", false);
      renderPage();
    } catch (error) {
      state.photoImport = buildInitialPhotoImportState();
      state.photoImport.feedbackId = String(feedbackId);
      state.photoImport.workflowStatus = "pending";
      state.photoImport.imageName = "telegram-web-app-form";
      state.photoImport.status = error instanceof Error
        ? `Не удалось загрузить данные Telegram формы: ${error.message}`
        : "Не удалось загрузить данные Telegram формы.";
      state.photoImport.isError = true;
      renderPage();
    }
  }

  async function maybeLoadStoredDepartmentPhotoAdjusted(forceReplace = false) {
    if (mode !== "department" || !sync.hasRemoteSync() || typeof sync.loadTelegramPhotoFeedback !== "function") {
      return;
    }

    const feedbackQueryId = queryParams.get("tgFeedback") || "";
    if (feedbackQueryId && !forceReplace) {
      return;
    }

    const row = getCurrentRow();
    const feedbackId = row && row.photoFeedbackId ? String(row.photoFeedbackId) : "";
    if (!feedbackId) {
      return;
    }

    if (!forceReplace) {
      if (state.photoImport.draftMode) {
        return;
      }
      if (state.photoImport.feedbackId === feedbackId && state.photoImport.imageDataUrl) {
        return;
      }
    }

    try {
      const record = await sync.loadTelegramPhotoFeedback(feedbackId, departmentId);
      if (!record) {
        return;
      }

      const imageDataUrl = typeof record.imageDataUrl === "string" ? record.imageDataUrl : "";
      if (!imageDataUrl.startsWith("data:image/")) {
        return;
      }

      const recordNotes = Array.isArray(record.notes) ? record.notes : [];
      const preparedPhoto = await normalizeTelegramFeedbackImageDataUrl(imageDataUrl, recordNotes);
      const workflowStatus = row && typeof row.photoWorkflowStatus === "string" ? row.photoWorkflowStatus : "idle";

      state.photoImport = buildInitialPhotoImportState();
      state.photoImport.feedbackId = String(record.id || feedbackId);
      state.photoImport.workflowStatus = workflowStatus;
      state.photoImport.imageName = typeof record.imageName === "string" && record.imageName.trim()
        ? record.imageName
        : (row && typeof row.photoName === "string" ? row.photoName : "");
      state.photoImport.imageDataUrl = preparedPhoto.dataUrl;
      state.photoImport.lastReportDate = typeof record.photoReportDate === "string" && record.photoReportDate.trim()
        ? record.photoReportDate
        : (typeof record.reportDate === "string" ? record.reportDate : "");
      state.photoImport.lastAppliedKeys = Array.isArray(record.recognizedKeys)
        ? record.recognizedKeys.map((item) => String(item))
        : [];
      state.photoImport.recognizedValues = buildPhotoPreviewValuesFromRecord(record);
      state.photoImport.notes = normalizeOcrNotes(recordNotes);
      state.photoImport.cellReviews = Array.isArray(record.cellReviews) ? record.cellReviews : [];
      state.photoImport.status = workflowStatus === "pending"
        ? "Новый бланк загружен. Проверьте значения и сохраните данные после корректировок."
        : "Показан последний сохранённый бланк отделения.";
      if (preparedPhoto.rotatedToLandscape) {
        state.photoImport.status = `Фото автоматически выровнено: SR сверху справа. ${state.photoImport.status}`;
      }
      state.photoImport.isError = false;
      if (workflowStatus === "pending") {
        void playPhotoReceivedSound();
      }
      renderPage();
    } catch (_error) {
    }
  }

  async function maybeAutoRecognizeLoadedTelegramPhoto() {
    if (mode !== "department" || !sync.hasRemoteSync() || typeof sync.recognizeDepartmentPhoto !== "function") {
      return;
    }

    const photoState = state.photoImport;
    if (!photoState || photoState.isProcessing || photoState.draftMode || !photoState.imageDataUrl) {
      return;
    }

    const feedbackId = String(photoState.feedbackId || "").trim();
    const shouldAutoRecognize = photoState.workflowStatus === "pending" || Boolean(queryParams.get("tgFeedback"));
    if (!feedbackId || !shouldAutoRecognize || autoRecognizedTelegramFeedbackIds.has(feedbackId)) {
      return;
    }

    autoRecognizedTelegramFeedbackIds.add(feedbackId);
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

  async function handleMainPhotoRouteRotate() {
    if (!state.mainPhotoRoute.imageDataUrl || state.mainPhotoRoute.isProcessing) {
      return;
    }

    state.mainPhotoRoute.isProcessing = true;
    setMainPhotoRouteStatus("Поворачиваю фото для проверки ориентации...", false);
    renderPage();

    try {
      state.mainPhotoRoute.imageDataUrl = await rotateImageDataUrl(state.mainPhotoRoute.imageDataUrl, 90);
      state.mainPhotoRoute.detectedDepartmentId = "";
      state.mainPhotoRoute.detectedDepartmentName = "";
      state.mainPhotoRoute.isProcessing = false;
      setMainPhotoRouteStatus("Фото вручную повернуто на 90°. Если ориентация правильная, запускайте определение отделения.", false);
      renderPage();
    } catch (error) {
      state.mainPhotoRoute.isProcessing = false;
      setMainPhotoRouteStatus(
        error instanceof Error ? error.message : "Не удалось повернуть фото.",
        true
      );
      renderPage();
    }
  }

  function buildPendingOcrFeedback(row, finalValues) {
    if (mode !== "department" || !state.photoImport || !state.photoImport.draftMode) {
      return null;
    }

    const rawRecognizedValues = state.photoImport.recognizedValues && typeof state.photoImport.recognizedValues === "object"
      ? state.photoImport.recognizedValues
      : null;
    const recognizedValues = rawRecognizedValues
      ? config.normalizeRowValues(rawRecognizedValues)
      : null;
    if (!recognizedValues) {
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(rawRecognizedValues, "presentTotal")) {
      recognizedValues.presentTotal = config.normalizeCellValue(rawRecognizedValues.presentTotal);
    }

    const previewFeedbackKeys = PHOTO_FIELD_DEFINITIONS
      .map((item) => item.key)
      .filter((key) => key !== "leaveTotal");
    const recognizedKeys = previewFeedbackKeys.filter((key) => {
      return Object.prototype.hasOwnProperty.call(recognizedValues, key) && recognizedValues[key] !== null;
    });
    if (!recognizedKeys.length) {
      return null;
    }

    const normalizedFinalValues = config.normalizeRowValues(finalValues);
    if (Object.prototype.hasOwnProperty.call(recognizedValues, "presentTotal")) {
      normalizedFinalValues.presentTotal = recognizedValues.presentTotal;
    }
    const changedKeys = recognizedKeys.filter((key) => recognizedValues[key] !== normalizedFinalValues[key]);
    const status = changedKeys.length > 0 ? "corrected_by_operator" : "accepted_as_is";

    return {
      departmentId: row.id,
      departmentName: row.department,
      reportDate: state.snapshot.reportDate,
      photoReportDate: state.photoImport.lastReportDate || "",
      imageName: state.photoImport.imageName || "",
      imageDataUrl: status === "corrected_by_operator" ? (state.photoImport.imageDataUrl || "") : "",
      status,
      recognizedKeys,
      changedKeys,
      recognizedValues,
      finalValues: normalizedFinalValues,
      notes: Array.isArray(state.photoImport.notes) ? [...state.photoImport.notes] : [],
      cellReviews: Array.isArray(state.photoImport.cellReviews) ? deepCopy(state.photoImport.cellReviews) : []
    };
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
    if (isQhCalcDepartment(row)) {
      expectedValues.qhBaseSoldier = expectedValues.currentShar || 0;
      expectedValues.qhBaseOfficer = expectedValues.currentSpa || 0;
      expectedValues.qhBaseContract = expectedValues.currentPaym || 0;
    }
    const payloadValues = deepCopy(expectedValues);
    if (isQhCalcDepartment(row)) {
      QH_CALC_INPUT_KEYS.forEach((key) => {
        payloadValues[key] = 0;
      });
    }
    const ocrFeedback = buildPendingOcrFeedback(row, expectedValues);
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

            if (isQhCalcDepartment(row)) {
              const currentSavedRow = getCurrentRow();
              const currentLoadedRow = getCurrentLoadedRow();
              QH_CALC_INPUT_KEYS.forEach((key) => {
                if (currentSavedRow && currentSavedRow.values) {
                  currentSavedRow.values[key] = 0;
                }
                if (currentLoadedRow && currentLoadedRow.values) {
                  currentLoadedRow.values[key] = 0;
                }
              });
            }

            const nextRows = result.snapshot.rows || [];
            const nextStats = buildFreshnessStats(nextRows);
            const nextOverall = getOverallUpdateStatus(nextStats, nextRows.length);
            let feedbackWarning = "";

            state.photoImport.draftMode = false;
            if (state.photoImport.feedbackId) {
              state.photoImport.workflowStatus = "processed";
              if (state.photoImport.imageDataUrl) {
                state.photoImport.status = "Последний бланк сохранён вместе с данными отделения.";
                state.photoImport.isError = false;
              }
            }

            if (ocrFeedback && typeof sync.saveOcrFeedback === "function") {
              try {
                await sync.saveOcrFeedback(ocrFeedback);
              } catch (feedbackError) {
                feedbackWarning = feedbackError instanceof Error
                  ? feedbackError.message
                  : "Не удалось сохранить OCR feedback.";
              }
            }

            if (nextOverall.level === "fresh" && previousOverall.level !== "fresh") {
              await playCompleteUpdateSound();
            } else {
              await playUpdateSound();
            }

            setInfo(manual ? "Данные отделения сохранены. Проверка записи пройдена." : "Изменения отправлены и проверка записи пройдена.", false);
            state.warning = feedbackWarning;
            refreshTableData();
            if (manual && state.photoImport.queueMode) {
              setInfo("Данные отделения сохранены, проверка записи пройдена. Автоматическое открытие следующих страниц отключено.", false);
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
    if (mode === "feedback") {
      await loadFeedbackRecords(false);
      renderPage();
      return;
    }
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
    const sendTelegramPdfsBtn = document.getElementById("sendTelegramPdfsBtn");
    const resetBtn = document.getElementById("resetBtn");
    const saveBtn = document.getElementById("saveBtn");
    const accessCodeField = document.getElementById("accessCodeField");
    const accessForm = document.getElementById("departmentAccessForm");
    const sheetBody = document.getElementById("sheetBody");
    const qhCalcPanel = document.getElementById("qhCalcPanel");
    const qhCalcApplyBtn = document.getElementById("qhCalcApplyBtn");

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

    if (sendTelegramPdfsBtn) {
      sendTelegramPdfsBtn.addEventListener("click", async () => {
        const button = sendTelegramPdfsBtn instanceof HTMLButtonElement ? sendTelegramPdfsBtn : null;
        if (button) {
          button.disabled = true;
        }

        setInfo("Отправляю Report.pdf и MAINFLOW.pdf в Telegram...", false);
        try {
          if (typeof sync.sendMainPdfsToTelegram !== "function") {
            throw new Error("Отправка PDF в Telegram пока недоступна.");
          }
          const result = await sync.sendMainPdfsToTelegram();
          const sent = result && result.result && typeof result.result.sent === "number"
            ? result.result.sent
            : 0;
          setInfo(`PDF отправлены в Telegram: Report.pdf и MAINFLOW.pdf. Получателей: ${sent}.`, false);
        } catch (error) {
          setInfo(error instanceof Error ? error.message : "Не удалось отправить PDF в Telegram.", true);
        } finally {
          if (button) {
            button.disabled = false;
          }
        }
      });
    }

    if (!state.printHandlersAttached) {
      window.addEventListener("beforeprint", () => {
        document.title = getPrintDocumentTitle();
        removePrintableLinks();
      });

      window.addEventListener("afterprint", () => {
        restorePrintableLinks();
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

    const mainPhotoRouteRotateBtn = document.getElementById("mainPhotoRouteRotateBtn");
    if (mainPhotoRouteRotateBtn) {
      mainPhotoRouteRotateBtn.addEventListener("click", () => {
        handleMainPhotoRouteRotate();
      });
    }

    const mainPhotoRouteRecheckBtn = document.getElementById("mainPhotoRouteRecheckBtn");
    if (mainPhotoRouteRecheckBtn) {
      mainPhotoRouteRecheckBtn.addEventListener("click", () => {
        handleMainPhotoRouteDetection();
      });
    }

    const mainPhotoRouteSaveFolderBtn = document.getElementById("mainPhotoRouteSaveFolderBtn");
    if (mainPhotoRouteSaveFolderBtn) {
      mainPhotoRouteSaveFolderBtn.addEventListener("click", () => {
        chooseMainPhotoSaveDirectory();
      });
    }

    const mainPhotoRouteClearBtn = document.getElementById("mainPhotoRouteClearBtn");
    if (mainPhotoRouteClearBtn) {
      mainPhotoRouteClearBtn.addEventListener("click", () => {
        clearMainPhotoRouteSelection();
      });
    }

    const mainPhotoRouteZoomBtn = document.getElementById("mainPhotoRouteZoomBtn");
    if (mainPhotoRouteZoomBtn) {
      mainPhotoRouteZoomBtn.addEventListener("click", () => {
        openPhotoLightbox(state.mainPhotoRoute?.imageDataUrl || "", "Фото для определения отделения");
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

    const photoRotateBtn = document.getElementById("photoRotateBtn");
    if (photoRotateBtn) {
      photoRotateBtn.addEventListener("click", () => {
        handlePhotoImportRotate();
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

    const photoZoomBtn = document.getElementById("photoZoomBtn");
    if (photoZoomBtn) {
      photoZoomBtn.addEventListener("click", () => {
        openPhotoLightbox(state.photoImport?.imageDataUrl || "", "Фото бланка");
      });
    }

    document.querySelectorAll("[data-photo-zoom-trigger]").forEach((image) => {
      image.addEventListener("click", () => {
        const kind = image.getAttribute("data-photo-zoom-trigger");
        if (kind === "main") {
          openPhotoLightbox(state.mainPhotoRoute?.imageDataUrl || "", "Фото для определения отделения");
          return;
        }
        openPhotoLightbox(state.photoImport?.imageDataUrl || "", "Фото бланка");
      });
    });

    const photoLightboxClose = document.getElementById("photoLightboxClose");
    if (photoLightboxClose) {
      photoLightboxClose.addEventListener("click", () => {
        closePhotoLightbox();
      });
    }

    document.querySelectorAll("[data-photo-lightbox-close]").forEach((element) => {
      element.addEventListener("click", () => {
        closePhotoLightbox();
      });
    });
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

    if (mode === "department" && qhCalcPanel) {
      qhCalcPanel.addEventListener("input", (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) {
          return;
        }

        const key = input.dataset.qhCalcKey;
        if (!key) {
          return;
        }

        const row = getCurrentRow();
        if (!row || !isQhCalcDepartment(row)) {
          return;
        }

        const sanitized = sanitizeNumericInput(input.value);
        input.value = sanitized.text;
        row.values[key] = sanitized.value;
        if (key === "currentShar" || key === "currentSpa" || key === "currentPaym") {
          syncDepartmentRowInput(row.id, key, sanitized.value);
        }
        refreshQhCalcDisplay(row);
        queueDepartmentSave();
      });
    }

    if (mode === "department" && qhCalcApplyBtn) {
      qhCalcApplyBtn.addEventListener("click", () => {
        applyQhCalcToDepartment();
      });
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
        const previousPendingPhotoSignature = mode === "main"
          ? getPendingPhotoWorkflowSignature(state.snapshot)
          : "";
        const result = await sync.loadSnapshot();
        applyLoadedSnapshot(result);
        const nextPendingPhotoSignature = mode === "main"
          ? getPendingPhotoWorkflowSignature(state.snapshot)
          : "";
        if (mode === "feedback") {
          await loadFeedbackRecords(false);
          renderPage();
          return;
        }
        if (
          mode === "main"
          && nextPendingPhotoSignature
          && nextPendingPhotoSignature !== previousPendingPhotoSignature
        ) {
          void playPhotoReceivedSound();
          triggerBackgroundUpdateAttention("photo");
        }
        restorePendingMainSaveNotice();
        refreshTableData();
        if (mode === "department") {
          await maybeLoadStoredDepartmentPhotoAdjusted();
          await maybeAutoRecognizeLoadedTelegramPhoto();
        }
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
    if (mode === "feedback") {
      await loadFeedbackRecords(true);
    }
    renderPage();
    startAutoRefreshIfNeeded();
    startFreshnessTicker();
    startClockTicker();
    await maybeResumeTransferredPhotoImport();
    await maybeLoadTelegramFeedbackPhotoAdjusted();
    await maybeLoadTelegramFeedbackValues();
    await maybeLoadStoredDepartmentPhotoAdjusted();
    await maybeAutoRecognizeLoadedTelegramPhoto();
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



