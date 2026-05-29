(function () {
  const config = window.SHARSH_CONFIG;
  const sync = window.SHARSH_SYNC;
  const auth = window.SHARSH_AUTH || null;
  const app = document.getElementById("app");
  const PENDING_SYNC_EVENT_NAME = "sharsh-pending-sync-changed";
  const AUTO_PENDING_SYNC_DELAY_MS = 1500;
  const AUTO_PENDING_SYNC_RETRY_MS = Math.max(15000, Number(sync?.runtime?.refreshIntervalMs) || 30000);

  if (!config || !sync || !app) {
    return;
  }

  const queryParams = new URLSearchParams(window.location.search);
  if (["night", "day", "discharge"].includes(queryParams.get("view") || "")) {
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
  const savedMainKeyFromQuery = queryParams.get("savedMain") || "";
  const departmentArchiveKeyFromQuery = queryParams.get("departmentArchive") || "";
  const departmentArchiveDateFromQuery = queryParams.get("departmentArchiveDate") || "";
  const archiveAutoPrint = queryParams.get("autoprint") !== "0";
  const PRINT_REPORT_TITLE = "ԿԿԶՀ-Շարժ․";
  const SAVE_RULE_TEXT = "13-22 = (1 + 4 + 11) - (7 + 10)";
  const SAVE_RULE_NAME = "Контроль 13-22";
  const SOLDIER_COUNT_RULE_NAME = "Количество срочников";
  const SOLDIER_COUNT_RULE_TEXT = "(3 + 6) - 9 = 13 + 20";
  const MILITARY_COUNT_RULE_NAME = "Количество военнослужащих";
  const MILITARY_COUNT_RULE_TEXT = "(2 + 5) - 8 = 13 + 14 + 15 + 20 + 21 + 22";
  const OCR_TOP_CELLS_RULE_NAME = "Контроль OCR 1-3";
  const OCR_TOP_CELLS_RULE_TEXT = "OCR 1 = таблица 1; OCR 2 = таблица 2; OCR 3 = таблица 3";
  const SAVE_RULE_TEXT_SHORT = "сумма блока АРКА Э = (1 + 4 + 11) - (7 + 10)";
  const DEPARTMENT_MORNING_CONTROL_KEYS = ["beenTotal", "beenSoldier", "beenSeries"];
  const DEPARTMENT_MORNING_CONTROL_KEY_SET = new Set(DEPARTMENT_MORNING_CONTROL_KEYS);
  const ARCHIVE_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:main-archive:v1`;
  const MAIN_TABLE_SAVED_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:main-saved-tables:v1`;
  const MORNING_ROLLOVER_PENDING_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:morning-rollover-pending:v1`;
  const ARCHIVE_TIMEZONE = "Asia/Yerevan";
  const DATA_UPDATE_SLOT_MINUTES = {
    morning: 2 * 60,
    evening: 18 * 60
  };
  const DATA_UPDATE_GRACE_MINUTES = 2 * 60;
  const DATA_UPDATE_EARLY_TOLERANCE_MINUTES = 60;
  const ARCHIVE_CAPTURE_HOUR = 10;
  const MAX_ARCHIVE_RECORDS = 60;
  const MAX_MAIN_TABLE_SAVED_RECORDS = 60;
  const DEPARTMENT_PDF_ARCHIVE_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:department-pdf-archive:v1`;
  const MAX_DEPARTMENT_PDF_ARCHIVE_RECORDS = 240;
  const DEPARTMENT_UNLOCK_STORAGE_PREFIX = `${config.STORAGE_NAMESPACE}:department-unlock:`;
  const PHOTO_MAX_DIMENSION = 1800;
  const PHOTO_JPEG_QUALITY = 0.88;
  const MAIN_PHOTO_ROUTE_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:main-photo-route:v1`;
  const MAIN_PHOTO_ROUTE_MAX_AGE_MS = 15 * 60 * 1000;
  const MAIN_PHOTO_ROUTE_TRANSFER_STORAGE_PREFIX = `${config.STORAGE_NAMESPACE}:main-photo-route-transfer:`;
  const OCR_FEEDBACK_IMAGE_OVERRIDE_STORAGE_PREFIX = `${config.STORAGE_NAMESPACE}:ocr-feedback-image-override:`;
  const MAIN_SAVE_NOTICE_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:main-save-notice:v1`;
  const MAIN_PAGE_COLLAPSE_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:main-panel-collapse:v1`;
  const SHIFT_AUTO_TRANSFER_MODE_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:shift-auto-transfer-mode:v1`;
  const SHIFT_AUTO_TRANSFER_DONE_PREFIX = `${config.STORAGE_NAMESPACE}:shift-auto-transfer-done:`;
  const SHIFT_TRANSFER_SIGNAL_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:shift-transfer-signal:v1`;
  const SHIFT_AUTO_TRANSFER_TIME_MINUTES = (8 * 60) + 1;
  const SHIFT_DRAFT_DAY_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:day-shift:v3`;
  const SHIFT_DRAFT_DAY_LEGACY_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:night-shift:v1`;
  const SHIFT_DRAFT_DISCHARGE_STORAGE_KEY = `${config.STORAGE_NAMESPACE}:discharge-shift:v3`;
  const SHIFT_DRAFT_COLUMNS = ["shar", "spa", "paym", "zh", "family", "zp", "qi"];
  const REMOTE_AUX_PANEL_REFRESH_MS = 45 * 1000;
  const SAVE_VERIFICATION_ATTEMPTS = 3;
  const SAVE_VERIFICATION_DELAY_MS = 700;
  const HOSPITAL_REPORT_FILENAME = "hospital-report.html";
  const CIVIL_REFERRALS_FILENAME = "civil-referrals.html";
  const NIGHT_SHIFT_FILENAME = "index.html";
  const DAY_SHIFT_FILENAME = "index.html";
  const DISCHARGE_SHIFT_FILENAME = "index.html";
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
  const QH_CALC_DEPARTMENT_IDS = new Set();
  const QH_CALC_COLUMNS = [
    {
      type: "soldier",
      label: "ՇԱՐ",
      currentKey: "currentShar",
      incomingKey: "qhIncomingSoldier",
      dischargedKey: "qhDischargedSoldier",
      baseKey: "qhBaseSoldier",
      outputKey: "qhRemainingSoldier",
      incomingMarker: "A",
      dischargedMarker: "H",
      baseMarker: "O",
      outputMarker: "V"
    },
    {
      type: "officer",
      label: "ՍՊԱ",
      currentKey: "currentSpa",
      incomingKey: "qhIncomingOfficer",
      dischargedKey: "qhDischargedOfficer",
      baseKey: "qhBaseOfficer",
      outputKey: "qhRemainingOfficer",
      incomingMarker: "B",
      dischargedMarker: "I",
      baseMarker: "P",
      outputMarker: "W"
    },
    {
      type: "contract",
      label: "ՊԱՅՄ",
      currentKey: "currentPaym",
      incomingKey: "qhIncomingContract",
      dischargedKey: "qhDischargedContract",
      baseKey: "qhBaseContract",
      outputKey: "qhRemainingContract",
      incomingMarker: "C",
      dischargedMarker: "J",
      baseMarker: "Q",
      outputMarker: "X"
    },
    {
      type: "zh",
      label: "Զ/Հ",
      currentKey: "currentZh",
      incomingKey: "qhIncomingZh",
      dischargedKey: "qhDischargedZh",
      baseKey: "qhBaseZh",
      outputKey: "qhRemainingZh",
      incomingMarker: "D",
      dischargedMarker: "K",
      baseMarker: "R",
      outputMarker: "Y"
    },
    {
      type: "family",
      label: "Զ/Ծ ընտ",
      currentKey: "family",
      incomingKey: "qhIncomingFamily",
      dischargedKey: "qhDischargedFamily",
      baseKey: "qhBaseFamily",
      outputKey: "qhRemainingFamily",
      incomingMarker: "E",
      dischargedMarker: "L",
      baseMarker: "S",
      outputMarker: "Z"
    },
    {
      type: "reserve",
      label: "Զ/Պ",
      currentKey: "officer",
      incomingKey: "qhIncomingReserve",
      dischargedKey: "qhDischargedReserve",
      baseKey: "qhBaseReserve",
      outputKey: "qhRemainingReserve",
      incomingMarker: "F",
      dischargedMarker: "M",
      baseMarker: "T",
      outputMarker: "AA"
    },
    {
      type: "civil",
      label: "Ք-ի",
      currentKey: "civil",
      incomingKey: "qhIncomingCivil",
      dischargedKey: "qhDischargedCivil",
      baseKey: "qhBaseCivil",
      outputKey: "qhRemainingCivil",
      incomingMarker: "G",
      dischargedMarker: "N",
      baseMarker: "U",
      outputMarker: "AB"
    }
  ];
  const QH_CALC_TYPE_MAP = QH_CALC_COLUMNS.reduce((map, column) => {
    map[column.type] = column;
    return map;
  }, {});
  const QH_CALC_FIELD_ROWS = [
    {
      label: "Ընդունվել է",
      cells: QH_CALC_COLUMNS.map((column) => ({
        key: column.incomingKey,
        marker: column.incomingMarker,
        role: "input"
      }))
    },
    {
      label: "Դուրս է գրվել",
      cells: QH_CALC_COLUMNS.map((column) => ({
        key: column.dischargedKey,
        marker: column.dischargedMarker,
        role: "input"
      }))
    },
    {
      label: "Եղել է",
      cells: QH_CALC_COLUMNS.map((column) => ({
        key: column.baseKey,
        marker: column.baseMarker,
        role: "input"
      }))
    },
    {
      label: "Հաշվարկ",
      cells: QH_CALC_COLUMNS.map((column) => ({
        key: column.outputKey,
        marker: column.outputMarker,
        role: "output"
      }))
    }
  ];
  const QH_CALC_INPUT_KEYS = new Set(
    QH_CALC_COLUMNS.flatMap((column) => [column.incomingKey, column.dischargedKey])
  );
  const QH_CALC_OPTIONAL_INPUT_KEYS = new Set(QH_CALC_COLUMNS.map((column) => column.baseKey));
  const QH_CALC_CURRENT_KEYS = new Set(QH_CALC_COLUMNS.map((column) => column.currentKey));
  function getEffectiveQhCalcFieldRows(row = null) {
    return QH_CALC_FIELD_ROWS.map((definition, rowIndex) => {
      if (rowIndex !== 2) {
        return definition;
      }

      return {
        ...definition,
        cells: QH_CALC_COLUMNS.map((column) => ({
          key: column.currentKey,
          marker: column.baseMarker,
          role: "linked"
        }))
      };
    });
  }
  const LEAVE_CALC_COLUMNS = [
    {
      type: "sharq",
      label: "ՇԱՐ",
      presentKey: "currentShar",
      leaveKey: "leaveSharq",
      sentKey: "leaveCalcSentSharq",
      returnedKey: "leaveCalcReturnedSharq",
      sentMarker: "A",
      returnedMarker: "D",
      baseMarker: "G",
      leaveOutputMarker: "J",
      presentOutputMarker: "M"
    },
    {
      type: "spa",
      label: "ՍՊԱ",
      presentKey: "currentSpa",
      leaveKey: "leaveSpa",
      sentKey: "leaveCalcSentSpa",
      returnedKey: "leaveCalcReturnedSpa",
      sentMarker: "B",
      returnedMarker: "E",
      baseMarker: "H",
      leaveOutputMarker: "K",
      presentOutputMarker: "N"
    },
    {
      type: "paym",
      label: "ՊԱՅՄ",
      presentKey: "currentPaym",
      leaveKey: "leavePaym",
      sentKey: "leaveCalcSentPaym",
      returnedKey: "leaveCalcReturnedPaym",
      sentMarker: "C",
      returnedMarker: "F",
      baseMarker: "I",
      leaveOutputMarker: "L",
      presentOutputMarker: "O"
    }
  ];
  const LEAVE_CALC_INPUT_KEYS = new Set(
    LEAVE_CALC_COLUMNS.flatMap((column) => [column.sentKey, column.returnedKey])
  );
  const TRANSFER_CALC_COLUMNS = [
    {
      type: "soldier",
      label: "ՇԱՐ",
      currentKey: "currentShar",
      incomingKey: "transferCalcIncomingSoldier",
      outgoingKey: "transferCalcOutgoingSoldier",
      outputKey: "transferCalcRemainingSoldier",
      incomingMarker: "A",
      outgoingMarker: "H",
      baseMarker: "O",
      outputMarker: "V"
    },
    {
      type: "officer",
      label: "ՍՊԱ",
      currentKey: "currentSpa",
      incomingKey: "transferCalcIncomingOfficer",
      outgoingKey: "transferCalcOutgoingOfficer",
      outputKey: "transferCalcRemainingOfficer",
      incomingMarker: "B",
      outgoingMarker: "I",
      baseMarker: "P",
      outputMarker: "W"
    },
    {
      type: "contract",
      label: "ՊԱՅՄ",
      currentKey: "currentPaym",
      incomingKey: "transferCalcIncomingContract",
      outgoingKey: "transferCalcOutgoingContract",
      outputKey: "transferCalcRemainingContract",
      incomingMarker: "C",
      outgoingMarker: "J",
      baseMarker: "Q",
      outputMarker: "X"
    },
    {
      type: "zh",
      label: "Զ/Հ",
      currentKey: "currentZh",
      incomingKey: "transferCalcIncomingZh",
      outgoingKey: "transferCalcOutgoingZh",
      outputKey: "transferCalcRemainingZh",
      incomingMarker: "D",
      outgoingMarker: "K",
      baseMarker: "R",
      outputMarker: "Y"
    },
    {
      type: "family",
      label: "Զ/Ծ ընտ",
      currentKey: "family",
      incomingKey: "transferCalcIncomingFamily",
      outgoingKey: "transferCalcOutgoingFamily",
      outputKey: "transferCalcRemainingFamily",
      incomingMarker: "E",
      outgoingMarker: "L",
      baseMarker: "S",
      outputMarker: "Z"
    },
    {
      type: "reserve",
      label: "Զ/Պ",
      currentKey: "officer",
      incomingKey: "transferCalcIncomingReserve",
      outgoingKey: "transferCalcOutgoingReserve",
      outputKey: "transferCalcRemainingReserve",
      incomingMarker: "F",
      outgoingMarker: "M",
      baseMarker: "T",
      outputMarker: "AA"
    },
    {
      type: "civil",
      label: "Ք-ի",
      currentKey: "civil",
      incomingKey: "transferCalcIncomingCivil",
      outgoingKey: "transferCalcOutgoingCivil",
      outputKey: "transferCalcRemainingCivil",
      incomingMarker: "G",
      outgoingMarker: "N",
      baseMarker: "U",
      outputMarker: "AB"
    }
  ];
  const TRANSFER_CALC_INPUT_KEYS = new Set(
    TRANSFER_CALC_COLUMNS.flatMap((column) => [column.incomingKey, column.outgoingKey])
  );
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

  function buildInitialTelegramFormReviewState() {
    return {
      feedbackId: "",
      workflowStatus: "idle",
      imageName: "telegram-web-app-form",
      recognizedValues: {},
      notes: [],
      cellReviews: [],
      lastReportDate: "",
      lastAppliedKeys: [],
      draftMode: false,
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
      alt: "Фото бланка",
      sourceKind: "",
      sourceId: "",
      selectedDepartmentId: "",
      recognizedValues: null,
      recognizedKeys: null,
      cellReviews: null,
      isRotating: false,
      isReassigning: false,
      isRechecking: false,
      isSaving: false,
      status: "",
      statusIsError: false
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

  function buildInitialMainTablePhotoGalleryState() {
    return {
      records: [],
      isLoading: false,
      error: "",
      loaded: false,
      isDeletingAll: false,
      lastLoadedAt: 0,
      lastRenderRecordsRef: null,
      lastRenderDateKey: "",
      lastRenderIsLoading: false,
      lastRenderIsDeletingAll: false,
      lastRenderError: "",
      lastRenderContent: null,
      lastRenderToken: 0
    };
  }

  function buildInitialMainTableTelegramFormState() {
    return {
      records: [],
      isLoading: false,
      error: "",
      loaded: false,
      isDeletingAll: false,
      lastLoadedAt: 0
    };
  }

  function buildInitialMainTableAndroidAppState() {
    return {
      records: [],
      isLoading: false,
      error: "",
      loaded: false,
      lastLoadedAt: 0
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
    pendingSyncAutoTimerId: 0,
    pendingSyncAutoRetryAfter: 0,
    pendingSyncEventsBound: false,
    shiftTransferEventsBound: false,
    updateAudioContext: null,
    updateAudioBound: false,
    updateAttentionIntervalId: 0,
    updateAttentionTimeoutId: 0,
    updateAttentionBound: false,
    archiveRecords: [],
    selectedArchiveKey: "",
    mainTableSavedRecords: [],
    selectedMainTableSavedKey: "",
    activeMainTableSavedPreviewKey: "",
    departmentPdfArchiveRecords: [],
    selectedDepartmentPdfArchiveKey: "",
    selectedDepartmentPdfArchiveDate: "",
    departmentPdfArchiveRemoteLoaded: false,
    departmentPdfArchiveRemoteLoading: false,
    morningRolloverInFlight: false,
    morningRolloverCompletedKeys: new Set(),
    initialized: false,
    photoImport: buildInitialPhotoImportState(),
    telegramFormReview: buildInitialTelegramFormReviewState(),
    photoLightbox: buildInitialPhotoLightboxState(),
    mainPhotoSaveDirectoryHandle: null,
    mainPhotoSaveDirectoryName: "",
    mainPhotoRoute: buildInitialMainPhotoRouteState(),
    feedback: buildInitialFeedbackState(),
    mainTablePhotoGallery: buildInitialMainTablePhotoGalleryState(),
    mainTableTelegramForms: buildInitialMainTableTelegramFormState(),
    mainTableAndroidApp: buildInitialMainTableAndroidAppState(),
    selectedMainCalcDepartmentId: "",
    departmentTopCellsUnlocked: false,
    shiftAutoTransferEnabled: readShiftAutoTransferEnabled(),
    shiftTransferInFlightMode: "",
    mainTableUnlocked: false,
    mainTableSaveSequence: 0,
    mainTableSaveInFlight: false
  };
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

  function readMainPageCollapseState() {
    try {
      const raw = localStorage.getItem(MAIN_PAGE_COLLAPSE_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function writeMainPageCollapseState(nextState) {
    try {
      localStorage.setItem(MAIN_PAGE_COLLAPSE_STORAGE_KEY, JSON.stringify(nextState && typeof nextState === "object" ? nextState : {}));
    } catch (_error) {
      // Ignore local storage errors and keep the current UI state in memory only.
    }
  }

  function readShiftAutoTransferEnabled() {
    try {
      return localStorage.getItem(SHIFT_AUTO_TRANSFER_MODE_STORAGE_KEY) === "auto";
    } catch (_error) {
      return false;
    }
  }

  function writeShiftAutoTransferEnabled(enabled) {
    state.shiftAutoTransferEnabled = Boolean(enabled);
    try {
      localStorage.setItem(
        SHIFT_AUTO_TRANSFER_MODE_STORAGE_KEY,
        state.shiftAutoTransferEnabled ? "auto" : "manual"
      );
    } catch (_error) {
      // Ignore local storage errors and keep the setting in memory.
    }
  }

  function getShiftTransferModeMeta(modeKey) {
    return modeKey === "day"
      ? {
        modeKey: "day",
        label: "Ընդունում",
        loadFn: "loadDayShiftDraft",
        applyFn: "applyDayShiftToMain",
        storageKeys: [SHIFT_DRAFT_DAY_STORAGE_KEY, SHIFT_DRAFT_DAY_LEGACY_STORAGE_KEY]
      }
      : {
        modeKey: "discharge",
        label: "Դուրսգրում",
        loadFn: "loadDischargeShiftDraft",
        applyFn: "applyDischargeShiftToMain",
        storageKeys: [SHIFT_DRAFT_DISCHARGE_STORAGE_KEY]
      };
  }

  function buildEmptyShiftDraftRows() {
    return Object.fromEntries(
      config.departmentDefinitions.map((department) => [
        department.id,
        Object.fromEntries(SHIFT_DRAFT_COLUMNS.map((key) => [key, 0]))
      ])
    );
  }

  function sanitizeShiftDraftRows(rows) {
    const sanitized = buildEmptyShiftDraftRows();
    config.departmentDefinitions.forEach((department) => {
      SHIFT_DRAFT_COLUMNS.forEach((key) => {
        sanitized[department.id][key] = config.normalizeCellValue(rows?.[department.id]?.[key]) || 0;
      });
    });
    return sanitized;
  }

  function shiftDraftHasValues(rows) {
    return config.departmentDefinitions.some((department) =>
      SHIFT_DRAFT_COLUMNS.some((key) => (config.normalizeCellValue(rows?.[department.id]?.[key]) || 0) > 0)
    );
  }

  function buildEmptyShiftDraftState(reportDateTime = getCurrentDateTimeParts().full) {
    return {
      reportDateTime,
      savedAt: "",
      rows: buildEmptyShiftDraftRows()
    };
  }

  function parseShiftDraftState(rawValue, fallbackReportDateTime = getCurrentDateTimeParts().full) {
    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue);
      return {
        reportDateTime: typeof parsed?.reportDateTime === "string" && parsed.reportDateTime.trim()
          ? parsed.reportDateTime.trim()
          : fallbackReportDateTime,
        savedAt: typeof parsed?.savedAt === "string" ? parsed.savedAt.trim() : "",
        rows: sanitizeShiftDraftRows(parsed?.rows)
      };
    } catch (_error) {
      return null;
    }
  }

  function loadLocalShiftDraftState(modeKey) {
    const meta = getShiftTransferModeMeta(modeKey);
    const fallback = buildEmptyShiftDraftState();

    for (const storageKey of meta.storageKeys) {
      const parsed = parseShiftDraftState(localStorage.getItem(storageKey), fallback.reportDateTime);
      if (parsed && shiftDraftHasValues(parsed.rows)) {
        return parsed;
      }
    }

    for (const storageKey of meta.storageKeys) {
      const parsed = parseShiftDraftState(localStorage.getItem(storageKey), fallback.reportDateTime);
      if (parsed) {
        return parsed;
      }
    }

    return fallback;
  }

  function clearLocalShiftDraftState(modeKey) {
    const meta = getShiftTransferModeMeta(modeKey);
    meta.storageKeys.forEach((storageKey) => {
      try {
        localStorage.removeItem(storageKey);
      } catch (_error) {
      }
    });
  }

  function getShiftAutoTransferDoneStorageKey(modeKey, dateKey) {
    return `${SHIFT_AUTO_TRANSFER_DONE_PREFIX}${modeKey}:${dateKey}`;
  }

  function hasShiftAutoTransferCompleted(modeKey, dateKey) {
    if (!dateKey) {
      return false;
    }
    try {
      return localStorage.getItem(getShiftAutoTransferDoneStorageKey(modeKey, dateKey)) === "1";
    } catch (_error) {
      return false;
    }
  }

  function markShiftAutoTransferCompleted(modeKey, dateKey) {
    if (!dateKey) {
      return;
    }
    try {
      localStorage.setItem(getShiftAutoTransferDoneStorageKey(modeKey, dateKey), "1");
    } catch (_error) {
    }
  }

  function parseShiftTransferSignal(rawValue) {
    if (!rawValue) {
      return null;
    }
    try {
      const parsed = JSON.parse(rawValue);
      const modeKey = parsed?.mode === "day" ? "day" : (parsed?.mode === "discharge" ? "discharge" : "");
      if (!modeKey) {
        return null;
      }
      return {
        mode: modeKey,
        source: typeof parsed?.source === "string" ? parsed.source : "",
        at: typeof parsed?.at === "string" ? parsed.at : "",
        reportDateTime: typeof parsed?.reportDateTime === "string" ? parsed.reportDateTime : ""
      };
    } catch (_error) {
      return null;
    }
  }

  function emitShiftTransferSignal(modeKey, source, reportDateTime) {
    const payload = {
      mode: modeKey,
      source,
      at: new Date().toISOString(),
      reportDateTime: typeof reportDateTime === "string" ? reportDateTime : ""
    };

    try {
      localStorage.setItem(SHIFT_TRANSFER_SIGNAL_STORAGE_KEY, JSON.stringify(payload));
    } catch (_error) {
    }
  }

  function getMainPagePanelCollapsed(panelId, defaultCollapsed = false) {
    const savedState = readMainPageCollapseState();
    if (Object.prototype.hasOwnProperty.call(savedState, panelId)) {
      return Boolean(savedState[panelId]);
    }
    return defaultCollapsed;
  }

  function setMainPagePanelCollapsed(panelId, collapsed) {
    const savedState = readMainPageCollapseState();
    savedState[panelId] = Boolean(collapsed);
    writeMainPageCollapseState(savedState);
  }

  function setMainPagePanelToggleState(panel, toggle, collapsed) {
    if (!(panel instanceof HTMLElement) || !(toggle instanceof HTMLButtonElement)) {
      return;
    }
    panel.classList.toggle("main-collapsible-panel--collapsed", collapsed);
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggle.setAttribute("title", collapsed ? "Развернуть блок" : "Свернуть блок");
    const text = toggle.querySelector("[data-panel-toggle-text]");
    if (text) {
      text.textContent = collapsed ? "Развернуть" : "Свернуть";
    }
  }

  function buildMainPagePanelToggleButton() {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "main-collapsible-panel__toggle";
    toggle.innerHTML = `
      <span class="main-collapsible-panel__toggle-icon" aria-hidden="true"></span>
      <span class="main-collapsible-panel__toggle-text" data-panel-toggle-text>Свернуть</span>
    `;
    return toggle;
  }

  function findDirectPanelChild(panel, selector) {
    return Array.from(panel.children).find((child) => child instanceof Element && child.matches(selector)) || null;
  }

  function enhanceMainPageCollapsiblePanel(panel, config) {
    if (!(panel instanceof HTMLElement) || panel.dataset.mainCollapsibleReady === "1") {
      return;
    }

    const directPersistent = findDirectPanelChild(panel, config.persistentSelector);
    const headingElement = directPersistent || findDirectPanelChild(panel, "h2") || findDirectPanelChild(panel, "h3");
    if (!(headingElement instanceof HTMLElement)) {
      return;
    }

    let header = headingElement;
    if (/^H[1-6]$/i.test(headingElement.tagName)) {
      header = document.createElement("div");
      header.className = "main-collapsible-panel__header";
      panel.insertBefore(header, headingElement);
      header.appendChild(headingElement);
    } else {
      header.classList.add("main-collapsible-panel__header");
    }

    const body = document.createElement("div");
    body.className = "main-collapsible-panel__body";
    const childNodes = Array.from(panel.childNodes);
    childNodes.forEach((node) => {
      if (node === header) {
        return;
      }
      body.appendChild(node);
    });
    panel.appendChild(body);

    const toggle = buildMainPagePanelToggleButton();
    toggle.dataset.mainPanelToggle = config.id;
    header.appendChild(toggle);

    panel.classList.add("main-collapsible-panel");
    panel.dataset.mainPanelCollapseId = config.id;
    panel.dataset.mainCollapsibleReady = "1";

    const collapsed = getMainPagePanelCollapsed(config.id, Boolean(config.defaultCollapsed));
    setMainPagePanelToggleState(panel, toggle, collapsed);

    toggle.addEventListener("click", () => {
      const nextCollapsed = !panel.classList.contains("main-collapsible-panel--collapsed");
      setMainPagePanelCollapsed(config.id, nextCollapsed);
      setMainPagePanelToggleState(panel, toggle, nextCollapsed);
    });
  }

  function enhanceMainPageCollapsiblePanels() {
    if (mode !== "main") {
      return;
    }

    [
      {
        selector: ".main-table-photo-gallery-panel",
        id: "photo-gallery",
        persistentSelector: ".main-table-photo-gallery-panel__head",
        defaultCollapsed: true
      },
      {
        selector: ".main-table-telegram-form-panel",
        id: "telegram-forms",
        persistentSelector: "h2",
        defaultCollapsed: true
      },
      {
        selector: ".main-department-calc-panel",
        id: "main-calculator",
        persistentSelector: ".main-department-calc-panel__head",
        defaultCollapsed: true
      },
      {
        selector: ".main-summary-panel",
        id: "summary",
        persistentSelector: "h2",
        defaultCollapsed: false
      },
      {
        selector: ".photo-import-panel",
        id: "photo-routing",
        persistentSelector: "h2",
        defaultCollapsed: true
      },
      {
        selector: ".updates-panel",
        id: "department-updates",
        persistentSelector: "h2",
        defaultCollapsed: true
      },
      {
        selector: ".main-daily-archive-panel",
        id: "daily-archive",
        persistentSelector: "h2",
        defaultCollapsed: true
      },
      {
        selector: ".department-pdf-archive-panel",
        id: "department-pdf-archive",
        persistentSelector: "h2",
        defaultCollapsed: true
      },
      {
        selector: ".main-links-panel",
        id: "department-links",
        persistentSelector: "h2",
        defaultCollapsed: true
      }
    ].forEach((definition) => {
      const panel = document.querySelector(definition.selector);
      enhanceMainPageCollapsiblePanel(panel, definition);
    });
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
    if (Array.isArray(notes)) {
      return notes
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => translateOcrNote(item))
        .filter(Boolean);
    }

    if (typeof notes === "string") {
      const trimmed = notes.trim();
      if (!trimmed) {
        return [];
      }

      if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
        try {
          const parsed = JSON.parse(trimmed);
          return normalizeOcrNotes(parsed);
        } catch (_error) {
        }
      }

      return [translateOcrNote(trimmed)].filter(Boolean);
    }

    return [];
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

  function hasDepartmentCalculatorPendingInputs(row) {
    if (!row || !row.values || typeof row.values !== "object") {
      return false;
    }

    return [
      ...QH_CALC_INPUT_KEYS,
      ...LEAVE_CALC_INPUT_KEYS,
      ...TRANSFER_CALC_INPUT_KEYS
    ].some((key) => (Number(row.values[key]) || 0) !== 0);
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
    state.snapshot = syncQhCalculatedTargets(primeQhBaseInputs(deepCopy(result.snapshot)));
    state.loadedSnapshot = syncQhCalculatedTargets(primeQhBaseInputs(deepCopy(result.snapshot)));
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

  function isDepartmentMorningControlledKey(key) {
    return DEPARTMENT_MORNING_CONTROL_KEY_SET.has(key);
  }

  function areDepartmentMorningCellsUnlocked() {
    return mode !== "department" || Boolean(state.departmentTopCellsUnlocked);
  }

  function canEditMainTableDirectly() {
    if (mode !== "main") {
      return false;
    }

    if (!sync.hasRemoteSync()) {
      return true;
    }

    if (!sync.runtime || !sync.runtime.requireOwnerAuth) {
      return true;
    }

    return showOwnerAuthTools();
  }

  function getDepartmentSourceTransferKeys(keys) {
    if (!Array.isArray(keys)) {
      return [];
    }

    return keys.filter((key) => {
      if (typeof key !== "string") {
        return false;
      }
      if (areDepartmentMorningCellsUnlocked()) {
        return true;
      }
      return !isDepartmentMorningControlledKey(key);
    });
  }

  function hasLockedDepartmentMorningSourceValues(previewValues) {
    if (areDepartmentMorningCellsUnlocked() || !previewValues || typeof previewValues !== "object") {
      return false;
    }

    return DEPARTMENT_MORNING_CONTROL_KEYS.some((key) => (
      Object.prototype.hasOwnProperty.call(previewValues, key)
      && config.normalizeCellValue(previewValues[key]) !== null
    ));
  }

  function getDepartmentMorningLockMeta() {
    const unlocked = areDepartmentMorningCellsUnlocked();
    return {
      unlocked,
      statusLabel: unlocked ? "1-3 editable" : "1-3 read only",
      hint: unlocked
        ? "Open: OCR, Telegram form and manual input may change cells 1, 2 and 3."
        : "Closed: cells 1, 2 and 3 stay on the morning main-table values and are not copied from OCR or Telegram form."
    };
  }

  function getPhotoFieldMetaByKey(key) {
    return PHOTO_FIELD_DEFINITIONS.find((item) => item.key === key) || null;
  }

  const SAVE_RULE_DISPLAY_NAME = "Առկա է";
  const SOLDIER_COUNT_DISPLAY_NAME = "Շարքայիններ";
  const MILITARY_COUNT_DISPLAY_NAME = "Զինծառայողներ";
  const OCR_TOP_CELLS_DISPLAY_NAME = "Եղել է";

  function buildPresentBalanceFailureMessage(actual, expected) {
    return `${SAVE_RULE_DISPLAY_NAME} не сошлось: сумма ячеек 13-22 сейчас ${actual}, должна быть ${expected}. Проверь ячейки 1, 4, 7, 10, 11 и блок 13-22.`;
  }

  function buildSoldierCountFailureMessage(actual, expected) {
    return `${SOLDIER_COUNT_DISPLAY_NAME} не сошлись: по ячейкам 3, 6 и 9 получилось ${actual}, а по ячейкам 13 и 20 сейчас ${expected}. Проверь ячейки 3, 6, 9, 13 и 20.`;
  }

  function buildMilitaryCountFailureMessage(actual, expected) {
    return `${MILITARY_COUNT_DISPLAY_NAME} не сошлись: по ячейкам 2, 5 и 8 получилось ${actual}, а по ячейкам 13, 14, 15, 20, 21 и 22 сейчас ${expected}. Проверь ячейки 2, 5, 8, 13, 14, 15, 20, 21 и 22.`;
  }

  function buildOcrTopCellsFailureMessage(mismatches = []) {
    if (!Array.isArray(mismatches) || !mismatches.length) {
      return "";
    }

    const details = mismatches
      .map((item) => {
        const cellLabel = getPhotoFieldMetaByKey(item.key)?.label || item.key;
        return `ячейка ${cellLabel}: OCR ${item.ocrValue}, в таблице ${item.tableValue}`;
      })
      .join("; ");

    return `${OCR_TOP_CELLS_DISPLAY_NAME}: OCR 1-3 не совпадает с таблицей отделения: ${details}.`;
  }

  function formatDepartmentValidationSuccessMessage(check) {
    if (!check || !check.applicable) {
      return "";
    }

    switch (check.id) {
      case "present-balance":
        return `${SAVE_RULE_DISPLAY_NAME}: ${check.actual} = ${check.expected}.`;
      case "soldier-count":
        return `${SOLDIER_COUNT_DISPLAY_NAME}: ${check.actual} = ${check.expected}.`;
      case "military-count":
        return `${MILITARY_COUNT_DISPLAY_NAME}: ${check.actual} = ${check.expected}.`;
      case "ocr-top-cells":
        return `${OCR_TOP_CELLS_DISPLAY_NAME}: OCR 1-3 совпадает с таблицей.`;
      default:
        return "";
    }
  }

  function buildDepartmentValidationMessage(isValid, checks = [], failedChecks = []) {
    if (isValid) {
      const successParts = checks
        .filter((item) => item.applicable)
        .map((item) => formatDepartmentValidationSuccessMessage(item))
        .filter(Boolean);

      return successParts.length
        ? `Проверка пройдена. ${successParts.join(" ")}`
        : "Проверка пройдена.";
    }

    const failureParts = failedChecks
      .map((item) => item.failureMessage)
      .filter(Boolean);

    return failureParts.length
      ? `Сохранение заблокировано. ${failureParts.join(" ")}`
      : "Сохранение заблокировано. Исправь данные и попробуй снова.";
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
    return mode === "department" && Boolean(
      (state.photoImport && state.photoImport.draftMode)
      || (state.telegramFormReview && state.telegramFormReview.draftMode)
    );
  }

  function blockPhotoImportDraftAction(message) {
    if (!hasPhotoImportDraft()) {
      return false;
    }

    setInfo(
      message || "Подставленные значения пока сохранены только локально. Сначала проверьте их и нажмите Сохранить.",
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

    if (!runtime.autoRotateImages) {
      return buildPreparedPhotoResultFromCanvas(buildRotatedCanvasFromImage(image, 0), 0);
    }

    const candidateRotations = [0, 90, 180, 270];
    let bestRotation = 0;
    let bestCanvas = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    candidateRotations.forEach((rotation) => {
      const initialCanvas = buildRotatedCanvasFromImage(image, rotation);
      const { canvas: candidateCanvas, rotation: normalizedRotation } = flipCanvasIfSrIsBottomLeft(initialCanvas, rotation);
      const score = scoreCanvasForSrTopRight(candidateCanvas);
      if (score > bestScore) {
        bestScore = score;
        bestRotation = normalizedRotation;
        bestCanvas = candidateCanvas;
      }
    });

    if (!bestCanvas) {
      throw new Error("Не удалось подготовить фото.");
    }

    return buildPreparedPhotoResultFromCanvas(bestCanvas, bestRotation);

  }

  async function normalizeTelegramFeedbackImageDataUrl(sourceDataUrl, notes) {
    const normalizedSourceDataUrl = typeof sourceDataUrl === "string" ? sourceDataUrl.trim() : "";
    const normalizedNotes = Array.isArray(notes) ? notes : [];
    const rotatedToLandscape = normalizedNotes.some((note) => {
      return typeof note === "string" && note.toLowerCase().includes("photo auto-rotated by");
    });

    return {
      dataUrl: normalizedSourceDataUrl,
      rotatedToLandscape,
      normalizedRotation: 0
    };
  }

  function normalizePhotoPreviewValueObject(values) {
    if (!values || typeof values !== "object") {
      return {};
    }

    const output = {};
    PHOTO_FIELD_DEFINITIONS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(values, field.key)) {
        output[field.key] = config.normalizeCellValue(values[field.key]);
      }
    });
    return output;
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

  function normalizeMainTablePhotoGalleryRecord(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    const id = Number(record.id);
    const imageDataUrl = typeof record.imageDataUrl === "string" ? record.imageDataUrl.trim() : "";
    if (!Number.isFinite(id) || !imageDataUrl.startsWith("data:image/")) {
      return null;
    }

    return {
      id,
      departmentId: typeof record.departmentId === "string" ? record.departmentId : "",
      departmentName: typeof record.departmentName === "string" ? record.departmentName : "",
      reportDate: typeof record.reportDate === "string" ? record.reportDate : "",
      photoReportDate: typeof record.photoReportDate === "string" ? record.photoReportDate : "",
      imageName: typeof record.imageName === "string" ? record.imageName : "",
      imageDataUrl,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
      saveStatus: typeof record.saveStatus === "string" ? record.saveStatus : "",
      notes: normalizeOcrNotes(record.notes),
      recognizedKeys: Array.isArray(record.recognizedKeys)
        ? record.recognizedKeys.map((item) => String(item))
        : [],
      changedKeys: Array.isArray(record.changedKeys)
        ? record.changedKeys.map((item) => String(item))
        : [],
      recognizedValues: normalizePhotoPreviewValueObject(record.recognizedValues || record.recognized_values),
      finalValues: normalizePhotoPreviewValueObject(record.finalValues || record.final_values),
      cellReviews: Array.isArray(record.cellReviews) ? record.cellReviews : []
    };
  }

  function ensureMainTablePhotoGalleryRecordsLoaded() {
    if (!Array.isArray(state.mainTablePhotoGallery.records)) {
      state.mainTablePhotoGallery.records = [];
    }
    return state.mainTablePhotoGallery.records;
  }

  function isTelegramFormFeedbackImageName(imageName) {
    const normalized = typeof imageName === "string" ? imageName.trim() : "";
    return normalized === "telegram-web-app-form" || normalized === "telegram-qh-form";
  }

  function isAndroidMainTablePhotoRecord(record) {
    const notes = Array.isArray(record?.notes)
      ? record.notes.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const sourceText = record?.sourceMeta && typeof record.sourceMeta.text === "string"
      ? record.sourceMeta.text
      : "";
    return notes.some((note) => /Android MAINFORM/i.test(note))
      || /Android MAINFORM/i.test(sourceText);
  }

  function getMainTablePhotoGallerySourceMeta(record) {
    const notes = Array.isArray(record?.notes)
      ? record.notes.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const explicitSource = notes.find((note) => /^Источник:\s*/i.test(note));
    if (explicitSource) {
      const sourceText = explicitSource.replace(/^Источник:\s*/i, "").trim();
      if (sourceText) {
        return {
          text: `Источник: ${sourceText}`,
          kind: /Android MAINFORM/i.test(sourceText) ? "android" : "default"
        };
      }
    }

    const androidNote = notes.find((note) => /Android MAINFORM/i.test(note));
    if (androidNote) {
      const deviceMatch = androidNote.match(/Android MAINFORM\s*:?\s*(.+)$/i);
      return {
        text: deviceMatch && deviceMatch[1] && !/^Submitted via/i.test(androidNote)
          ? `Источник: Android MAINFORM ${deviceMatch[1].trim()}`
          : "Источник: Android MAINFORM",
        kind: "android"
      };
    }

    return null;
  }

  function canPostDesktopHostMessage() {
    return Boolean(window.chrome?.webview && typeof window.chrome.webview.postMessage === "function");
  }

  function postDesktopHostMessage(type, payload = {}) {
    if (!canPostDesktopHostMessage()) {
      return false;
    }

    try {
      window.chrome.webview.postMessage({
        source: "sharsh-app",
        type,
        ...payload
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  function buildDesktopNotificationDepartmentSummary(records, prefix) {
    const names = Array.from(new Set(
      (Array.isArray(records) ? records : [])
        .map((record) => String(record?.departmentName || record?.departmentId || "").trim())
        .filter(Boolean)
    ));

    if (!names.length) {
      return prefix;
    }

    const visibleNames = names.slice(0, 3).join(", ");
    const extra = names.length > 3 ? ` и ещё ${names.length - 3}` : "";
    return `${prefix}: ${visibleNames}${extra}.`;
  }

  function notifyDesktopHostAboutPhotoGalleryUpdates(previousRecords, nextRecords) {
    const previousIds = new Set(
      (Array.isArray(previousRecords) ? previousRecords : [])
        .map((record) => Number(record?.id))
        .filter((value) => Number.isFinite(value))
    );
    const addedRecords = (Array.isArray(nextRecords) ? nextRecords : [])
      .filter((record) => record && !previousIds.has(Number(record.id)));

    if (!addedRecords.length) {
      return;
    }

    const androidRecords = [];
    const photoRecords = [];
    addedRecords.forEach((record) => {
      const sourceMeta = getMainTablePhotoGallerySourceMeta(record);
      if (sourceMeta?.kind === "android") {
        androidRecords.push(record);
      } else {
        photoRecords.push(record);
      }
    });

    if (androidRecords.length) {
      postDesktopHostMessage("desktop-notification", {
        category: "android-update",
        title: "MAINFLOW: Android MAINFORM",
        message: buildDesktopNotificationDepartmentSummary(
          androidRecords,
          androidRecords.length > 1
            ? "Получены новые данные из Android MAINFORM"
            : "Получены новые данные из Android MAINFORM"
        )
      });
    }

    if (photoRecords.length) {
      postDesktopHostMessage("desktop-notification", {
        category: "photo-update",
        title: "MAINFLOW: Фото бланка",
        message: buildDesktopNotificationDepartmentSummary(
          photoRecords,
          photoRecords.length > 1
            ? "Получены новые фото бланков"
            : "Получено новое фото бланка"
        )
      });
    }
  }

  function notifyDesktopHostAboutTelegramFormUpdates(previousRecords, nextRecords) {
    const previousIds = new Set(
      (Array.isArray(previousRecords) ? previousRecords : [])
        .map((record) => Number(record?.id))
        .filter((value) => Number.isFinite(value))
    );
    const addedRecords = (Array.isArray(nextRecords) ? nextRecords : [])
      .filter((record) => record && !previousIds.has(Number(record.id)));

    if (!addedRecords.length) {
      return;
    }

    postDesktopHostMessage("desktop-notification", {
      category: "telegram-form",
      title: "MAINFLOW: Telegram форма",
      message: buildDesktopNotificationDepartmentSummary(
        addedRecords,
        addedRecords.length > 1
          ? "Получены новые Telegram формы"
          : "Получена новая Telegram форма"
      )
    });
  }

  function normalizeMainTableTelegramFormRecord(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    const id = Number(record.id);
    const imageName = typeof record.imageName === "string" ? record.imageName.trim() : "";
    if (!Number.isFinite(id) || !isTelegramFormFeedbackImageName(imageName)) {
      return null;
    }

    return {
      id,
      departmentId: typeof record.departmentId === "string" ? record.departmentId : "",
      departmentName: typeof record.departmentName === "string" ? record.departmentName : "",
      reportDate: typeof record.reportDate === "string" ? record.reportDate : "",
      photoReportDate: typeof record.photoReportDate === "string" ? record.photoReportDate : "",
      imageName,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
      saveStatus: typeof record.saveStatus === "string" ? record.saveStatus : "",
      notes: normalizeOcrNotes(record.notes),
      recognizedKeys: Array.isArray(record.recognizedKeys)
        ? record.recognizedKeys.map((item) => String(item))
        : [],
      changedKeys: Array.isArray(record.changedKeys)
        ? record.changedKeys.map((item) => String(item))
        : [],
      recognizedValues: normalizePhotoPreviewValueObject(record.recognizedValues || record.recognized_values),
      finalValues: normalizePhotoPreviewValueObject(record.finalValues || record.final_values),
      cellReviews: Array.isArray(record.cellReviews) ? record.cellReviews : []
    };
  }

  function ensureMainTableTelegramFormRecordsLoaded() {
    if (!Array.isArray(state.mainTableTelegramForms.records)) {
      state.mainTableTelegramForms.records = [];
    }
    return state.mainTableTelegramForms.records;
  }

  function ensureMainTableAndroidAppRecordsLoaded() {
    if (!Array.isArray(state.mainTableAndroidApp.records)) {
      state.mainTableAndroidApp.records = [];
    }
    return state.mainTableAndroidApp.records;
  }

  function getMainTableTelegramFormRecordById(feedbackId) {
    const normalizedFeedbackId = Number(feedbackId);
    return ensureMainTableTelegramFormRecordsLoaded()
      .map((record) => normalizeMainTableTelegramFormRecord(record))
      .find((record) => record && Number(record.id) === normalizedFeedbackId) || null;
  }

  function getMainTablePhotoGalleryRecordById(feedbackId) {
    const normalizedFeedbackId = Number(feedbackId);
    const photoGalleryRecord = ensureMainTablePhotoGalleryRecordsLoaded()
      .map((record) => normalizeMainTablePhotoGalleryRecord(record))
      .find((record) => record && Number(record.id) === normalizedFeedbackId) || null;
    if (photoGalleryRecord) {
      return photoGalleryRecord;
    }

    return ensureMainTableAndroidAppRecordsLoaded()
      .map((record) => normalizeMainTablePhotoGalleryRecord(record))
      .find((record) => record && Number(record.id) === normalizedFeedbackId) || null;
  }

  function getArchiveDateKey(value = new Date()) {
    const context = getArchiveContext(value);
    if (!context || !context.year || !context.month || !context.day) {
      return "";
    }
    return `${context.year}-${context.month}-${context.day}`;
  }

  function getArchiveDateKeyForTimestamp(value) {
    const parsed = new Date(value || "");
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return getArchiveDateKey(parsed);
  }

  function getMainTablePhotoGalleryTodayItems(rows) {
    const records = ensureMainTablePhotoGalleryRecordsLoaded();
    const todayDateKey = getArchiveDateKey();
    const rowsById = new Map(
      (Array.isArray(rows) ? rows : [])
        .filter((row) => row && typeof row.id === "string")
        .map((row) => [row.id, row])
    );

    return records
      .map((record) => normalizeMainTablePhotoGalleryRecord(record))
      .filter(Boolean)
      .filter((record) => !isTelegramFormFeedbackImageName(record.imageName))
      .filter((record) => getArchiveDateKeyForTimestamp(record.createdAt) === todayDateKey)
      .map((record) => {
        const boundRow = rowsById.get(record.departmentId) || null;
        const sourceMeta = getMainTablePhotoGallerySourceMeta(record);
        return {
          ...record,
          feedbackId: record.id,
          rowId: boundRow?.id || record.departmentId,
          departmentId: boundRow?.id || record.departmentId,
          departmentName: boundRow?.department || record.departmentName || record.departmentId || "Неизвестное отделение",
          photoSentAt: record.createdAt,
          sourceMeta,
          workflowStatus: boundRow?.photoWorkflowStatus || "",
          freshness: boundRow ? getRowFreshnessMeta(boundRow) : null
        };
      })
      .sort((left, right) => getTimestampSortValue(right.createdAt) - getTimestampSortValue(left.createdAt));
  }

  function getMainTablePhotoGalleryItems(rows) {
    return getMainTablePhotoGalleryTodayItems(rows)
      .filter((item) => !isAndroidMainTablePhotoRecord(item));
  }

  function getMainTablePhotoGalleryBulkDeleteMeta(displayContext = getMainTableDisplaySnapshotContext()) {
    const rows = Array.isArray(displayContext?.rows) ? displayContext.rows : [];
    const items = getMainTablePhotoGalleryItems(rows);
    const isDeletingAll = Boolean(state.mainTablePhotoGallery.isDeletingAll);
    const canUseRemoteDelete = sync.hasRemoteSync?.() && typeof sync.deleteDepartmentFeedback === "function";

    return {
      items,
      count: items.length,
      isDeletingAll,
      isDisabled: !canUseRemoteDelete || !items.length || state.mainTablePhotoGallery.isLoading || isDeletingAll || Boolean(state.mainTablePhotoGallery.error),
      label: isDeletingAll
        ? `Удаляю фото (${items.length})...`
        : `Удалить все фото${items.length ? ` (${items.length})` : ""}`,
      title: !canUseRemoteDelete
        ? "Массовое удаление доступно только в онлайн-режиме владельца."
        : (!items.length
          ? "Для текущей таблицы нет загруженных фото для удаления."
          : "Удалить с сервера все фото, показанные в этом блоке.")
    };
  }

  function buildMainTableTelegramFormItems() {
    const records = ensureMainTableTelegramFormRecordsLoaded();
    const todayDateKey = getArchiveDateKey();
    return records
      .map((record) => normalizeMainTableTelegramFormRecord(record))
      .filter((record) => record && getArchiveDateKeyForTimestamp(record.createdAt) === todayDateKey)
      .map((record) => {
        const liveRow = getDepartmentRow(state.snapshot, record.departmentId);
        const previewValues = buildPhotoPreviewValuesFromRecord(record);
        const recognizedKeys = Array.isArray(record.recognizedKeys) && record.recognizedKeys.length
          ? record.recognizedKeys.map((item) => String(item))
          : Object.keys(previewValues);
        const previewRow = liveRow ? deepCopy(liveRow) : null;
        const appliedKeys = previewRow
          ? applyTelegramFormValuesToDepartmentRow(previewRow, previewValues, recognizedKeys)
          : [];
        const alreadySaved = liveRow
          ? doesDepartmentRowMatchPreviewValues(state.snapshot, liveRow, previewValues, recognizedKeys)
          : false;
        return {
          ...record,
          liveRow,
          previewRow,
          previewValues,
          recognizedKeys,
          appliedKeys,
          alreadySaved,
          formLabel: record.imageName === "telegram-qh-form" ? "Telegram QH" : "Telegram Web"
        };
      })
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
  }

  function getMainTableAndroidAppTodayItems(rows) {
    const records = ensureMainTableAndroidAppRecordsLoaded();
    const todayDateKey = getArchiveDateKey();
    const rowsById = new Map(
      (Array.isArray(rows) ? rows : [])
        .filter((row) => row && typeof row.id === "string")
        .map((row) => [row.id, row])
    );

    return records
      .map((record) => normalizeMainTablePhotoGalleryRecord(record))
      .filter(Boolean)
      .filter((record) => getArchiveDateKeyForTimestamp(record.createdAt) === todayDateKey)
      .map((record) => {
        const boundRow = rowsById.get(record.departmentId) || null;
        const sourceMeta = getMainTablePhotoGallerySourceMeta(record);
        return {
          ...record,
          feedbackId: record.id,
          rowId: boundRow?.id || record.departmentId,
          departmentId: boundRow?.id || record.departmentId,
          departmentName: boundRow?.department || record.departmentName || record.departmentId || "Неизвестное отделение",
          photoSentAt: record.createdAt,
          sourceMeta,
          workflowStatus: boundRow?.photoWorkflowStatus || "",
          freshness: boundRow ? getRowFreshnessMeta(boundRow) : null
        };
      })
      .sort((left, right) => getTimestampSortValue(right.createdAt) - getTimestampSortValue(left.createdAt));
  }

  function buildMainTableAndroidAppItems(displayContext = getMainTableDisplaySnapshotContext()) {
    const rows = Array.isArray(displayContext?.rows) ? displayContext.rows : [];
    return getMainTableAndroidAppTodayItems(rows)
      .map((item) => {
        const previewValues = buildPhotoPreviewValuesFromRecord(item);
        const recognizedKeys = Array.isArray(item.recognizedKeys) && item.recognizedKeys.length
          ? item.recognizedKeys.map((entry) => String(entry))
          : Object.keys(previewValues);
        const liveRow = typeof item.departmentId === "string" && item.departmentId
          ? getDepartmentRow(state.snapshot, item.departmentId)
          : null;
        const previewRow = liveRow ? deepCopy(liveRow) : null;
        const appliedKeys = previewRow
          ? applyPreviewValuesToDepartmentRow(previewRow, previewValues, recognizedKeys)
          : [];
        const alreadySaved = liveRow
          ? doesDepartmentRowMatchPreviewValues(state.snapshot, liveRow, previewValues, recognizedKeys)
          : false;
        return {
          ...item,
          liveRow,
          previewValues,
          recognizedKeys,
          previewRow,
          appliedKeys,
          alreadySaved
        };
      });
  }

  function getMainTableTelegramFormBulkDeleteMeta() {
    const items = buildMainTableTelegramFormItems()
      .filter((item) => Number.isFinite(Number(item?.id)) && typeof item?.departmentId === "string" && item.departmentId.trim());
    const isDeletingAll = Boolean(state.mainTableTelegramForms.isDeletingAll);
    const canUseRemoteDelete = sync.hasRemoteSync?.() && typeof sync.deleteDepartmentFeedback === "function";

    return {
      items,
      count: items.length,
      isDeletingAll,
      isDisabled: !canUseRemoteDelete || !items.length || state.mainTableTelegramForms.isLoading || isDeletingAll || Boolean(state.mainTableTelegramForms.error),
      label: isDeletingAll
        ? `Удаляю формы (${items.length})...`
        : `Удалить все формы${items.length ? ` (${items.length})` : ""}`,
      title: !canUseRemoteDelete
        ? "Массовое удаление Telegram Web форм доступно только в онлайн-режиме владельца."
        : (!items.length
          ? "За сегодня нет Telegram Web форм с корректной привязкой для удаления."
          : "Удалить с сервера все сегодняшние Telegram Web формы, показанные в этом блоке.")
    };
  }

  function renderMainTableTelegramFormPreviewTable(record, row) {
    if (!record || !row) {
      return "";
    }

    const tableHtml = renderTable(
      {
        ...deepCopy(state.snapshot),
        reportDate: record.reportDate || state.snapshot.reportDate
      },
      [row],
      {
        interactive: false,
        viewMode: "department",
        headerDateTime: getHeaderDateTimeParts(record.reportDate) || getCurrentDateTimeParts()
      }
    )
      .replace(' id="sheetTable"', "")
      .replace(' id="sheetBody"', "");

    return `
      <div class="main-table-telegram-form-card__table">
        <div class="table-wrap main-table-telegram-form-card__table-wrap">
          ${tableHtml}
        </div>
      </div>
    `;
  }

  function buildMainTablePhotoDepartmentOptions(selectedDepartmentId = "") {
    return config.departmentDefinitions.map((definition) => {
      const selected = definition.id === selectedDepartmentId ? " selected" : "";
      return `<option value="${escapeHtml(definition.id)}"${selected}>${escapeHtml(shortenText(definition.department, 18))}</option>`;
    }).join("");
  }

  function getMainTablePhotoLightboxContext(lightbox = state.photoLightbox || buildInitialPhotoLightboxState()) {
    if (String(lightbox?.sourceKind || "") !== "main-table-gallery" || !lightbox?.sourceId) {
      return null;
    }

    const record = getMainTablePhotoGalleryRecordById(lightbox.sourceId);
    if (!record) {
      return null;
    }

    const displayContext = getMainTableDisplaySnapshotContext();
    const rows = Array.isArray(displayContext?.rows) ? displayContext.rows : [];
    const recordDepartmentId = String(record.departmentId || "").trim();
    const selectedDepartmentId = String(lightbox?.selectedDepartmentId || "").trim();
    const preferredDepartmentId = selectedDepartmentId || recordDepartmentId;
    const boundRow = (
      preferredDepartmentId
        ? rows.find((row) => row?.id === preferredDepartmentId) || null
        : null
    ) || rows.find((row) => Number(row?.photoFeedbackId) === Number(record.id) || row?.id === recordDepartmentId) || null;
    const departmentId = String(boundRow?.id || preferredDepartmentId || "").trim();
    const departmentDefinition = departmentId ? config.getDepartmentById(departmentId) : null;
    const departmentName = boundRow?.department || departmentDefinition?.department || record.departmentName || departmentId;
    const hasLightboxOverride = Boolean(
      lightbox?.recognizedValues
      && typeof lightbox.recognizedValues === "object"
    );
    const previewValues = hasLightboxOverride
      ? normalizePhotoPreviewValueObject(lightbox.recognizedValues)
      : buildPhotoPreviewValuesFromRecord(record);
    const recognizedKeys = hasLightboxOverride
      ? getPhotoPreviewKeysFromValues(previewValues)
      : (Array.isArray(record.recognizedKeys) && record.recognizedKeys.length
        ? record.recognizedKeys.map((item) => String(item))
        : Object.keys(previewValues));
    const recognizedFields = new Set(recognizedKeys);
    const suspectDetails = boundRow
      ? getPhotoImportSuspectDetails(boundRow, recognizedFields, previewValues)
      : { suspectKeys: [], suspectReason: "" };
    const reviewSource = hasLightboxOverride && Array.isArray(lightbox?.cellReviews)
      ? lightbox.cellReviews
      : (Array.isArray(record.cellReviews) ? record.cellReviews : []);
    const reviewByKey = new Map(
      reviewSource.map((item) => [item.key, item])
    );
    const validation = boundRow
      ? buildPhotoImportPreviewValidation(boundRow, previewValues)
      : {
        applicable: false,
        checks: [],
        applicableChecks: [],
        failedChecks: [],
        failedKeySet: new Set(),
        isValid: false,
        statusTone: "neutral"
      };
    const validationStatus = buildPhotoImportPreviewValidationStatus(validation);

    return {
      record,
      displayContext,
      rows,
      boundRow,
      departmentId,
      departmentName,
      departmentChanged: Boolean(departmentId && recordDepartmentId && departmentId !== recordDepartmentId),
      previewValues,
      recognizedKeys,
      recognizedFields,
      reviewSource,
      suspectDetails,
      reviewByKey,
      validation,
      validationStatus
    };
  }

  function getPhotoPreviewKeysFromValues(values) {
    const sourceValues = values && typeof values === "object" ? values : {};
    return PHOTO_FIELD_DEFINITIONS
      .filter((field) => !field.computed)
      .filter((field) => Object.prototype.hasOwnProperty.call(sourceValues, field.key) && sourceValues[field.key] !== null)
      .map((field) => field.key);
  }

  function getPhotoPreviewGroups() {
    return [
      {
        title: "ԵՂԵԼ Է",
        keys: [
          { key: "beenTotal", label: "ԸՆԴ" },
          { key: "beenSoldier", label: "Զ/Ծ" },
          { key: "beenSeries", label: "ՇԱՐ" }
        ]
      },
      {
        title: "ԸՆԴՈՒՆՎԵԼ Է",
        keys: [
          { key: "admittedTotal", label: "ԸՆԴ" },
          { key: "admittedSoldier", label: "Զ/Ծ" },
          { key: "admittedSeries", label: "ՇԱՐ" }
        ]
      },
      {
        title: "Դ/Գ",
        keys: [
          { key: "dgTotal", label: "ԸՆԴ" },
          { key: "dgSoldier", label: "Զ/Ծ" },
          { key: "dgSeries", label: "ՇԱՐ" }
        ]
      },
      {
        title: "Տեղափոխ",
        keys: [
          { key: "transferFromDepartment", label: "Դուրս" },
          { key: "transferToDepartment", label: "Ներս" }
        ]
      },
      {
        title: "Առկա է",
        keys: [
          { key: "presentTotal", label: "Ընդհ." },
          { key: "currentShar", label: "ՇԱՐ" },
          { key: "currentSpa", label: "ՍՊԱ" },
          { key: "currentPaym", label: "ՊԱՅՄ" },
          { key: "currentZh", label: "Զ/Հ" },
          { key: "family", label: "Զ/Ծ ընտ" },
          { key: "officer", label: "Զ/Պ" },
          { key: "civil", label: "Ք-ի" }
        ]
      },
      {
        title: "Արձակուրդում",
        keys: [
          { key: "leaveSharq", label: "ՇԱՐ" },
          { key: "leaveSpa", label: "ՍՊԱ" },
          { key: "leavePaym", label: "ՊԱՅՄ" }
        ]
      },
      {
        label: "Առկա է",
        cells: LEAVE_CALC_COLUMNS.map((column) => ({ key: column.presentKey, marker: column.presentOutputMarker, role: "present-output" }))
      }
    ];
  }

  function renderPhotoLightboxDepartmentTable(snapshot, row) {
    if (!snapshot || !row) {
      return "";
    }

    const groups = getPhotoPreviewGroups();
    const groupHeaders = groups
      .map((group) => `<th colspan="${group.keys.length}">${escapeHtml(group.title)}</th>`)
      .join("");
    const subHeaders = groups
      .map((group) => group.keys.map((cell) => `<th>${escapeHtml(cell.label)}</th>`).join(""))
      .join("");
    const dataCells = groups
      .map((group) => group.keys.map((cell) => `
        <td class="photo-import-mini-table__cell photo-import-mini-table__cell--neutral">
          <span>${escapeHtml(getRowDisplayValue(snapshot, row, cell.key) || "?")}</span>
        </td>
      `).join(""))
      .join("");

    return `
      <div class="photo-lightbox-department-table">
        <div class="photo-lightbox-ocr__head">
          <h3>Текущая таблица отделения</h3>
        </div>
        <div class="photo-import-mini-table-wrap photo-lightbox-department-table__wrap">
          <table class="photo-import-mini-table photo-lightbox-department-mini-table" aria-label="Текущая таблица отделения">
            <thead>
              <tr>${groupHeaders}</tr>
              <tr>${subHeaders}</tr>
            </thead>
            <tbody>
              <tr>${dataCells}</tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildMainTablePhotoGalleryContent(displayContext = getMainTableDisplaySnapshotContext()) {
    const rows = Array.isArray(displayContext?.rows) ? displayContext.rows : [];
    const items = getMainTablePhotoGalleryItems(rows);
    const isDeletingAll = Boolean(state.mainTablePhotoGallery.isDeletingAll);

    if (state.mainTablePhotoGallery.error) {
      return {
        summary: state.mainTablePhotoGallery.error,
        html: '<div class="archive-empty">Не удалось загрузить фото бланков для этой таблицы.</div>'
      };
    }

    if (state.mainTablePhotoGallery.isLoading && !items.length) {
      return {
        summary: "Загружаю фото бланков для текущей сводки...",
        html: '<div class="archive-empty">Загружаю фото...</div>'
      };
    }

    if (!items.length) {
      return {
        summary: "Для текущих суток пока нет связанных фото бланков.",
        html: '<div class="archive-empty">Сегодняшних связанных фото бланков пока нет.</div>'
      };
    }

    return {
      summary: `Показано сегодняшних фото бланков из Telegram-бота: ${items.length}. Один клик открывает фото, двойной клик — страницу отделения.`,
      html: `
        <div class="main-table-photo-gallery-grid">
          ${items.map((item) => `
            <div class="main-table-photo-thumb-card" data-main-table-photo-feedback="${escapeHtml(String(item.feedbackId))}">
              <button
                type="button"
                class="main-table-photo-thumb-delete"
                data-main-table-photo-delete="${escapeHtml(String(item.feedbackId))}"
                data-main-table-photo-department-id="${escapeHtml(item.departmentId || item.rowId || "")}"
                aria-label="${escapeHtml(`Удалить фото ${item.departmentName}`)}"
                title="Удалить фото"
                ${isDeletingAll ? "disabled" : ""}
              >×</button>
              <button
                type="button"
                class="main-table-photo-thumb"
                data-main-table-photo-open="${escapeHtml(String(item.feedbackId))}"
                data-main-table-photo-department-id="${escapeHtml(item.departmentId || item.rowId || "")}"
                aria-label="${escapeHtml(`Открыть фото бланка ${item.departmentName}`)}"
                title="${escapeHtml(`${item.departmentName}${item.photoReportDate ? `
Дата на фото: ${item.photoReportDate}` : ""}${item.photoSentAt ? `
Отправлено: ${formatTimestamp(item.photoSentAt)}` : ""}`)}"
                ${isDeletingAll ? "disabled" : ""}
              >
                <img
                  src="${escapeHtml(item.imageDataUrl)}"
                  alt="${escapeHtml(`Фото бланка ${item.departmentName}`)}"
                  loading="lazy"
                  decoding="async"
                >
              </button>
              <div class="main-table-photo-thumb__meta">
                <span class="main-table-photo-thumb__caption">${escapeHtml(item.departmentName)}</span>
                ${item.photoSentAt ? `<span class="main-table-photo-thumb__updated">Отправлено ${escapeHtml(formatTimestamp(item.photoSentAt))}</span>` : ""}
                ${item.sourceMeta?.text ? `<span class="main-table-photo-thumb__source${item.sourceMeta.kind === "android" ? " main-table-photo-thumb__source--android" : ""}">${escapeHtml(item.sourceMeta.text)}</span>` : ""}
                ${item.imageName ? `<span class="main-table-photo-thumb__file">Файл: ${escapeHtml(item.imageName)}</span>` : ""}
                <label class="main-table-photo-thumb__department-picker">
                  <span>Отделение</span>
                  <select
                    data-main-table-photo-department-select="${escapeHtml(String(item.feedbackId))}"
                    data-current-department-id="${escapeHtml(item.departmentId || item.rowId || "")}"
                    ${isDeletingAll ? "disabled" : ""}
                  >
                    ${buildMainTablePhotoDepartmentOptions(item.departmentId || item.rowId || "")}
                  </select>
                </label>
              </div>
            </div>
          `).join("")}
        </div>
      `
    };
  }

  function buildMainTableTelegramFormContent() {
    const items = buildMainTableTelegramFormItems();
    const isDeletingAll = Boolean(state.mainTableTelegramForms.isDeletingAll);

    if (!sync.hasRemoteSync?.() || typeof sync.listTelegramFormFeedback !== "function") {
      return {
        summary: "Блок Telegram Web форм доступен только в онлайн-режиме владельца.",
        html: '<div class="archive-empty">Telegram Web формы на сервере недоступны в локальном режиме.</div>'
      };
    }

    if (state.mainTableTelegramForms.error) {
      return {
        summary: state.mainTableTelegramForms.error,
        html: '<div class="archive-empty">Не удалось загрузить сегодняшние Telegram Web формы.</div>'
      };
    }

    if (state.mainTableTelegramForms.isLoading && !items.length) {
      return {
        summary: "Загружаю сегодняшние Telegram Web формы...",
        html: '<div class="archive-empty">Загружаю формы...</div>'
      };
    }

    if (!items.length) {
      return {
        summary: "За текущие сутки отправленных Telegram Web форм пока нет.",
        html: '<div class="archive-empty">Сегодняшние Telegram Web формы пока не поступали.</div>'
      };
    }

    const archivePreviewActive = Boolean(state.activeMainTableSavedPreviewKey);
    const dirtyMainRows = getMainTableDirtyRows();
    const hasDirtyMainRows = dirtyMainRows.length > 0;

    return {
      summary: `Показано сегодняшних Telegram Web форм: ${items.length}. Для каждой формы можно обновить основную таблицу или удалить её отдельно.`,
      html: `
        <div class="main-table-telegram-form-list">
          ${items.map((item) => {
            const canApply = Boolean(item.liveRow && item.appliedKeys.length)
              && !archivePreviewActive
              && !hasDirtyMainRows
              && !state.mainTableSaveInFlight
              && !isDeletingAll;
            const statusText = item.alreadySaved
              ? "Уже в основной таблице"
              : (item.liveRow ? "Готова к обновлению" : "Не удалось привязать к строке отделения");
            const statusClass = item.alreadySaved
              ? "main-table-telegram-form-card__status--saved"
              : (item.liveRow ? "main-table-telegram-form-card__status--pending" : "main-table-telegram-form-card__status--error");
            const reportDateText = item.reportDate
              ? `Дата отчёта: ${item.reportDate}`
              : "Дата отчёта не указана";
            const createdAtText = item.createdAt
              ? `Отправлено: ${formatTimestamp(item.createdAt)}`
              : "Время отправки не указано";
            const disabledReason = isDeletingAll
              ? "Дождитесь завершения массового удаления форм."
              : (archivePreviewActive
              ? "Сначала вернитесь к текущей таблице."
              : (hasDirtyMainRows
                ? "Сначала сохраните или отмените ручные правки в главной таблице."
                : (!item.liveRow
                  ? "У формы нет корректной привязки к строке отделения."
                  : (!item.appliedKeys.length
                    ? "В этой форме нет значений для записи в основную таблицу."
                    : ""))));
            return `
              <article class="main-table-telegram-form-card">
                <div class="main-table-telegram-form-card__head">
                  <div class="main-table-telegram-form-card__meta">
                    <strong>${escapeHtml(item.departmentName || item.departmentId || `feedback ${item.id}`)}</strong>
                    <span>${escapeHtml(item.formLabel)}</span>
                    <span>${escapeHtml(reportDateText)}</span>
                    <span>${escapeHtml(createdAtText)}</span>
                  </div>
                  <span class="main-table-telegram-form-card__status ${statusClass}">${escapeHtml(statusText)}</span>
                </div>
                <div class="main-table-telegram-form-card__actions">
                  <button
                    type="button"
                    data-main-table-telegram-form-apply="${escapeHtml(String(item.id))}"
                    ${canApply ? "" : "disabled"}
                    title="${escapeHtml(disabledReason || "Записать значения этой формы в основную таблицу")}"
                  >Обновить основную таблицу</button>
                  <button
                    type="button"
                    class="main-table-telegram-form-card__delete"
                    data-main-table-telegram-form-delete="${escapeHtml(String(item.id))}"
                    data-main-table-telegram-form-department-id="${escapeHtml(item.departmentId || "")}"
                    ${isDeletingAll ? "disabled" : ""}
                    title="${escapeHtml(isDeletingAll ? "Дождитесь завершения массового удаления форм." : "Удалить эту Telegram Web форму")}"
                  >Удалить</button>
                </div>
                ${disabledReason && !canApply ? `<div class="main-table-telegram-form-card__hint">${escapeHtml(disabledReason)}</div>` : ""}
                ${item.previewRow ? renderMainTableTelegramFormPreviewTable(item, item.previewRow) : '<div class="archive-empty">Не удалось собрать таблицу предпросмотра для этой формы.</div>'}
              </article>
            `;
          }).join("")}
        </div>
      `
    };
  }

  function getMainTablePhotoGalleryDepartmentPath(record, feedbackId) {
    const departmentId = typeof record?.departmentId === "string" && record.departmentId.trim()
      ? record.departmentId.trim()
      : "";
    if (!departmentId) {
      return "";
    }

    return appendQueryParams(config.getDepartmentPagePath(basePath, departmentId), {
      tgFeedback: feedbackId
    });
  }

  function refreshMainTablePhotoGalleryUi(displayContext = getMainTableDisplaySnapshotContext()) {
    const summaryEl = document.getElementById("mainTablePhotoGallerySummaryText");
    const listEl = document.getElementById("mainTablePhotoGalleryList");
    const deleteAllBtn = document.getElementById("mainTablePhotoGalleryDeleteAllBtn");
    if (!summaryEl || !listEl) {
      refreshMainTableAndroidAppUi(displayContext);
      return;
    }

    const content = getMainTablePhotoGalleryRenderedContent(displayContext);
    const bulkDeleteMeta = getMainTablePhotoGalleryBulkDeleteMeta(displayContext);
    if (summaryEl.textContent !== content.summary) {
      summaryEl.textContent = content.summary;
    }
    const renderToken = String(content.renderToken || 0);
    if (listEl.dataset.renderToken !== renderToken) {
      listEl.innerHTML = content.html;
      listEl.dataset.renderToken = renderToken;
      bindMainTablePhotoGalleryEvents(listEl);
    }
    if (deleteAllBtn) {
      deleteAllBtn.disabled = bulkDeleteMeta.isDisabled;
      deleteAllBtn.textContent = bulkDeleteMeta.label;
      deleteAllBtn.title = bulkDeleteMeta.title;
    }
    refreshMainTableAndroidAppUi(displayContext);
  }

  function refreshMainTableAndroidAppUi(displayContext = getMainTableDisplaySnapshotContext()) {
    const summaryEl = document.getElementById("mainTableAndroidAppSummaryText");
    const listEl = document.getElementById("mainTableAndroidAppList");
    if (!summaryEl || !listEl) {
      return;
    }

    const content = buildMainTableAndroidAppContent(displayContext);
    summaryEl.textContent = content.summary;
    listEl.innerHTML = content.html;
    bindMainTablePhotoGalleryEvents(listEl);
  }

  function refreshMainTableTelegramFormUi() {
    const summaryEl = document.getElementById("mainTableTelegramFormSummaryText");
    const listEl = document.getElementById("mainTableTelegramFormList");
    const deleteAllBtn = document.getElementById("mainTableTelegramFormDeleteAllBtn");
    if (!summaryEl || !listEl) {
      return;
    }

    const content = buildMainTableTelegramFormContent();
    const bulkDeleteMeta = getMainTableTelegramFormBulkDeleteMeta();
    summaryEl.textContent = content.summary;
    listEl.innerHTML = content.html;
    bindMainTableTelegramFormEvents(listEl);
    if (deleteAllBtn) {
      deleteAllBtn.disabled = bulkDeleteMeta.isDisabled;
      deleteAllBtn.textContent = bulkDeleteMeta.label;
      deleteAllBtn.title = bulkDeleteMeta.title;
    }
  }

  function bindMainTablePhotoGalleryEvents(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }

    root.querySelectorAll("[data-main-table-photo-delete]").forEach((button) => {
      if (button.dataset.mainTablePhotoDeleteBound === "true") {
        return;
      }
      button.dataset.mainTablePhotoDeleteBound = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleDeleteMainTablePhotoGalleryFeedback(button);
      });
    });

    root.querySelectorAll("[data-main-table-photo-open]").forEach((button) => {
      if (button.dataset.mainTablePhotoBound === "true") {
        return;
      }
      button.dataset.mainTablePhotoBound = "true";
      let clickTimeoutId = 0;
      button.addEventListener("click", () => {
        const feedbackId = Number(button.getAttribute("data-main-table-photo-open") || "");
        if (!Number.isFinite(feedbackId)) {
          return;
        }
        const record = getMainTablePhotoGalleryRecordById(feedbackId);
        if (!record) {
          return;
        }
        window.clearTimeout(clickTimeoutId);
        clickTimeoutId = window.setTimeout(() => {
          openPhotoLightbox(
            record.imageDataUrl,
            `Photo ${record.departmentName || record.departmentId || feedbackId}`,
            "main-table-gallery",
            feedbackId
          );
        }, 220);
      });
      button.addEventListener("dblclick", () => {
        const feedbackId = Number(button.getAttribute("data-main-table-photo-open") || "");
        const boundDepartmentId = String(button.getAttribute("data-main-table-photo-department-id") || "").trim();
        if (!Number.isFinite(feedbackId)) {
          return;
        }
        const record = getMainTablePhotoGalleryRecordById(feedbackId);
        if (!record) {
          return;
        }
        window.clearTimeout(clickTimeoutId);
        const departmentPath = getMainTablePhotoGalleryDepartmentPath(
          boundDepartmentId ? { ...record, departmentId: boundDepartmentId } : record,
          feedbackId
        );
        if (!departmentPath) {
          return;
        }
        window.open(departmentPath, "_blank", "noopener");
      });
    });

    root.querySelectorAll("[data-main-table-photo-department-select]").forEach((select) => {
      if (select.dataset.mainTablePhotoDepartmentBound === "true") {
        return;
      }
      select.dataset.mainTablePhotoDepartmentBound = "true";
      select.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      select.addEventListener("change", () => {
        handleReassignMainTablePhotoGalleryFeedback(select);
      });
    });
  }

  function bindMainTableTelegramFormEvents(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }

    root.querySelectorAll("[data-main-table-telegram-form-apply]").forEach((button) => {
      if (button.dataset.mainTableTelegramFormApplyBound === "true") {
        return;
      }
      button.dataset.mainTableTelegramFormApplyBound = "true";
      button.addEventListener("click", () => {
        void handleApplyMainTableTelegramForm(button);
      });
    });

    root.querySelectorAll("[data-main-table-telegram-form-delete]").forEach((button) => {
      if (button.dataset.mainTableTelegramFormDeleteBound === "true") {
        return;
      }
      button.dataset.mainTableTelegramFormDeleteBound = "true";
      button.addEventListener("click", () => {
        void handleDeleteMainTableTelegramForm(button);
      });
    });
  }

  async function handleDeleteAllMainTableTelegramForms(button) {
    const bulkDeleteMeta = getMainTableTelegramFormBulkDeleteMeta();
    const items = Array.isArray(bulkDeleteMeta.items) ? [...bulkDeleteMeta.items] : [];

    if (!items.length) {
      setInfo("За сегодня нет Telegram Web форм для массового удаления.", false);
      return;
    }
    if (bulkDeleteMeta.isDeletingAll) {
      return;
    }
    if (typeof sync.deleteDepartmentFeedback !== "function" || !sync.hasRemoteSync?.()) {
      setInfo("Массовое удаление Telegram Web форм доступно только в онлайн-режиме владельца.", true);
      return;
    }

    const confirmed = window.confirm(
      `Удалить с сервера все сегодняшние Telegram Web формы из этого блока? Сейчас будет удалено: ${items.length}.`
    );
    if (!confirmed) {
      return;
    }

    state.mainTableTelegramForms.isDeletingAll = true;
    refreshMainTableTelegramFormUi();

    let deletedCount = 0;
    let lastResult = null;
    const failedItems = [];

    try {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const departmentName = item.departmentName || item.departmentId || `feedback ${item.id}`;
        setInfo(`Удаляю Telegram Web форму ${index + 1} из ${items.length}: ${departmentName}...`, false);
        try {
          const result = await sync.deleteDepartmentFeedback(item.departmentId || "", item.id);
          lastResult = result;
          removeMainTableTelegramFormRecord(item.id);
          deletedCount += 1;
        } catch (error) {
          failedItems.push({
            item,
            error
          });
        }
      }

      if (lastResult) {
        applyLoadedSnapshot(lastResult);
      }

      if (failedItems.length) {
        const failureSummary = failedItems
          .slice(0, 3)
          .map(({ item, error }) => {
            const departmentName = item.departmentName || item.departmentId || `feedback ${item.id}`;
            const reason = error instanceof Error && error.message ? error.message : "ошибка удаления";
            return `${departmentName} (${reason})`;
          })
          .join("; ");
        const extraFailures = failedItems.length > 3 ? ` Ещё ошибок: ${failedItems.length - 3}.` : "";
        setInfo(`Удалено Telegram Web форм: ${deletedCount} из ${items.length}. Не удалось удалить: ${failureSummary}.${extraFailures}`, true);
      } else {
        setInfo(`Все сегодняшние Telegram Web формы удалены: ${deletedCount}.`, false);
      }
    } finally {
      state.mainTableTelegramForms.isDeletingAll = false;
      renderPage();
    }
  }

  async function refreshMainTablePhotoGalleryRecordsFromRemote(displayContext = getMainTableDisplaySnapshotContext()) {
    if (
      mode !== "main"
      || state.mainTablePhotoGallery.isLoading
      || !sync.hasRemoteSync?.()
      || typeof sync.listOcrFeedback !== "function"
    ) {
      refreshMainTablePhotoGalleryUi(displayContext);
      return;
    }

    if (state.mainTablePhotoGallery.loaded && ensureMainTablePhotoGalleryRecordsLoaded().length) {
      refreshMainTablePhotoGalleryUi(displayContext);
    }

    const now = Date.now();
    if (
      state.mainTablePhotoGallery.loaded
      && Number.isFinite(state.mainTablePhotoGallery.lastLoadedAt)
      && now - state.mainTablePhotoGallery.lastLoadedAt < REMOTE_AUX_PANEL_REFRESH_MS
    ) {
      refreshMainTablePhotoGalleryUi(displayContext);
      return;
    }

    state.mainTablePhotoGallery.isLoading = true;
    state.mainTablePhotoGallery.error = "";
    refreshMainTablePhotoGalleryUi(displayContext);

    try {
      const hadLoadedBefore = Boolean(state.mainTablePhotoGallery.loaded);
      const previousRecords = hadLoadedBefore
        ? ensureMainTablePhotoGalleryRecordsLoaded()
          .map(normalizeMainTablePhotoGalleryRecord)
          .filter(Boolean)
        : [];
      const records = await sync.listOcrFeedback(80, {
        createdDateKey: getArchiveDateKey(),
        excludeTelegramForms: true
      });
      const nextRecords = (Array.isArray(records) ? records : [])
        .map(normalizeMainTablePhotoGalleryRecord)
        .filter(Boolean);
      state.mainTablePhotoGallery.records = nextRecords;
      state.mainTablePhotoGallery.loaded = true;
      state.mainTablePhotoGallery.error = "";
      state.mainTablePhotoGallery.lastLoadedAt = Date.now();
      if (hadLoadedBefore) {
        notifyDesktopHostAboutPhotoGalleryUpdates(previousRecords, nextRecords);
      }
    } catch (error) {
      state.mainTablePhotoGallery.loaded = true;
      state.mainTablePhotoGallery.error = error instanceof Error ? error.message : "Не удалось загрузить фото бланков.";
    } finally {
      state.mainTablePhotoGallery.isLoading = false;
      refreshMainTablePhotoGalleryUi(displayContext);
    }
  }

  async function refreshMainTableAndroidAppRecordsFromRemote(displayContext = getMainTableDisplaySnapshotContext()) {
    if (
      mode !== "main"
      || state.mainTableAndroidApp.isLoading
      || !sync.hasRemoteSync?.()
      || typeof sync.listAndroidMainformFeedback !== "function"
    ) {
      refreshMainTableAndroidAppUi(displayContext);
      return;
    }

    if (state.mainTableAndroidApp.loaded && ensureMainTableAndroidAppRecordsLoaded().length) {
      refreshMainTableAndroidAppUi(displayContext);
    }

    const now = Date.now();
    if (
      state.mainTableAndroidApp.loaded
      && Number.isFinite(state.mainTableAndroidApp.lastLoadedAt)
      && now - state.mainTableAndroidApp.lastLoadedAt < REMOTE_AUX_PANEL_REFRESH_MS
    ) {
      refreshMainTableAndroidAppUi(displayContext);
      return;
    }

    state.mainTableAndroidApp.isLoading = true;
    state.mainTableAndroidApp.error = "";
    refreshMainTableAndroidAppUi(displayContext);

    try {
      const records = await sync.listAndroidMainformFeedback(120, {
        createdDateKey: getArchiveDateKey()
      });
      state.mainTableAndroidApp.records = (Array.isArray(records) ? records : [])
        .map(normalizeMainTablePhotoGalleryRecord)
        .filter(Boolean);
      state.mainTableAndroidApp.loaded = true;
      state.mainTableAndroidApp.error = "";
      state.mainTableAndroidApp.lastLoadedAt = Date.now();
    } catch (error) {
      state.mainTableAndroidApp.loaded = true;
      state.mainTableAndroidApp.error = error instanceof Error ? error.message : "Не удалось загрузить отправки Android MAINFORM.";
    } finally {
      state.mainTableAndroidApp.isLoading = false;
      refreshMainTableAndroidAppUi(displayContext);
    }
  }

  async function refreshMainTableTelegramFormRecordsFromRemote() {
    if (
      mode !== "main"
      || state.mainTableTelegramForms.isLoading
      || !sync.hasRemoteSync?.()
      || typeof sync.listTelegramFormFeedback !== "function"
    ) {
      refreshMainTableTelegramFormUi();
      return;
    }

    const now = Date.now();
    if (
      state.mainTableTelegramForms.loaded
      && Number.isFinite(state.mainTableTelegramForms.lastLoadedAt)
      && now - state.mainTableTelegramForms.lastLoadedAt < 45000
    ) {
      refreshMainTableTelegramFormUi();
      return;
    }

    state.mainTableTelegramForms.isLoading = true;
    state.mainTableTelegramForms.error = "";
    refreshMainTableTelegramFormUi();

    try {
      const hadLoadedBefore = Boolean(state.mainTableTelegramForms.loaded);
      const previousRecords = hadLoadedBefore
        ? ensureMainTableTelegramFormRecordsLoaded()
          .map((record) => normalizeMainTableTelegramFormRecord(record))
          .filter(Boolean)
        : [];
      const records = await sync.listTelegramFormFeedback(120);
      const nextRecords = (Array.isArray(records) ? records : [])
        .map((record) => normalizeMainTableTelegramFormRecord(record))
        .filter(Boolean);
      state.mainTableTelegramForms.records = nextRecords;
      state.mainTableTelegramForms.loaded = true;
      state.mainTableTelegramForms.error = "";
      state.mainTableTelegramForms.lastLoadedAt = Date.now();
      if (hadLoadedBefore) {
        notifyDesktopHostAboutTelegramFormUpdates(previousRecords, nextRecords);
      }
    } catch (error) {
      state.mainTableTelegramForms.loaded = true;
      state.mainTableTelegramForms.error = error instanceof Error ? error.message : "Не удалось загрузить Telegram Web формы.";
    } finally {
      state.mainTableTelegramForms.isLoading = false;
      refreshMainTableTelegramFormUi();
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

  function buildOcrFeedbackImageOverrideStorageKey(feedbackId) {
    return `${OCR_FEEDBACK_IMAGE_OVERRIDE_STORAGE_PREFIX}${String(feedbackId || "").trim()}`;
  }

  function storeOcrFeedbackImageOverride(feedbackId, imageDataUrl) {
    const normalizedFeedbackId = String(feedbackId || "").trim();
    const normalizedImageDataUrl = typeof imageDataUrl === "string" ? imageDataUrl.trim() : "";
    if (!normalizedFeedbackId || !normalizedImageDataUrl.startsWith("data:image/")) {
      return;
    }

    try {
      sessionStorage.setItem(
        buildOcrFeedbackImageOverrideStorageKey(normalizedFeedbackId),
        JSON.stringify({
          imageDataUrl: normalizedImageDataUrl,
          savedAt: Date.now()
        })
      );
    } catch (_error) {
    }
  }

  function getOcrFeedbackImageOverride(feedbackId) {
    const normalizedFeedbackId = String(feedbackId || "").trim();
    if (!normalizedFeedbackId) {
      return "";
    }

    try {
      const raw = sessionStorage.getItem(buildOcrFeedbackImageOverrideStorageKey(normalizedFeedbackId));
      if (!raw) {
        return "";
      }

      const parsed = JSON.parse(raw);
      const imageDataUrl = typeof parsed?.imageDataUrl === "string" ? parsed.imageDataUrl.trim() : "";
      return imageDataUrl.startsWith("data:image/") ? imageDataUrl : "";
    } catch (_error) {
      return "";
    }
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
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      label: `${parts.day}.${parts.month}.${parts.year}`,
      timeLabel: `${parts.hour}:${parts.minute}`,
      totalMinutes: (Number(parts.hour) * 60) + Number(parts.minute)
    };
  }

  function getArchiveDayNumber(context) {
    if (!context) {
      return 0;
    }
    return Math.floor(Date.UTC(Number(context.year), Number(context.month) - 1, Number(context.day)) / 86400000);
  }

  function getCompletedUpdateSlotOrdinal(value = new Date()) {
    const context = getArchiveContext(value);
    const dayNumber = getArchiveDayNumber(context);
    const totalMinutes = Number(context.totalMinutes) || 0;

    if (totalMinutes >= DATA_UPDATE_SLOT_MINUTES.evening + DATA_UPDATE_GRACE_MINUTES) {
      return (dayNumber * 2) + 1;
    }

    if (totalMinutes >= DATA_UPDATE_SLOT_MINUTES.morning + DATA_UPDATE_GRACE_MINUTES) {
      return dayNumber * 2;
    }

    return ((dayNumber - 1) * 2) + 1;
  }

  function getUpdateSlotOrdinalForTimestamp(value) {
    const context = getArchiveContext(value);
    const dayNumber = getArchiveDayNumber(context);
    const totalMinutes = Number(context.totalMinutes) || 0;

    if (totalMinutes >= DATA_UPDATE_SLOT_MINUTES.evening - DATA_UPDATE_EARLY_TOLERANCE_MINUTES) {
      return (dayNumber * 2) + 1;
    }

    if (totalMinutes >= DATA_UPDATE_SLOT_MINUTES.morning - DATA_UPDATE_EARLY_TOLERANCE_MINUTES) {
      return dayNumber * 2;
    }

    return ((dayNumber - 1) * 2) + 1;
  }

  function getUpdateSlotLabel(ordinal) {
    return ordinal % 2 === 0 ? "02:00" : "18:00";
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

  function upsertArchiveRecord(record) {
    const normalized = normalizeArchiveRecord(record);
    if (!normalized) {
      return ensureArchiveRecordsLoaded();
    }
    const records = ensureArchiveRecordsLoaded().filter((item) => item.archiveKey !== normalized.archiveKey);
    return writeArchiveRecords([normalized, ...records]);
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

  function getPendingMorningRolloverKey() {
    try {
      return localStorage.getItem(MORNING_ROLLOVER_PENDING_STORAGE_KEY) || "";
    } catch (_error) {
      return "";
    }
  }

  function setPendingMorningRolloverKey(archiveKey) {
    if (!archiveKey) {
      return;
    }
    try {
      localStorage.setItem(MORNING_ROLLOVER_PENDING_STORAGE_KEY, archiveKey);
    } catch (_error) {
    }
  }

  function clearPendingMorningRolloverKey(archiveKey) {
    try {
      if (!archiveKey || getPendingMorningRolloverKey() === archiveKey) {
        localStorage.removeItem(MORNING_ROLLOVER_PENDING_STORAGE_KEY);
      }
    } catch (_error) {
    }
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
      return {
        record: existing,
        shouldRollover: getPendingMorningRolloverKey() === context.key
      };
    }

    if (sync.hasRemoteSync()) {
      const pendingRecord = {
        archiveKey: context.key,
        archiveLabel: context.label,
        capturedAt: new Date().toISOString(),
        reportDate: state.snapshot.reportDate,
        source: "remote-pending",
        snapshot: deepCopy(state.snapshot)
      };
      setPendingMorningRolloverKey(context.key);
      return {
        record: pendingRecord,
        shouldRollover: true
      };
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
    setPendingMorningRolloverKey(context.key);
    return {
      record: nextRecord,
      shouldRollover: true
    };
  }

  async function maybeApplyMorningRolloverAfterArchive(record) {
    if (mode !== "main"
      || !record
      || !record.archiveKey
      || state.morningRolloverInFlight
      || state.morningRolloverCompletedKeys.has(record.archiveKey)
      || typeof sync.rolloverMainAfterArchive !== "function"
      || getPendingMorningRolloverKey() !== record.archiveKey) {
      return;
    }

    state.morningRolloverInFlight = true;
    try {
      const result = await sync.rolloverMainAfterArchive(record.archiveKey, state.snapshot.reportDate);
      state.morningRolloverCompletedKeys.add(record.archiveKey);
      clearPendingMorningRolloverKey(record.archiveKey);
      if (result && result.archiveRecord) {
        upsertArchiveRecord(result.archiveRecord);
      }
      if (result && result.snapshot) {
        applyLoadedSnapshot(result);
      }
      const archiveLabel = record.archiveLabel || record.archiveKey;
      setInfo(result && result.rolloverAlreadyApplied
        ? `Архив ${archiveLabel} уже сохранён, утренний перенос уже был выполнен.`
        : `Архив ${archiveLabel} сохранён. Утренний перенос выполнен: 12→1, 13+20→3, 13+14+15+20+21+22→2, 4–11 обнулены.`,
      false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "неизвестная ошибка");
      setInfo(`Архив сохранён, но утренний перенос пока не выполнен: ${message}`, true);
    } finally {
      state.morningRolloverInFlight = false;
    }
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

  function getMainTableSaveSlotContext(value = new Date()) {
    const context = getArchiveContext(value);
    const slotLabel = context.totalMinutes < DATA_UPDATE_SLOT_MINUTES.evening ? "02:00" : "18:00";
    const slotCode = slotLabel === "02:00" ? "02" : "18";
    return {
      dateKey: context.key,
      dateLabel: context.label,
      slotLabel,
      slotKey: `${context.key}-${slotCode}`
    };
  }

  function normalizeMainTableSavedRecord(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    const snapshotKey = typeof record.snapshotKey === "string" && record.snapshotKey.trim()
      ? record.snapshotKey.trim()
      : (typeof record.slotKey === "string" ? record.slotKey.trim() : "");
    if (!snapshotKey) {
      return null;
    }

    const savedAt = typeof record.savedAt === "string" && record.savedAt.trim()
      ? record.savedAt.trim()
      : new Date().toISOString();
    const slotContext = getMainTableSaveSlotContext(new Date(savedAt));

    return {
      snapshotKey,
      slotKey: typeof record.slotKey === "string" && record.slotKey.trim()
        ? record.slotKey.trim()
        : snapshotKey,
      dateKey: typeof record.dateKey === "string" && record.dateKey.trim()
        ? record.dateKey.trim()
        : slotContext.dateKey,
      dateLabel: typeof record.dateLabel === "string" && record.dateLabel.trim()
        ? record.dateLabel.trim()
        : slotContext.dateLabel,
      slotLabel: typeof record.slotLabel === "string" && record.slotLabel.trim()
        ? record.slotLabel.trim()
        : slotContext.slotLabel,
      savedAt,
      reportDate: typeof record.reportDate === "string" && record.reportDate.trim()
        ? record.reportDate.trim()
        : config.DEFAULT_DATE,
      source: typeof record.source === "string" && record.source.trim()
        ? record.source.trim()
        : "local-only",
      snapshot: config.buildSnapshotFromSaved(record.snapshot)
    };
  }

  function sortMainTableSavedRecords(records) {
    return records.sort((left, right) => {
      const byTime = getTimestampSortValue(right.savedAt) - getTimestampSortValue(left.savedAt);
      if (byTime) {
        return byTime;
      }
      return right.snapshotKey.localeCompare(left.snapshotKey);
    });
  }

  function readMainTableSavedRecords() {
    try {
      const raw = localStorage.getItem(MAIN_TABLE_SAVED_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return sortMainTableSavedRecords(parsed.map(normalizeMainTableSavedRecord).filter(Boolean))
        .slice(0, MAX_MAIN_TABLE_SAVED_RECORDS);
    } catch (_error) {
      return [];
    }
  }

  function writeMainTableSavedRecords(records) {
    const normalized = sortMainTableSavedRecords(records.map(normalizeMainTableSavedRecord).filter(Boolean))
      .slice(0, MAX_MAIN_TABLE_SAVED_RECORDS);
    state.mainTableSavedRecords = normalized;
    localStorage.setItem(MAIN_TABLE_SAVED_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function ensureMainTableSavedRecordsLoaded() {
    if (!Array.isArray(state.mainTableSavedRecords) || !state.mainTableSavedRecords.length) {
      state.mainTableSavedRecords = readMainTableSavedRecords();
    }
    return state.mainTableSavedRecords;
  }

  function getMainTableSavedRecordByKey(snapshotKey) {
    if (!snapshotKey) {
      return null;
    }
    return ensureMainTableSavedRecordsLoaded().find((record) => record.snapshotKey === snapshotKey) || null;
  }

  function upsertMainTableSavedRecord(record) {
    const normalized = normalizeMainTableSavedRecord(record);
    if (!normalized) {
      return ensureMainTableSavedRecordsLoaded();
    }
    const records = ensureMainTableSavedRecordsLoaded()
      .filter((item) => item.snapshotKey !== normalized.snapshotKey);
    return writeMainTableSavedRecords([normalized, ...records]);
  }

  function captureMainTableSavedSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.rows)) {
      return null;
    }

    const savedAt = new Date().toISOString();
    const slotContext = getMainTableSaveSlotContext(new Date(savedAt));
    const record = {
      snapshotKey: slotContext.slotKey,
      slotKey: slotContext.slotKey,
      dateKey: slotContext.dateKey,
      dateLabel: slotContext.dateLabel,
      slotLabel: slotContext.slotLabel,
      savedAt,
      reportDate: String(snapshot.reportDate || config.DEFAULT_DATE).trim() || config.DEFAULT_DATE,
      source: state.source,
      snapshot: deepCopy(snapshot)
    };

    upsertMainTableSavedRecord(record);
    state.selectedMainTableSavedKey = record.snapshotKey;
    return record;
  }

  function getSelectedMainTableSavedRecord(records = ensureMainTableSavedRecordsLoaded()) {
    if (!Array.isArray(records) || !records.length) {
      state.selectedMainTableSavedKey = "";
      return null;
    }

    const selected = state.selectedMainTableSavedKey
      ? records.find((record) => record.snapshotKey === state.selectedMainTableSavedKey) || null
      : null;
    if (selected) {
      return selected;
    }

    state.selectedMainTableSavedKey = records[0].snapshotKey;
    return records[0];
  }

  function getActiveMainTableSavedPreviewRecord(records = ensureMainTableSavedRecordsLoaded()) {
    if (!state.activeMainTableSavedPreviewKey) {
      return null;
    }

    const activeRecord = Array.isArray(records)
      ? records.find((record) => record.snapshotKey === state.activeMainTableSavedPreviewKey) || null
      : null;
    if (activeRecord) {
      return activeRecord;
    }

    state.activeMainTableSavedPreviewKey = "";
    return null;
  }

  function getMainTableDisplaySnapshotContext(records = ensureMainTableSavedRecordsLoaded()) {
    const previewRecord = getActiveMainTableSavedPreviewRecord(records);
    const snapshot = previewRecord
      ? syncQhCalculatedTargets(primeQhBaseInputs(deepCopy(previewRecord.snapshot)))
      : state.snapshot;
    return {
      previewRecord,
      snapshot,
      rows: Array.isArray(snapshot?.rows) ? snapshot.rows : [],
      headerDateTime: previewRecord ? getHeaderDateTimeParts(previewRecord.reportDate) : null
    };
  }

  function getMainTableSavedSnapshotPath(snapshotKey) {
    if (basePath === "@site") {
      return appendShareQuery(`${window.location.origin}/functions/v1/site?path=${encodeURIComponent("archive-print.html")}&savedMain=${encodeURIComponent(snapshotKey)}&autoprint=0`);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return `${prefix}archive-print.html?savedMain=${encodeURIComponent(snapshotKey)}&autoprint=0`;
  }

  function moveMainTableSavedSelection(direction) {
    const records = ensureMainTableSavedRecordsLoaded();
    if (!records.length) {
      return;
    }

    const current = getSelectedMainTableSavedRecord(records);
    const currentIndex = current
      ? records.findIndex((record) => record.snapshotKey === current.snapshotKey)
      : 0;
    const nextIndex = Math.min(records.length - 1, Math.max(0, currentIndex + direction));
    state.selectedMainTableSavedKey = records[nextIndex].snapshotKey;
  }

  function getArchivePickerRenderKey(records) {
    const items = Array.isArray(records) ? records : [];
    return [
      state.selectedArchiveKey || "",
      ...items.map((record) => `${record.archiveKey}:${record.capturedAt || ""}`)
    ].join("|");
  }

  function buildMainTableSavedSelectionText(record) {
    if (!record) {
      return "Сохранённых таблиц пока нет.";
    }
    return `${record.dateLabel} ${record.slotLabel} — сохранено ${formatTimestamp(record.savedAt)}`;
  }

  function buildMainTableSavedMetaText(record) {
    if (!record) {
      return "Сохраните главную таблицу, чтобы потом быстро открыть старые данные.";
    }
    return `Дата документа: ${record.reportDate}. Это сохранённый снимок главной таблицы для окна ${record.slotLabel}.`;
  }

  function buildMainTableSavedDisplayMetaText(record) {
    if (!record) {
      return buildMainTableSavedMetaText(record);
    }
    if (state.activeMainTableSavedPreviewKey === record.snapshotKey) {
      return `Сейчас на таблице показан снимок за окно ${record.slotLabel}. Дата документа: ${record.reportDate}.`;
    }
    return `Сейчас показана текущая таблица. Снимок ${record.slotLabel} можно открыть стрелками прямо здесь или в отдельной странице.`;
  }

  function buildMainTableSavedNavigator(records) {
    const selectedRecord = getSelectedMainTableSavedRecord(records);
    if (!selectedRecord) {
      return '<div class="archive-empty">Сохранённых таблиц пока нет.</div>';
    }

    return `
      <div class="archive-selector archive-selector--compact">
        <div class="archive-selector-row archive-selector-row--nav">
          <button type="button" class="archive-open-link archive-nav-button" data-main-saved-nav="-1" aria-label="Назад">←</button>
          <div class="archive-current-stamp" id="mainTableSavedStamp">${escapeHtml(buildMainTableSavedSelectionText(selectedRecord))}</div>
          <button type="button" class="archive-open-link archive-nav-button" data-main-saved-nav="1" aria-label="Вперёд">→</button>
          <button type="button" class="archive-open-link archive-open-link--secondary" id="mainTableSavedLiveBtn">Текущая таблица</button>
          <a class="archive-open-link archive-open-link--secondary" id="mainTableSavedOpenLink" href="${escapeHtml(getMainTableSavedSnapshotPath(selectedRecord.snapshotKey))}" target="_blank" rel="noopener">Открыть</a>
        </div>
        <div class="archive-selected-meta" id="mainTableSavedMeta">${escapeHtml(buildMainTableSavedDisplayMetaText(selectedRecord))}</div>
      </div>
    `;
  }

  function syncMainTableSavedNavigatorUi() {
    const records = ensureMainTableSavedRecordsLoaded();
    const selectedRecord = getSelectedMainTableSavedRecord(records);
    const stamp = document.getElementById("mainTableSavedStamp");
    const meta = document.getElementById("mainTableSavedMeta");
    const link = document.getElementById("mainTableSavedOpenLink");
    const liveBtn = document.getElementById("mainTableSavedLiveBtn");
    const buttons = Array.from(document.querySelectorAll("[data-main-saved-nav]"));

    if (stamp) {
      stamp.textContent = buildMainTableSavedSelectionText(selectedRecord);
    }
    if (meta) {
      meta.textContent = buildMainTableSavedDisplayMetaText(selectedRecord);
    }
    if (link instanceof HTMLAnchorElement) {
      if (selectedRecord) {
        link.href = getMainTableSavedSnapshotPath(selectedRecord.snapshotKey);
        link.removeAttribute("aria-disabled");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
      }
    }
    if (liveBtn instanceof HTMLButtonElement) {
      const previewActive = Boolean(state.activeMainTableSavedPreviewKey);
      liveBtn.disabled = !previewActive;
      liveBtn.setAttribute("aria-disabled", String(!previewActive));
      liveBtn.textContent = previewActive ? "Вернуться к текущей таблице" : "Текущая таблица";
    }

    const selectedIndex = selectedRecord
      ? records.findIndex((record) => record.snapshotKey === selectedRecord.snapshotKey)
      : -1;
    buttons.forEach((button) => {
      const direction = Number(button.getAttribute("data-main-saved-nav") || "0");
      const disabled = !selectedRecord
        || !Number.isFinite(direction)
        || (direction < 0 && selectedIndex <= 0)
        || (direction > 0 && selectedIndex >= records.length - 1);
      button.toggleAttribute("disabled", disabled);
      button.setAttribute("aria-disabled", String(disabled));
    });
  }

  function getDepartmentDefinitionById(rowId) {
    return config.departmentDefinitions.find((definition) => definition.id === rowId) || null;
  }

  function getDepartmentSortIndex(rowId) {
    const index = config.departmentDefinitions.findIndex((definition) => definition.id === rowId);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  }

  function getTimestampSortValue(value) {
    const parsed = Date.parse(value || "");
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function normalizeDepartmentPdfArchiveRecord(record) {
    if (!record || typeof record !== "object" || typeof record.archiveKey !== "string") {
      return null;
    }

    const rowId = typeof record.departmentId === "string" ? record.departmentId : "";
    const definition = getDepartmentDefinitionById(rowId);
    const fallbackDateKey = record.archiveKey.split("-").slice(0, 3).join("-");

    return {
      archiveKey: record.archiveKey,
      archiveDateKey: typeof record.archiveDateKey === "string" && record.archiveDateKey.trim()
        ? record.archiveDateKey.trim()
        : fallbackDateKey,
      archiveLabel: typeof record.archiveLabel === "string" && record.archiveLabel.trim()
        ? record.archiveLabel.trim()
        : record.archiveKey,
      archiveDateLabel: typeof record.archiveDateLabel === "string" && record.archiveDateLabel.trim()
        ? record.archiveDateLabel.trim()
        : "",
      capturedAt: typeof record.capturedAt === "string" ? record.capturedAt : new Date().toISOString(),
      reportDate: typeof record.reportDate === "string" && record.reportDate.trim()
        ? record.reportDate.trim()
        : config.DEFAULT_DATE,
      source: typeof record.source === "string" ? record.source : "local-only",
      feedbackId: typeof record.feedbackId === "string" ? record.feedbackId : "",
      departmentId: rowId,
      departmentName: typeof record.departmentName === "string" && record.departmentName.trim()
        ? record.departmentName.trim()
        : (definition ? definition.department : rowId),
      departmentMarker: typeof record.departmentMarker === "string" && record.departmentMarker.trim()
        ? record.departmentMarker.trim()
        : (definition ? definition.marker : ""),
      values: config.normalizeRowValues(record.values || {}),
      updatedAt: typeof record.updatedAt === "string" && record.updatedAt.trim()
        ? record.updatedAt.trim()
        : new Date().toISOString()
    };
  }

  function sortDepartmentPdfArchiveRecords(records) {
    return records.sort((left, right) => {
      const byDate = right.archiveDateKey.localeCompare(left.archiveDateKey);
      if (byDate) {
        return byDate;
      }

      const byTime = getTimestampSortValue(right.capturedAt) - getTimestampSortValue(left.capturedAt);
      if (byTime) {
        return byTime;
      }

      return getDepartmentSortIndex(left.departmentId) - getDepartmentSortIndex(right.departmentId);
    });
  }

  function readDepartmentPdfArchiveRecords() {
    try {
      const raw = localStorage.getItem(DEPARTMENT_PDF_ARCHIVE_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return sortDepartmentPdfArchiveRecords(parsed.map(normalizeDepartmentPdfArchiveRecord).filter(Boolean))
        .slice(0, MAX_DEPARTMENT_PDF_ARCHIVE_RECORDS);
    } catch (_error) {
      return [];
    }
  }

  function writeDepartmentPdfArchiveRecords(records) {
    const normalized = sortDepartmentPdfArchiveRecords(records.map(normalizeDepartmentPdfArchiveRecord).filter(Boolean))
      .slice(0, MAX_DEPARTMENT_PDF_ARCHIVE_RECORDS);
    state.departmentPdfArchiveRecords = normalized;
    localStorage.setItem(DEPARTMENT_PDF_ARCHIVE_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function upsertDepartmentPdfArchiveRecord(record) {
    const normalized = normalizeDepartmentPdfArchiveRecord(record);
    if (!normalized) {
      return ensureDepartmentPdfArchiveRecordsLoaded();
    }
    const records = ensureDepartmentPdfArchiveRecordsLoaded()
      .filter((item) => item.archiveKey !== normalized.archiveKey);
    return writeDepartmentPdfArchiveRecords([normalized, ...records]);
  }

  function ensureDepartmentPdfArchiveRecordsLoaded() {
    if (!Array.isArray(state.departmentPdfArchiveRecords) || !state.departmentPdfArchiveRecords.length) {
      state.departmentPdfArchiveRecords = readDepartmentPdfArchiveRecords();
    }
    return state.departmentPdfArchiveRecords;
  }

  function getDepartmentPdfArchiveRecordByKey(archiveKey) {
    if (!archiveKey) {
      return null;
    }
    return ensureDepartmentPdfArchiveRecordsLoaded().find((record) => record.archiveKey === archiveKey) || null;
  }

  function captureDepartmentPdfArchiveFromSave(snapshot, rowId) {
    if (!snapshot || !rowId) {
      return null;
    }

    const row = Array.isArray(snapshot.rows)
      ? snapshot.rows.find((item) => item && item.id === rowId)
      : null;
    const definition = getDepartmentDefinitionById(rowId);
    if (!row || !definition) {
      return null;
    }

    const capturedAt = String(row.updatedAt || snapshot.updatedAt || new Date().toISOString()).trim() || new Date().toISOString();
    const reportDate = String(snapshot.reportDate || config.DEFAULT_DATE).trim() || config.DEFAULT_DATE;
    const archiveDateKey = normalizeDepartmentPdfArchiveDateKey(reportDate || capturedAt);
    if (!archiveDateKey) {
      return null;
    }

    const archiveDateLabel = formatDepartmentPdfArchiveDateLabel(archiveDateKey, reportDate);
    const timestampKey = String(getTimestampSortValue(capturedAt) || Date.now());
    const record = {
      archiveKey: `${archiveDateKey}-${rowId}-${timestampKey}`,
      archiveDateKey,
      archiveLabel: archiveDateLabel,
      archiveDateLabel,
      capturedAt,
      reportDate,
      source: typeof row.photoWorkflowStatus === "string" && row.photoWorkflowStatus.trim()
        ? row.photoWorkflowStatus.trim()
        : "department-save",
      feedbackId: "",
      departmentId: rowId,
      departmentName: definition.department,
      departmentMarker: definition.marker,
      values: config.normalizeRowValues(row.values || {}),
      updatedAt: capturedAt
    };

    upsertDepartmentPdfArchiveRecord(record);
    if (!state.selectedDepartmentPdfArchiveKey) {
      state.selectedDepartmentPdfArchiveKey = record.archiveKey;
    }
    if (!state.selectedDepartmentPdfArchiveDate) {
      state.selectedDepartmentPdfArchiveDate = archiveDateKey;
    }
    refreshDepartmentPdfArchiveUi();
    return record;
  }

  function backfillDepartmentPdfArchiveFromSnapshot(snapshot) {
    if (
      !snapshot
      || !Array.isArray(snapshot.rows)
      || ensureDepartmentPdfArchiveRecordsLoaded().length
    ) {
      return ensureDepartmentPdfArchiveRecordsLoaded();
    }

    snapshot.rows.forEach((row) => {
      const definition = getDepartmentDefinitionById(row && row.id);
      const capturedAt = String((row && row.updatedAt) || "").trim();
      if (!definition || !capturedAt) {
        return;
      }

      const reportDate = String(snapshot.reportDate || config.DEFAULT_DATE).trim() || config.DEFAULT_DATE;
      const archiveDateKey = normalizeDepartmentPdfArchiveDateKey(reportDate || capturedAt);
      if (!archiveDateKey) {
        return;
      }

      const timestampKey = String(getTimestampSortValue(capturedAt) || Date.now());
      upsertDepartmentPdfArchiveRecord({
        archiveKey: `${archiveDateKey}-${row.id}-${timestampKey}`,
        archiveDateKey,
        archiveLabel: formatDepartmentPdfArchiveDateLabel(archiveDateKey, reportDate),
        archiveDateLabel: formatDepartmentPdfArchiveDateLabel(archiveDateKey, reportDate),
        capturedAt,
        reportDate,
        source: typeof row.photoWorkflowStatus === "string" && row.photoWorkflowStatus.trim()
          ? row.photoWorkflowStatus.trim()
          : "snapshot-backfill",
        feedbackId: "",
        departmentId: row.id,
        departmentName: definition.department,
        departmentMarker: definition.marker,
        values: config.normalizeRowValues(row.values || {}),
        updatedAt: capturedAt
      });
    });

    refreshDepartmentPdfArchiveUi();
    return ensureDepartmentPdfArchiveRecordsLoaded();
  }

  function normalizeDepartmentPdfArchiveDateKey(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const localMatch = raw.match(/^(\d{1,2})[.,/](\d{1,2})[.,/](\d{2,4})/);
    if (localMatch) {
      const day = localMatch[1].padStart(2, "0");
      const month = localMatch[2].padStart(2, "0");
      const year = localMatch[3].length === 2 ? `20${localMatch[3]}` : localMatch[3];
      return `${year}-${month}-${day}`;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return "";
  }

  function formatDepartmentPdfArchiveDateLabel(dateKey, fallback = "") {
    const raw = String(dateKey || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return String(fallback || raw).trim();
    }
    return `${match[3]}.${match[2]}.${match[1]}`;
  }

  function normalizeTelegramWebFormArchiveRecord(record) {
    if (!record || typeof record !== "object") {
      return null;
    }
    const imageName = String(record.imageName || record.image_name || "").trim();
    if (imageName !== "telegram-web-app-form") {
      return null;
    }

    const feedbackId = String(record.id || record.feedbackId || "").trim();
    const departmentId = String(record.departmentId || record.department_id || "").trim();
    const definition = getDepartmentDefinitionById(departmentId);
    if (!feedbackId || !definition) {
      return null;
    }

    const reportDate = String(record.reportDate || record.report_date || "").trim();
    const createdAt = String(record.createdAt || record.created_at || new Date().toISOString()).trim();
    const archiveDateKey = normalizeDepartmentPdfArchiveDateKey(reportDate || createdAt);
    if (!archiveDateKey) {
      return null;
    }

    const values = record.finalValues || record.final_values || record.recognizedValues || record.recognized_values || {};
    const archiveDateLabel = formatDepartmentPdfArchiveDateLabel(archiveDateKey, reportDate);
    const timeLabel = formatTimestamp(createdAt);
    return normalizeDepartmentPdfArchiveRecord({
      archiveKey: `${archiveDateKey}-${departmentId}-${feedbackId}`,
      archiveDateKey,
      archiveLabel: timeLabel ? `${archiveDateLabel} ${timeLabel}` : archiveDateLabel,
      archiveDateLabel,
      capturedAt: createdAt,
      reportDate,
      source: "telegram-web-app",
      feedbackId,
      departmentId,
      departmentName: String(record.departmentName || record.department_name || definition.department).trim(),
      departmentMarker: definition.marker,
      values,
      updatedAt: createdAt
    });
  }

  function refreshDepartmentPdfArchiveUi() {
    const records = ensureDepartmentPdfArchiveRecordsLoaded();
    const summary = document.getElementById("departmentPdfArchiveSummaryText");
    if (summary) {
      summary.textContent = getDepartmentPdfArchiveSummaryText(records);
    }
    const list = document.getElementById("departmentPdfArchiveList");
    if (list) {
      list.innerHTML = buildMainDepartmentPdfArchivePicker(records);
    }
    syncDepartmentPdfArchivePickerUi();
    syncMainDepartmentPdfArchivePickerUi();
  }

  async function refreshDepartmentPdfArchiveRecordsFromRemote() {
    if (
      state.departmentPdfArchiveRemoteLoading ||
      !sync.hasRemoteSync?.() ||
      typeof sync.listOcrFeedback !== "function"
    ) {
      refreshDepartmentPdfArchiveUi();
      return;
    }

    state.departmentPdfArchiveRemoteLoading = true;
    try {
      const records = await sync.listOcrFeedback(500);
      const normalized = sortDepartmentPdfArchiveRecords(
        (Array.isArray(records) ? records : [])
          .map(normalizeTelegramWebFormArchiveRecord)
          .filter(Boolean)
      ).slice(0, MAX_DEPARTMENT_PDF_ARCHIVE_RECORDS);

      if (normalized.length) {
        const localRecords = ensureDepartmentPdfArchiveRecordsLoaded();
        const mergedByKey = new Map();
        [...normalized, ...localRecords].forEach((record) => {
          if (record && typeof record.archiveKey === "string" && !mergedByKey.has(record.archiveKey)) {
            mergedByKey.set(record.archiveKey, record);
          }
        });
        state.departmentPdfArchiveRecords = sortDepartmentPdfArchiveRecords(Array.from(mergedByKey.values()))
          .slice(0, MAX_DEPARTMENT_PDF_ARCHIVE_RECORDS);
        localStorage.setItem(DEPARTMENT_PDF_ARCHIVE_STORAGE_KEY, JSON.stringify(state.departmentPdfArchiveRecords));
        state.departmentPdfArchiveRemoteLoaded = true;
        const selectedKeyExists = state.departmentPdfArchiveRecords.some((record) => record.archiveKey === state.selectedDepartmentPdfArchiveKey);
        if (!selectedKeyExists) {
          state.selectedDepartmentPdfArchiveKey = state.departmentPdfArchiveRecords[0].archiveKey;
        }
        const selectedDateExists = state.departmentPdfArchiveRecords.some((record) => record.archiveDateKey === state.selectedDepartmentPdfArchiveDate);
        if (!selectedDateExists) {
          state.selectedDepartmentPdfArchiveDate = state.departmentPdfArchiveRecords[0].archiveDateKey;
        }
      }
    } catch (error) {
      console.warn("Failed to load Telegram Web App PDF archive.", error);
    } finally {
      state.departmentPdfArchiveRemoteLoading = false;
      refreshDepartmentPdfArchiveUi();
    }
  }

  function getDepartmentPdfArchiveDateGroups(records = ensureDepartmentPdfArchiveRecordsLoaded()) {
    const groupsByDate = new Map();

    records.forEach((record) => {
      const dateKey = record.archiveDateKey;
      if (!groupsByDate.has(dateKey)) {
        groupsByDate.set(dateKey, {
          dateKey,
          label: record.archiveDateLabel || record.archiveLabel || dateKey,
          count: 0,
          departmentIds: new Set(),
          latestCapturedAt: record.capturedAt
        });
      }

      const group = groupsByDate.get(dateKey);
      group.count += 1;
      group.departmentIds.add(record.departmentId);
      if (getTimestampSortValue(record.capturedAt) > getTimestampSortValue(group.latestCapturedAt)) {
        group.latestCapturedAt = record.capturedAt;
      }
    });

    return Array.from(groupsByDate.values())
      .map((group) => ({
        dateKey: group.dateKey,
        label: group.label,
        count: group.count,
        departmentCount: group.departmentIds.size,
        latestCapturedAt: group.latestCapturedAt
      }))
      .sort((left, right) => right.dateKey.localeCompare(left.dateKey));
  }

  function getSelectedDepartmentPdfArchiveDateGroup(groups = getDepartmentPdfArchiveDateGroups()) {
    if (!Array.isArray(groups) || !groups.length) {
      state.selectedDepartmentPdfArchiveDate = "";
      return null;
    }

    const selected = state.selectedDepartmentPdfArchiveDate
      ? groups.find((group) => group.dateKey === state.selectedDepartmentPdfArchiveDate) || null
      : null;
    if (selected) {
      return selected;
    }

    state.selectedDepartmentPdfArchiveDate = groups[0].dateKey;
    return groups[0];
  }

  function getDepartmentPdfArchiveRecordsForDate(dateKey) {
    if (!dateKey) {
      return [];
    }

    const latestByDepartment = new Map();
    ensureDepartmentPdfArchiveRecordsLoaded()
      .filter((record) => record.archiveDateKey === dateKey)
      .forEach((record) => {
        const existing = latestByDepartment.get(record.departmentId);
        if (!existing || getTimestampSortValue(record.capturedAt) > getTimestampSortValue(existing.capturedAt)) {
          latestByDepartment.set(record.departmentId, record);
        }
      });

    return Array.from(latestByDepartment.values())
      .sort((left, right) => getDepartmentSortIndex(left.departmentId) - getDepartmentSortIndex(right.departmentId));
  }

  function buildSnapshotFromDepartmentPdfArchiveRecords(records, reportDate) {
    const recordsByDepartment = new Map(records.map((record) => [record.departmentId, record]));
    const rows = records.map((record) => ({
      id: record.departmentId,
      values: config.normalizeRowValues(record.values),
      updatedAt: record.updatedAt || record.capturedAt,
      photoWorkflowStatus: "processed",
      photoFeedbackId: null,
      photoFeedbackUpdatedAt: null,
      photoName: "",
      lastUpdateSource: ""
    }));
    const snapshot = config.buildSnapshotFromSaved({
      reportDate: reportDate || (records[0] ? records[0].reportDate : config.DEFAULT_DATE),
      updatedAt: records[0] ? records[0].capturedAt : null,
      rows
    });
    snapshot.rows = snapshot.rows
      .filter((row) => recordsByDepartment.has(row.id))
      .map((row) => {
        const record = recordsByDepartment.get(row.id);
        return {
          ...row,
          department: record?.departmentName || row.department,
          marker: record?.departmentMarker || row.marker
        };
      });
    return snapshot;
  }

  function getDepartmentPdfArchiveRecordsForDepartment(rowId) {
    return ensureDepartmentPdfArchiveRecordsLoaded()
      .filter((record) => record.departmentId === rowId)
      .sort((left, right) => getTimestampSortValue(right.capturedAt) - getTimestampSortValue(left.capturedAt));
  }

  function getSelectedDepartmentPdfArchiveRecord(rowId) {
    const records = getDepartmentPdfArchiveRecordsForDepartment(rowId);
    if (!records.length) {
      state.selectedDepartmentPdfArchiveKey = "";
      return null;
    }

    const selected = state.selectedDepartmentPdfArchiveKey
      ? records.find((record) => record.archiveKey === state.selectedDepartmentPdfArchiveKey) || null
      : null;
    if (selected) {
      return selected;
    }

    state.selectedDepartmentPdfArchiveKey = records[0].archiveKey;
    return records[0];
  }

  function getDepartmentPdfArchiveSummaryText(records) {
    if (!Array.isArray(records) || !records.length) {
      return "PDF-архив отделений пока пуст. Он начнет заполняться после сохранения отделений.";
    }
    const groups = getDepartmentPdfArchiveDateGroups(records);
    const latest = groups[0];
    return `PDF-бланков: ${records.length}. Дат: ${groups.length}. Последняя дата: ${latest ? latest.label : "-"}.`;
  }

  function getDepartmentPdfArchiveSelectionText(record) {
    if (!record) {
      return "После сохранения отделения здесь появятся PDF-бланки этого отделения.";
    }
    const marker = record.departmentMarker ? `${record.departmentMarker} ` : "";
    return `${marker}${record.departmentName}: ${record.archiveLabel}. Сохранено: ${formatTimestamp(record.capturedAt)}.`;
  }

  function buildDepartmentPdfArchiveOptions(records, selectedArchiveKey) {
    return records.map((record) => `
      <option value="${escapeHtml(record.archiveKey)}"${record.archiveKey === selectedArchiveKey ? " selected" : ""}>
        ${escapeHtml(`${record.archiveLabel} - ${formatTimestamp(record.capturedAt)}`)}
      </option>
    `).join("");
  }

  function buildDepartmentPdfArchiveDateOptions(groups, selectedDateKey) {
    return groups.map((group) => `
      <option value="${escapeHtml(group.dateKey)}"${group.dateKey === selectedDateKey ? " selected" : ""}>
        ${escapeHtml(`${group.label} - отделений: ${group.departmentCount}`)}
      </option>
    `).join("");
  }

  function renderDepartmentPdfArchivePanel(row) {
    const records = getDepartmentPdfArchiveRecordsForDepartment(row.id);
    const selectedRecord = getSelectedDepartmentPdfArchiveRecord(row.id);
    return `
      <section class="panel no-print archive-panel department-pdf-archive-panel">
        <h2>Архив PDF бланков</h2>
        <p class="hint">Здесь сохраняются PDF-бланки этого отделения после успешного сохранения данных.</p>
        ${records.length ? `
          <div class="archive-selector">
            <div class="archive-selector-row">
              <label class="archive-picker" for="departmentPdfArchiveSelect">
                <span>Бланк отделения</span>
                <select id="departmentPdfArchiveSelect">
                  ${buildDepartmentPdfArchiveOptions(records, selectedRecord ? selectedRecord.archiveKey : "")}
                </select>
              </label>
              <a class="archive-open-link archive-open-link--secondary" id="departmentPdfArchivePdfLink" href="${escapeHtml(getDepartmentPdfArchivePrintPath(selectedRecord.archiveKey))}" target="_blank" rel="noopener">PDF</a>
            </div>
            <div class="archive-selected-meta" id="departmentPdfArchiveSelectedMeta">${escapeHtml(getDepartmentPdfArchiveSelectionText(selectedRecord))}</div>
          </div>
        ` : '<div class="archive-empty">Пока нет сохраненных PDF-бланков этого отделения.</div>'}
      </section>
    `;
  }

  function buildMainDepartmentPdfArchivePicker(records) {
    const groups = getDepartmentPdfArchiveDateGroups(records);
    const selectedGroup = getSelectedDepartmentPdfArchiveDateGroup(groups);
    if (!selectedGroup) {
      return '<div class="archive-empty">Пока нет сохраненных PDF-бланков отделений.</div>';
    }

    return `
      <div class="archive-selector">
        <div class="archive-selector-row">
          <label class="archive-picker" for="departmentPdfArchiveDateSelect">
            <span>Дата бланков</span>
            <select id="departmentPdfArchiveDateSelect">
              ${buildDepartmentPdfArchiveDateOptions(groups, selectedGroup.dateKey)}
            </select>
          </label>
          <a class="archive-open-link archive-open-link--secondary" id="departmentPdfArchiveDatePdfLink" href="${escapeHtml(getDepartmentPdfArchiveDatePrintPath(selectedGroup.dateKey))}" target="_blank" rel="noopener">Общий PDF</a>
        </div>
        <div class="archive-selected-meta" id="departmentPdfArchiveDateSelectedMeta">
          ${escapeHtml(`Дата: ${selectedGroup.label}. Отделений в PDF: ${selectedGroup.departmentCount}. Бланков в архиве: ${selectedGroup.count}.`)}
        </div>
      </div>
    `;
  }

  function syncDepartmentPdfArchivePickerUi() {
    const row = getDepartmentCalcTargetRow();
    if (!row) {
      return;
    }
    const selectedRecord = getSelectedDepartmentPdfArchiveRecord(row.id);
    const select = document.getElementById("departmentPdfArchiveSelect");
    const link = document.getElementById("departmentPdfArchivePdfLink");
    const meta = document.getElementById("departmentPdfArchiveSelectedMeta");

    if (select && selectedRecord) {
      select.value = selectedRecord.archiveKey;
    }
    if (link) {
      if (selectedRecord) {
        link.href = getDepartmentPdfArchivePrintPath(selectedRecord.archiveKey);
        link.removeAttribute("aria-disabled");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
      }
    }
    if (meta) {
      meta.textContent = getDepartmentPdfArchiveSelectionText(selectedRecord);
    }
  }

  function syncMainDepartmentPdfArchivePickerUi() {
    const groups = getDepartmentPdfArchiveDateGroups();
    const selectedGroup = getSelectedDepartmentPdfArchiveDateGroup(groups);
    const select = document.getElementById("departmentPdfArchiveDateSelect");
    const link = document.getElementById("departmentPdfArchiveDatePdfLink");
    const meta = document.getElementById("departmentPdfArchiveDateSelectedMeta");

    if (select && selectedGroup) {
      select.value = selectedGroup.dateKey;
    }
    if (link) {
      if (selectedGroup) {
        link.href = getDepartmentPdfArchiveDatePrintPath(selectedGroup.dateKey);
        link.removeAttribute("aria-disabled");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
      }
    }
    if (meta) {
      meta.textContent = selectedGroup
        ? `Дата: ${selectedGroup.label}. Отделений в PDF: ${selectedGroup.departmentCount}. Бланков в архиве: ${selectedGroup.count}.`
        : "Выберите дату PDF-архива отделений.";
    }
  }

  function getCurrentDateTimeParts() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("ru-RU", {
      timeZone: ARCHIVE_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now);
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    const date = `${get("day")}.${get("month")}.${get("year")}`;
    const time = `${get("hour")}:${get("minute")}`;
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

  function getRowEffectiveUpdatedAt(row) {
    if (!row) {
      return "";
    }

    const source = String(row.lastUpdateSource || row.photoWorkflowStatus || "");
    if (source === "processed_rollover" || source === "processed_night_shift" || source === "processed_day_shift") {
      return row.photoFeedbackUpdatedAt || "";
    }

    return row.updatedAt || row.photoFeedbackUpdatedAt || "";
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

    const updatedSlotOrdinal = getUpdateSlotOrdinalForTimestamp(date);
    const expectedSlotOrdinal = getCompletedUpdateSlotOrdinal();
    const missedSlots = Math.max(0, expectedSlotOrdinal - updatedSlotOrdinal);

    if (missedSlots <= 0) {
      return {
        level: "fresh",
        label: "Свежие",
        timestamp: formatTimestamp(updatedAt),
        age: `Обновлено ${formatAge(updatedAt)}`
      };
    }

    if (missedSlots === 1) {
      return {
        level: "warning",
        label: "Проверить",
        timestamp: formatTimestamp(updatedAt),
        age: `Последнее обновление ${formatAge(updatedAt)}. Нет данных за окно ${getUpdateSlotLabel(expectedSlotOrdinal)}.`
      };
    }

    return {
      level: "stale",
      label: "Старые",
      timestamp: formatTimestamp(updatedAt),
      age: `Данные не обновлялись ${formatAge(updatedAt)}. Пропущено больше одного окна обновления.`
    };
  }

  function getRowFreshnessMeta(row) {
    return getFreshnessMeta(getRowEffectiveUpdatedAt(row), rowHasSubmittedData(row));
  }

  function getDepartmentPhotoWorkflowMeta(row) {
    if (!row) {
      return {
        tone: "neutral",
        label: "Без нового бланка"
      };
    }

    if (String(row.photoWorkflowStatus || "").startsWith("pending") && row.photoFeedbackId) {
      const isTelegramForm = row.photoName === "telegram-web-app-form";
      return {
        tone: "pending",
        label: isTelegramForm ? "Новая Telegram форма" : "Новый бланк"
      };
    }

    const freshness = getRowFreshnessMeta(row);
    if (String(row.photoWorkflowStatus || "").startsWith("processed") && row.photoFeedbackId && freshness.level !== "stale" && freshness.level !== "missing") {
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

  function getDepartmentFeedbackSourceMeta(row) {
    const hasTelegramFormFeedback = Boolean(row && row.hasTelegramFormFeedback);
    const hasPhotoFeedback = Boolean(row && row.hasPhotoFeedback);

    if (hasTelegramFormFeedback && hasPhotoFeedback) {
      return {
        label: "Фото + Telegram",
        tone: "both"
      };
    }

    if (hasPhotoFeedback) {
      return {
        label: "Фото бланка",
        tone: "photo"
      };
    }

    if (hasTelegramFormFeedback) {
      return {
        label: "Telegram форма",
        tone: "form"
      };
    }

    return {
      label: "",
      tone: "none"
    };
  }

  function getDepartmentLastUpdateSourceMeta(row) {
    const source = row && typeof row.lastUpdateSource === "string" && row.lastUpdateSource.trim()
      ? row.lastUpdateSource.trim()
      : (row && typeof row.photoWorkflowStatus === "string" ? row.photoWorkflowStatus.trim() : "");

    if (source === "telegram-form" || source === "processed_telegram") {
      return {
        label: "Telegram",
        tone: "form"
      };
    }

    if (source === "photo" || source === "processed_photo") {
      return {
        label: "Фото",
        tone: "photo"
      };
    }

    if (source === "site" || source === "processed_site") {
      return {
        label: "",
        tone: "none"
      };
    }

    if (source === "processed_rollover" || source === "processed_night_shift" || source === "processed_day_shift") {
      return {
        label: "",
        tone: "none"
      };
    }

    return {
      label: "",
      tone: "none"
    };
  }

  function getDepartmentOpenFeedbackId(row) {
    if (!row) {
      return null;
    }
    if (row.photoFeedbackId !== null && typeof row.photoFeedbackId !== "undefined") {
      return row.photoFeedbackId;
    }
    if (row.latestFeedbackId !== null && typeof row.latestFeedbackId !== "undefined") {
      return row.latestFeedbackId;
    }
    return null;
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

      const effectiveUpdatedAt = getRowEffectiveUpdatedAt(row);
      const time = parseTimestamp(effectiveUpdatedAt);
      if (!time || !rowHasSubmittedData(row)) {
        return;
      }

      if (!oldestRow || time.getTime() < parseTimestamp(getRowEffectiveUpdatedAt(oldestRow)).getTime()) {
        oldestRow = row;
      }
      if (!newestRow || time.getTime() > parseTimestamp(getRowEffectiveUpdatedAt(newestRow)).getTime()) {
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

    if (allUpdated) {
      return {
        level: "fresh",
        label: "Все отделения обновлены",
        detail: `Свежие данные есть у всех ${totalRows} отделений.`
      };
    }

    if (staleCount > 0 || missingCount > 0) {
      return {
        level: "stale",
        label: "Есть устаревшие отделения",
        detail: `Свежие: ${freshCount} из ${totalRows}. Проверить: ${warningCount}, старые: ${staleCount}, нет данных: ${missingCount}.`
      };
    }

    return {
      level: "warning",
      label: "Нужно проверить часть отделений",
      detail: `Свежие: ${freshCount} из ${totalRows}. Проверить: ${warningCount}, старые: ${staleCount}, нет данных: ${missingCount}.`
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

  function hasQhCalcPendingMovementValues(values) {
    if (!values || typeof values !== "object") {
      return false;
    }

    return QH_CALC_COLUMNS.some((column) => {
      return (config.normalizeCellValue(values[column.incomingKey]) || 0) !== 0
        || (config.normalizeCellValue(values[column.dischargedKey]) || 0) !== 0;
    });
  }

  function hasLeaveCalcPendingMovementValues(values) {
    if (!values || typeof values !== "object") {
      return false;
    }

    return LEAVE_CALC_COLUMNS.some((column) => {
      return (config.normalizeCellValue(values[column.sentKey]) || 0) !== 0
        || (config.normalizeCellValue(values[column.returnedKey]) || 0) !== 0;
    });
  }

  function hasTransferCalcPendingMovementValues(values) {
    if (!values || typeof values !== "object") {
      return false;
    }

    return TRANSFER_CALC_COLUMNS.some((column) => {
      return (config.normalizeCellValue(values[column.incomingKey]) || 0) !== 0
        || (config.normalizeCellValue(values[column.outgoingKey]) || 0) !== 0;
    });
  }

  function shouldApplyDepartmentCombinedCalcFromPendingPanels(row) {
    if (!isQhCalcDepartment(row) || !row || !row.values || typeof row.values !== "object") {
      return false;
    }

    const activePanels = [
      hasQhCalcPendingMovementValues(row.values),
      hasLeaveCalcPendingMovementValues(row.values),
      hasTransferCalcPendingMovementValues(row.values)
    ].filter(Boolean).length;

    return activePanels > 1;
  }

  function attachMainTableSavedNavigatorEvents(root = document) {
    const scope = root && typeof root.querySelectorAll === "function" ? root : document;

    scope.querySelectorAll("[data-main-saved-nav]").forEach((button) => {
      if (button.dataset.mainSavedNavBound === "true") {
        return;
      }
      button.dataset.mainSavedNavBound = "true";
      button.addEventListener("click", () => {
        const direction = Number(button.getAttribute("data-main-saved-nav") || "0");
        if (!Number.isFinite(direction) || direction === 0) {
          return;
        }
        moveMainTableSavedSelection(direction);
        const selectedRecord = getSelectedMainTableSavedRecord();
        state.activeMainTableSavedPreviewKey = selectedRecord ? selectedRecord.snapshotKey : "";
        renderPage();
      });
    });

    const mainTableSavedLiveBtn = scope.querySelector("#mainTableSavedLiveBtn");
    if (mainTableSavedLiveBtn instanceof HTMLButtonElement && mainTableSavedLiveBtn.dataset.mainSavedLiveBound !== "true") {
      mainTableSavedLiveBtn.dataset.mainSavedLiveBound = "true";
      mainTableSavedLiveBtn.addEventListener("click", () => {
        if (!state.activeMainTableSavedPreviewKey) {
          return;
        }
        state.activeMainTableSavedPreviewKey = "";
        renderPage();
      });
    }
  }

  function syncQhBaseValuesFromCurrentValues(values) {
    if (!values || typeof values !== "object") {
      return values;
    }

    QH_CALC_COLUMNS.forEach((column) => {
      values[column.baseKey] = config.normalizeCellValue(values[column.currentKey]) || 0;
    });

    return values;
  }

  function syncQhBaseValuesFromCurrentRow(row) {
    if (!isQhCalcDepartment(row) || !row || !row.values || typeof row.values !== "object") {
      return;
    }

    syncQhBaseValuesFromCurrentValues(row.values);
  }

  function hasPendingTelegramPhotoUpdate(row) {
    if (!row) {
      return false;
    }

    return String(row.photoWorkflowStatus || "").startsWith("pending")
      && Boolean(row.photoFeedbackId)
      && row.photoName !== "telegram-web-app-form";
  }

  function getDepartmentMainTableStateMeta(row, validation = null) {
    if (!row) {
      return {
        tone: "none",
        label: "",
        title: ""
      };
    }

    if (validation && validation.applicable && !validation.isValid) {
      return {
        tone: "control-error",
        label: "Ошибка контрольных сумм",
        title: "В строке есть ошибка контрольных сумм."
      };
    }

    if (hasPendingTelegramPhotoUpdate(row)) {
      return {
        tone: "photo-pending",
        label: "Новое фото, проверь OCR",
        title: "Пришло новое фото из Telegram. Проверь OCR и сохрани строку отделения."
      };
    }

    const freshness = getRowFreshnessMeta(row);
    if (freshness.level === "warning" || freshness.level === "stale" || freshness.level === "missing") {
      return {
        tone: "waiting",
        label: "Нет новых данных",
        title: "За текущее окно новые данные ещё не отправлены."
      };
    }

    const source = row && typeof row.lastUpdateSource === "string" && row.lastUpdateSource.trim()
      ? row.lastUpdateSource.trim()
      : (row && typeof row.photoWorkflowStatus === "string" ? row.photoWorkflowStatus.trim() : "");

    if (source === "telegram-form" || source === "processed_telegram" || source === "photo" || source === "processed_photo") {
      return {
        tone: "auto",
        label: "Обновлено автоматически",
        title: "Строка обновилась автоматически из Telegram формы или фото."
      };
    }

    if (
      source === "site"
      || source === "processed_site"
      || source === "processed_night_shift"
      || source === "processed_day_shift"
    ) {
      return {
        tone: "manual",
        label: "Обновлено вручную",
        title: "Строка обновлена вручную пользователем."
      };
    }

    return {
      tone: "none",
      label: "",
      title: ""
    };
  }

  function getQhCalcColumnByKey(key) {
    return QH_CALC_COLUMNS.find((column) =>
      column.baseKey === key
      || column.currentKey === key
      || column.incomingKey === key
      || column.dischargedKey === key
      || column.outputKey === key
    ) || null;
  }

  function getQhCalcSourceValue(row, key, snapshot = state.snapshot) {
    if (!row) {
      return null;
    }
    const column = getQhCalcColumnByKey(key);
    if (column && column.baseKey === key && !isQhCalcDepartment(row)) {
      return config.normalizeCellValue(getEffectiveValue(snapshot, row, column.currentKey));
    }

    const directValue = config.normalizeCellValue(getEffectiveValue(snapshot, row, key));
    if (directValue !== null || !key) {
      return directValue;
    }

    if (column && column.baseKey === key) {
      return config.normalizeCellValue(getEffectiveValue(snapshot, row, column.currentKey));
    }

    return directValue;
  }

  function getLeaveCalcSourceValue(row, key) {
    if (!row) {
      return null;
    }
    const value = row.values && typeof row.values === "object"
      ? row.values[key]
      : null;
    return config.normalizeCellValue(value);
  }

  function getLeaveCalcColumnByKey(key) {
    return LEAVE_CALC_COLUMNS.find((column) =>
      column.leaveKey === key
      || column.presentKey === key
      || column.sentKey === key
      || column.returnedKey === key
    ) || null;
  }

  function getLeaveCalcConstraint(row, key, snapshot = state.snapshot) {
    if (!row) {
      return null;
    }

    const column = getLeaveCalcColumnByKey(key);
    if (!column) {
      return null;
    }

    const sentRaw = Math.max(0, Number(getLeaveCalcSourceValue(row, column.sentKey)) || 0);
    const returnedRaw = Math.max(0, Number(getLeaveCalcSourceValue(row, column.returnedKey)) || 0);

    if (column.sentKey === key) {
      const limit = Math.max(0, (getNumber(snapshot, row, column.presentKey) || 0) + returnedRaw);
      return {
        column,
        kind: "sent",
        limit,
        blocked: limit <= 0
      };
    }

    if (column.returnedKey === key) {
      const limit = Math.max(0, (getNumber(snapshot, row, column.leaveKey) || 0) + sentRaw);
      return {
        column,
        kind: "returned",
        limit,
        blocked: limit <= 0
      };
    }

    return null;
  }

  function normalizeLeaveCalcInputValue(row, key, value, snapshot = state.snapshot) {
    if (value === null || value === "" || typeof value === "undefined") {
      return null;
    }

    const normalized = Math.max(0, Number(value) || 0);
    const constraint = getLeaveCalcConstraint(row, key, snapshot);
    if (!constraint) {
      return normalized;
    }

    return Math.min(normalized, constraint.limit);
  }

  function getLeaveCalcBlockedColumns(row, snapshot = state.snapshot) {
    if (!row) {
      return [];
    }

    return LEAVE_CALC_COLUMNS.flatMap((column) => {
      const sentConstraint = getLeaveCalcConstraint(row, column.sentKey, snapshot);
      const returnedConstraint = getLeaveCalcConstraint(row, column.returnedKey, snapshot);
      const blocked = [];
      if (sentConstraint && sentConstraint.blocked) {
        blocked.push(sentConstraint);
      }
      if (returnedConstraint && returnedConstraint.blocked) {
        blocked.push(returnedConstraint);
      }
      return blocked;
    });
  }

  function getLeaveCalcConstraintTitle(constraint) {
    if (!constraint) {
      return "";
    }

    if (constraint.kind === "sent") {
      if (constraint.blocked) {
        return `По категории ${constraint.column.label} нет наличия в больнице. Отправка в отпуск заблокирована.`;
      }
      return `По категории ${constraint.column.label} можно отправить в отпуск не больше ${constraint.limit}.`;
    }

    if (constraint.blocked) {
      return `По категории ${constraint.column.label} нет больных в лечебном отпуске. Возврат заблокирован.`;
    }
    return `По категории ${constraint.column.label} можно вернуть из отпуска не больше ${constraint.limit}.`;
  }

  function calcQhRemainingValue(row, type, snapshot = state.snapshot) {
    if (!row) {
      return null;
    }

    const source = QH_CALC_TYPE_MAP[type];
    if (!source) {
      return null;
    }

    const previous = getQhCalcSourceValue(row, source.baseKey, snapshot);
    const incoming = getQhCalcSourceValue(row, source.incomingKey, snapshot);
    const discharged = normalizeQhCalcInputValue(
      row,
      source.dischargedKey,
      getQhCalcSourceValue(row, source.dischargedKey, snapshot),
      snapshot
    );

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

      if (!hasQhCalcPendingMovementValues(row.values)) {
        syncQhBaseValuesFromCurrentValues(row.values);
        return;
      }

      QH_CALC_COLUMNS.forEach((column) => {
        const hasBaseValue = row.values[column.baseKey] !== null
          && typeof row.values[column.baseKey] !== "undefined"
          && row.values[column.baseKey] !== "";
        if (!hasBaseValue) {
          row.values[column.baseKey] = row.values[column.currentKey] || 0;
        }
      });
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

      QH_CALC_COLUMNS.forEach((column) => {
        row.values[column.currentKey] = calcQhRemainingValue(row, column.type, snapshot) || 0;
      });
    });

    return snapshot;
  }

  function getQhCalcDisplayValue(row, key, snapshot = state.snapshot) {
    if (!row) {
      return "";
    }

    if (key === "qhRemainingSoldier") {
      return getDisplayValue(calcQhRemainingValue(row, "soldier", snapshot));
    }
    if (key === "qhRemainingOfficer") {
      return getDisplayValue(calcQhRemainingValue(row, "officer", snapshot));
    }
    if (key === "qhRemainingContract") {
      return getDisplayValue(calcQhRemainingValue(row, "contract", snapshot));
    }
    if (key === "qhRemainingZh") {
      return getDisplayValue(calcQhRemainingValue(row, "zh", snapshot));
    }
    if (key === "qhRemainingFamily") {
      return getDisplayValue(calcQhRemainingValue(row, "family", snapshot));
    }
    if (key === "qhRemainingReserve") {
      return getDisplayValue(calcQhRemainingValue(row, "reserve", snapshot));
    }
    if (key === "qhRemainingCivil") {
      return getDisplayValue(calcQhRemainingValue(row, "civil", snapshot));
    }

    const value = getQhCalcSourceValue(row, key, snapshot);
    if ((QH_CALC_INPUT_KEYS.has(key) || QH_CALC_OPTIONAL_INPUT_KEYS.has(key))
      && (value === null || value === "" || typeof value === "undefined")) {
      return "0";
    }
    if (QH_CALC_INPUT_KEYS.has(key)) {
      return getDisplayValue(normalizeQhCalcInputValue(row, key, value, snapshot));
    }
    return getDisplayValue(value);
  }

  function getQhDischargeConstraint(row, key, snapshot = state.snapshot) {
    if (!row) {
      return null;
    }

    const column = getQhCalcColumnByKey(key);
    if (!column || column.dischargedKey !== key) {
      return null;
    }

    const limit = Math.max(0, getNumber(snapshot, row, column.currentKey) || 0);
    return {
      column,
      limit,
      blocked: limit <= 0
    };
  }

  function normalizeQhCalcInputValue(row, key, value, snapshot = state.snapshot) {
    if (value === null || value === "" || typeof value === "undefined") {
      return null;
    }

    const normalized = Math.max(0, Number(value) || 0);
    const dischargeConstraint = getQhDischargeConstraint(row, key, snapshot);
    if (!dischargeConstraint) {
      return normalized;
    }

    return Math.min(normalized, dischargeConstraint.limit);
  }

  function getQhCalcBlockedDischargeColumns(row, snapshot = state.snapshot) {
    if (!row) {
      return [];
    }

    return QH_CALC_COLUMNS.filter((column) => {
      const dischargeConstraint = getQhDischargeConstraint(row, column.dischargedKey, snapshot);
      return Boolean(dischargeConstraint && dischargeConstraint.blocked);
    });
  }

  function getQhCalcDischargeTitle(constraint) {
    if (!constraint) {
      return "";
    }

    if (constraint.blocked) {
      return `По категории ${constraint.column.label} нет наличия. Выписка заблокирована.`;
    }

    return `По категории ${constraint.column.label} можно выписать не больше ${constraint.limit}.`;
  }

  function getDepartmentAdmissionCalcActiveMessage() {
    return "Հաշվիչը հասանելի է։";
  }

  function syncDepartmentRowInput(rowId, key, value) {
    const input = document.querySelector(`input[data-row="${rowId}"][data-key="${key}"]`);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    input.value = value === null || value === "" || typeof value === "undefined" ? "0" : String(value);
  }

  function refreshQhCalcDisplay(row) {
    if (!row) {
      return;
    }

    [
      "currentShar",
      "currentSpa",
      "currentPaym",
      "currentZh",
      "family",
      "officer",
      "civil",
      "qhBaseSoldier",
      "qhBaseOfficer",
      "qhBaseContract",
      "qhBaseZh",
      "qhBaseFamily",
      "qhBaseReserve",
      "qhBaseCivil"
    ].forEach((key) => {
      document.querySelectorAll(`[data-qh-base="${key}"]`).forEach((element) => {
        element.textContent = getQhCalcDisplayValue(row, key);
      });
    });

    [
      "currentShar",
      "currentSpa",
      "currentPaym",
      "currentZh",
      "family",
      "officer",
      "civil",
      "qhRemainingSoldier",
      "qhRemainingOfficer",
      "qhRemainingContract",
      "qhRemainingZh",
      "qhRemainingFamily",
      "qhRemainingReserve",
      "qhRemainingCivil"
    ].forEach((key) => {
      document.querySelectorAll(`[data-qh-output="${key}"]`).forEach((element) => {
        element.textContent = getQhCalcDisplayValue(row, key);
      });
    });

    QH_CALC_COLUMNS.forEach((column) => {
      const dischargeConstraint = getQhDischargeConstraint(row, column.dischargedKey);
      const displayValue = getQhCalcDisplayValue(row, column.dischargedKey) || "0";
      document.querySelectorAll(`[data-qh-calc-key="${column.dischargedKey}"]`).forEach((element) => {
        if (!(element instanceof HTMLInputElement)) {
          return;
        }

        if (document.activeElement !== element) {
          element.value = displayValue;
        }
        element.max = dischargeConstraint ? String(dischargeConstraint.limit) : "";
        element.disabled = Boolean(dischargeConstraint && dischargeConstraint.blocked);
        element.title = getQhCalcDischargeTitle(dischargeConstraint);
        const cell = element.closest(".qh-calc-cell");
        if (cell) {
          cell.classList.toggle("qh-calc-cell--blocked", Boolean(dischargeConstraint && dischargeConstraint.blocked));
        }
      });
    });

    const status = document.getElementById("qhCalcStatus");
    if (status) {
      status.className = "qh-calc-status";
      status.textContent = "";
    }
  }

  function applyQhCalcToDepartment(options = {}) {
    const shouldRefresh = options.refresh !== false;
    const shouldSave = options.save !== false;
    const shouldAnnounce = options.announce !== false;
    if (mode === "main" && state.activeMainTableSavedPreviewKey) {
      state.activeMainTableSavedPreviewKey = "";
    }
    const row = getDepartmentCalcTargetRow();
    if (!row) {
      return;
    }

    const originalCell1 = getNumber(state.snapshot, row, "beenTotal") || 0;
    const originalCell2 = getNumber(state.snapshot, row, "beenSoldier") || 0;
    const originalCell3 = getNumber(state.snapshot, row, "beenSeries") || 0;
    const originalCell4 = getNumber(state.snapshot, row, "admittedTotal") || 0;
    const originalCell5 = getNumber(state.snapshot, row, "admittedSoldier") || 0;
    const originalCell6 = getNumber(state.snapshot, row, "admittedSeries") || 0;
    const originalCell7 = getNumber(state.snapshot, row, "dgTotal") || 0;
    const originalCell8 = getNumber(state.snapshot, row, "dgSoldier") || 0;
    const originalCell9 = getNumber(state.snapshot, row, "dgSeries") || 0;

    const incomingByType = Object.fromEntries(
      QH_CALC_COLUMNS.map((column) => [column.type, getQhCalcSourceValue(row, column.incomingKey) || 0])
    );
    const dischargedByType = Object.fromEntries(
      QH_CALC_COLUMNS.map((column) => [
        column.type,
        normalizeQhCalcInputValue(row, column.dischargedKey, getQhCalcSourceValue(row, column.dischargedKey)) || 0
      ])
    );
    const remainingByType = Object.fromEntries(
      QH_CALC_COLUMNS.map((column) => [column.type, calcQhRemainingValue(row, column.type) || 0])
    );

    const cell4 = QH_CALC_COLUMNS.reduce((sum, column) => sum + incomingByType[column.type], 0);
    const cell5 = incomingByType.soldier + incomingByType.officer + incomingByType.contract;
    const cell6 = incomingByType.soldier;
    const cell7 = QH_CALC_COLUMNS.reduce((sum, column) => sum + dischargedByType[column.type], 0);
    const cell8 = dischargedByType.soldier + dischargedByType.officer + dischargedByType.contract;
    const cell9 = dischargedByType.soldier;
    const cell13 = remainingByType.soldier;
    const cell14 = remainingByType.officer;
    const cell15 = remainingByType.contract;
    const cell16 = remainingByType.zh;
    const cell17 = remainingByType.family;
    const cell18 = remainingByType.reserve;
    const cell19 = remainingByType.civil;

    row.values.currentShar = cell13;
    row.values.currentSpa = cell14;
    row.values.currentPaym = cell15;
    row.values.currentZh = cell16;
    row.values.family = cell17;
    row.values.officer = cell18;
    row.values.civil = cell19;

    row.values.beenTotal = originalCell1;
    row.values.beenSoldier = originalCell2;
    row.values.beenSeries = originalCell3;
    row.values.admittedTotal = originalCell4 + cell4;
    row.values.admittedSoldier = originalCell5 + cell5;
    row.values.admittedSeries = originalCell6 + cell6;
    row.values.dgTotal = originalCell7 + cell7;
    row.values.dgSoldier = originalCell8 + cell8;
    row.values.dgSeries = originalCell9 + cell9;

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
      ["currentPaym", row.values.currentPaym],
      ["currentZh", row.values.currentZh],
      ["family", row.values.family],
      ["officer", row.values.officer],
      ["civil", row.values.civil]
    ].forEach(([key, value]) => {
      syncDepartmentRowInput(row.id, key, value);
    });

    QH_CALC_COLUMNS.forEach((column) => {
      row.values[column.incomingKey] = 0;
      row.values[column.dischargedKey] = 0;
    });
    syncQhBaseValuesFromCurrentRow(row);

    if (shouldRefresh) {
      refreshTableData();
      if (mode === "main") {
        renderPage();
      }
      return;
    }
    if (shouldSave) {
      if (mode === "department") {
        queueDepartmentSave();
      } else if (mode === "main") {
        refreshMainTableSaveState();
      }
    }
    if (shouldAnnounce) {
      setInfo("Հաշվարկային աղյուսակի արժեքները տեղափոխվել են հիմնական բջիջներ, իսկ մուտքային դաշտերը զրոյացվել են։ Ուղարկելու համար սեղմեք «Պահպանել»։", false);
    }
  }

  function applyLeaveCalcToDepartment(options = {}) {
    const shouldRefresh = options.refresh !== false;
    const shouldSave = options.save !== false;
    const shouldAnnounce = options.announce !== false;
    if (mode === "main" && state.activeMainTableSavedPreviewKey) {
      state.activeMainTableSavedPreviewKey = "";
    }
    const row = getDepartmentCalcTargetRow();
    if (!row) {
      return false;
    }

    const nextLeaveResults = LEAVE_CALC_COLUMNS.map((column) => ({
      column,
      nextLeave: calcLeaveRemainingValue(row, column.type) || 0,
      nextPresent: calcLeavePresentValue(row, column.type) || 0
    }));
    const invalidColumns = nextLeaveResults
      .filter((item) => item.nextLeave < 0 || item.nextPresent < 0)
      .map((item) => item.column);
    if (invalidColumns.length) {
      setInfo(`Բուժական արձակուրդի հաշվարկը չի կարող կիրառվել․ ${invalidColumns.map((column) => column.label).join(", ")} սյունակներում ստացվել է բացասական արժեք։`, true);
      return false;
    }

    nextLeaveResults.forEach(({ column, nextLeave, nextPresent }) => {
      row.values[column.leaveKey] = nextLeave;
      row.values[column.presentKey] = nextPresent;
      row.values[column.sentKey] = 0;
      row.values[column.returnedKey] = 0;
    });

    [
      ["currentShar", row.values.currentShar],
      ["currentSpa", row.values.currentSpa],
      ["currentPaym", row.values.currentPaym],
      ["leaveSharq", row.values.leaveSharq],
      ["leaveSpa", row.values.leaveSpa],
      ["leavePaym", row.values.leavePaym]
    ].forEach(([key, value]) => {
      syncDepartmentRowInput(row.id, key, value);
    });

    if (isQhCalcDepartment(row)) {
      syncQhBaseValuesFromCurrentRow(row);
      refreshQhCalcDisplay(row);
    }

    if (shouldRefresh) {
      refreshTableData();
      if (mode === "main") {
        renderPage();
      }
    }
    if (shouldSave) {
      if (mode === "department") {
        queueDepartmentSave();
      } else if (mode === "main") {
        refreshMainTableSaveState();
      }
    }
    if (shouldAnnounce) {
      setInfo("Բուժական արձակուրդի հաշվարկը տեղափոխվել է հիմնական բջիջներ, իսկ մուտքային դաշտերը զրոյացվել են։ Ուղարկելու համար սեղմեք «Պահպանել»։", false);
    }
    return true;
  }

  function applyTransferCalcToDepartment(options = {}) {
    const shouldRefresh = options.refresh !== false;
    const shouldSave = options.save !== false;
    const shouldAnnounce = options.announce !== false;
    if (mode === "main" && state.activeMainTableSavedPreviewKey) {
      state.activeMainTableSavedPreviewKey = "";
    }
    const row = getDepartmentCalcTargetRow();
    if (!row) {
      return false;
    }

    const originalCell10 = getNumber(state.snapshot, row, "transferFromDepartment") || 0;
    const originalCell11 = getNumber(state.snapshot, row, "transferToDepartment") || 0;

    const invalidColumns = getTransferCalcInvalidColumns(row);
    if (invalidColumns.length) {
      setInfo(`Переводы не могут быть рассчитаны: ${invalidColumns.map((column) => column.label).join(", ")} дают отрицательный остаток.`, true);
      return false;
    }

    let incomingTotal = 0;
    let outgoingTotal = 0;
    TRANSFER_CALC_COLUMNS.forEach((column) => {
      const incoming = Math.max(0, Number(getTransferCalcSourceValue(row, column.incomingKey)) || 0);
      const outgoing = normalizeTransferCalcInputValue(
        row,
        column.outgoingKey,
        getTransferCalcSourceValue(row, column.outgoingKey)
      ) || 0;
      const nextCurrent = calcTransferRemainingValue(row, column.type) || 0;

      row.values[column.currentKey] = nextCurrent;
      row.values[column.incomingKey] = 0;
      row.values[column.outgoingKey] = 0;

      incomingTotal += incoming;
      outgoingTotal += outgoing;
    });

    row.values.transferToDepartment = originalCell11 + incomingTotal;
    row.values.transferFromDepartment = originalCell10 + outgoingTotal;

    [
      ["currentShar", row.values.currentShar],
      ["currentSpa", row.values.currentSpa],
      ["currentPaym", row.values.currentPaym],
      ["currentZh", row.values.currentZh],
      ["family", row.values.family],
      ["officer", row.values.officer],
      ["civil", row.values.civil],
      ["transferToDepartment", row.values.transferToDepartment],
      ["transferFromDepartment", row.values.transferFromDepartment]
    ].forEach(([key, value]) => {
      syncDepartmentRowInput(row.id, key, value);
    });

    if (isQhCalcDepartment(row)) {
      syncQhBaseValuesFromCurrentRow(row);
      refreshQhCalcDisplay(row);
    }

    if (shouldRefresh) {
      refreshTableData();
      if (mode === "main") {
        renderPage();
      }
    }
    if (shouldSave) {
      if (mode === "department") {
        queueDepartmentSave();
      } else if (mode === "main") {
        refreshMainTableSaveState();
      }
    }
    if (shouldAnnounce) {
      setInfo("Расчёт переводов перенесён в строку отделения. Для отправки в общий файл нажмите «Сохранить».", false);
    }
    return true;
  }

  function applyStandardDepartmentCombinedCalc(options = {}) {
    const shouldRefresh = options.refresh !== false;
    const shouldSave = options.save !== false;
    const shouldAnnounce = options.announce !== false;
    if (mode === "main" && state.activeMainTableSavedPreviewKey) {
      state.activeMainTableSavedPreviewKey = "";
    }
    const row = getDepartmentCalcTargetRow();
    if (!row) {
      return false;
    }

    const originalCell1 = getNumber(state.snapshot, row, "beenTotal") || 0;
    const originalMilitary = getNumber(state.snapshot, row, "beenSoldier") || 0;
    const originalSeries = getNumber(state.snapshot, row, "beenSeries") || 0;
    const originalCell4 = getNumber(state.snapshot, row, "admittedTotal") || 0;
    const originalCell5 = getNumber(state.snapshot, row, "admittedSoldier") || 0;
    const originalCell6 = getNumber(state.snapshot, row, "admittedSeries") || 0;
    const originalCell7 = getNumber(state.snapshot, row, "dgTotal") || 0;
    const originalCell8 = getNumber(state.snapshot, row, "dgSoldier") || 0;
    const originalCell9 = getNumber(state.snapshot, row, "dgSeries") || 0;
    const originalCell10 = getNumber(state.snapshot, row, "transferFromDepartment") || 0;
    const originalCell11 = getNumber(state.snapshot, row, "transferToDepartment") || 0;

    const incomingByType = Object.fromEntries(
      QH_CALC_COLUMNS.map((column) => [column.type, getQhCalcSourceValue(row, column.incomingKey) || 0])
    );
    const dischargedByType = Object.fromEntries(
      QH_CALC_COLUMNS.map((column) => [
        column.type,
        normalizeQhCalcInputValue(row, column.dischargedKey, getQhCalcSourceValue(row, column.dischargedKey)) || 0
      ])
    );
    const remainingByType = Object.fromEntries(
      QH_CALC_COLUMNS.map((column) => [
        column.type,
        (getNumber(state.snapshot, row, column.currentKey) || 0)
          + incomingByType[column.type]
          - dischargedByType[column.type]
      ])
    );
    const invalidCurrentColumns = QH_CALC_COLUMNS.filter((column) => remainingByType[column.type] < 0);
    if (invalidCurrentColumns.length) {
      setInfo(`Ընդունում/Դուրսգրում հաշվարկը չի կարող կիրառվել․ ${invalidCurrentColumns.map((column) => column.label).join(", ")} սյունակներում ստացվել է բացասական արժեք։`, true);
      return false;
    }

    const leaveRemainingByType = Object.fromEntries(
      LEAVE_CALC_COLUMNS.map((column) => [
        column.type,
        (getNumber(state.snapshot, row, column.leaveKey) || 0)
          + (normalizeLeaveCalcInputValue(row, column.sentKey, getLeaveCalcSourceValue(row, column.sentKey)) || 0)
          - (normalizeLeaveCalcInputValue(row, column.returnedKey, getLeaveCalcSourceValue(row, column.returnedKey)) || 0)
      ])
    );
    const leavePresentByType = Object.fromEntries(
      LEAVE_CALC_COLUMNS.map((column) => {
        const currentAfterAdmission = column.type === "sharq"
          ? remainingByType.soldier
          : (column.type === "spa" ? remainingByType.officer : remainingByType.contract);
        return [
          column.type,
          currentAfterAdmission
            - (normalizeLeaveCalcInputValue(row, column.sentKey, getLeaveCalcSourceValue(row, column.sentKey)) || 0)
            + (normalizeLeaveCalcInputValue(row, column.returnedKey, getLeaveCalcSourceValue(row, column.returnedKey)) || 0)
        ];
      })
    );
    const invalidLeaveColumns = LEAVE_CALC_COLUMNS.filter((column) =>
      leaveRemainingByType[column.type] < 0 || leavePresentByType[column.type] < 0
    );
    if (invalidLeaveColumns.length) {
      setInfo(`Բուժական արձակուրդի հաշվարկը չի կարող կիրառվել․ ${invalidLeaveColumns.map((column) => column.label).join(", ")} սյունակներում ստացվել է բացասական արժեք։`, true);
      return false;
    }

    const transferBaseByType = {
      soldier: leavePresentByType.sharq,
      officer: leavePresentByType.spa,
      contract: leavePresentByType.paym,
      zh: remainingByType.zh,
      family: remainingByType.family,
      reserve: remainingByType.reserve,
      civil: remainingByType.civil
    };
    const transferIncomingByType = Object.fromEntries(
      TRANSFER_CALC_COLUMNS.map((column) => [column.type, getTransferCalcSourceValue(row, column.incomingKey) || 0])
    );
    const transferOutgoingByType = Object.fromEntries(
      TRANSFER_CALC_COLUMNS.map((column) => [column.type, getTransferCalcSourceValue(row, column.outgoingKey) || 0])
    );
    const transferRemainingByType = Object.fromEntries(
      TRANSFER_CALC_COLUMNS.map((column) => [
        column.type,
        (transferBaseByType[column.type] || 0)
          + transferIncomingByType[column.type]
          - transferOutgoingByType[column.type]
      ])
    );
    const invalidTransferColumns = TRANSFER_CALC_COLUMNS.filter((column) => transferRemainingByType[column.type] < 0);
    if (invalidTransferColumns.length) {
      setInfo(`Տեղափոխության հաշվարկը չի կարող կիրառվել․ ${invalidTransferColumns.map((column) => column.label).join(", ")} սյունակներում ստացվել է բացասական արժեք։`, true);
      return false;
    }

    row.values.beenTotal = originalCell1;
    row.values.beenSoldier = originalMilitary;
    row.values.beenSeries = originalSeries;
    row.values.admittedTotal = originalCell4 + QH_CALC_COLUMNS.reduce((sum, column) => sum + incomingByType[column.type], 0);
    row.values.admittedSoldier = originalCell5 + incomingByType.soldier + incomingByType.officer + incomingByType.contract;
    row.values.admittedSeries = originalCell6 + incomingByType.soldier;
    row.values.dgTotal = originalCell7 + QH_CALC_COLUMNS.reduce((sum, column) => sum + dischargedByType[column.type], 0);
    row.values.dgSoldier = originalCell8 + dischargedByType.soldier + dischargedByType.officer + dischargedByType.contract;
    row.values.dgSeries = originalCell9 + dischargedByType.soldier;

    row.values.currentShar = transferRemainingByType.soldier;
    row.values.currentSpa = transferRemainingByType.officer;
    row.values.currentPaym = transferRemainingByType.contract;
    row.values.currentZh = transferRemainingByType.zh;
    row.values.family = transferRemainingByType.family;
    row.values.officer = transferRemainingByType.reserve;
    row.values.civil = transferRemainingByType.civil;

    row.values.leaveSharq = leaveRemainingByType.sharq;
    row.values.leaveSpa = leaveRemainingByType.spa;
    row.values.leavePaym = leaveRemainingByType.paym;

    row.values.transferToDepartment = originalCell11 + TRANSFER_CALC_COLUMNS.reduce((sum, column) => sum + transferIncomingByType[column.type], 0);
    row.values.transferFromDepartment = originalCell10 + TRANSFER_CALC_COLUMNS.reduce((sum, column) => sum + transferOutgoingByType[column.type], 0);

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
      ["currentPaym", row.values.currentPaym],
      ["currentZh", row.values.currentZh],
      ["family", row.values.family],
      ["officer", row.values.officer],
      ["civil", row.values.civil],
      ["leaveSharq", row.values.leaveSharq],
      ["leaveSpa", row.values.leaveSpa],
      ["leavePaym", row.values.leavePaym],
      ["transferToDepartment", row.values.transferToDepartment],
      ["transferFromDepartment", row.values.transferFromDepartment]
    ].forEach(([key, value]) => {
      syncDepartmentRowInput(row.id, key, value);
    });

    QH_CALC_COLUMNS.forEach((column) => {
      row.values[column.incomingKey] = 0;
      row.values[column.dischargedKey] = 0;
    });
    LEAVE_CALC_COLUMNS.forEach((column) => {
      row.values[column.sentKey] = 0;
      row.values[column.returnedKey] = 0;
    });
    TRANSFER_CALC_COLUMNS.forEach((column) => {
      row.values[column.incomingKey] = 0;
      row.values[column.outgoingKey] = 0;
    });

    if (shouldRefresh) {
      refreshTableData();
      if (mode === "main") {
        renderPage();
      }
    }
    if (shouldSave) {
      if (mode === "department") {
        queueDepartmentSave();
      } else if (mode === "main") {
        refreshMainTableSaveState();
      }
    }
    if (shouldAnnounce) {
      setInfo("Հաշվարկները տեղափոխվել են հիմնական բջիջներ, իսկ մուտքային դաշտերը զրոյացվել են։ Ուղարկելու համար սեղմեք «Պահպանել»։", false);
    }
    return true;
  }

  function applyDepartmentCombinedCalc() {
    const row = getDepartmentCalcTargetRow();
    if (!row) {
      return;
    }

    if (!isQhCalcDepartment(row)) {
      applyStandardDepartmentCombinedCalc();
      return;
    }

    const originalValues = deepCopy(row.values);
    applyQhCalcToDepartment({ refresh: false, save: false, announce: false });

    const leaveApplied = applyLeaveCalcToDepartment({ refresh: false, save: false, announce: false });
    const transferApplied = applyTransferCalcToDepartment({ refresh: false, save: false, announce: false });
    if (!leaveApplied || !transferApplied) {
      row.values = originalValues;
      refreshTableData();
      if (mode === "main") {
        renderPage();
      }
      return;
    }

    refreshTableData();
    if (mode === "department") {
      queueDepartmentSave();
    } else if (mode === "main") {
      refreshMainTableSaveState();
      renderPage();
    }
    setInfo("Հաշվարկները տեղափոխվել են հիմնական բջիջներ, իսկ մուտքային դաշտերը զրոյացվել են։ Ուղարկելու համար սեղմեք «Պահպանել»։", false);
  }

  function getPhotoPreviewValue(row, key, sourceValues = null) {
    const effectiveSourceValues = sourceValues && typeof sourceValues === "object"
      ? sourceValues
      : (state.photoImport?.recognizedValues && typeof state.photoImport.recognizedValues === "object"
        ? state.photoImport.recognizedValues
        : null);
    if (!row || !effectiveSourceValues) {
      return "";
    }
    return Object.prototype.hasOwnProperty.call(effectiveSourceValues, key)
      ? effectiveSourceValues[key]
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

  function applyPreviewValuesToDepartmentRow(row, previewValues, recognizedKeys) {
    if (!row || !previewValues || typeof previewValues !== "object") {
      return [];
    }

    const allowedKeys = new Set(
      Array.isArray(recognizedKeys) && recognizedKeys.length
        ? recognizedKeys.filter((item) => typeof item === "string")
        : getRecognizablePhotoFields(row).map((field) => field.key)
    );
    const appliedKeys = [];

    getRecognizablePhotoFields(row).forEach((field) => {
      if (!allowedKeys.has(field.key) || !Object.prototype.hasOwnProperty.call(previewValues, field.key)) {
        return;
      }

      const normalized = config.normalizeCellValue(previewValues[field.key]);
      row.values[field.key] = normalized;
      if (normalized !== null) {
        appliedKeys.push(field.key);
      }
    });

    if (isQhCalcDepartment(row) && appliedKeys.some((key) => QH_CALC_CURRENT_KEYS.has(key))) {
      syncQhBaseValuesFromCurrentRow(row);
    }

    return appliedKeys;
  }

  function applyTelegramFormValuesToDepartmentRow(row, previewValues, recognizedKeys) {
    return applyPreviewValuesToDepartmentRow(row, previewValues, recognizedKeys);
  }

  function doesDepartmentRowMatchPreviewValues(snapshot, row, previewValues, recognizedKeys) {
    if (!snapshot || !row || !previewValues || typeof previewValues !== "object") {
      return false;
    }

    const keys = Array.isArray(recognizedKeys) && recognizedKeys.length
      ? recognizedKeys.filter((item) => typeof item === "string")
      : Object.keys(previewValues);
    let hasComparableValues = false;

    return keys.every((key) => {
      if (!Object.prototype.hasOwnProperty.call(previewValues, key)) {
        return true;
      }

      const expected = config.normalizeCellValue(previewValues[key]);
      if (expected === null) {
        return true;
      }

      hasComparableValues = true;
      if (key === "presentTotal") {
        return config.normalizeCellValue(calcPresentTotal(snapshot, row)) === expected;
      }

      return config.normalizeCellValue(getEffectiveValue(snapshot, row, key)) === expected;
    }) && hasComparableValues;
  }

  function buildTelegramFormReviewStateFromRecord(record, row, options = {}) {
    const next = buildInitialTelegramFormReviewState();
    const previewValues = buildPhotoPreviewValuesFromRecord(record);
    const recognizedKeys = Array.isArray(record?.recognizedKeys) && record.recognizedKeys.length
      ? record.recognizedKeys.map((item) => String(item))
      : Object.keys(previewValues);
    const hasValues = recognizedKeys.some((key) => Object.prototype.hasOwnProperty.call(previewValues, key));

    next.feedbackId = String(record?.id || options.feedbackId || "").trim();
    next.workflowStatus = typeof options.workflowStatus === "string" && options.workflowStatus.trim()
      ? options.workflowStatus.trim()
      : "processed";
    next.imageName = typeof record?.imageName === "string" && record.imageName.trim()
      ? record.imageName.trim()
      : "telegram-web-app-form";
    next.lastReportDate = typeof record?.reportDate === "string" && record.reportDate.trim()
      ? record.reportDate.trim()
      : "";
    next.recognizedValues = previewValues;
    next.notes = normalizeOcrNotes(record?.notes);
    next.cellReviews = Array.isArray(record?.cellReviews) ? record.cellReviews : [];

    if (!hasValues) {
      next.isError = true;
      next.status = "Telegram форма найдена, но в ней нет значений для показа.";
      return next;
    }

    if (Boolean(options.applyToDepartment) && row) {
      const appliedKeys = applyTelegramFormValuesToDepartmentRow(row, previewValues, recognizedKeys);
      next.lastAppliedKeys = appliedKeys;
      next.draftMode = appliedKeys.length > 0;
      next.workflowStatus = "pending";
      next.status = appliedKeys.length > 0
        ? "Открыта отправленная Telegram форма. Значения подставлены в таблицу отделения. Проверьте их и нажмите Сохранить."
        : "Открыта отправленная Telegram форма. Значения доступны для проверки.";
      return next;
    }

    next.lastAppliedKeys = recognizedKeys.filter((key) => Object.prototype.hasOwnProperty.call(previewValues, key));
    next.draftMode = false;
    next.status = "Показана последняя отправленная Telegram форма для этого отделения.";
    return next;
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

  function shouldApplyExtendedDepartmentChecks(snapshot, row) {
    return getNumber(snapshot, row, "transferFromDepartment") === 0
      && getNumber(snapshot, row, "transferToDepartment") === 0;
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
    const photoTopCellsCheck = buildDepartmentOcrTopCellsCheck(row, previewValues);
    if (
      (!validation.applicable || validation.isValid)
      && (!photoTopCellsCheck.applicable || photoTopCellsCheck.isValid)
    ) {
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

  function buildDepartmentValidationChecksForSnapshot(snapshot, row) {
    if (!row) {
      return [];
    }

    const presentActual = calcPresentTotal(snapshot, row);
    const presentExpected = (
      getNumber(snapshot, row, "beenTotal")
      + getNumber(snapshot, row, "admittedTotal")
      + getNumber(snapshot, row, "transferToDepartment")
    ) - (
      getNumber(snapshot, row, "dgTotal")
      + getNumber(snapshot, row, "transferFromDepartment")
    );
    const checks = [
      {
        id: "present-balance",
        name: SAVE_RULE_DISPLAY_NAME,
        ruleText: row.hasLeaveTotal ? SAVE_RULE_TEXT : SAVE_RULE_TEXT_SHORT,
        applicable: true,
        isValid: presentActual === presentExpected,
        actual: presentActual,
        expected: presentExpected,
        suspectKeys: PHOTO_FIELD_DEFINITIONS
          .filter((item) => item.cell >= 13 && item.cell <= 22)
          .map((item) => item.key),
        failureMessage: buildPresentBalanceFailureMessage(presentActual, presentExpected)
      }
    ];

    if (shouldApplyExtendedDepartmentChecks(snapshot, row)) {
      const soldierActual = (
        getNumber(snapshot, row, "beenSeries")
        + getNumber(snapshot, row, "admittedSeries")
      ) - getNumber(snapshot, row, "dgSeries");
      const soldierExpected = (
        getNumber(snapshot, row, "currentShar")
        + getNumber(snapshot, row, "leaveSharq")
      );

      checks.push({
        id: "soldier-count",
        name: SOLDIER_COUNT_DISPLAY_NAME,
        ruleText: SOLDIER_COUNT_RULE_TEXT,
        applicable: true,
        isValid: soldierActual === soldierExpected,
        actual: soldierActual,
        expected: soldierExpected,
        suspectKeys: ["beenSeries", "admittedSeries", "dgSeries", "currentShar", "leaveSharq"],
        failureMessage: buildSoldierCountFailureMessage(soldierActual, soldierExpected)
      });

      const militaryActual = (
        getNumber(snapshot, row, "beenSoldier")
        + getNumber(snapshot, row, "admittedSoldier")
      ) - getNumber(snapshot, row, "dgSoldier");
      const militaryExpected = (
        getNumber(snapshot, row, "currentShar")
        + getNumber(snapshot, row, "currentSpa")
        + getNumber(snapshot, row, "currentPaym")
        + getNumber(snapshot, row, "leaveSharq")
        + getNumber(snapshot, row, "leaveSpa")
        + getNumber(snapshot, row, "leavePaym")
      );

      checks.push({
        id: "military-count",
        name: MILITARY_COUNT_DISPLAY_NAME,
        ruleText: MILITARY_COUNT_RULE_TEXT,
        applicable: true,
        isValid: militaryActual === militaryExpected,
        actual: militaryActual,
        expected: militaryExpected,
        suspectKeys: [
          "beenSoldier",
          "admittedSoldier",
          "dgSoldier",
          "currentShar",
          "currentSpa",
          "currentPaym",
          "leaveSharq",
          "leaveSpa",
          "leavePaym"
        ],
        failureMessage: buildMilitaryCountFailureMessage(militaryActual, militaryExpected)
      });
    }

    return checks;
  }

  function buildDepartmentValidationChecks(row) {
    return buildDepartmentValidationChecksForSnapshot(state.snapshot, row);
  }

  function buildDepartmentOcrTopCellsCheck(row, previewValues = null) {
    const values = previewValues && typeof previewValues === "object"
      ? previewValues
      : (state.photoImport?.recognizedValues && typeof state.photoImport.recognizedValues === "object"
        ? state.photoImport.recognizedValues
        : null);

    if (mode !== "department" || !row || !values) {
      return {
        id: "ocr-top-cells",
        name: OCR_TOP_CELLS_DISPLAY_NAME,
        ruleText: OCR_TOP_CELLS_RULE_TEXT,
        applicable: false,
        isValid: true,
        actual: 0,
        expected: 0,
        suspectKeys: [],
        failureMessage: ""
      };
    }

    const mismatches = [];
    const comparedKeys = [];

    DEPARTMENT_MORNING_CONTROL_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(values, key)) {
        return;
      }

      const ocrValue = config.normalizeCellValue(values[key]);
      if (ocrValue === null) {
        return;
      }

      comparedKeys.push(key);
      const tableValue = getNumber(state.snapshot, row, key);
      if (ocrValue !== tableValue) {
        mismatches.push({ key, ocrValue, tableValue });
      }
    });

    if (!comparedKeys.length) {
      return {
        id: "ocr-top-cells",
        name: OCR_TOP_CELLS_DISPLAY_NAME,
        ruleText: OCR_TOP_CELLS_RULE_TEXT,
        applicable: false,
        isValid: true,
        actual: 0,
        expected: 0,
        suspectKeys: [],
        failureMessage: ""
      };
    }

    const mismatchMessage = mismatches
      .map((item) => {
        const fieldMeta = getPhotoFieldMetaByKey(item.key);
        const cellLabel = fieldMeta?.label || item.key;
        return `OCR ${cellLabel} = ${item.ocrValue}, а в таблице ${cellLabel} = ${item.tableValue}`;
      })
      .join("; ");

    return {
      id: "ocr-top-cells",
      name: OCR_TOP_CELLS_DISPLAY_NAME,
      ruleText: OCR_TOP_CELLS_RULE_TEXT,
      applicable: true,
      isValid: mismatches.length === 0,
      actual: mismatches.length,
      expected: 0,
      suspectKeys: mismatches.map((item) => item.key),
      failureMessage: buildOcrTopCellsFailureMessage(mismatches)
    };
  }

  function buildDepartmentValidationChecksWithLiveSources(row) {
    const checks = buildDepartmentValidationChecksForSnapshot(state.snapshot, row);
    const ocrTopCellsCheck = buildDepartmentOcrTopCellsCheck(row);
    if (ocrTopCellsCheck.applicable) {
      checks.push(ocrTopCellsCheck);
    }
    return checks;
  }

  function getPhotoImportPreviewValueNumber(previewValues, key) {
    if (!previewValues || typeof previewValues !== "object" || !Object.prototype.hasOwnProperty.call(previewValues, key)) {
      return null;
    }
    return config.normalizeCellValue(previewValues[key]);
  }

  function buildPhotoImportPreviewValidation(row, previewValues = null) {
    const values = previewValues && typeof previewValues === "object"
      ? previewValues
      : (state.photoImport?.recognizedValues && typeof state.photoImport.recognizedValues === "object"
        ? state.photoImport.recognizedValues
        : null);

    if (!row || !values) {
      return {
        applicable: false,
        checks: [],
        applicableChecks: [],
        failedChecks: [],
        failedKeySet: new Set(),
        isValid: false,
        statusTone: "neutral"
      };
    }

    const read = (key) => getPhotoImportPreviewValueNumber(values, key);
    const hasAll = (keys) => keys.every((key) => read(key) !== null);
    const checks = [];
    const photoBlockKeys = PHOTO_FIELD_DEFINITIONS
      .filter((item) => item.cell >= 13 && item.cell <= 22)
      .map((item) => item.key);
    const presentKeys = Array.isArray(row.presentKeys) ? row.presentKeys : [];
    const presentRequiredKeys = [
      ...presentKeys,
      "beenTotal",
      "admittedTotal",
      "dgTotal",
      "transferFromDepartment",
      "transferToDepartment"
    ];

    if (presentKeys.length && hasAll(presentRequiredKeys)) {
      const presentActual = presentKeys.reduce((sum, key) => sum + (read(key) || 0), 0);
      const presentExpected = (
        (read("beenTotal") || 0)
        + (read("admittedTotal") || 0)
        + (read("transferToDepartment") || 0)
      ) - (
        (read("dgTotal") || 0)
        + (read("transferFromDepartment") || 0)
      );

      checks.push({
        id: "present-balance",
        name: SAVE_RULE_DISPLAY_NAME,
        ruleText: row.hasLeaveTotal ? SAVE_RULE_TEXT : SAVE_RULE_TEXT_SHORT,
        applicable: true,
        isValid: presentActual === presentExpected,
        actual: presentActual,
        expected: presentExpected,
        suspectKeys: photoBlockKeys,
        failureMessage: buildPresentBalanceFailureMessage(presentActual, presentExpected)
      });
    } else {
      checks.push({
        id: "present-balance",
        name: SAVE_RULE_DISPLAY_NAME,
        ruleText: row.hasLeaveTotal ? SAVE_RULE_TEXT : SAVE_RULE_TEXT_SHORT,
        applicable: false,
        isValid: true,
        actual: 0,
        expected: 0,
        suspectKeys: photoBlockKeys,
        failureMessage: ""
      });
    }

    const transferFromValue = read("transferFromDepartment");
    const transferToValue = read("transferToDepartment");
    const shouldApplyExtendedChecks = transferFromValue === 0 && transferToValue === 0;
    const soldierRequiredKeys = ["beenSeries", "admittedSeries", "dgSeries", "currentShar", "leaveSharq"];
    const militaryRequiredKeys = [
      "beenSoldier",
      "admittedSoldier",
      "dgSoldier",
      "currentShar",
      "currentSpa",
      "currentPaym",
      "leaveSharq",
      "leaveSpa",
      "leavePaym"
    ];

    if (shouldApplyExtendedChecks && hasAll(soldierRequiredKeys)) {
      const soldierActual = ((read("beenSeries") || 0) + (read("admittedSeries") || 0)) - (read("dgSeries") || 0);
      const soldierExpected = (read("currentShar") || 0) + (read("leaveSharq") || 0);
      checks.push({
        id: "soldier-count",
        name: SOLDIER_COUNT_DISPLAY_NAME,
        ruleText: SOLDIER_COUNT_RULE_TEXT,
        applicable: true,
        isValid: soldierActual === soldierExpected,
        actual: soldierActual,
        expected: soldierExpected,
        suspectKeys: soldierRequiredKeys,
        failureMessage: buildSoldierCountFailureMessage(soldierActual, soldierExpected)
      });
    } else {
      checks.push({
        id: "soldier-count",
        name: SOLDIER_COUNT_DISPLAY_NAME,
        ruleText: SOLDIER_COUNT_RULE_TEXT,
        applicable: false,
        isValid: true,
        actual: 0,
        expected: 0,
        suspectKeys: soldierRequiredKeys,
        failureMessage: ""
      });
    }

    if (shouldApplyExtendedChecks && hasAll(militaryRequiredKeys)) {
      const militaryActual = ((read("beenSoldier") || 0) + (read("admittedSoldier") || 0)) - (read("dgSoldier") || 0);
      const militaryExpected = (
        (read("currentShar") || 0)
        + (read("currentSpa") || 0)
        + (read("currentPaym") || 0)
        + (read("leaveSharq") || 0)
        + (read("leaveSpa") || 0)
        + (read("leavePaym") || 0)
      );

      checks.push({
        id: "military-count",
        name: MILITARY_COUNT_DISPLAY_NAME,
        ruleText: MILITARY_COUNT_RULE_TEXT,
        applicable: true,
        isValid: militaryActual === militaryExpected,
        actual: militaryActual,
        expected: militaryExpected,
        suspectKeys: militaryRequiredKeys,
        failureMessage: buildMilitaryCountFailureMessage(militaryActual, militaryExpected)
      });
    } else {
      checks.push({
        id: "military-count",
        name: MILITARY_COUNT_DISPLAY_NAME,
        ruleText: MILITARY_COUNT_RULE_TEXT,
        applicable: false,
        isValid: true,
        actual: 0,
        expected: 0,
        suspectKeys: militaryRequiredKeys,
        failureMessage: ""
      });
    }

    const comparedTopKeys = DEPARTMENT_MORNING_CONTROL_KEYS.filter((key) => read(key) !== null);
    if (comparedTopKeys.length) {
      const mismatches = comparedTopKeys
        .map((key) => ({
          key,
          ocrValue: read(key),
          tableValue: getNumber(state.snapshot, row, key)
        }))
        .filter((item) => item.ocrValue !== item.tableValue);

      const mismatchMessage = mismatches
        .map((item) => {
          const fieldMeta = getPhotoFieldMetaByKey(item.key);
          const cellLabel = fieldMeta?.label || item.key;
          return `OCR ${cellLabel} = ${item.ocrValue}, а в таблице ${cellLabel} = ${item.tableValue}`;
        })
        .join("; ");

      checks.push({
        id: "ocr-top-cells",
        name: OCR_TOP_CELLS_DISPLAY_NAME,
        ruleText: OCR_TOP_CELLS_RULE_TEXT,
        applicable: true,
        isValid: mismatches.length === 0,
        actual: mismatches.length,
        expected: 0,
        suspectKeys: mismatches.map((item) => item.key),
        failureMessage: buildOcrTopCellsFailureMessage(mismatches)
      });
    } else {
      checks.push({
        id: "ocr-top-cells",
        name: OCR_TOP_CELLS_DISPLAY_NAME,
        ruleText: OCR_TOP_CELLS_RULE_TEXT,
        applicable: false,
        isValid: true,
        actual: 0,
        expected: 0,
        suspectKeys: [],
        failureMessage: ""
      });
    }

    const applicableChecks = checks.filter((item) => item.applicable);
    const failedChecks = applicableChecks.filter((item) => !item.isValid);
    const failedKeySet = new Set(
      failedChecks.flatMap((item) => Array.isArray(item.suspectKeys) ? item.suspectKeys : [])
    );

    return {
      applicable: applicableChecks.length > 0,
      checks,
      applicableChecks,
      failedChecks,
      failedKeySet,
      isValid: applicableChecks.length > 0 && failedChecks.length === 0,
      statusTone: failedChecks.length ? "invalid" : (applicableChecks.length ? "valid" : "neutral")
    };
  }

  function buildPhotoImportPreviewValidationStatus(validation) {
    const applicableCount = validation?.applicableChecks?.length || 0;
    const failedCount = validation?.failedChecks?.length || 0;
    const passedCount = Math.max(0, applicableCount - failedCount);
    const failedNames = validation?.failedChecks?.map((item) => item.name).filter(Boolean) || [];

    if (!applicableCount) {
      return {
        tone: "neutral",
        text: "OCR контроль пока не посчитан."
      };
    }

    if (!failedCount) {
      return {
        tone: "valid",
        text: `OCR контроль: ${passedCount}/${applicableCount} проверок пройдено.`
      };
    }

    return {
      tone: "invalid",
      text: `OCR контроль: ${passedCount}/${applicableCount}. Проверьте: ${failedNames.join(", ")}.`
    };
  }

  function getPhotoImportPreviewControlTone(validation, key) {
    if (!validation) {
      return "";
    }
    if (validation.statusTone === "valid") {
      return "valid";
    }
    if (validation.statusTone === "invalid" && validation.failedKeySet instanceof Set && validation.failedKeySet.has(key)) {
      return "invalid";
    }
    return "";
  }

  function getDepartmentSaveRuleText(row, checks = []) {
    if (!row) {
      return SAVE_RULE_TEXT;
    }
    const activeChecks = Array.isArray(checks) && checks.length ? checks : buildDepartmentValidationChecks(row);
    return activeChecks.map((item) => `${item.name}: ${item.ruleText}`).join("; ");
  }

  function getDepartmentValidationStateForSnapshot(snapshot, row) {
    if (!hasDepartmentSaveRule(row)) {
      return {
        applicable: false,
        isValid: true,
        actual: 0,
        expected: 0,
        checks: [],
        failedChecks: [],
        failedKeySet: new Set(),
        applicableKeySet: new Set(),
        statusTone: "neutral",
        message: ""
      };
    }

    const checks = buildDepartmentValidationChecksForSnapshot(snapshot, row);
    const applicableChecks = checks.filter((item) => item.applicable);
    const failedChecks = checks.filter((item) => item.applicable && !item.isValid);
    const primaryCheck = checks[0] || null;
    const isValid = failedChecks.length === 0;
    const failedKeySet = new Set(
      failedChecks.flatMap((item) => Array.isArray(item.suspectKeys) ? item.suspectKeys : [])
    );
    const applicableKeySet = new Set(
      applicableChecks.flatMap((item) => Array.isArray(item.suspectKeys) ? item.suspectKeys : [])
    );

    return {
      applicable: true,
      isValid,
      actual: primaryCheck ? primaryCheck.actual : 0,
      expected: primaryCheck ? primaryCheck.expected : 0,
      checks,
      applicableChecks,
      failedChecks,
      failedKeySet,
      applicableKeySet,
      statusTone: isValid ? "valid" : "invalid",
      message: buildDepartmentValidationMessage(isValid, checks, failedChecks)
    };
  }

  function getDepartmentValidationState() {
    const row = getCurrentRow();
    if (mode !== "department") {
      return {
        applicable: false,
        isValid: true,
        actual: 0,
        expected: 0,
        checks: [],
        failedChecks: [],
        message: ""
      };
    }

    if (!hasDepartmentSaveRule(row)) {
      return {
        applicable: false,
        isValid: true,
        actual: 0,
        expected: 0,
        checks: [],
        failedChecks: [],
        message: ""
      };
    }

    const checks = buildDepartmentValidationChecksWithLiveSources(row);
    const failedChecks = checks.filter((item) => item.applicable && !item.isValid);
    const primaryCheck = checks[0] || null;
    const isValid = failedChecks.length === 0;

    return {
      applicable: true,
      isValid,
      actual: primaryCheck ? primaryCheck.actual : 0,
      expected: primaryCheck ? primaryCheck.expected : 0,
      checks,
      failedChecks,
      message: buildDepartmentValidationMessage(isValid, checks, failedChecks)
    };
  }

  function getPhotoImportSuspectDetails(row, recognizedKeys, previewValues = null) {
    if (!row || !hasDepartmentSaveRule(row)) {
      return {
        suspectKeys: [],
        suspectReason: ""
      };
    }

    const validation = buildPhotoImportPreviewValidation(row, previewValues);
    if (!validation.applicable || validation.isValid) {
      return {
        suspectKeys: [],
        suspectReason: ""
      };
    }

    const photoBlockFields = PHOTO_FIELD_DEFINITIONS
      .filter((item) => item.cell >= 13 && item.cell <= 22)
      .map((item) => item.key);
    const activeBlockKeys = photoBlockFields.filter((key) => getPhotoImportPreviewValueNumber(previewValues, key) !== null);
    const reviewBlockKeys = Array.isArray(state.photoImport?.cellReviews)
      ? state.photoImport.cellReviews
        .filter((item) => item && item.status === "review" && photoBlockFields.includes(item.key))
        .map((item) => item.key)
      : [];
    const recognizedInBlock = photoBlockFields.filter((key) => recognizedKeys.has(key));
    const fallbackBlockKeys = activeBlockKeys.length
      ? activeBlockKeys
      : (reviewBlockKeys.length
        ? reviewBlockKeys
        : (recognizedInBlock.length ? recognizedInBlock : photoBlockFields));
    const suspectKeys = [];
    const suspectReasonParts = [];

    validation.failedChecks.forEach((check) => {
      if (check.id === "ocr-top-cells") {
        return;
      }
      const checkKeys = check.id === "present-balance"
        ? fallbackBlockKeys
        : (Array.isArray(check.suspectKeys) ? check.suspectKeys : []);
      checkKeys.forEach((key) => {
        if (!suspectKeys.includes(key)) {
          suspectKeys.push(key);
        }
      });
      const labels = checkKeys
        .map((key) => getPhotoFieldMetaByKey(key))
        .filter(Boolean)
        .map((item) => item.label);
      if (check.id === "soldier-count" || check.id === "military-count") {
        suspectReasonParts.push(
          labels.length
            ? `Контрольная сумма «${check.name}» не сошлась. Проверьте ячейки ${labels.join(", ")}.`
            : `Контрольная сумма «${check.name}» не сошлась.`
        );
        return;
      }
      suspectReasonParts.push(
        labels.length
          ? `Формула 13-22 не сошлась. Проверьте ячейки ${labels.join(", ")}.`
          : "Формула 13-22 не сошлась. Проверьте блок ячеек 13-22."
      );
    });

    return {
      suspectKeys,
      suspectReason: suspectReasonParts.join(" ")
    };
  }

  function verifySavedRowResult(targetDepartmentId, expectedValues, resultSnapshot) {
    const savedRow = getDepartmentRow(resultSnapshot, targetDepartmentId);
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

  function verifySavedDepartmentResult(expectedValues, resultSnapshot) {
    return verifySavedRowResult(departmentId, expectedValues, resultSnapshot);
  }

  function getTransferColumnMismatchMeta(snapshot, rows) {
    const fromTotal = getSummaryValue(snapshot, rows, "transferFromDepartment");
    const toTotal = getSummaryValue(snapshot, rows, "transferToDepartment");

    return {
      fromTotal,
      toTotal,
      hasMismatch: fromTotal !== toTotal
    };
  }

  function hasActiveMainTransferColumnMismatch() {
    if (mode !== "main") {
      return false;
    }
    const displayContext = getMainTableDisplaySnapshotContext();
    return getTransferColumnMismatchMeta(displayContext.snapshot, displayContext.rows).hasMismatch;
  }

  function shouldHighlightTransferMismatchCell(key, options) {
    if (key !== "transferFromDepartment" && key !== "transferToDepartment") {
      return false;
    }

    if (options && options.highlightTransferMismatch) {
      return Boolean(options.transferMismatch);
    }

    return hasActiveMainTransferColumnMismatch();
  }

  function supportsValue(row, key) {
    if (key === "presentTotal" || key === "leaveTotal") {
      return true;
    }
    if (key === "transferFromDepartment" || key === "transferToDepartment") {
      return true;
    }
    const editableKeys = Array.isArray(row?.editableKeys) ? row.editableKeys : [];
    return editableKeys.includes(key) || Boolean(getLinkedSource(row, key));
  }

  function isEditable(row, key) {
    if (key === "transferFromDepartment" || key === "transferToDepartment") {
      return true;
    }
    if (mode === "department" && isDepartmentMorningControlledKey(key) && !areDepartmentMorningCellsUnlocked()) {
      return false;
    }
    if (getLinkedSource(row, key)) {
      return false;
    }
    const editableKeys = Array.isArray(row?.editableKeys) ? row.editableKeys : [];
    return editableKeys.includes(key);
  }

  function getCellClasses(key, row, type, options = null) {
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
    if (shouldHighlightTransferMismatchCell(key, options)) {
      classes.push("transfer-mismatch-cell");
    }
    if (mode === "department" && isDepartmentMorningControlledKey(key) && !areDepartmentMorningCellsUnlocked()) {
      classes.push("department-locked-top-cell");
    }
    if (row && options && options.validationPreview === true) {
      const failedKeySet = options.validationFailedKeySet instanceof Set ? options.validationFailedKeySet : null;
      const applicableKeySet = options.validationApplicableKeySet instanceof Set ? options.validationApplicableKeySet : null;
      if (failedKeySet && failedKeySet.has(key)) {
        classes.push("main-calc-preview-control-cell", "main-calc-preview-control-cell--invalid");
      } else if (options.validationStatusTone === "valid" && applicableKeySet && applicableKeySet.has(key)) {
        classes.push("main-calc-preview-control-cell", "main-calc-preview-control-cell--valid");
      } else if (options.validationStatusTone === "invalid" && applicableKeySet && applicableKeySet.has(key)) {
        classes.push("main-calc-preview-control-cell", "main-calc-preview-control-cell--watch");
      }
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

  function renderDetailCell(snapshot, row, key, interactive, options = null) {
    const classes = [
      getCellClasses(key, row, "detail", options),
      getPhotoFieldReviewStatus(key)
    ]
      .filter(Boolean)
      .join(" ");
    const renderComputedInline = Boolean(options && options.inlineComputedValues);

    if (key === "presentTotal") {
      if (renderComputedInline) {
        return `<td class="${classes}" data-column-key="${key}"><span>${escapeHtml(String(calcPresentTotal(snapshot, row)))}</span></td>`;
      }
      return `<td class="${classes}" data-column-key="${key}"><span data-output="presentTotal" data-row="${row.id}"></span></td>`;
    }

    if (key === "leaveTotal") {
      if (!row.hasLeaveTotal) {
        return `<td class="${classes} blank-cell" data-column-key="${key}"><span></span></td>`;
      }
      if (renderComputedInline) {
        return `<td class="${classes}" data-column-key="${key}"><span>${escapeHtml(String(calcLeaveTotal(snapshot, row) || 0))}</span></td>`;
      }
      return `<td class="${classes}" data-column-key="${key}"><span data-output="leaveTotal" data-row="${row.id}"></span></td>`;
    }

    const linkedSource = getLinkedSource(row, key);
    if (linkedSource) {
      if (renderComputedInline) {
        return `<td class="${classes}" data-column-key="${key}"><span>${escapeHtml(getDisplayValue(getEffectiveValue(snapshot, row, key)))}</span></td>`;
      }
      return `<td class="${classes}" data-column-key="${key}"><span data-linked="${row.id}:${key}"></span></td>`;
    }

    if (!supportsValue(row, key)) {
      return `<td class="${classes} blank-cell" data-column-key="${key}"><span></span></td>`;
    }

    if (!interactive || !isEditable(row, key)) {
      return `<td class="${classes}" data-column-key="${key}"><span data-value="${row.id}:${key}">${escapeHtml(getDisplayValue(getEffectiveValue(snapshot, row, key)))}</span></td>`;
    }

    return `
      <td class="${classes}" data-column-key="${key}">
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

  function renderDetailRow(snapshot, row, interactive, viewMode, options = null) {
    const freshness = viewMode === "main" ? getRowFreshnessMeta(row) : null;
    const previewValidation = viewMode !== "main"
      && options
      && options.validationPreviewRow === true
      && options.validationPreviewState
      && options.validationPreviewState.rowId === row.id
      ? options.validationPreviewState.validation
      : null;
    const validation = viewMode === "main" ? getDepartmentValidationStateForSnapshot(snapshot, row) : previewValidation;
    const mainRowState = viewMode === "main" ? getDepartmentMainTableStateMeta(row, validation) : null;
    const previewRowValidationClass = previewValidation && previewValidation.applicable
      ? ` main-calc-preview-row main-calc-preview-row--${previewValidation.isValid ? "valid" : "invalid"}`
      : "";
    const validationClass = validation && validation.applicable && !validation.isValid ? " main-invalid-row" : "";
    const validationAttr = validation && validation.applicable
      ? ` data-row-validation="${validation.isValid ? "valid" : "invalid"}"`
      : "";
    const validationTitle = validation && validation.applicable
      ? ` title="${escapeHtml(validation.message || validation.failedChecks.map((item) => item.failureMessage).join(" "))}"`
      : "";
    const freshnessClass = freshness && freshness.level === "fresh" && !(validation && validation.applicable && !validation.isValid)
      ? " main-fresh-row"
      : "";
    const freshnessAttr = freshness ? ` data-row-freshness="${escapeHtml(freshness.level)}"` : "";
    const departmentPath = viewMode === "main" && mode === "main"
      ? appendShareQuery(config.getDepartmentPagePath(basePath, row.id))
      : "";
    const openRowClass = departmentPath ? " main-open-row" : "";
    const openRowAttr = departmentPath
      ? ` data-open-department-path="${escapeHtml(departmentPath)}"`
      : "";
    const deptStateClass = mainRowState && mainRowState.tone !== "none"
      ? ` dept-cell--state-${mainRowState.tone}`
      : "";
    const deptTitle = mainRowState && mainRowState.title
      ? `${row.department}\n${mainRowState.title}`
      : validation && validation.applicable && validation.message
        ? `${row.department}\n${validation.message}`
      : row.department;
    return `
      <tr class="detail-row ${row.group === "extra" ? "extra-row" : "primary-row"}${freshnessClass}${validationClass}${previewRowValidationClass}${openRowClass}" data-row-id="${row.id}"${freshnessAttr}${validationAttr}${validationTitle}${openRowAttr}>
        <td class="dept-cell${deptStateClass}" title="${escapeHtml(deptTitle)}">${renderResponsiveDepartmentName(row.department)}</td>
        ${config.columns.map((key) => renderDetailCell(snapshot, row, key, interactive, options)).join("")}
      </tr>
    `;
  }

  function renderSummaryRow(summaryId, label, rowClass, snapshot, rows, options = null) {
    return `
      <tr class="${rowClass}">
        <td class="dept-cell">${escapeHtml(label)}</td>
        ${config.columns.map((key) => `
          <td class="${getCellClasses(key, null, rowClass === "grand-row" ? "grand" : "summary", options)}" data-column-key="${key}">
            <span data-summary="${summaryId}" data-key="${key}">${escapeHtml(String(getSummaryValue(snapshot, rows, key)))}</span>
          </td>
        `).join("")}
      </tr>
    `;
  }

  function renderTable(snapshot, rows, options) {
    const interactive = Boolean(options.interactive);
    const headerDateTime = options.headerDateTime || getCurrentDateTimeParts();
    const renderOptions = {
      highlightTransferMismatch: Boolean(options.highlightTransferMismatch || (options.viewMode === "main" && mode === "main")),
      transferMismatch: Boolean(
        (options.highlightTransferMismatch || (options.viewMode === "main" && mode === "main"))
        && getTransferColumnMismatchMeta(snapshot, rows).hasMismatch
      ),
      inlineComputedValues: Boolean(options.inlineComputedValues),
      validationPreview: Boolean(options.validationPreview),
      validationPreviewRow: Boolean(options.validationPreviewRow),
      validationPreviewState: options.validationPreviewState || null,
      validationStatusTone: typeof options.validationStatusTone === "string" ? options.validationStatusTone : "neutral",
      validationFailedKeySet: options.validationFailedKeySet instanceof Set ? options.validationFailedKeySet : new Set(),
      validationApplicableKeySet: options.validationApplicableKeySet instanceof Set ? options.validationApplicableKeySet : new Set()
    };
    let bodyHtml = "";

    if (options.viewMode === "main") {
      const primaryRows = rows.filter((row) => row.group === "primary");
      const extraRows = rows.filter((row) => row.group === "extra");
      bodyHtml = [
        ...primaryRows.map((row) => renderDetailRow(snapshot, row, interactive, options.viewMode, renderOptions)),
        renderSummaryRow("subtotal", "Ընդամենը", "subtotal-row", snapshot, primaryRows),
        ...extraRows.map((row) => renderDetailRow(snapshot, row, interactive, options.viewMode, renderOptions)),
        renderSummaryRow("grand", "Ընդամենը", "grand-row", snapshot, rows)
      ].join("");
    } else {
      bodyHtml = [
        ...rows.map((row) => renderDetailRow(snapshot, row, interactive, options.viewMode, renderOptions)),
        renderSummaryRow("single", "Итог отделения", "single-total-row", snapshot, rows)
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

  function getSelectedMainCalcDepartmentId(rows = null) {
    const availableRows = Array.isArray(rows)
      ? rows.filter((row) => row && typeof row.id === "string")
      : [];
    if (!availableRows.length) {
      state.selectedMainCalcDepartmentId = "";
      return "";
    }

    const currentId = String(state.selectedMainCalcDepartmentId || "").trim();
    const hasCurrent = availableRows.some((row) => row.id === currentId);
    if (hasCurrent) {
      return currentId;
    }

    state.selectedMainCalcDepartmentId = availableRows[0].id;
    return state.selectedMainCalcDepartmentId;
  }

  function getSelectedMainCalcRow(snapshot = state.snapshot) {
    if (mode !== "main" || !snapshot || !Array.isArray(snapshot.rows)) {
      return null;
    }
    const rowId = getSelectedMainCalcDepartmentId(snapshot.rows);
    return rowId ? getDepartmentRow(snapshot, rowId) : null;
  }

  function getDepartmentCalcTargetRow(snapshot = state.snapshot) {
    if (mode === "department") {
      return getDepartmentRow(snapshot, departmentId);
    }
    if (mode === "main") {
      return getSelectedMainCalcRow(snapshot);
    }
    return null;
  }

  function hasDepartmentPendingLocalChanges() {
    if (mode !== "department") {
      return false;
    }

    if (hasPhotoImportDraft()) {
      return true;
    }

    const currentRow = getCurrentRow();
    if (hasDepartmentCalculatorPendingInputs(currentRow)) {
      return true;
    }
    const loadedRow = getCurrentLoadedRow();
    return getRowValueSignature(currentRow) !== getRowValueSignature(loadedRow);
  }

  function getMainTableDirtyRows() {
    if (mode !== "main") {
      return [];
    }

    return state.snapshot.rows.filter((row) => {
      const loadedRow = getDepartmentRow(state.loadedSnapshot, row.id);
      return getRowValueSignature(row) !== getRowValueSignature(loadedRow);
    });
  }

  function calcLeaveRemainingValue(row, type, snapshot = state.snapshot) {
    const column = LEAVE_CALC_COLUMNS.find((item) => item.type === type);
    if (!row || !column) {
      return null;
    }
    const baseLeave = getNumber(snapshot, row, column.leaveKey) || 0;
    const sent = normalizeLeaveCalcInputValue(row, column.sentKey, getLeaveCalcSourceValue(row, column.sentKey), snapshot) || 0;
    const returned = normalizeLeaveCalcInputValue(row, column.returnedKey, getLeaveCalcSourceValue(row, column.returnedKey), snapshot) || 0;
    return baseLeave + sent - returned;
  }

  function calcLeavePresentValue(row, type, snapshot = state.snapshot) {
    const column = LEAVE_CALC_COLUMNS.find((item) => item.type === type);
    if (!row || !column) {
      return null;
    }
    const basePresent = getNumber(snapshot, row, column.presentKey) || 0;
    const sent = normalizeLeaveCalcInputValue(row, column.sentKey, getLeaveCalcSourceValue(row, column.sentKey), snapshot) || 0;
    const returned = normalizeLeaveCalcInputValue(row, column.returnedKey, getLeaveCalcSourceValue(row, column.returnedKey), snapshot) || 0;
    return basePresent - sent + returned;
  }

  function refreshLeaveCalcDisplay(row) {
    if (!row) {
      return;
    }
    LEAVE_CALC_COLUMNS.forEach((column) => {
      document.querySelectorAll(`[data-leave-calc-base="${column.leaveKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(getNumber(state.snapshot, row, column.leaveKey)) || "0";
      });
      document.querySelectorAll(`[data-leave-calc-output="${column.leaveKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(calcLeaveRemainingValue(row, column.type)) || "0";
      });
      document.querySelectorAll(`[data-leave-calc-output="${column.presentKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(calcLeavePresentValue(row, column.type)) || "0";
      });
    });

    const status = document.getElementById("leaveCalcStatus");
    if (status) {
      const invalidColumns = LEAVE_CALC_COLUMNS.filter((column) =>
        (calcLeaveRemainingValue(row, column.type) || 0) < 0
        || (calcLeavePresentValue(row, column.type) || 0) < 0
      );
      status.className = `qh-calc-status${invalidColumns.length ? " qh-calc-status--bad" : ""}`;
      status.innerHTML = invalidColumns.length
        ? invalidColumns.map((column) => (
          `<div>${escapeHtml(`${column.label}: չի կարող լինել բացասական արժեք`)}</div>`
        )).join("")
        : `<div>${escapeHtml("Այս հաշվարկը չի փոխում ընդհանուր քանակը․ փոխվում են միայն 13-15 և 20-22 բջիջները։")}</div>`;
    }
  }

  function refreshLeaveCalcDisplay(row) {
    if (!row) {
      return;
    }

    LEAVE_CALC_COLUMNS.forEach((column) => {
      document.querySelectorAll(`[data-leave-calc-base="${column.leaveKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(getNumber(state.snapshot, row, column.leaveKey)) || "0";
      });
      document.querySelectorAll(`[data-leave-calc-output="${column.leaveKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(calcLeaveRemainingValue(row, column.type)) || "0";
      });
      document.querySelectorAll(`[data-leave-calc-output="${column.presentKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(calcLeavePresentValue(row, column.type)) || "0";
      });

      [column.sentKey, column.returnedKey].forEach((key) => {
        const constraint = getLeaveCalcConstraint(row, key);
        const displayValue = getDisplayValue(
          normalizeLeaveCalcInputValue(row, key, getLeaveCalcSourceValue(row, key))
        ) || "0";

        document.querySelectorAll(`[data-leave-calc-key="${key}"]`).forEach((element) => {
          if (!(element instanceof HTMLInputElement)) {
            return;
          }

          if (document.activeElement !== element) {
            element.value = displayValue;
          }
          element.max = constraint ? String(constraint.limit) : "";
          element.disabled = Boolean(constraint && constraint.blocked);
          element.title = getLeaveCalcConstraintTitle(constraint);
          const cell = element.closest(".qh-calc-cell");
          if (cell) {
            cell.classList.toggle("qh-calc-cell--blocked", Boolean(constraint && constraint.blocked));
          }
        });
      });
    });

    const status = document.getElementById("leaveCalcStatus");
    if (status) {
      const invalidColumns = LEAVE_CALC_COLUMNS.filter((column) =>
        (calcLeaveRemainingValue(row, column.type) || 0) < 0
        || (calcLeavePresentValue(row, column.type) || 0) < 0
      );
    status.className = `qh-calc-status${invalidColumns.length ? " qh-calc-status--bad" : ""}`;
    status.innerHTML = invalidColumns.length
      ? invalidColumns.map((column) => (
        `<div>${escapeHtml(`${column.label}: Õ¹Õ« Õ¯Õ¡Ö€Õ¸Õ² Õ¬Õ«Õ¶Õ¥Õ¬ Õ¢Õ¡ÖÕ¡Õ½Õ¡Õ¯Õ¡Õ¶ Õ¡Ö€ÕªÕ¥Ö„`)}</div>`
      )).join("")
      : "";
  }
  }

  function hasMainTablePendingLocalChanges() {
    return getMainTableDirtyRows().length > 0;
  }

  function getMainTableValidationState() {
    if (mode !== "main") {
      return {
        applicable: false,
        isValid: true,
        dirtyRows: [],
        failedRows: [],
        message: ""
      };
    }

    const dirtyRows = getMainTableDirtyRows();
    const failedRows = state.snapshot.rows
      .map((row) => ({
        row,
        validation: getDepartmentValidationStateForSnapshot(state.snapshot, row)
      }))
      .filter((item) => item.validation.applicable && !item.validation.isValid);

    return {
      applicable: true,
      isValid: failedRows.length === 0,
      dirtyRows,
      failedRows,
      message: failedRows.length
        ? `Сохранение заблокировано: ${failedRows.map((item) => `${item.row.department} — ${item.validation.failedChecks.map((check) => check.name).join(", ")}`).join("; ")}.`
        : (dirtyRows.length
          ? `Изменено строк: ${dirtyRows.length}. Контрольные суммы в порядке, таблицу можно сохранить.`
          : "Изменений в главной таблице пока нет.")
    };
  }

  function buildCopyCard(definition) {
    const row = getDepartmentRow(state.snapshot, definition.id);
    const freshness = getRowFreshnessMeta(row);
    const photoWorkflow = getDepartmentPhotoWorkflowMeta(row);
    const feedbackSource = getDepartmentFeedbackSourceMeta(row);
    const lastUpdateSource = getDepartmentLastUpdateSourceMeta(row);
    const relativePath = appendShareQuery(config.getDepartmentPagePath(basePath, definition.id));
    const openFeedbackId = getDepartmentOpenFeedbackId(row);
    const feedbackPath = openFeedbackId
      ? appendQueryParams(config.getDepartmentPagePath(basePath, definition.id), { tgFeedback: openFeedbackId })
      : "";
    const openPath = feedbackPath || relativePath;
    const openLabel = feedbackPath ? "Открыть отправленное" : "Открыть отделение";
    return `
      <div class="link-card" data-department-open-card="${definition.id}" data-workflow-tone="${photoWorkflow.tone}" title="${escapeHtml(photoWorkflow.label)}">
        <div class="link-card-heading">
          <strong>${escapeHtml(definition.department)}</strong>
          <span class="link-card-update-source" data-department-last-source="${definition.id}" data-update-source-tone="${escapeHtml(lastUpdateSource.tone)}"${lastUpdateSource.label ? "" : " hidden"}>${escapeHtml(lastUpdateSource.label)}</span>
        </div>
        <div class="link-card-meta">
          <span class="status-chip status-chip--${freshness.level}" data-department-status="${definition.id}">${escapeHtml(freshness.label)}</span>
          <span class="link-card-time" data-department-updated="${definition.id}">${escapeHtml(freshness.timestamp)}</span>
        </div>
        <p class="link-card-subtext" data-department-age="${definition.id}">${escapeHtml(freshness.age)}</p>
        <div class="link-card-actions">
          <a href="${escapeHtml(openPath)}" target="_blank" rel="noopener" data-department-feedback-link="${definition.id}" data-open-mode="${feedbackPath ? "feedback" : "department"}">${escapeHtml(openLabel)}</a>
          <span class="link-card-feedback-kind" data-department-feedback-source="${definition.id}" data-feedback-source-tone="${escapeHtml(feedbackSource.tone)}"${feedbackSource.label ? "" : " hidden"}>${escapeHtml(feedbackSource.label)}</span>
          <button type="button" data-delete-feedback="${definition.id}" data-feedback-id="${row && row.photoFeedbackId ? row.photoFeedbackId : ""}"${feedbackPath ? "" : " hidden"}>Удалить отправленное</button>
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

  function getDepartmentPdfArchivePrintPath(archiveKey) {
    const record = getDepartmentPdfArchiveRecordByKey(archiveKey);
    if (
      record?.feedbackId &&
      sync.hasRemoteSync?.() &&
      typeof sync.buildTelegramFormPdfUrl === "function"
    ) {
      const remoteUrl = sync.buildTelegramFormPdfUrl(record.feedbackId, record.departmentId);
      if (remoteUrl) {
        return remoteUrl;
      }
    }

    if (basePath === "@site") {
      return appendShareQuery(`${window.location.origin}/functions/v1/site?path=${encodeURIComponent("archive-print.html")}&departmentArchive=${encodeURIComponent(archiveKey)}&autoprint=1`);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return `${prefix}archive-print.html?departmentArchive=${encodeURIComponent(archiveKey)}&autoprint=1`;
  }

  function getDepartmentPdfArchiveDatePrintPath(dateKey) {
    if (
      sync.hasRemoteSync?.() &&
      typeof sync.buildTelegramFormArchiveDatePdfUrl === "function"
    ) {
      const remoteUrl = sync.buildTelegramFormArchiveDatePdfUrl(dateKey);
      if (remoteUrl) {
        return remoteUrl;
      }
    }

    if (basePath === "@site") {
      return appendShareQuery(`${window.location.origin}/functions/v1/site?path=${encodeURIComponent("archive-print.html")}&departmentArchiveDate=${encodeURIComponent(dateKey)}&autoprint=1`);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return `${prefix}archive-print.html?departmentArchiveDate=${encodeURIComponent(dateKey)}&autoprint=1`;
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

  function getCivilReferralsPath() {
    if (basePath === "@site") {
      return appendShareQuery(`${window.location.origin}/functions/v1/site?path=${encodeURIComponent(CIVIL_REFERRALS_FILENAME)}`);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return appendShareQuery(`${prefix}${CIVIL_REFERRALS_FILENAME}`);
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

  function getDischargeShiftPath() {
    if (basePath === "@site") {
      return appendShareQuery(`${window.location.origin}/functions/v1/site?path=${encodeURIComponent(DISCHARGE_SHIFT_FILENAME)}&view=discharge`);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return appendShareQuery(`${prefix}${DISCHARGE_SHIFT_FILENAME}?view=discharge`);
  }

  function getWindowsDesktopSetupPath() {
    try {
      return appendShareQuery(new URL("windows/releases/Mainflow.exe", window.location.href).href);
    } catch (_error) {
      const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
      return appendShareQuery(`${prefix}windows/releases/Mainflow.exe`);
    }
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
    if (state.source === "remote") {
      return "remote";
    }
    if (state.source === "pending-sync") {
      return "pending";
    }
    return "local";
  }

  function getSyncDescription() {
    if (state.source === "remote") {
      return "Данные объединяются между компьютерами через интернет.";
    }
    if (state.source === "pending-sync") {
      return "Часть изменений ещё не отправлена на сервер. Они сохранены локально и ждут синхронизации.";
    }
    if (state.source === "local-cache") {
      return "Сейчас показан локальный кэш. Сервер временно недоступен.";
    }
    return "Сейчас включен локальный режим. Между разными компьютерами данные еще не объединяются.";
  }

  function getPendingSyncStatus() {
    if (!sync || typeof sync.getPendingSyncStatus !== "function") {
      return {
        count: 0,
        hasPending: false,
        isSyncing: false,
        lastSyncedAt: "",
        lastAttemptedAt: "",
        lastError: ""
      };
    }

    const status = sync.getPendingSyncStatus();
    const count = Number(status?.count) || 0;
    return {
      count,
      hasPending: Boolean(status?.hasPending && count > 0),
      isSyncing: Boolean(status?.isSyncing),
      lastSyncedAt: typeof status?.lastSyncedAt === "string" ? status.lastSyncedAt : "",
      lastAttemptedAt: typeof status?.lastAttemptedAt === "string" ? status.lastAttemptedAt : "",
      lastError: typeof status?.lastError === "string" ? status.lastError : ""
    };
  }

  function getPendingSyncButtonLabel(status = getPendingSyncStatus()) {
    if (status.isSyncing) {
      return status.count > 0 ? `Синхр. накопл. (${status.count})...` : "Синхр. накопл....";
    }
    return status.count > 0 ? `Синхр. накопл. (${status.count})` : "Синхр. накопл.";
  }

  function getPendingSyncSummaryText(status = getPendingSyncStatus()) {
    if (status.hasPending) {
      if (!sync.hasRemoteSync()) {
        return `В очереди: ${status.count}. Сейчас оффлайн-режим, поэтому изменения ждут отправки.`;
      }
      return `В очереди: ${status.count}. Очередь отправится автоматически в фоне, а кнопка остаётся для ручной синхронизации.`;
    }
    if (status.lastSyncedAt) {
      return `Очередь пуста. Последняя успешная синхронизация: ${formatTimestamp(status.lastSyncedAt)}.`;
    }
    return sync.hasRemoteSync()
      ? "Очередь синхронизации пуста. Фоновая автосинхронизация включена."
      : "Сейчас оффлайн-режим. Новые изменения будут накапливаться локально.";
  }

  function getPendingSyncErrorText(status = getPendingSyncStatus()) {
    if (status.lastError) {
      return `Последняя ошибка синхронизации: ${status.lastError}`;
    }
    if (status.hasPending && !sync.hasRemoteSync()) {
      return "Чтобы отправить накопленные изменения, переключитесь в онлайн-режим.";
    }
    return "";
  }

  function getShiftTransferSummaryText() {
    const context = getArchiveContext();
    const completed = [
      hasShiftAutoTransferCompleted("day", context.key) ? "Ընդունում" : "",
      hasShiftAutoTransferCompleted("discharge", context.key) ? "Դուրսգրում" : ""
    ].filter(Boolean);

    if (state.shiftAutoTransferEnabled) {
      const base = "Автоперенос включён: после 08:01 данные из Ընդունում и Դուրսգրում автоматически перейдут в основную таблицу.";
      return completed.length
        ? `${base} Сегодня уже перенесены: ${completed.join(", ")}.`
        : base;
    }

    return "Автоперенос выключен. Сейчас действует ручной режим: перенос выполняется кнопками ниже или со страниц `Ընդունում` и `Դուրսգրում`.";
  }

  function getShiftTransferStatusText() {
    if (!state.shiftTransferInFlightMode) {
      return "";
    }
    const meta = getShiftTransferModeMeta(state.shiftTransferInFlightMode);
    return `Переношу данные из ${meta.label} в основную таблицу...`;
  }

  function isMainTableBusyForShiftTransfer() {
    return Boolean(state.mainTableUnlocked || hasMainTablePendingLocalChanges() || state.mainTableSaveInFlight);
  }

  async function loadShiftDraftForMainTransfer(modeKey) {
    const meta = getShiftTransferModeMeta(modeKey);
    let remoteDraft = null;

    if (typeof sync[meta.loadFn] === "function") {
      try {
        const result = await sync[meta.loadFn]();
        if (result && result.draft) {
          remoteDraft = {
            reportDateTime: typeof result.draft.reportDateTime === "string" && result.draft.reportDateTime.trim()
              ? result.draft.reportDateTime.trim()
              : getCurrentDateTimeParts().full,
            savedAt: typeof result.draft.savedAt === "string" ? result.draft.savedAt.trim() : "",
            rows: sanitizeShiftDraftRows(result.draft.rows)
          };
        }
      } catch (_error) {
        remoteDraft = null;
      }
    }

    const localDraft = loadLocalShiftDraftState(modeKey);
    if (shiftDraftHasValues(localDraft.rows)) {
      return {
        draft: localDraft,
        source: "local-draft"
      };
    }
    if (remoteDraft && shiftDraftHasValues(remoteDraft.rows)) {
      return {
        draft: remoteDraft,
        source: "remote-draft"
      };
    }

    return {
      draft: remoteDraft || localDraft || buildEmptyShiftDraftState(),
      source: remoteDraft ? "remote-draft" : "local-draft"
    };
  }

  async function transferShiftDraftToMain(modeKey, options = {}) {
    const automatic = Boolean(options.automatic);
    const meta = getShiftTransferModeMeta(modeKey);

    if (state.shiftTransferInFlightMode) {
      return { applied: false, busy: true };
    }

    if (mode !== "main") {
      return { applied: false, unsupported: true };
    }

    if (isMainTableBusyForShiftTransfer()) {
      if (!automatic) {
        setInfo("Сначала сохраните или закройте редактирование основной таблицы, потом переносите данные из Ընդունում/Դուրսգրում.", true);
        refreshTableData();
      }
      return { applied: false, blocked: true };
    }

    state.shiftTransferInFlightMode = modeKey;
    refreshTableData();

    try {
      const loaded = await loadShiftDraftForMainTransfer(modeKey);
      const draft = loaded.draft || buildEmptyShiftDraftState();
      if (!shiftDraftHasValues(draft.rows)) {
        if (!automatic) {
          setInfo(`В странице ${meta.label} сейчас нет данных для переноса.`, false);
          refreshTableData();
        }
        return { applied: false, empty: true };
      }

      if (typeof sync[meta.applyFn] !== "function") {
        throw new Error(`Перенос ${meta.label} сейчас недоступен.`);
      }

      const effectiveReportDate = typeof draft.reportDateTime === "string" && draft.reportDateTime.trim()
        ? draft.reportDateTime.trim()
        : getCurrentDateTimeParts().full;
      const result = await sync[meta.applyFn](draft.rows, effectiveReportDate);

      if (result && result.snapshot) {
        applyLoadedSnapshot(result);
      }

      clearLocalShiftDraftState(modeKey);
      markShiftAutoTransferCompleted(modeKey, getArchiveContext().key);
      emitShiftTransferSignal(modeKey, automatic ? "main-auto" : "main-manual", effectiveReportDate);
      setInfo(
        automatic
          ? `Автоперенос ${meta.label} выполнен: данные добавлены в основную таблицу и черновик очищен.`
          : `Данные из ${meta.label} перенесены в основную таблицу и черновик очищен.`,
        false
      );
      refreshTableData();
      return { applied: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : `Не удалось перенести данные из ${meta.label}.`;
      if (!automatic || !state.info) {
        setInfo(message, true);
        refreshTableData();
      }
      return { applied: false, error: message };
    } finally {
      state.shiftTransferInFlightMode = "";
      refreshTableData();
    }
  }

  async function maybeAutoTransferShiftDrafts() {
    if (mode !== "main" || !state.initialized || !state.shiftAutoTransferEnabled || state.shiftTransferInFlightMode) {
      return;
    }

    const context = getArchiveContext();
    if (context.totalMinutes < SHIFT_AUTO_TRANSFER_TIME_MINUTES || isMainTableBusyForShiftTransfer()) {
      return;
    }

    if (!hasShiftAutoTransferCompleted("day", context.key)) {
      const result = await transferShiftDraftToMain("day", { automatic: true });
      if (result && result.busy) {
        return;
      }
    }

    if (!hasShiftAutoTransferCompleted("discharge", context.key)) {
      await transferShiftDraftToMain("discharge", { automatic: true });
    }
  }

  async function handleExternalShiftTransferSignal(detail) {
    if (!detail || typeof detail !== "object" || mode !== "main") {
      return;
    }

    markShiftAutoTransferCompleted(detail.mode, getArchiveContext().key);

    if (isMainTableBusyForShiftTransfer()) {
      setInfo(`Данные из ${getShiftTransferModeMeta(detail.mode).label} уже перенесены в другой вкладке. Завершите локальные правки и обновите сводку.`, false);
      refreshTableData();
      return;
    }

    try {
      const result = await sync.loadSnapshot();
      applyLoadedSnapshot(result);
      restorePendingMainSaveNotice();
      setInfo(`Главная таблица обновлена после переноса данных из ${getShiftTransferModeMeta(detail.mode).label}.`, false);
      refreshTableData();
    } catch (error) {
      setInfo(
        error instanceof Error ? error.message : `Не удалось обновить главную таблицу после переноса ${getShiftTransferModeMeta(detail.mode).label}.`,
        true
      );
      refreshTableData();
    }
  }

  function bindShiftTransferEvents() {
    if (state.shiftTransferEventsBound) {
      return;
    }

    window.addEventListener("storage", (event) => {
      if (event.key !== SHIFT_TRANSFER_SIGNAL_STORAGE_KEY || !event.newValue) {
        return;
      }
      const signal = parseShiftTransferSignal(event.newValue);
      if (!signal) {
        return;
      }
      void handleExternalShiftTransferSignal(signal);
    });

    state.shiftTransferEventsBound = true;
  }

  function clearBackgroundPendingSyncSchedule() {
    window.clearTimeout(state.pendingSyncAutoTimerId);
    state.pendingSyncAutoTimerId = 0;
  }

  function hasBlockingLocalWorkForBackgroundSync() {
    if (state.mainTableSaveInFlight) {
      return true;
    }
    if (mode === "department") {
      return hasDepartmentPendingLocalChanges();
    }
    if (mode === "main") {
      return state.mainTableUnlocked || hasMainTablePendingLocalChanges();
    }
    if (mode === "feedback") {
      const lightbox = state.photoLightbox || buildInitialPhotoLightboxState();
      return Boolean(
        lightbox.open
        || lightbox.isSaving
        || lightbox.isRechecking
        || lightbox.isReassigning
      );
    }
    return false;
  }

  function scheduleBackgroundPendingSync(options = {}) {
    if (!state.initialized) {
      return;
    }

    const status = getPendingSyncStatus();
    if (!status.hasPending || status.isSyncing || !sync.hasRemoteSync()) {
      clearBackgroundPendingSyncSchedule();
      return;
    }

    if (state.pendingSyncAutoTimerId) {
      return;
    }

    const requestedDelay = Math.max(0, Number(options.delayMs) || AUTO_PENDING_SYNC_DELAY_MS);
    const retryDelay = Math.max(0, Number(state.pendingSyncAutoRetryAfter) - Date.now());
    const effectiveDelay = Math.max(requestedDelay, retryDelay);

    state.pendingSyncAutoTimerId = window.setTimeout(() => {
      state.pendingSyncAutoTimerId = 0;
      void runPendingSyncNow({
        silent: true,
        background: true
      });
    }, effectiveDelay);
  }

  function bindBackgroundPendingSyncEvents() {
    if (state.pendingSyncEventsBound) {
      return;
    }

    window.addEventListener("online", () => {
      scheduleBackgroundPendingSync({
        delayMs: AUTO_PENDING_SYNC_DELAY_MS
      });
    });

    window.addEventListener(PENDING_SYNC_EVENT_NAME, () => {
      scheduleBackgroundPendingSync({
        delayMs: AUTO_PENDING_SYNC_DELAY_MS
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        scheduleBackgroundPendingSync({
          delayMs: 250
        });
      }
    });

    state.pendingSyncEventsBound = true;
  }

  function renderPendingSyncControls() {
    const status = getPendingSyncStatus();
    const errorText = getPendingSyncErrorText(status);
    return `
      <div class="pending-sync-panel">
        <div class="pending-sync-panel__copy">
          <strong>Оффлайн-очередь</strong>
          <p id="pendingSyncSummaryText">${escapeHtml(getPendingSyncSummaryText(status))}</p>
          <p class="hint${errorText ? " warning-note" : ""}" id="pendingSyncErrorText">${escapeHtml(errorText)}</p>
        </div>
        <button
          type="button"
          id="pendingSyncBtn"
          class="pending-sync-panel__button${status.hasPending && sync.hasRemoteSync() && !status.isSyncing ? " save-ready" : ""}"
          ${(status.hasPending && !status.isSyncing && sync.hasRemoteSync()) ? "" : "disabled"}
        >${escapeHtml(getPendingSyncButtonLabel(status))}</button>
      </div>
    `;
  }

  function buildMainTableAndroidAppContent(displayContext = getMainTableDisplaySnapshotContext()) {
    const items = buildMainTableAndroidAppItems(displayContext);

    if (state.mainTableAndroidApp.error && !items.length) {
      return {
        summary: state.mainTableAndroidApp.error,
        html: '<div class="archive-empty">Не удалось загрузить отправки Android MAINFORM.</div>'
      };
    }

    if (state.mainTableAndroidApp.isLoading && !items.length) {
      return {
        summary: "Загружаю Android MAINFORM отправки за сегодня...",
        html: '<div class="archive-empty">Загружаю Android MAINFORM данные...</div>'
      };
    }

    if (!items.length) {
      return {
        summary: "За текущие сутки отправок Android MAINFORM пока нет.",
        html: '<div class="archive-empty">Сегодняшние отправки Android MAINFORM пока не поступали.</div>'
      };
    }

    return {
      summary: `Показано Android MAINFORM отправок за сегодня: ${items.length}. Здесь видны фото и табличные данные, которые пришли через Android app.`,
      html: `
        <div class="main-table-android-list">
          ${items.map((item) => {
            const statusText = item.alreadySaved
              ? "Уже в основной таблице"
              : (item.appliedKeys.length ? "Есть данные Android MAINFORM" : "Нет табличных данных");
            const statusClass = item.alreadySaved
              ? "main-table-telegram-form-card__status--saved"
              : (item.appliedKeys.length ? "main-table-telegram-form-card__status--pending" : "main-table-telegram-form-card__status--error");
            const reportDateText = item.reportDate
              ? `Дата отчёта: ${item.reportDate}`
              : "Дата отчёта не указана";
            const createdAtText = item.createdAt
              ? `Отправлено: ${formatTimestamp(item.createdAt)}`
              : "Время отправки не указано";
            return `
              <article class="main-table-android-card">
                <div class="main-table-android-card__head">
                  <div class="main-table-android-card__meta">
                    <strong>${escapeHtml(item.departmentName || item.departmentId || `feedback ${item.id}`)}</strong>
                    <span>Android MAINFORM</span>
                    <span>${escapeHtml(reportDateText)}</span>
                    <span>${escapeHtml(createdAtText)}</span>
                    ${item.imageName ? `<span>Файл: ${escapeHtml(item.imageName)}</span>` : ""}
                  </div>
                  <span class="main-table-telegram-form-card__status ${statusClass}">${escapeHtml(statusText)}</span>
                </div>
                <div class="main-table-android-card__body">
                  <div class="main-table-android-card__photo">
                    <button
                      type="button"
                      class="main-table-android-card__photo-button"
                      data-main-table-photo-open="${escapeHtml(String(item.feedbackId))}"
                      data-main-table-photo-department-id="${escapeHtml(item.departmentId || item.rowId || "")}"
                      aria-label="${escapeHtml(`Открыть Android MAINFORM фото ${item.departmentName}`)}"
                      title="${escapeHtml(`${item.departmentName}${item.photoReportDate ? `\nДата на фото: ${item.photoReportDate}` : ""}${item.photoSentAt ? `\nОтправлено: ${formatTimestamp(item.photoSentAt)}` : ""}`)}"
                    >
                      <img
                        src="${escapeHtml(item.imageDataUrl)}"
                        alt="${escapeHtml(`Android MAINFORM фото ${item.departmentName}`)}"
                        loading="lazy"
                        decoding="async"
                      >
                    </button>
                    ${item.sourceMeta?.text ? `<span class="main-table-android-card__source">${escapeHtml(item.sourceMeta.text)}</span>` : ""}
                  </div>
                  <div class="main-table-android-card__table">
                    ${item.previewRow
                      ? renderMainTableTelegramFormPreviewTable(item, item.previewRow)
                      : '<div class="archive-empty">В этой Android-отправке нет табличных данных для предпросмотра.</div>'}
                  </div>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      `
    };
  }

  function renderShiftTransferControls() {
    const busy = Boolean(state.shiftTransferInFlightMode);
    const statusText = getShiftTransferStatusText();
    return `
      <div class="shift-transfer-panel">
        <div class="shift-transfer-panel__copy">
          <strong>Ընդունում / Դուրսգրում</strong>
          <p id="shiftTransferSummaryText">${escapeHtml(getShiftTransferSummaryText())}</p>
          <label class="shift-transfer-panel__toggle" for="shiftAutoTransferToggle">
            <input
              type="checkbox"
              id="shiftAutoTransferToggle"
              ${state.shiftAutoTransferEnabled ? "checked" : ""}
              ${busy ? "disabled" : ""}
            >
            <span>Автоперенос в 08:01</span>
          </label>
          <p class="hint" id="shiftTransferStatusText">${escapeHtml(statusText)}</p>
        </div>
        <div class="shift-transfer-panel__actions">
          <button type="button" id="applyDayShiftNowBtn" ${busy ? "disabled" : ""}>Перенести Ընդունում</button>
          <button type="button" id="applyDischargeShiftNowBtn" ${busy ? "disabled" : ""}>Перенести Դուրսգրում</button>
        </div>
      </div>
    `;
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
      <span class="pill remote">${escapeHtml(email || "Տեր")}</span>
      <button type="button" data-owner-signout>Ելք</button>
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
      if (savedMainKeyFromQuery) {
        const savedRecord = getMainTableSavedRecordByKey(savedMainKeyFromQuery);
        return savedRecord
          ? `Сохранённая таблица ${savedRecord.dateLabel} ${savedRecord.slotLabel} | SARSH_KKZH`
          : "Сохранённая таблица | SARSH_KKZH";
      }
      if (departmentArchiveKeyFromQuery) {
        const record = getDepartmentPdfArchiveRecordByKey(departmentArchiveKeyFromQuery);
        return record
          ? `${PRINT_REPORT_TITLE} ${record.departmentMarker || record.departmentName} ${record.archiveLabel}`
          : PRINT_REPORT_TITLE;
      }
      if (departmentArchiveDateFromQuery) {
        return `${PRINT_REPORT_TITLE} ${departmentArchiveDateFromQuery}`;
      }
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
      if (departmentArchiveKeyFromQuery) {
        const record = getDepartmentPdfArchiveRecordByKey(departmentArchiveKeyFromQuery);
        return record
          ? `PDF архив ${record.departmentMarker || record.departmentName} ${record.archiveLabel} | SARSH_KKZH`
          : "PDF архив отделения | SARSH_KKZH";
      }
      if (departmentArchiveDateFromQuery) {
        return `PDF архив отделений ${departmentArchiveDateFromQuery} | SARSH_KKZH`;
      }
      const record = getArchiveRecordByKey(archiveKeyFromQuery);
      return record ? `Архив ${record.archiveLabel} | SARSH_KKZH` : "Архив | SARSH_KKZH";
    }
    return "MAINFLOW";
  }

  function renderMainPage() {
    const sourceLabel = sync.getSourceLabel(state.source);
    const freshnessStats = buildFreshnessStats(state.snapshot.rows);
    const overallUpdateStatus = getOverallUpdateStatus(freshnessStats, state.snapshot.rows.length);
    const summaryFreshness = getFreshnessMeta(
      freshnessStats.newestRow ? getRowEffectiveUpdatedAt(freshnessStats.newestRow) : "",
      Boolean(freshnessStats.newestRow)
    );
    const currentDateTime = getCurrentDateTimeParts();
    const archiveRecords = ensureArchiveRecordsLoaded();
    const latestArchive = archiveRecords[0] || null;
    const mainTableSavedRecords = ensureMainTableSavedRecordsLoaded();
    const activeMainTableSavedRecord = getActiveMainTableSavedPreviewRecord(mainTableSavedRecords);
    const displayedMainTableSnapshot = activeMainTableSavedRecord
      ? syncQhCalculatedTargets(primeQhBaseInputs(deepCopy(activeMainTableSavedRecord.snapshot)))
      : state.snapshot;
    const displayedMainTableRows = Array.isArray(displayedMainTableSnapshot.rows) ? displayedMainTableSnapshot.rows : [];
    const displayedMainTableFreshness = buildFreshnessStats(displayedMainTableRows);
    const displayedMainTableSummaryFreshness = getFreshnessMeta(
      displayedMainTableFreshness.newestRow ? getRowEffectiveUpdatedAt(displayedMainTableFreshness.newestRow) : "",
      Boolean(displayedMainTableFreshness.newestRow)
    );
    const displayedMainTableHeaderDateTime = activeMainTableSavedRecord
      ? getHeaderDateTimeParts(activeMainTableSavedRecord.reportDate)
      : null;
    const mainTablePhotoGalleryContent = buildMainTablePhotoGalleryContent({
      snapshot: displayedMainTableSnapshot,
      rows: displayedMainTableRows
    });
    const mainTablePhotoGalleryBulkDeleteMeta = getMainTablePhotoGalleryBulkDeleteMeta({
      snapshot: displayedMainTableSnapshot,
      rows: displayedMainTableRows
    });
    const mainTableAndroidAppContent = buildMainTableAndroidAppContent({
      snapshot: displayedMainTableSnapshot,
      rows: displayedMainTableRows
    });
    const mainTableTelegramFormContent = buildMainTableTelegramFormContent();
    const mainTableTelegramFormBulkDeleteMeta = getMainTableTelegramFormBulkDeleteMeta();
    const departmentPdfArchiveRecords = ensureDepartmentPdfArchiveRecordsLoaded();
    const canEditMainTable = canEditMainTableDirectly();
    const mainBlankPdfPath = config.getMainBlankPdfPath
      ? config.getMainBlankPdfPath(basePath)
      : null;
    const desktopSetupPath = window.location.protocol !== "file:"
      ? getWindowsDesktopSetupPath()
      : "";
    const downloadDesktopButtonHtml = desktopSetupPath
      ? `<a class="button-link" href="${escapeHtml(desktopSetupPath)}" download="Mainflow.exe" target="_blank" rel="noopener">Mainflow.exe</a>`
      : "";
    const downloadMainPdfButtonHtml = mainBlankPdfPath
      ? `<a class="button-link" href="${escapeHtml(mainBlankPdfPath)}" download target="_blank" rel="noopener">PDF ներբ.</a>`
      : "";

    app.innerHTML = `
      <div class="page">
        <div class="print-title print-only">
          <h1>${escapeHtml(PRINT_REPORT_TITLE)}</h1>
        </div>
        <div class="toolbar no-print toolbar--main">
          <div class="toolbar-copy toolbar-copy--main">
            <h1>SARSH_KKZH</h1>
            <p>Главный файл собирает данные всех отделений, показывает общий документ и готов для печати в PDF.</p>
          </div>
          <div class="toolbar-actions toolbar-actions--main">
            <div class="main-toolbar-group main-toolbar-group--status">
              <span class="pill ${getSourceClass()}" id="syncModeLabel">${escapeHtml(sourceLabel)}</span>
              ${buildOwnerAuthActions()}
              <div class="zoom-control">
                <label for="zoomRange">Մաշտաբ</label>
                <input type="range" id="zoomRange" min="60" max="140" step="5" value="100">
                <span class="zoom-value" id="zoomValue">100%</span>
              </div>
            </div>
            <div class="main-toolbar-group">
              ${downloadDesktopButtonHtml}
              ${downloadMainPdfButtonHtml}
              <button type="button" id="sendTelegramPdfsBtn">PDF ուղարկել TG</button>
              <a class="button-link" href="${escapeHtml(getHospitalReportPath())}" target="_blank" rel="noopener">Հաշվետվ.</a>
              <a class="button-link" href="${escapeHtml(getFeedbackPath())}">OCR ստուգ.</a>
            </div>
            <div class="main-toolbar-group">
              <a class="button-link" href="${escapeHtml(getDayShiftPath())}" target="_blank" rel="noopener">Ընդունում</a>
              <a class="button-link" href="${escapeHtml(getDischargeShiftPath())}" target="_blank" rel="noopener">Դուրսգրում</a>
              <a class="button-link" href="${escapeHtml(getCivilReferralsPath())}" target="_blank" rel="noopener">Քաղ. ԲԿ բազա</a>
              <a class="button-link" href="${escapeHtml(getSetupPath())}">Կարգավ.</a>
            </div>
            <div class="main-toolbar-group main-toolbar-group--actions">
              <button type="button" id="refreshBtn">Թարմ.</button>
              <button type="button" id="printBtn">Տպել</button>
            </div>
          </div>
        </div>

                    <div class="zoom-target">
              <div class="sheet-shell">
              ${activeMainTableSavedRecord ? `
                <div class="main-table-edit-panel main-table-edit-panel--table main-table-edit-panel--preview">
                  <strong>Показан сохранённый снимок главной таблицы.</strong>
                  <span>Чтобы вернуться к живым данным и редактированию, нажмите «Вернуться к текущей таблице».</span>
                </div>
              ` : (canEditMainTable ? `
                <div class="main-table-edit-panel main-table-edit-panel--table">
                  <label class="department-top-lock-switch" for="mainTableEditToggle">
                    <input type="checkbox" id="mainTableEditToggle"${state.mainTableUnlocked ? " checked" : ""}>
                    <span class="department-top-lock-slider" aria-hidden="true"></span>
                    <span class="department-top-lock-copy">
                      <strong>Редактирование таблицы</strong>
                      <span>${escapeHtml(state.mainTableUnlocked ? "Редактирование включено." : "Редактирование заблокировано.")}</span>
                    </span>
                  </label>
                  <div class="photo-import-save-actions main-table-save-actions">
                    <button type="button" id="mainSaveBtn">Сохранить таблицу</button>
                    <span id="mainSaveRuleText">Изменений в главной таблице пока нет.</span>
                  </div>
                </div>
              ` : "")}
              <div class="main-table-saved-panel no-print">
                <div class="main-table-saved-panel__head">
                  <strong>Сохранённые таблицы 02:00 / 18:00</strong>
                  <span id="mainTableSavedSummaryText">${
                    mainTableSavedRecords.length
                      ? escapeHtml(`Снимков: ${mainTableSavedRecords.length}.`)
                      : "Снимков пока нет. После сохранения таблицы здесь появятся версии за окна 02:00 и 18:00."
                  }</span>
                </div>
                <div class="archive-list" id="mainTableSavedList">
                  ${buildMainTableSavedNavigator(mainTableSavedRecords)}
                </div>
              </div>
              <p class="status-line no-print">
                <strong>${escapeHtml(activeMainTableSavedRecord ? "Последнее обновление показанной таблицы:" : "Последнее обновление сводки:")}</strong>
                <span id="lastUpdatedText">${escapeHtml(displayedMainTableFreshness.newestRow ? formatTimestamp(getRowEffectiveUpdatedAt(displayedMainTableFreshness.newestRow)) : "еще не отправлялось")}</span>
                <span class="status-chip status-chip--${displayedMainTableSummaryFreshness.level}" id="lastUpdatedBadge">${escapeHtml(displayedMainTableSummaryFreshness.label)}</span>
              </p>
              <div class="main-table-state-legend no-print">
                <span class="main-table-state-legend__item"><span class="main-table-state-legend__swatch main-table-state-legend__swatch--auto"></span>Авто</span>
                <span class="main-table-state-legend__item"><span class="main-table-state-legend__swatch main-table-state-legend__swatch--manual"></span>Вручную</span>
                <span class="main-table-state-legend__item"><span class="main-table-state-legend__swatch main-table-state-legend__swatch--waiting"></span>Нет новых данных</span>
                <span class="main-table-state-legend__item"><span class="main-table-state-legend__swatch main-table-state-legend__swatch--pending"></span>Новые данные, проверь OCR</span>
                <span class="main-table-state-legend__item"><span class="main-table-state-legend__swatch main-table-state-legend__swatch--invalid"></span>Ошибка контроля</span>
              </div>
                <div class="table-wrap">
                  ${renderTable(
                    displayedMainTableSnapshot,
                    displayedMainTableRows,
                    {
                      interactive: state.mainTableUnlocked && !activeMainTableSavedRecord,
                      viewMode: "main",
                      headerDateTime: displayedMainTableHeaderDateTime || undefined
                    }
                  )}
                </div>
              </div>
            </div>

        <section class="panel no-print main-table-photo-gallery-panel">
          <div class="main-table-photo-gallery-panel__head">
            <div class="main-table-photo-gallery-panel__copy">
              <h2>Фото бланков текущей таблицы</h2>
              <p id="mainTablePhotoGallerySummaryText">${escapeHtml(mainTablePhotoGalleryContent.summary)}</p>
            </div>
            <button
              type="button"
              id="mainTablePhotoGalleryDeleteAllBtn"
              class="main-table-photo-gallery-panel__delete-all"
              ${mainTablePhotoGalleryBulkDeleteMeta.isDisabled ? "disabled" : ""}
              title="${escapeHtml(mainTablePhotoGalleryBulkDeleteMeta.title)}"
            >${escapeHtml(mainTablePhotoGalleryBulkDeleteMeta.label)}</button>
          </div>
          <div class="archive-list" id="mainTablePhotoGalleryList">
            ${mainTablePhotoGalleryContent.html}
          </div>
        </section>

        <section class="panel no-print main-table-android-panel">
          <h2>Данные Android MAINFORM за сегодня</h2>
          <p id="mainTableAndroidAppSummaryText">${escapeHtml(mainTableAndroidAppContent.summary)}</p>
          <div class="archive-list" id="mainTableAndroidAppList">
            ${mainTableAndroidAppContent.html}
          </div>
        </section>

        <section class="panel no-print main-table-telegram-form-panel">
          <h2>Таблицы Telegram Web форм за сегодня</h2>
          <p id="mainTableTelegramFormSummaryText">${escapeHtml(mainTableTelegramFormContent.summary)}</p>
          <div class="main-table-telegram-form-panel__actions">
            <button
              type="button"
              id="mainTableTelegramFormDeleteAllBtn"
              class="main-table-telegram-form-panel__delete-all"
              ${mainTableTelegramFormBulkDeleteMeta.isDisabled ? "disabled" : ""}
              title="${escapeHtml(mainTableTelegramFormBulkDeleteMeta.title)}"
            >${escapeHtml(mainTableTelegramFormBulkDeleteMeta.label)}</button>
          </div>
          <div class="archive-list" id="mainTableTelegramFormList">
            ${mainTableTelegramFormContent.html}
          </div>
        </section>

        ${renderMainDepartmentCalcPanel({
          previewRecord: activeMainTableSavedRecord,
          snapshot: displayedMainTableSnapshot,
          rows: displayedMainTableRows,
          headerDateTime: displayedMainTableHeaderDateTime || undefined
        })}

        <div class="layout-grid split">
          <div class="info-stack">
            <div class="panel no-print main-summary-panel">
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
              ${renderPendingSyncControls()}
              ${renderShiftTransferControls()}
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
                  ? escapeHtml(`Самые старые данные: ${freshnessStats.oldestRow.department} — ${formatTimestamp(getRowEffectiveUpdatedAt(freshnessStats.oldestRow))} (${formatAge(getRowEffectiveUpdatedAt(freshnessStats.oldestRow))})`)
                  : "Нет ни одного отделения с отправленными данными."
              }</p>
            </div>

            ${renderMainPhotoRoutePanel()}

            <section class="panel no-print updates-panel">
              <h2>Обновления отделений</h2>
              <p>Точный список по каждому отделению: когда именно пришли последние данные.</p>
              <div class="updates-list" id="departmentUpdatesList">
                ${state.snapshot.rows.map((row) => buildDepartmentUpdateItem(row)).join("")}
              </div>
            </section>
            <section class="panel no-print archive-panel main-daily-archive-panel">
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
            <section class="panel no-print archive-panel department-pdf-archive-panel">
              <h2>Архив PDF отделений</h2>
              <p id="departmentPdfArchiveSummaryText">${escapeHtml(getDepartmentPdfArchiveSummaryText(departmentPdfArchiveRecords))}</p>
              <p class="hint">После сохранения отделения здесь остается PDF-копия бланка. Можно открыть отдельный бланк на странице отделения или общий PDF за выбранную дату.</p>
              <div class="archive-list" id="departmentPdfArchiveList">
                ${buildMainDepartmentPdfArchivePicker(departmentPdfArchiveRecords)}
              </div>
            </section>
          </div>

          <aside class="panel no-print main-links-panel">
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

    let ocrPreviewHtml = "";
    let recheckButtonHtml = "";
    if (lightbox.sourceKind === "main-table-gallery" && lightbox.sourceId) {
      const context = getMainTablePhotoLightboxContext(lightbox);
      const boundRow = context?.boundRow || null;
      if (context?.record && boundRow) {
        const previewTable = renderPhotoImportPreviewTable(
          boundRow,
          {
            recognizedValues: context.previewValues,
            cellReviews: context.reviewSource,
            suspectKeys: Array.isArray(context.suspectDetails?.suspectKeys) ? context.suspectDetails.suspectKeys : [],
            suspectReason: context.suspectDetails?.suspectReason || ""
          },
          context.reviewByKey,
          context.recognizedFields,
          new Set(Array.isArray(context.suspectDetails?.suspectKeys) ? context.suspectDetails.suspectKeys : []),
          {
            editable: true,
            validationStatusId: "photoLightboxPreviewValidationStatus"
          }
        );
        if (previewTable) {
          const isArchivePreview = Boolean(state.activeMainTableSavedPreviewKey);
          const hasDirtyMainTableRows = getMainTableDirtyRows().length > 0;
          const saveBlockedByControls = !context.validation.applicable || !context.validation.isValid;
          const saveBlockedByState = isArchivePreview || hasDirtyMainTableRows || state.mainTableSaveInFlight || lightbox.isReassigning;
          const canSave = !saveBlockedByControls && !saveBlockedByState && !lightbox.isSaving;
          const saveHint = isArchivePreview
            ? "Для сохранения OCR вернитесь к текущей таблице."
            : (hasDirtyMainTableRows
              ? "Сначала сохраните или снимите ручные правки в главной таблице."
              : (state.mainTableSaveInFlight
                ? "Главная таблица уже сохраняется. Подождите."
                : (saveBlockedByControls
                  ? context.validation.failedChecks.map((item) => item.failureMessage).join(" ")
                  : "Контроль пройден. OCR можно сохранить в строку отделения.")));
          const reassignMeta = getPhotoLightboxReassignMeta(context, lightbox);
          ocrPreviewHtml = `
            <div class="photo-lightbox-ocr">
              <div class="photo-lightbox-ocr__head">
                <h3>OCR данные</h3>
                <div class="photo-lightbox-ocr__department-tools">
                  <label class="photo-lightbox-ocr__department">
                    <span>\u041e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u0435</span>
                    <select id="photoLightboxDepartmentSelect" ${(lightbox.isSaving || lightbox.isReassigning) ? "disabled" : ""}>
                      ${buildMainTablePhotoDepartmentOptions(context.departmentId || "")}
                    </select>
                  </label>
                  <button
                    type="button"
                    id="photoLightboxReassignBtn"
                    class="photo-lightbox-reassign${reassignMeta.changed ? " photo-lightbox-reassign--ready" : ""}"
                    ${reassignMeta.disabled ? "disabled" : ""}
                  >${escapeHtml(reassignMeta.label)}</button>
                </div>
              </div>
              <p id="photoLightboxDepartmentHint" class="hint">${escapeHtml(reassignMeta.hint)}</p>
              ${previewTable}
              <div class="photo-lightbox-save-actions">
                <button
                  type="button"
                  class="photo-lightbox-recheck"
                  id="photoLightboxRecheck"
                  ${(lightbox.isRechecking || lightbox.isSaving || lightbox.isReassigning) ? "disabled" : ""}
                >${lightbox.isRechecking ? "\u054d\u057f\u0578\u0582\u0563\u0578\u0582\u0574 \u0565\u0574..." : "\u054e\u0565\u0580\u057d\u057f\u0578\u0582\u0563\u0565\u056c"}</button>
                <button
                  type="button"
                  id="photoLightboxSaveBtn"
                  class="${canSave ? "save-ready" : "save-blocked"}"
                  ${(canSave && !lightbox.isSaving && !lightbox.isReassigning) ? "" : "disabled"}
                >${lightbox.isSaving ? "Сохраняю..." : "Сохранить"}</button>
                <span id="photoLightboxSaveHint" class="photo-lightbox-save-hint${(!canSave && saveBlockedByControls) || lightbox.statusIsError ? " warning-note" : ""}">${escapeHtml(saveHint)}</span>
              </div>
              ${renderPhotoLightboxDepartmentTable(context.displayContext?.snapshot || state.snapshot, boundRow)}
              <p id="photoLightboxStatusText" class="hint${lightbox.statusIsError ? " warning-note" : ""}"${lightbox.status ? "" : " hidden"}>${escapeHtml(lightbox.status || "")}</p>
            </div>
          `;
        }
        recheckButtonHtml = `
          <button
            type="button"
            class="photo-lightbox-recheck"
            id="photoLightboxRecheck"
            ${(lightbox.isRechecking || lightbox.isSaving || lightbox.isReassigning) ? "disabled" : ""}
          >${lightbox.isRechecking ? "Проверяю..." : "Перепроверить"}</button>
        `;
      }
    }

    return `
      <div class="photo-lightbox" id="photoLightbox" aria-modal="true" role="dialog">
        <div class="photo-lightbox-backdrop" data-photo-lightbox-close="true"></div>
        <div class="photo-lightbox-dialog">
          <button
            type="button"
            class="photo-lightbox-rotate"
            id="photoLightboxRotate"
            aria-label="Повернуть фото"
            title="Повернуть фото"
            ${(lightbox.isRotating || lightbox.isSaving || lightbox.isReassigning) ? "disabled" : ""}
          >↻</button>
          <button type="button" class="photo-lightbox-close" id="photoLightboxClose" aria-label="Закрыть просмотр">×</button>
          <img src="${escapeHtml(lightbox.imageDataUrl)}" alt="${escapeHtml(lightbox.alt || "Фото бланка")}">
          ${ocrPreviewHtml}
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
    const reviewState = state.telegramFormReview || buildInitialTelegramFormReviewState();
    const values = reviewState.recognizedValues && typeof reviewState.recognizedValues === "object"
      ? reviewState.recognizedValues
      : null;
    const feedbackId = String(reviewState.feedbackId || "").trim();

    if (!row || !feedbackId) {
      return "";
    }

    const status = reviewState.draftMode ? "pending" : "processed";
    const canApplyTelegramSource = Boolean(
      values
      && Array.isArray(reviewState.lastAppliedKeys)
      && reviewState.lastAppliedKeys.length
      && !reviewState.isError
    );
    const savedToMain = Boolean(
      !reviewState.draftMode
      && values
      && doesDepartmentRowMatchPreviewValues(state.snapshot, row, values, reviewState.lastAppliedKeys)
    );
    const statusText = reviewState.draftMode
      ? "Значения подставлены в таблицу отделения"
      : "Последняя Telegram форма показана для сверки";
    const effectiveStatusText = savedToMain
      ? "Уже сохранено в основную таблицу"
      : statusText;
    const cells = PHOTO_FIELD_DEFINITIONS.map((field) => {
      const displayValue = getTelegramFormReviewValue(values, field.key);
      return `
        <td>
          <span>${escapeHtml(field.label)}</span>
          <strong>${escapeHtml(displayValue === null ? "-" : (getDisplayValue(displayValue) || "0"))}</strong>
        </td>
      `;
    }).join("");
    const note = reviewState.isError
      ? (reviewState.status || "Не удалось загрузить значения Telegram формы.")
      : (reviewState.status || "Проверьте эту таблицу. Если всё правильно, нажмите Сохранить, чтобы внести данные в общую таблицу.");

    const effectiveNote = savedToMain && !reviewState.isError
      ? "Эта Telegram форма уже автоматически записана в основную таблицу. Ниже можно сверить отправленные значения."
      : note;

    return `
      <section class="panel no-print telegram-form-review-panel telegram-form-review-panel--${status}">
        <div class="telegram-form-review-head">
          <div>
            <h2>Данные из Telegram формы</h2>
            <p class="hint${reviewState.isError ? " warning-note" : ""}">${escapeHtml(effectiveNote)}</p>
          </div>
          <span class="status-chip status-chip--${status === "processed" ? "fresh" : "stale"}">${escapeHtml(effectiveStatusText)}</span>
        </div>
        <div class="telegram-form-review-meta">
          <span>Feedback: ${escapeHtml(feedbackId)}</span>
          <span>Отделение: ${escapeHtml(row.department)}</span>
          ${reviewState.lastReportDate ? `<span>Дата: ${escapeHtml(reviewState.lastReportDate)}</span>` : ""}
        </div>
        <div class="telegram-form-review-actions">
          <button
            type="button"
            id="applyTelegramSourceBtn"
            ${canApplyTelegramSource && !reviewState.draftMode ? "" : "disabled"}
          >Взять данные из Telegram формы</button>
          <span>${reviewState.draftMode
            ? "Сейчас в таблице выбран источник Telegram формы."
            : "Источник попадет в таблицу только после вашего выбора и сохранения."}</span>
        </div>
        ${savedToMain ? `<p class="hint">Эти значения уже автоматически записаны в основную таблицу из Telegram App.</p>` : ""}
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


  function getPhotoImportPreviewStatus(photoState, reviewByKey, recognizedFields, suspectFields, key) {
    const review = reviewByKey.get(key) || null;
    if (suspectFields.has(key)) {
      return "suspect";
    }
    if (review?.status === "review") {
      return "review";
    }
    if (review?.status === "recognized" || recognizedFields.has(key) || key === "presentTotal") {
      return "recognized";
    }
    const rawValues = photoState?.recognizedValues && typeof photoState.recognizedValues === "object"
      ? photoState.recognizedValues
      : {};
    if (Object.prototype.hasOwnProperty.call(rawValues, key) && rawValues[key] !== null) {
      return "neutral";
    }
    return "empty";
  }

  function syncPhotoImportPreviewState(row) {
    if (mode !== "department" || !row || !state.photoImport) {
      return buildPhotoImportPreviewValidation(row, null);
    }

    const recognizedValues = state.photoImport.recognizedValues && typeof state.photoImport.recognizedValues === "object"
      ? state.photoImport.recognizedValues
      : {};
    const previewKeys = getPhotoPreviewKeysFromValues(recognizedValues);

    state.photoImport.lastAppliedKeys = previewKeys;
    state.photoImport.draftMode = false;

    const validation = buildPhotoImportPreviewValidation(row, recognizedValues);
    const suspectDetails = getPhotoImportSuspectDetails(row, new Set(previewKeys), recognizedValues);
    state.photoImport.suspectKeys = suspectDetails.suspectKeys;
    state.photoImport.suspectReason = suspectDetails.suspectReason;

    return validation;
  }

  function refreshPhotoImportPreviewUi(row) {
    if (mode !== "department" || !row || !state.photoImport) {
      return;
    }

    const photoState = state.photoImport;
    const reviewByKey = new Map(
      (Array.isArray(photoState.cellReviews) ? photoState.cellReviews : []).map((item) => [item.key, item])
    );
    const recognizedFields = new Set(photoState.lastAppliedKeys || []);
    const suspectFields = new Set(Array.isArray(photoState.suspectKeys) ? photoState.suspectKeys : []);
    const validation = buildPhotoImportPreviewValidation(row, photoState.recognizedValues);
    const statusMeta = buildPhotoImportPreviewValidationStatus(validation);

    PHOTO_FIELD_DEFINITIONS.forEach((field) => {
      const cell = document.querySelector(`[data-photo-preview-cell="${field.key}"]`);
      if (!(cell instanceof HTMLTableCellElement)) {
        return;
      }

      const status = getPhotoImportPreviewStatus(photoState, reviewByKey, recognizedFields, suspectFields, field.key);
      const controlTone = getPhotoImportPreviewControlTone(validation, field.key);
      cell.className = [
        "photo-import-mini-table__cell",
        `photo-import-mini-table__cell--${status}`,
        controlTone ? `photo-import-mini-table__cell--control-${controlTone}` : ""
      ].filter(Boolean).join(" ");

      if (field.computed) {
        const output = cell.querySelector("[data-photo-preview-output]");
        if (output) {
          output.textContent = getDisplayValue(getPhotoPreviewValue(row, field.key, photoState.recognizedValues)) || "—";
        }
        return;
      }

      const input = cell.querySelector("input[data-photo-preview-key]");
      if (input instanceof HTMLInputElement) {
        const value = getPhotoPreviewValue(row, field.key, photoState.recognizedValues);
        const expectedText = getDisplayValue(value) || "";
        if (input.value !== expectedText) {
          input.value = expectedText;
        }
      }
    });

    const validationStatus = document.getElementById("photoImportPreviewValidationStatus");
    if (validationStatus) {
      validationStatus.textContent = statusMeta.text;
      validationStatus.className = `photo-import-mini-table-status photo-import-mini-table-status--${statusMeta.tone}`;
    }

    const suspectReason = document.getElementById("photoImportSuspectReason");
    if (suspectReason) {
      if (photoState.suspectReason) {
        suspectReason.textContent = photoState.suspectReason;
        suspectReason.hidden = false;
      } else {
        suspectReason.textContent = "";
        suspectReason.hidden = true;
      }
    }

    const applyPhotoSourceBtn = document.getElementById("applyPhotoSourceBtn");
    if (applyPhotoSourceBtn instanceof HTMLButtonElement) {
      const canApplyPhotoSource = Boolean(
        photoState.recognizedValues
        && typeof photoState.recognizedValues === "object"
        && Array.isArray(photoState.lastAppliedKeys)
        && photoState.lastAppliedKeys.length
        && photoState.structureOk !== false
        && !photoState.draftMode
      );
      applyPhotoSourceBtn.disabled = !canApplyPhotoSource;
    }

    const statusLine = document.getElementById("photoImportStatus");
    if (statusLine) {
      statusLine.textContent = photoState.status || "";
      statusLine.className = `hint${photoState.isError ? " warning-note" : ""}`;
    }
  }

  function getPhotoLightboxSaveMeta(context, lightbox = state.photoLightbox || buildInitialPhotoLightboxState()) {
    const isArchivePreview = Boolean(state.activeMainTableSavedPreviewKey);
    const hasDirtyMainTableRows = getMainTableDirtyRows().length > 0;
    const saveBlockedByControls = !context?.validation?.applicable || !context.validation.isValid;
    const saveBlockedByState = isArchivePreview || hasDirtyMainTableRows || state.mainTableSaveInFlight || lightbox.isReassigning;
    const canSave = !saveBlockedByControls && !saveBlockedByState && !lightbox.isSaving;
    const saveHint = lightbox.isReassigning
      ? "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0434\u043e\u0436\u0434\u0438\u0442\u0435\u0441\u044c, \u043f\u043e\u043a\u0430 \u0444\u043e\u0442\u043e \u043f\u0435\u0440\u0435\u043d\u043e\u0441\u0438\u0442\u0441\u044f \u0432 \u043d\u043e\u0432\u043e\u0435 \u043e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u0435."
      : isArchivePreview
      ? "\u0414\u043b\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f OCR \u0432\u0435\u0440\u043d\u0438\u0442\u0435\u0441\u044c \u043a \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u0442\u0430\u0431\u043b\u0438\u0446\u0435."
      : (hasDirtyMainTableRows
        ? "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 \u0438\u043b\u0438 \u0441\u043d\u0438\u043c\u0438\u0442\u0435 \u0440\u0443\u0447\u043d\u044b\u0435 \u043f\u0440\u0430\u0432\u043a\u0438 \u0432 \u0433\u043b\u0430\u0432\u043d\u043e\u0439 \u0442\u0430\u0431\u043b\u0438\u0446\u0435."
        : (state.mainTableSaveInFlight
          ? "\u0413\u043b\u0430\u0432\u043d\u0430\u044f \u0442\u0430\u0431\u043b\u0438\u0446\u0430 \u0443\u0436\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442\u0441\u044f. \u041f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435."
          : (saveBlockedByControls
            ? context.validation.failedChecks.map((item) => item.failureMessage).join(" ")
            : (context?.departmentChanged
              ? `\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c \u043f\u0440\u043e\u0439\u0434\u0435\u043d. \u041c\u043e\u0436\u043d\u043e \u0441\u0440\u0430\u0437\u0443 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0432 ${context.departmentName}.`
              : "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c \u043f\u0440\u043e\u0439\u0434\u0435\u043d. OCR \u043c\u043e\u0436\u043d\u043e \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0432 \u0441\u0442\u0440\u043e\u043a\u0443 \u043e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u044f."))));
    return {
      saveBlockedByControls,
      saveBlockedByState,
      canSave,
      saveHint
    };
  }

  function getMainTablePhotoGalleryRenderedContent(displayContext = getMainTableDisplaySnapshotContext()) {
    const galleryState = state.mainTablePhotoGallery || buildInitialMainTablePhotoGalleryState();
    const recordsRef = ensureMainTablePhotoGalleryRecordsLoaded();
    const todayDateKey = getArchiveDateKey();
    if (
      galleryState.lastRenderContent
      && galleryState.lastRenderRecordsRef === recordsRef
      && galleryState.lastRenderDateKey === todayDateKey
      && galleryState.lastRenderIsLoading === Boolean(galleryState.isLoading)
      && galleryState.lastRenderIsDeletingAll === Boolean(galleryState.isDeletingAll)
      && galleryState.lastRenderError === String(galleryState.error || "")
    ) {
      return {
        ...galleryState.lastRenderContent,
        renderToken: galleryState.lastRenderToken
      };
    }

    const content = buildMainTablePhotoGalleryContent(displayContext);
    galleryState.lastRenderRecordsRef = recordsRef;
    galleryState.lastRenderDateKey = todayDateKey;
    galleryState.lastRenderIsLoading = Boolean(galleryState.isLoading);
    galleryState.lastRenderIsDeletingAll = Boolean(galleryState.isDeletingAll);
    galleryState.lastRenderError = String(galleryState.error || "");
    galleryState.lastRenderContent = content;
    galleryState.lastRenderToken += 1;
    return {
      ...content,
      renderToken: galleryState.lastRenderToken
    };
  }

  function getPhotoLightboxReassignMeta(context, lightbox = state.photoLightbox || buildInitialPhotoLightboxState()) {
    const recordDepartmentId = String(context?.record?.departmentId || "").trim();
    const selectedDepartmentId = String(context?.departmentId || "").trim();
    const changed = Boolean(selectedDepartmentId && recordDepartmentId && selectedDepartmentId !== recordDepartmentId);
    const canUseRemoteReassign = sync.hasRemoteSync?.() && typeof sync.reassignOcrFeedbackDepartment === "function";
    const disabled = !changed || !canUseRemoteReassign || lightbox.isSaving || lightbox.isReassigning;
    const label = lightbox.isReassigning
      ? "\u041f\u0435\u0440\u0435\u043d\u043e\u0448\u0443..."
      : (changed ? "\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u0435" : "\u041e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u0432\u0435\u0440\u043d\u043e");
    const hint = changed
      ? `\u0412\u044b\u0431\u0440\u0430\u043d\u043e \u043d\u043e\u0432\u043e\u0435 \u043e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u0435: ${context?.departmentName || selectedDepartmentId}. \u041c\u043e\u0436\u043d\u043e \u043d\u0430\u0436\u0430\u0442\u044c \u00ab\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u0435\u00bb \u0438\u043b\u0438 \u0441\u0440\u0430\u0437\u0443 \u00ab\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c\u00bb.`
      : "\u0415\u0441\u043b\u0438 OCR \u043e\u0448\u0438\u0431\u0441\u044f \u0441 \u043e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u0435\u043c, \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043d\u0443\u0436\u043d\u043e\u0435 \u043e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u0437\u0434\u0435\u0441\u044c.";
    return {
      changed,
      disabled,
      label,
      hint,
      canUseRemoteReassign
    };
  }

  function refreshPhotoLightboxPreviewUi(context = getMainTablePhotoLightboxContext()) {
    const root = document.getElementById("photoLightbox");
    if (!(root instanceof HTMLDivElement) || !context?.boundRow) {
      return;
    }

    const lightbox = state.photoLightbox || buildInitialPhotoLightboxState();
    const photoState = {
      recognizedValues: context.previewValues,
      cellReviews: context.reviewSource,
      suspectKeys: Array.isArray(context.suspectDetails?.suspectKeys) ? context.suspectDetails.suspectKeys : [],
      suspectReason: context.suspectDetails?.suspectReason || ""
    };
    const reviewByKey = context.reviewByKey instanceof Map ? context.reviewByKey : new Map();
    const recognizedFields = context.recognizedFields instanceof Set ? context.recognizedFields : new Set();
    const suspectFields = new Set(Array.isArray(context.suspectDetails?.suspectKeys) ? context.suspectDetails.suspectKeys : []);
    const validation = context.validation || buildPhotoImportPreviewValidation(context.boundRow, context.previewValues);
    const validationStatusMeta = context.validationStatus || buildPhotoImportPreviewValidationStatus(validation);

    const previewTable = root.querySelector(".photo-import-mini-table");
    if (previewTable instanceof HTMLTableElement) {
      previewTable.className = `photo-import-mini-table photo-import-mini-table--${validation.statusTone}`;
    }

    PHOTO_FIELD_DEFINITIONS.forEach((field) => {
      const cell = root.querySelector(`[data-photo-preview-cell="${field.key}"]`);
      if (!(cell instanceof HTMLTableCellElement)) {
        return;
      }

      const status = getPhotoImportPreviewStatus(photoState, reviewByKey, recognizedFields, suspectFields, field.key);
      const controlTone = getPhotoImportPreviewControlTone(validation, field.key);
      cell.className = [
        "photo-import-mini-table__cell",
        `photo-import-mini-table__cell--${status}`,
        controlTone ? `photo-import-mini-table__cell--control-${controlTone}` : ""
      ].filter(Boolean).join(" ");

      if (field.computed) {
        const output = cell.querySelector("[data-photo-preview-output]");
        if (output) {
          output.textContent = getDisplayValue(getPhotoPreviewValue(context.boundRow, field.key, context.previewValues)) || "\u2014";
        }
        return;
      }

      const input = cell.querySelector("input[data-photo-preview-key]");
      if (input instanceof HTMLInputElement) {
        const value = getPhotoPreviewValue(context.boundRow, field.key, context.previewValues);
        const expectedText = getDisplayValue(value) || "";
        if (input.value !== expectedText) {
          input.value = expectedText;
        }
      }
    });

    const validationStatus = document.getElementById("photoLightboxPreviewValidationStatus");
    if (validationStatus) {
      validationStatus.textContent = validationStatusMeta.text;
      validationStatus.className = `photo-import-mini-table-status photo-import-mini-table-status--${validationStatusMeta.tone}`;
    }

    const saveMeta = getPhotoLightboxSaveMeta(context, lightbox);
    const saveButton = document.getElementById("photoLightboxSaveBtn");
    if (saveButton instanceof HTMLButtonElement) {
      saveButton.disabled = !saveMeta.canSave || lightbox.isSaving;
      saveButton.className = saveMeta.canSave ? "save-ready" : "save-blocked";
      saveButton.textContent = lightbox.isSaving
        ? "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e..."
        : "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c";
    }

    const saveHint = document.getElementById("photoLightboxSaveHint");
    if (saveHint) {
      saveHint.textContent = saveMeta.saveHint;
      saveHint.className = `photo-lightbox-save-hint${(!saveMeta.canSave && saveMeta.saveBlockedByControls) || lightbox.statusIsError ? " warning-note" : ""}`;
    }

    const departmentSelect = document.getElementById("photoLightboxDepartmentSelect");
    if (departmentSelect instanceof HTMLSelectElement) {
      if (departmentSelect.value !== (context.departmentId || "")) {
        departmentSelect.value = context.departmentId || "";
      }
      departmentSelect.disabled = lightbox.isSaving || lightbox.isReassigning;
    }

    const reassignMeta = getPhotoLightboxReassignMeta(context, lightbox);
    const reassignButton = document.getElementById("photoLightboxReassignBtn");
    if (reassignButton instanceof HTMLButtonElement) {
      reassignButton.disabled = reassignMeta.disabled;
      reassignButton.className = `photo-lightbox-reassign${reassignMeta.changed ? " photo-lightbox-reassign--ready" : ""}`;
      reassignButton.textContent = reassignMeta.label;
    }

    const departmentHint = document.getElementById("photoLightboxDepartmentHint");
    if (departmentHint) {
      departmentHint.textContent = reassignMeta.hint;
      departmentHint.className = `hint${reassignMeta.changed ? "" : ""}`;
    }

    const statusText = document.getElementById("photoLightboxStatusText");
    if (statusText) {
      statusText.textContent = lightbox.status || "";
      statusText.className = `hint${lightbox.statusIsError ? " warning-note" : ""}`;
      statusText.hidden = !lightbox.status;
    }
  }

  function handlePhotoImportPreviewEdit(key, rawValue) {
    const row = getCurrentRow();
    const field = getPhotoFieldMetaByKey(key);
    if (!row || !field || field.computed || !state.photoImport) {
      return { text: "", value: null };
    }

    const sanitized = sanitizeNumericInput(rawValue);
    if (!state.photoImport.recognizedValues || typeof state.photoImport.recognizedValues !== "object") {
      state.photoImport.recognizedValues = {};
    }

    if (sanitized.value === null) {
      delete state.photoImport.recognizedValues[key];
    } else {
      state.photoImport.recognizedValues[key] = sanitized.value;
    }

    syncPhotoImportPreviewState(row);
    setPhotoImportStatus("OCR данные изменены вручную. Проверьте контроль и нажмите «Взять данные из фото».", false);
    refreshPhotoImportPreviewUi(row);
    return sanitized;
  }

  function handlePhotoLightboxPreviewEdit(key, rawValue) {
    const lightbox = state.photoLightbox || buildInitialPhotoLightboxState();
    const context = getMainTablePhotoLightboxContext(lightbox);
    const field = getPhotoFieldMetaByKey(key);
    if (!lightbox.open || !context?.boundRow || !field || field.computed) {
      return { text: "", value: null };
    }

    const sanitized = sanitizeNumericInput(rawValue);
    const nextValues = normalizePhotoPreviewValueObject(context.previewValues);
    if (sanitized.value === null) {
      delete nextValues[key];
    } else {
      nextValues[key] = sanitized.value;
    }

    state.photoLightbox = {
      ...lightbox,
      recognizedValues: nextValues,
      recognizedKeys: getPhotoPreviewKeysFromValues(nextValues),
      cellReviews: Array.isArray(lightbox.cellReviews)
        ? lightbox.cellReviews
        : (Array.isArray(context.reviewSource) ? context.reviewSource : []),
      status: "OCR \u0434\u0430\u043d\u043d\u044b\u0435 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u044b \u0432\u0440\u0443\u0447\u043d\u0443\u044e. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c \u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u00ab\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c\u00bb.",
      statusIsError: false
    };
    refreshPhotoLightboxPreviewUi(getMainTablePhotoLightboxContext(state.photoLightbox));
    return sanitized;
  }

  function handlePhotoLightboxDepartmentChange(nextDepartmentId) {
    const lightbox = state.photoLightbox || buildInitialPhotoLightboxState();
    const context = getMainTablePhotoLightboxContext(lightbox);
    if (!lightbox.open || !context?.record) {
      return;
    }

    const normalizedDepartmentId = String(nextDepartmentId || "").trim();
    if (!normalizedDepartmentId) {
      return;
    }

    state.photoLightbox = {
      ...lightbox,
      selectedDepartmentId: normalizedDepartmentId,
      status: context.record.departmentId !== normalizedDepartmentId
        ? `\u0412\u044b\u0431\u0440\u0430\u043d\u043e \u043e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u0435 ${config.getDepartmentById(normalizedDepartmentId)?.department || normalizedDepartmentId}.`
        : lightbox.status,
      statusIsError: false
    };
    renderPage();
  }

  async function persistPhotoLightboxDepartmentAssignment(lightbox = state.photoLightbox || buildInitialPhotoLightboxState()) {
    const context = getMainTablePhotoLightboxContext(lightbox);
    const nextDepartmentId = String(context?.departmentId || "").trim();
    const currentDepartmentId = String(context?.record?.departmentId || "").trim();
    if (!context?.record || !nextDepartmentId) {
      throw new Error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u043e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u0434\u043b\u044f \u0444\u043e\u0442\u043e.");
    }
    if (nextDepartmentId === currentDepartmentId) {
      return context;
    }
    if (!sync.hasRemoteSync?.() || typeof sync.reassignOcrFeedbackDepartment !== "function") {
      throw new Error("\u041f\u0435\u0440\u0435\u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u0444\u043e\u0442\u043e \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e \u0432 \u043e\u043d\u043b\u0430\u0439\u043d-\u0440\u0435\u0436\u0438\u043c\u0435 \u0432\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u0430.");
    }

    const result = await sync.reassignOcrFeedbackDepartment(context.record.id, nextDepartmentId);
    upsertMainTablePhotoGalleryRecord(result?.record);
    if (result?.snapshot) {
      applyLoadedSnapshot(result);
    }

    state.photoLightbox = {
      ...state.photoLightbox,
      selectedDepartmentId: nextDepartmentId
    };
    return getMainTablePhotoLightboxContext(state.photoLightbox);
  }

  async function handlePhotoLightboxReassignDepartment() {
    const lightbox = state.photoLightbox || buildInitialPhotoLightboxState();
    const context = getMainTablePhotoLightboxContext(lightbox);
    const reassignMeta = getPhotoLightboxReassignMeta(context, lightbox);
    if (!lightbox.open || !context?.record || reassignMeta.disabled) {
      return;
    }

    state.photoLightbox = {
      ...lightbox,
      isReassigning: true,
      status: `\u041f\u0435\u0440\u0435\u043d\u043e\u0448\u0443 \u0444\u043e\u0442\u043e \u0432 ${context.departmentName}...`,
      statusIsError: false
    };
    renderPage();

    try {
      const nextContext = await persistPhotoLightboxDepartmentAssignment(state.photoLightbox);
      state.photoLightbox = {
        ...state.photoLightbox,
        isReassigning: false,
        status: `\u0424\u043e\u0442\u043e \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d\u043e \u043a ${nextContext?.departmentName || context.departmentName}.`,
        statusIsError: false
      };
      renderPage();
    } catch (error) {
      state.photoLightbox = {
        ...state.photoLightbox,
        isReassigning: false,
        status: error instanceof Error ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u0434\u043b\u044f \u0444\u043e\u0442\u043e.",
        statusIsError: true
      };
      renderPage();
    }
  }

  function renderPhotoImportPreviewTable(row, photoState, reviewByKey, recognizedFields, suspectFields, options = {}) {
    const rawValues = photoState?.recognizedValues && typeof photoState.recognizedValues === "object"
      ? photoState.recognizedValues
      : {};
    const editable = options?.editable !== false;
    const validationStatusId = typeof options?.validationStatusId === "string" && options.validationStatusId.trim()
      ? options.validationStatusId.trim()
      : "photoImportPreviewValidationStatus";
    const hasPreviewValues = PHOTO_FIELD_DEFINITIONS.some((field) => {
      if (field.key === "presentTotal") {
        return true;
      }
      return Object.prototype.hasOwnProperty.call(rawValues, field.key) && rawValues[field.key] !== null;
    });

    if (!hasPreviewValues) {
      return "";
    }

    const validation = buildPhotoImportPreviewValidation(row, rawValues);
    const validationStatus = buildPhotoImportPreviewValidationStatus(validation);

    const groups = [
      {
        title: "ԵՂԵԼ Է",
        keys: [
          { key: "beenTotal", label: "ԸՆԴ" },
          { key: "beenSoldier", label: "Զ/Ծ" },
          { key: "beenSeries", label: "ՇԱՐ" }
        ]
      },
      {
        title: "ԸՆԴՈՒՆՎԵԼ Է",
        keys: [
          { key: "admittedTotal", label: "ԸՆԴ" },
          { key: "admittedSoldier", label: "Զ/Ծ" },
          { key: "admittedSeries", label: "ՇԱՐ" }
        ]
      },
      {
        title: "Դ/Գ",
        keys: [
          { key: "dgTotal", label: "ԸՆԴ" },
          { key: "dgSoldier", label: "Զ/Ծ" },
          { key: "dgSeries", label: "ՇԱՐ" }
        ]
      },
      {
        title: "Տեղափոխ",
        keys: [
          { key: "transferFromDepartment", label: "Դուրս" },
          { key: "transferToDepartment", label: "Ներս" }
        ]
      },
      {
        title: "ԱՌԿԱ Է",
        keys: [
          { key: "presentTotal", label: "Ընդհ." },
          { key: "currentShar", label: "ՇԱՐ" },
          { key: "currentSpa", label: "ՍՊԱ" },
          { key: "currentPaym", label: "ՊԱՅՄ" },
          { key: "currentZh", label: "Զ/Հ" },
          { key: "family", label: "Զ/Ծ ընտ" },
          { key: "officer", label: "Զ/Պ" },
          { key: "civil", label: "Ք-ի" }
        ]
      },
      {
        title: "Արձակուրդում",
        keys: [
          { key: "leaveSharq", label: "ՇԱՐ" },
          { key: "leaveSpa", label: "ՍՊԱ" },
          { key: "leavePaym", label: "ՊԱՅՄ" }
        ]
      }
    ];

    const groupHeaders = groups
      .map((group) => `<th colspan="${group.keys.length}">${escapeHtml(group.title)}</th>`)
      .join("");
    const subHeaders = groups
      .map((group) => group.keys.map((cell) => `<th>${escapeHtml(cell.label)}</th>`).join(""))
      .join("");
    const dataCells = groups
      .map((group) => group.keys.map((cell) => {
        const status = getPhotoImportPreviewStatus(photoState, reviewByKey, recognizedFields, suspectFields, cell.key);
        const value = getPhotoPreviewValue(row, cell.key, photoState.recognizedValues);
        const fieldMeta = getPhotoFieldMetaByKey(cell.key);
        const controlTone = getPhotoImportPreviewControlTone(validation, cell.key);
        const classes = [
          "photo-import-mini-table__cell",
          `photo-import-mini-table__cell--${status}`,
          controlTone ? `photo-import-mini-table__cell--control-${controlTone}` : ""
        ].filter(Boolean).join(" ");
        const inputHtml = fieldMeta?.computed || !editable
          ? `<span data-photo-preview-output="${escapeHtml(cell.key)}">${escapeHtml(getDisplayValue(value) || "—")}</span>`
          : `<input
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              value="${escapeHtml(getDisplayValue(value) || "")}"
              data-photo-preview-key="${escapeHtml(cell.key)}"
              aria-label="${escapeHtml(`OCR ${group.title} ${cell.label}`)}"
            >`;
        return `
          <td class="${classes}" data-photo-preview-cell="${escapeHtml(cell.key)}">
            ${inputHtml}
          </td>
        `;
      }).join(""))
      .join("");

    return `
      <div class="photo-import-mini-table-wrap">
        <table class="photo-import-mini-table photo-import-mini-table--${escapeHtml(validation.statusTone)}" aria-label="OCR preview table">
          <thead>
            <tr>${groupHeaders}</tr>
            <tr>${subHeaders}</tr>
          </thead>
          <tbody>
            <tr>${dataCells}</tr>
          </tbody>
        </table>
        <div id="${escapeHtml(validationStatusId)}" class="photo-import-mini-table-status photo-import-mini-table-status--${escapeHtml(validationStatus.tone)}">${escapeHtml(validationStatus.text)}</div>
      </div>
    `;
  }

  function getMainTableSavedNavigatorRenderKey(records) {
    const items = Array.isArray(records) ? records : [];
    return [
      state.selectedMainTableSavedKey || "",
      state.activeMainTableSavedPreviewKey || "",
      ...items.map((record) => `${record.snapshotKey}:${record.savedAt || ""}`)
    ].join("|");
  }

  function renderPhotoImportPanel(row) {
    const canRecognize = sync.hasRemoteSync() && typeof sync.recognizeDepartmentPhoto === "function";
    const photoState = state.photoImport || buildInitialPhotoImportState();
    const queueInfoText = photoState.queueMode
      ? (photoState.queueRemainingCount > 0
        ? `Это фото пришло из общей очереди. После сохранения автоматически откроется следующее фото. Осталось после текущего: ${photoState.queueRemainingCount}.${photoState.queueNextDepartmentName ? ` Следующее отделение: ${photoState.queueNextDepartmentName}.` : ""}`
        : "Это последнее фото из общей очереди. После сохранения очередь завершится.")
      : "";
    const canApplyPhotoSource = Boolean(
      photoState.recognizedValues
      && typeof photoState.recognizedValues === "object"
      && Array.isArray(photoState.lastAppliedKeys)
      && photoState.lastAppliedKeys.length
      && photoState.structureOk !== false
    );
    const recognizedFields = new Set(photoState.lastAppliedKeys || []);
    const suspectFields = new Set(Array.isArray(photoState.suspectKeys) ? photoState.suspectKeys : []);
    const reviewByKey = new Map(
      (Array.isArray(photoState.cellReviews) ? photoState.cellReviews : []).map((item) => [item.key, item])
    );
    const previewTable = renderPhotoImportPreviewTable(row, photoState, reviewByKey, recognizedFields, suspectFields);

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
        <div class="photo-import-save-actions">
          <button
            type="button"
            id="applyPhotoSourceBtn"
            ${canApplyPhotoSource && !photoState.draftMode ? "" : "disabled"}
          >Взять данные из фото</button>
          <span>${photoState.draftMode
            ? "Сейчас в таблице выбран источник фото."
            : "Источник попадет в таблицу только после вашего выбора и сохранения."}</span>
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
        ${previewTable || photoState.lastReportDate || (photoState.notes && photoState.notes.length) ? `
          <div class="photo-import-results">
            ${photoState.lastReportDate ? `<p class="hint">Дата на фото: <strong>${escapeHtml(photoState.lastReportDate)}</strong></p>` : ""}
            ${previewTable}
            ${photoState.notes && photoState.notes.length ? `
              <div class="photo-import-notes">
                ${photoState.notes.map((note) => `<p class="hint warning-note">${escapeHtml(note)}</p>`).join("")}
              </div>
            ` : ""}
            <p class="hint warning-note" id="photoImportSuspectReason"${photoState.suspectReason ? "" : " hidden"}><strong>${escapeHtml(photoState.suspectReason || "")}</strong></p>
            ${photoState.draftMode ? `<p class="hint"><strong>Для таблицы сейчас выбраны данные из фото.</strong> Проверьте ячейки и нажмите Сохранить.</p>` : ""}
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

  function renderQhCalcPanel(row, options = {}) {
    if (!row) {
      return "";
    }

    const isEmbedded = Boolean(options.embedded);
    const fieldRows = getEffectiveQhCalcFieldRows(row);
    const visibleFieldRows = isEmbedded ? fieldRows.slice(0, 2) : fieldRows;
    const bodyRows = visibleFieldRows.map((definition, rowIndex) => `
      <tr>
        <th scope="row">${escapeHtml(definition.label)}</th>
        ${definition.cells.map((cell, columnIndex) => {
          if (cell.role === "output") {
            return `
              <td class="qh-calc-cell qh-calc-cell--output">
                <strong data-qh-output="${escapeHtml(cell.key)}">${escapeHtml(getQhCalcDisplayValue(row, cell.key))}</strong>
              </td>
            `;
          }

          if (cell.role === "linked") {
            return `
              <td class="qh-calc-cell qh-calc-cell--output qh-calc-cell--linked">
                <strong data-qh-base="${escapeHtml(cell.key)}">${escapeHtml(getQhCalcDisplayValue(row, cell.key) || "0")}</strong>
              </td>
            `;
          }

          if (cell.role === "input") {
            const dischargeConstraint = getQhDischargeConstraint(row, cell.key);
            const isBlockedDischarge = Boolean(dischargeConstraint && dischargeConstraint.blocked);
            const dischargeMaxAttr = dischargeConstraint ? ` max="${escapeHtml(String(dischargeConstraint.limit))}"` : "";
            const dischargeDisabledAttr = isBlockedDischarge ? " disabled" : "";
            const dischargeTitleAttr = dischargeConstraint
              ? ` title="${escapeHtml(getQhCalcDischargeTitle(dischargeConstraint))}"`
              : "";
            return `
              <td class="qh-calc-cell${isBlockedDischarge ? " qh-calc-cell--blocked" : ""}">
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  value="${escapeHtml(getQhCalcDisplayValue(row, cell.key) || "0")}"
                  ${dischargeMaxAttr}${dischargeDisabledAttr}${dischargeTitleAttr}
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

    const panelClass = isEmbedded ? "department-calc-section department-calc-section--qh" : "panel qh-calc-panel";
    const titleTag = isEmbedded ? "h3" : "h2";
    const statusHtml = `<div id="qhCalcStatus" class="qh-calc-status"></div>`;
    const buttonHtml = options.showButton === false ? "" : `
          <div class="qh-calc-actions">
            <button type="button" id="qhCalcApplyBtn">Հաշվել և տեղադրել</button>
          </div>
    `;

    return `
      <div class="${panelClass}">
        <${titleTag}>Ընդունում/Դուրսգրում</${titleTag}>
        ${isEmbedded ? "" : `<p>Մուտքագրեք ընդունված, դուրսգրված, արձակուրդ գնացող և արձակուրդից վերադարձած հիվանդների քանակը, և հաշվարկները կկատարվեն ավտոմատ։ Սեղմեք «Հաշվել և տեղադրել» կոճակը․ տվյալները կտեղադրվեն բաժանմունքի սանդղակում, որից հետո սեղմեք «Պահպանել» կոճակը։</p>`}
        <div class="qh-calc-wrap" id="qhCalcPanel">
          <table class="qh-calc-table">
            <thead>
              <tr>
                <th></th>
                <th>ՇԱՐ</th>
                <th>ՍՊԱ</th>
                <th>ՊԱՅՄ</th>
                <th>Զ/Հ</th>
                <th>Զ/Ծ ընտ</th>
                <th>Զ/Պ</th>
                <th>Ք-ի</th>
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>
          ${statusHtml}
          ${buttonHtml}
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
    const morningLock = getDepartmentMorningLockMeta();

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
          <div class="zoom-target">
            <div class="sheet-shell">
              <p class="status-line no-print">
                <strong>Последняя отправка:</strong>
                <span id="lastUpdatedText">${escapeHtml(rowFreshness.timestamp)}</span>
                <span class="status-chip status-chip--${rowFreshness.level}" id="lastUpdatedBadge">${escapeHtml(rowFreshness.label)}</span>
              </p>
              <div class="table-wrap">
                ${renderTable(state.snapshot, [row], { interactive: true, viewMode: "department" })}
              </div>
            </div>
          </div>

          ${renderPhotoImportPanel(row)}

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
            ${renderPendingSyncControls()}
            <p class="hint save-rule-note" id="saveRuleText"></p>
            <div class="department-top-lock-panel no-print">
              <label class="department-top-lock-switch" for="departmentTopCellsToggle">
                <input type="checkbox" id="departmentTopCellsToggle" ${morningLock.unlocked ? "checked" : ""}>
                <span class="department-top-lock-slider" aria-hidden="true"></span>
                <span class="department-top-lock-copy">
                  <strong>Cells 1-3</strong>
                  <small>${escapeHtml(morningLock.statusLabel)}</small>
                </span>
              </label>
              <p class="hint">${escapeHtml(morningLock.hint)}</p>
            </div>
          </div>

          ${renderDepartmentCombinedCalcPanel(row)}
          ${renderTelegramFormReviewPanel(row)}
          ${renderDepartmentPdfArchivePanel(row)}
        </div>
        ${renderPhotoLightbox()}
      </div>
    `;
  }

  function renderArchiveNotFoundPage(title, message) {
    const mainPath = appendShareQuery(config.getMainPagePath(basePath));
    app.innerHTML = `
      <div class="page">
        <div class="panel">
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(message)}</p>
          <p><a href="${escapeHtml(mainPath)}">Вернуться к главному файлу</a></p>
        </div>
      </div>
    `;
  }

  function renderDepartmentPdfArchiveRecordPage() {
    const record = getDepartmentPdfArchiveRecordByKey(departmentArchiveKeyFromQuery);
    if (!record) {
      renderArchiveNotFoundPage("Архив PDF не найден", "Для этого отделения архивная PDF-копия в текущем браузере не найдена.");
      return;
    }

    const snapshot = buildSnapshotFromDepartmentPdfArchiveRecords([record], record.reportDate);
    const headerDateTime = getHeaderDateTimeParts(record.reportDate) || getCurrentDateTimeParts();
    state.snapshot = deepCopy(snapshot);
    state.loadedSnapshot = deepCopy(snapshot);
    state.source = record.source || "local-only";
    app.innerHTML = `
      <div class="page">
        <div class="print-title">
          <h1>${escapeHtml(PRINT_REPORT_TITLE)}</h1>
          <p>${escapeHtml(record.departmentName || "")}</p>
        </div>
        <div class="toolbar no-print">
          <div>
            <h1>PDF ${escapeHtml(record.departmentMarker || record.departmentName)}</h1>
            <p>${escapeHtml(record.archiveLabel)}. Архивная копия бланка отделения.</p>
          </div>
          <div class="toolbar-actions">
            <button type="button" id="printBtn">Печать</button>
            <a class="button-link" href="${escapeHtml(appendShareQuery(config.getMainPagePath(basePath)))}">К главному</a>
          </div>
        </div>
        <div class="info-stack">
          <div class="panel no-print">
            <h2>Данные PDF-архива</h2>
            <p><strong>Отделение:</strong> ${escapeHtml(record.departmentName || "")}</p>
            <p><strong>Дата:</strong> ${escapeHtml(record.archiveLabel)}</p>
            <p><strong>Сохранено:</strong> ${escapeHtml(formatTimestamp(record.capturedAt))}</p>
          </div>
          <div class="zoom-target">
            <div class="sheet-shell">
              <div class="table-wrap">
                ${renderTable(snapshot, snapshot.rows, { interactive: false, viewMode: "department", headerDateTime })}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderDepartmentPdfArchiveDatePage() {
    const records = getDepartmentPdfArchiveRecordsForDate(departmentArchiveDateFromQuery);
    if (!records.length) {
      renderArchiveNotFoundPage("PDF-архив за дату не найден", "За эту дату PDF-копии отделений в текущем браузере не найдены.");
      return;
    }

    const snapshot = buildSnapshotFromDepartmentPdfArchiveRecords(records);
    const headerDateTime = getHeaderDateTimeParts(snapshot.reportDate) || getCurrentDateTimeParts();
    state.snapshot = deepCopy(snapshot);
    state.loadedSnapshot = deepCopy(snapshot);
    state.source = records[0]?.source || "local-only";
    app.innerHTML = `
      <div class="page">
        <div class="print-title">
          <h1>${escapeHtml(PRINT_REPORT_TITLE)}</h1>
        </div>
        <div class="toolbar no-print">
          <div>
            <h1>PDF архив ${escapeHtml(departmentArchiveDateFromQuery)}</h1>
            <p>Общий файл из сохраненных PDF-бланков отделений за выбранную дату.</p>
          </div>
          <div class="toolbar-actions">
            <button type="button" id="printBtn">Печать</button>
            <a class="button-link" href="${escapeHtml(appendShareQuery(config.getMainPagePath(basePath)))}">К главному</a>
          </div>
        </div>
        <div class="info-stack">
          <div class="panel no-print">
            <h2>Данные PDF-архива</h2>
            <p><strong>Дата:</strong> ${escapeHtml(departmentArchiveDateFromQuery)}</p>
            <p><strong>Отделений:</strong> ${records.length}</p>
          </div>
          <div class="zoom-target">
            <div class="sheet-shell">
              <div class="table-wrap">
                ${renderTable(snapshot, snapshot.rows, { interactive: false, viewMode: "main", headerDateTime })}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderLeaveCalcPanel(row, options = {}) {
    const bodyRows = [
      {
        label: "Ուղարկվել է բուժ․ արձակուրդ",
        cells: LEAVE_CALC_COLUMNS.map((column) => ({ key: column.sentKey, marker: column.sentMarker, role: "input" }))
      },
      {
        label: "Վերադարձել է արձակուրդից",
        cells: LEAVE_CALC_COLUMNS.map((column) => ({ key: column.returnedKey, marker: column.returnedMarker, role: "input" }))
      },
      {
        label: "Եղել է արձակուրդում",
        cells: LEAVE_CALC_COLUMNS.map((column) => ({ key: column.leaveKey, marker: column.baseMarker, role: "linked" }))
      },
      {
        label: "Հաշվարկ",
        cells: LEAVE_CALC_COLUMNS.map((column) => ({ key: column.leaveKey, marker: column.leaveOutputMarker, role: "leave-output" }))
      },
      {
        label: "Առկա է",
        cells: LEAVE_CALC_COLUMNS.map((column) => ({ key: column.presentKey, marker: column.presentOutputMarker, role: "present-output" }))
      }
    ];

    const isEmbedded = Boolean(options.embedded);
    const visibleRows = isEmbedded ? bodyRows.slice(0, 2) : bodyRows;
    const bodyHtml = visibleRows.map((definition, rowIndex) => `
      <tr>
        <th scope="row">${escapeHtml(definition.label)}</th>
        ${definition.cells.map((cell, columnIndex) => {
          if (cell.role === "input") {
            const leaveConstraint = getLeaveCalcConstraint(row, cell.key);
            const isBlockedLeaveInput = Boolean(leaveConstraint && leaveConstraint.blocked);
            const leaveMaxAttr = leaveConstraint ? ` max="${escapeHtml(String(leaveConstraint.limit))}"` : "";
            const leaveDisabledAttr = isBlockedLeaveInput ? " disabled" : "";
            const leaveTitleAttr = leaveConstraint
              ? ` title="${escapeHtml(getLeaveCalcConstraintTitle(leaveConstraint))}"`
              : "";
            return `
              <td class="qh-calc-cell${isBlockedLeaveInput ? " qh-calc-cell--blocked" : ""}">
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  value="${escapeHtml(getDisplayValue(getLeaveCalcSourceValue(row, cell.key)) || "0")}"
                  ${leaveMaxAttr}${leaveDisabledAttr}${leaveTitleAttr}
                  data-leave-calc-key="${escapeHtml(cell.key)}"
                  data-leave-calc-row="${rowIndex}"
                  data-leave-calc-col="${columnIndex}"
                  aria-label="${escapeHtml(`${definition.label} ${cell.marker}`)}"
                >
              </td>
            `;
          }

      if (cell.role === "linked") {
        return `
              <td class="qh-calc-cell qh-calc-cell--linked">
                <strong data-leave-calc-base="${escapeHtml(cell.key)}">${escapeHtml(getDisplayValue(getNumber(state.snapshot, row, cell.key)) || "0")}</strong>
              </td>
            `;
          }

          return `
            <td class="qh-calc-cell qh-calc-cell--output">
              <strong data-leave-calc-output="${escapeHtml(cell.key)}">${escapeHtml(
                getDisplayValue(
                  cell.role === "leave-output"
                    ? calcLeaveRemainingValue(row, columnIndex === 0 ? "sharq" : columnIndex === 1 ? "spa" : "paym")
                    : calcLeavePresentValue(row, columnIndex === 0 ? "sharq" : columnIndex === 1 ? "spa" : "paym")
                ) || "0"
              )}</strong>
            </td>
          `;
        }).join("")}
      </tr>
    `).join("");

    const panelClass = isEmbedded ? "department-calc-section department-calc-section--leave" : "panel qh-calc-panel";
    const titleTag = isEmbedded ? "h3" : "h2";
    const buttonHtml = options.showButton === false ? "" : `
          <div class="qh-calc-actions">
            <button type="button" id="leaveCalcApplyBtn">Հաշվել և տեղադրել</button>
          </div>
    `;

    return `
      <div class="${panelClass}">
        <${titleTag}>Բուժական արձակուրդ</${titleTag}>
        <div class="qh-calc-wrap" id="leaveCalcPanel">
          <table class="qh-calc-table">
            <thead>
              <tr>
                <th></th>
                ${LEAVE_CALC_COLUMNS.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${bodyHtml}
            </tbody>
          </table>
          <div id="leaveCalcStatus" class="qh-calc-status"></div>
          ${buttonHtml}
        </div>
      </div>
    `;
  }

  function renderTransferCalcPanel(row, options = {}) {
    const bodyRows = [
      {
        label: "\u0546\u0565\u0580\u057d \u0567 \u0565\u056f\u0565\u056c",
        cells: TRANSFER_CALC_COLUMNS.map((column) => ({ key: column.incomingKey, role: "input" }))
      },
      {
        label: "\u0534\u0578\u0582\u0580\u057d \u0567 \u0563\u0576\u0561\u0581\u0565\u056c",
        cells: TRANSFER_CALC_COLUMNS.map((column) => ({ key: column.outgoingKey, role: "input" }))
      },
      {
        label: "\u0535\u0572\u0565\u056c \u0567",
        cells: TRANSFER_CALC_COLUMNS.map((column) => ({ key: column.currentKey, role: "linked" }))
      },
      {
        label: "\u0540\u0561\u0577\u057e\u0561\u0580\u056f",
        cells: TRANSFER_CALC_COLUMNS.map((column) => ({ key: column.outputKey, role: "output" }))
      }
    ];

    const isEmbedded = Boolean(options.embedded);
    const visibleRows = isEmbedded ? bodyRows.slice(0, 2) : bodyRows;
    const bodyHtml = visibleRows.map((definition) => `
      <tr>
        <th scope="row">${escapeHtml(definition.label)}</th>
        ${definition.cells.map((cell) => {
          if (cell.role === "input") {
            return `
              <td class="qh-calc-cell">
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputmode="numeric"
                  value="${escapeHtml(getTransferCalcDisplayValue(row, cell.key) || "0")}"
                  data-transfer-calc-key="${escapeHtml(cell.key)}"
                  aria-label="${escapeHtml(definition.label)}"
                >
              </td>
            `;
          }

          if (cell.role === "linked") {
            return `
              <td class="qh-calc-cell qh-calc-cell--linked">
                <strong data-transfer-calc-base="${escapeHtml(cell.key)}">${escapeHtml(getDisplayValue(getNumber(state.snapshot, row, cell.key)) || "0")}</strong>
              </td>
            `;
          }

          return `
            <td class="qh-calc-cell qh-calc-cell--output">
              <strong data-transfer-calc-output="${escapeHtml(cell.key)}">${escapeHtml(getTransferCalcDisplayValue(row, cell.key) || "0")}</strong>
            </td>
          `;
        }).join("")}
      </tr>
    `).join("");

    const panelClass = isEmbedded ? "department-calc-section department-calc-section--transfer" : "panel qh-calc-panel";
    const titleTag = isEmbedded ? "h3" : "h2";
    const buttonHtml = options.showButton === false ? "" : `
          <div class="qh-calc-actions">
            <button type="button" id="transferCalcApplyBtn">\u0540\u0561\u0577\u057e\u0565\u056c \u0587 \u057f\u0565\u0572\u0561\u0564\u0580\u0565\u056c</button>
          </div>
    `;

    return `
      <div class="${panelClass}">
        <${titleTag}>\u054f\u0565\u0572\u0561\u0583\u0578\u056d\u0578\u0582\u0569\u0575\u0578\u0582\u0576</${titleTag}>
        <div class="qh-calc-wrap" id="transferCalcPanel">
          <table class="qh-calc-table">
            <thead>
              <tr>
                <th></th>
                ${TRANSFER_CALC_COLUMNS.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${bodyHtml}
            </tbody>
          </table>
          <div id="transferCalcStatus" class="qh-calc-status"></div>
          ${buttonHtml}
        </div>
      </div>
    `;
  }

  function renderDepartmentCombinedCalcPanel(row) {
    const qhSection = renderQhCalcPanel(row, { embedded: true, showButton: false });
    const leaveSection = renderLeaveCalcPanel(row, { embedded: true, showButton: false });
    const transferSection = renderTransferCalcPanel(row, { embedded: true, showButton: false });
    const introHtml = qhSection
      ? `<p class="department-calc-intro">\u0544\u0578\u0582\u057f\u0584\u0561\u0563\u0580\u0565\u0584 \u0568\u0576\u0564\u0578\u0582\u0576\u057e\u0561\u056e, \u0564\u0578\u0582\u0580\u057d\u0563\u0580\u057e\u0561\u056e, \u0561\u0580\u0571\u0561\u056f\u0578\u0582\u0580\u0564 \u0563\u0576\u0561\u0581\u0578\u0572, \u0561\u0580\u0571\u0561\u056f\u0578\u0582\u0580\u0564\u056b\u0581 \u057e\u0565\u0580\u0561\u0564\u0561\u0580\u0571\u0561\u056e \u0587 \u057f\u0565\u0572\u0561\u0583\u0578\u056d\u057e\u0561\u056e \u0570\u056b\u057e\u0561\u0576\u0564\u0576\u0565\u0580\u056b \u0584\u0561\u0576\u0561\u056f\u0568, \u0570\u0565\u057f\u0578 \u057d\u0565\u0572\u0574\u0565\u0584 \xab\u0540\u0561\u0577\u057e\u0565\u056c \u0587 \u057f\u0565\u0572\u0561\u0564\u0580\u0565\u056c\xbb\u0589</p>`
      : "";
    const buttonHtml = qhSection
      ? `
        <div class="qh-calc-actions department-calc-actions">
          <button type="button" id="departmentCombinedCalcApplyBtn">\u0540\u0561\u0577\u057e\u0565\u056c \u0587 \u057f\u0565\u0572\u0561\u0564\u0580\u0565\u056c</button>
        </div>
      `
      : "";

    return `
      <div class="panel department-calc-combined-panel">
        ${introHtml}
        <div class="department-calc-grid">
          ${qhSection}
          ${leaveSection}
          ${transferSection}
        </div>
        ${buttonHtml}
      </div>
    `;
  }

  function renderMainDepartmentCalcPanel() {
    const rows = Array.isArray(state.snapshot?.rows)
      ? state.snapshot.rows.filter((row) => row && typeof row.id === "string")
      : [];

    if (!rows.length) {
      return `
        <section class="panel no-print main-department-calc-panel">
          <h2>\u0540\u0561\u0577\u057e\u056b\u0579 \u0563\u056c\u056d\u0561\u057e\u0578\u0580 \u0567\u057b\u0578\u0582\u0574</h2>
          <p>\u0540\u0561\u0577\u057e\u056b\u0579\u056b \u0570\u0561\u0574\u0561\u0580 \u0562\u0561\u056a\u0561\u0576\u0574\u0578\u0582\u0576\u0584\u0576\u0565\u0580 \u0579\u056f\u0561\u0576\u0589</p>
        </section>
      `;
    }

    const selectedId = getSelectedMainCalcDepartmentId(rows);
    const row = rows.find((item) => item.id === selectedId) || rows[0];
    const validation = row ? getDepartmentValidationStateForSnapshot(state.snapshot, row) : null;
    const previewWrapStateClass = validation && validation.applicable
      ? ` main-department-calc-panel__preview-wrap--${validation.statusTone}`
      : "";
    const previewStatusClass = validation && validation.applicable
      ? ` main-department-calc-panel__preview-status--${validation.statusTone}`
      : "";
    const tableHtml = row
      ? renderTable(
          state.snapshot,
          [row],
          {
            interactive: false,
            viewMode: "department",
            headerDateTime: getCurrentDateTimeParts(),
            inlineComputedValues: true,
            validationPreview: true,
            validationPreviewRow: true,
            validationPreviewState: { rowId: row.id, validation },
            validationStatusTone: validation?.statusTone || "neutral",
            validationFailedKeySet: validation?.failedKeySet || new Set(),
            validationApplicableKeySet: validation?.applicableKeySet || new Set()
          }
        )
          .replace(' id="sheetTable"', "")
          .replace(' id="sheetBody"', "")
          .replace(/<tr class="single-total-row">[\s\S]*?<\/tr>/, "")
      : "";

    return `
      <section class="panel no-print main-department-calc-panel">
        <div class="main-department-calc-panel__head">
          <div>
            <h2>\u0540\u0561\u0577\u057e\u056b\u0579 \u0563\u056c\u056d\u0561\u057e\u0578\u0580 \u0567\u057b\u0578\u0582\u0574</h2>
            <p class="main-department-calc-panel__note">\u0538\u0576\u057f\u0580\u0565\u0584 \u0562\u0561\u056a\u0561\u0576\u0574\u0578\u0582\u0576\u0584\u0568, \u0570\u0565\u057f\u0578 \u0574\u0578\u0582\u057f\u0584\u0561\u0563\u0580\u0565\u0584 \u0568\u0576\u0564\u0578\u0582\u0576\u0578\u0582\u0574, \u0564\u0578\u0582\u0580\u057d\u0563\u0580\u0578\u0582\u0574, \u0561\u0580\u0571\u0561\u056f\u0578\u0582\u0580\u0564 \u0587 \u057f\u0565\u0572\u0561\u0583\u0578\u056d\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0589</p>
          </div>
          <label class="main-department-calc-panel__select">
            <span>\u0532\u0561\u056a\u0561\u0576\u0574\u0578\u0582\u0576\u0584</span>
            <select id="mainCalcDepartmentSelect">
              ${buildMainTablePhotoDepartmentOptions(row.id)}
            </select>
          </label>
        </div>
        <div class="main-department-calc-panel__preview">
          <div class="table-wrap main-department-calc-panel__preview-wrap${previewWrapStateClass}">
            ${tableHtml}
          </div>
          ${validation && validation.applicable
            ? `<div class="main-department-calc-panel__preview-status${previewStatusClass}">${escapeHtml(validation.message)}</div>`
            : ""}
        </div>
        ${renderDepartmentCombinedCalcPanel(row)}
      </section>
    `;
  }

  function renderSavedMainTableArchivePage() {



    const record = getMainTableSavedRecordByKey(savedMainKeyFromQuery);
    if (!record) {
      renderArchiveNotFoundPage("Сохранённая таблица не найдена", "Для этого снимка сохранённой главной таблицы в текущем браузере данных нет.");
      return;
    }

    const headerDateTime = getHeaderDateTimeParts(record.reportDate) || getCurrentDateTimeParts();
    state.snapshot = syncQhCalculatedTargets(primeQhBaseInputs(deepCopy(record.snapshot)));
    state.loadedSnapshot = syncQhCalculatedTargets(primeQhBaseInputs(deepCopy(record.snapshot)));
    state.source = record.source || "local-only";

    app.innerHTML = `
      <div class="page">
        <div class="print-title">
          <h1>${escapeHtml(PRINT_REPORT_TITLE)}</h1>
        </div>
        <div class="toolbar no-print">
          <div>
            <h1>Сохранённая таблица ${escapeHtml(record.dateLabel)} ${escapeHtml(record.slotLabel)}</h1>
            <p>Сохранённая версия главной таблицы для просмотра старых данных и печати.</p>
          </div>
          <div class="toolbar-actions">
            <button type="button" id="printBtn">Печать</button>
            <a class="button-link" href="${escapeHtml(appendShareQuery(config.getMainPagePath(basePath)))}">К главному</a>
          </div>
        </div>
        <div class="info-stack">
          <div class="panel no-print">
            <h2>Данные сохранённой таблицы</h2>
            <p><strong>Окно:</strong> ${escapeHtml(record.dateLabel)} ${escapeHtml(record.slotLabel)}</p>
            <p><strong>Сохранено:</strong> ${escapeHtml(formatTimestamp(record.savedAt))}</p>
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

  function renderArchivePage() {
    if (savedMainKeyFromQuery) {
      renderSavedMainTableArchivePage();
      return;
    }
    if (departmentArchiveKeyFromQuery) {
      renderDepartmentPdfArchiveRecordPage();
      return;
    }
    if (departmentArchiveDateFromQuery) {
      renderDepartmentPdfArchiveDatePage();
      return;
    }

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
    enhanceMainPageCollapsiblePanels();
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

    const mainDisplayContext = mode === "main" ? getMainTableDisplaySnapshotContext() : null;
    const activeSnapshot = mainDisplayContext ? mainDisplayContext.snapshot : state.snapshot;
    const rows = mode === "department"
      ? [getCurrentRow()].filter(Boolean)
      : (mainDisplayContext ? mainDisplayContext.rows : state.snapshot.rows);
    const calcTargetRowId = mode === "department"
      ? departmentId
      : mode === "main" && activeSnapshot && Array.isArray(activeSnapshot.rows)
        ? getSelectedMainCalcDepartmentId(activeSnapshot.rows)
        : "";
    rows.forEach((row) => {
      const presentEl = body.querySelector(`[data-output="presentTotal"][data-row="${row.id}"]`);
      if (presentEl) {
        presentEl.textContent = String(calcPresentTotal(activeSnapshot, row));
      }

      const leaveEl = body.querySelector(`[data-output="leaveTotal"][data-row="${row.id}"]`);
      if (leaveEl) {
        leaveEl.textContent = String(calcLeaveTotal(activeSnapshot, row) || 0);
      }

      config.columns.forEach((key) => {
        const span = body.querySelector(`[data-value="${row.id}:${key}"]`);
        if (span) {
          span.textContent = getDisplayValue(getEffectiveValue(activeSnapshot, row, key));
        }

        const input = body.querySelector(`input[data-row="${row.id}"][data-key="${key}"]`);
        if (input instanceof HTMLInputElement) {
          const nextValue = getDisplayValue(getEffectiveValue(activeSnapshot, row, key));
          input.value = nextValue === "" ? "0" : nextValue;
        }
      });

      if (row.id === calcTargetRowId) {
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
          "currentZh",
          "family",
          "officer",
          "civil",
          "qhRemainingSoldier",
          "qhRemainingOfficer",
          "qhRemainingContract",
          "qhRemainingZh",
          "qhRemainingFamily",
          "qhRemainingReserve",
          "qhRemainingCivil"
        ].forEach((key) => {
          document.querySelectorAll(`[data-qh-output="${key}"]`).forEach((element) => {
            element.textContent = getQhCalcDisplayValue(row, key);
          });
        });

        refreshQhCalcDisplay(row);
      }

      if (row.id === calcTargetRowId) {
        LEAVE_CALC_INPUT_KEYS.forEach((key) => {
          document.querySelectorAll(`[data-leave-calc-key="${key}"]`).forEach((element) => {
            if (element instanceof HTMLInputElement) {
              element.value = getDisplayValue(getLeaveCalcSourceValue(row, key)) || "0";
            }
          });
        });

        LEAVE_CALC_COLUMNS.forEach((column) => {
          document.querySelectorAll(`[data-leave-calc-base="${column.leaveKey}"]`).forEach((element) => {
            element.textContent = getDisplayValue(getNumber(activeSnapshot, row, column.leaveKey)) || "0";
          });
          document.querySelectorAll(`[data-leave-calc-output="${column.leaveKey}"]`).forEach((element) => {
            element.textContent = getDisplayValue(calcLeaveRemainingValue(row, column.type)) || "0";
          });
          document.querySelectorAll(`[data-leave-calc-output="${column.presentKey}"]`).forEach((element) => {
            element.textContent = getDisplayValue(calcLeavePresentValue(row, column.type)) || "0";
          });
        });
        refreshLeaveCalcDisplay(row);

        TRANSFER_CALC_INPUT_KEYS.forEach((key) => {
          document.querySelectorAll(`[data-transfer-calc-key="${key}"]`).forEach((element) => {
            if (element instanceof HTMLInputElement) {
              element.value = getTransferCalcDisplayValue(row, key, activeSnapshot) || "0";
            }
          });
        });
        refreshTransferCalcDisplay(row, activeSnapshot);
      }
    });

    Object.keys(config.linkedCells).forEach((linkedKey) => {
      const [targetRowId, targetKey] = linkedKey.split(":");
      const linkedEl = body.querySelector(`[data-linked="${linkedKey}"]`);
      if (linkedEl) {
        const targetRow = getDepartmentRow(activeSnapshot, targetRowId);
        linkedEl.textContent = targetRow ? getDisplayValue(getEffectiveValue(activeSnapshot, targetRow, targetKey)) : "";
      }
    });

    if (mode === "main") {
      const summaryRows = mainDisplayContext ? mainDisplayContext.rows : state.snapshot.rows;
      refreshSummary("subtotal", summaryRows.filter((row) => row.group === "primary"), activeSnapshot);
      refreshSummary("grand", summaryRows, activeSnapshot);
      syncMainTransferMismatchUi();
    } else {
      const row = getCurrentRow();
      if (row) {
        refreshSummary("single", [row], activeSnapshot);
      }
    }
  }

  function refreshSummary(summaryId, rows, snapshot = state.snapshot) {
    const body = document.getElementById("sheetBody");
    if (!body) {
      return;
    }
    config.columns.forEach((key) => {
      const el = body.querySelector(`[data-summary="${summaryId}"][data-key="${key}"]`);
      if (el) {
        el.textContent = String(getSummaryValue(snapshot, rows, key));
      }
    });
  }

  function syncMainTransferMismatchUi() {
    const body = document.getElementById("sheetBody");
    if (!body || mode !== "main") {
      return;
    }

    const hasMismatch = hasActiveMainTransferColumnMismatch();
    [
      "transferFromDepartment",
      "transferToDepartment"
    ].forEach((key) => {
      body.querySelectorAll(`[data-column-key="${key}"]`).forEach((cell) => {
        cell.classList.toggle("transfer-mismatch-cell", hasMismatch);
      });
    });
  }

  function getTransferCalcSourceValue(row, key) {
    if (!row) {
      return null;
    }
    const value = row.values && typeof row.values === "object"
      ? row.values[key]
      : null;
    return config.normalizeCellValue(value);
  }

  function getTransferCalcColumnByKey(key) {
    return TRANSFER_CALC_COLUMNS.find((column) =>
      column.currentKey === key
      || column.incomingKey === key
      || column.outgoingKey === key
      || column.outputKey === key
    ) || null;
  }

  function getTransferCalcConstraint(row, key, snapshot = state.snapshot) {
    if (!row) {
      return null;
    }

    const column = getTransferCalcColumnByKey(key);
    if (!column || column.outgoingKey !== key) {
      return null;
    }

    const incomingRaw = Math.max(0, Number(getTransferCalcSourceValue(row, column.incomingKey)) || 0);
    const limit = Math.max(0, (getNumber(snapshot, row, column.currentKey) || 0) + incomingRaw);
    return {
      column,
      limit,
      blocked: limit <= 0
    };
  }

  function normalizeTransferCalcInputValue(row, key, value, snapshot = state.snapshot) {
    if (value === null || value === "" || typeof value === "undefined") {
      return null;
    }

    const normalized = Math.max(0, Number(value) || 0);
    const constraint = getTransferCalcConstraint(row, key, snapshot);
    if (!constraint) {
      return normalized;
    }

    return Math.min(normalized, constraint.limit);
  }

  function getTransferCalcBlockedColumns(row, snapshot = state.snapshot) {
    if (!row) {
      return [];
    }

    return TRANSFER_CALC_COLUMNS
      .map((column) => getTransferCalcConstraint(row, column.outgoingKey, snapshot))
      .filter((constraint) => Boolean(constraint && constraint.blocked));
  }

  function getTransferCalcConstraintTitle(constraint) {
    if (!constraint) {
      return "";
    }

    if (constraint.blocked) {
      return `По категории ${constraint.column.label} нет наличия в отделении. Перевод из отделения заблокирован.`;
    }

    return `По категории ${constraint.column.label} можно перевести из отделения не больше ${constraint.limit}.`;
  }

  function calcTransferRemainingValue(row, type, snapshot = state.snapshot) {
    const column = TRANSFER_CALC_COLUMNS.find((item) => item.type === type);
    if (!row || !column) {
      return null;
    }
    const baseCurrent = getNumber(snapshot, row, column.currentKey) || 0;
    const incoming = Math.max(0, Number(getTransferCalcSourceValue(row, column.incomingKey)) || 0);
    const outgoing = normalizeTransferCalcInputValue(
      row,
      column.outgoingKey,
      getTransferCalcSourceValue(row, column.outgoingKey),
      snapshot
    ) || 0;
    return baseCurrent + incoming - outgoing;
  }

  function getTransferCalcDisplayValue(row, key, snapshot = state.snapshot) {
    if (!row) {
      return "";
    }
    const outputColumn = TRANSFER_CALC_COLUMNS.find((item) => item.outputKey === key);
    if (outputColumn) {
      return getDisplayValue(calcTransferRemainingValue(row, outputColumn.type, snapshot));
    }
    const directValue = getTransferCalcSourceValue(row, key);
    if (TRANSFER_CALC_INPUT_KEYS.has(key) && (directValue === null || directValue === "" || typeof directValue === "undefined")) {
      return "0";
    }
    if (getTransferCalcConstraint(row, key, snapshot)) {
      return getDisplayValue(normalizeTransferCalcInputValue(row, key, directValue, snapshot));
    }
    return getDisplayValue(directValue);
  }

  function getTransferCalcInvalidColumns(row, snapshot = state.snapshot) {
    if (!row) {
      return [];
    }
    return TRANSFER_CALC_COLUMNS.filter((column) => (calcTransferRemainingValue(row, column.type, snapshot) || 0) < 0);
  }

  function refreshTransferCalcDisplay(row, snapshot = state.snapshot) {
    if (!row) {
      return;
    }
    TRANSFER_CALC_COLUMNS.forEach((column) => {
      document.querySelectorAll(`[data-transfer-calc-base="${column.currentKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(getNumber(snapshot, row, column.currentKey)) || "0";
      });
      document.querySelectorAll(`[data-transfer-calc-output="${column.outputKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(calcTransferRemainingValue(row, column.type, snapshot)) || "0";
      });
    });

    const statusEl = document.getElementById("transferCalcStatus");
    if (statusEl) {
      const invalidColumns = getTransferCalcInvalidColumns(row, snapshot);
      if (invalidColumns.length) {
        statusEl.textContent = `Փոխանցումների հաշվարկը չի կարող կիրառվել․ ${invalidColumns.map((column) => column.label).join(", ")} սյունակներում կստացվի բացասական արժեք։`;
        statusEl.className = "qh-calc-status qh-calc-status--invalid";
      } else {
        statusEl.textContent = "";
        statusEl.className = "qh-calc-status";
      }
    }
  }

  function refreshTableData() {
    const headerDateText = document.getElementById("sheetDateText");
    const headerTimeText = document.getElementById("sheetTimeText");
    const reportDateField = document.getElementById("reportDateField");
    const syncStatusText = document.getElementById("syncStatusText");
    const syncInfoText = document.getElementById("syncInfoText");
    const warningText = document.getElementById("warningText");
    const pendingSyncSummaryText = document.getElementById("pendingSyncSummaryText");
    const pendingSyncErrorText = document.getElementById("pendingSyncErrorText");
    const pendingSyncBtn = document.getElementById("pendingSyncBtn");
    const lastUpdatedText = document.getElementById("lastUpdatedText");
    const lastUpdatedBadge = document.getElementById("lastUpdatedBadge");
    const pills = Array.from(document.querySelectorAll("#syncModeLabel, #sheetSourcePill"));
    const currentDateTime = syncCurrentReportDate();
    const pendingSyncStatus = getPendingSyncStatus();

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
    if (pendingSyncSummaryText) {
      pendingSyncSummaryText.textContent = getPendingSyncSummaryText(pendingSyncStatus);
    }
    if (pendingSyncErrorText) {
      const errorText = getPendingSyncErrorText(pendingSyncStatus);
      pendingSyncErrorText.textContent = errorText;
      pendingSyncErrorText.className = `hint${errorText ? " warning-note" : ""}`;
    }
    if (pendingSyncBtn) {
      pendingSyncBtn.textContent = getPendingSyncButtonLabel(pendingSyncStatus);
      pendingSyncBtn.classList.toggle("save-ready", Boolean(pendingSyncStatus.hasPending && sync.hasRemoteSync() && !pendingSyncStatus.isSyncing));
      pendingSyncBtn.disabled = !(pendingSyncStatus.hasPending && sync.hasRemoteSync() && !pendingSyncStatus.isSyncing);
    }
    scheduleBackgroundPendingSync();
    pills.forEach((pill) => {
      pill.textContent = sync.getSourceLabel(state.source);
      pill.classList.toggle("remote", state.source === "remote");
      pill.classList.toggle("pending", state.source === "pending-sync");
      pill.classList.toggle("local", state.source !== "remote" && state.source !== "pending-sync");
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
        const mainDisplayContext = getMainTableDisplaySnapshotContext();
        const stats = buildFreshnessStats(mainDisplayContext.rows);
        const newestUpdatedAt = stats.newestRow ? getRowEffectiveUpdatedAt(stats.newestRow) : "";
        lastUpdatedText.textContent = newestUpdatedAt ? formatTimestamp(newestUpdatedAt) : "еще не отправлялось";
        if (lastUpdatedBadge) {
          const meta = getFreshnessMeta(newestUpdatedAt, Boolean(stats.newestRow));
          lastUpdatedBadge.textContent = meta.label;
          lastUpdatedBadge.className = `status-chip status-chip--${meta.level}`;
        }
      }
    }

    if (mode === "main") {
      syncMainTransferMismatchUi();
      const archiveCapture = maybeCaptureDailyArchive();
      if (archiveCapture && archiveCapture.shouldRollover) {
        void maybeApplyMorningRolloverAfterArchive(archiveCapture.record);
      }
      void maybeAutoTransferShiftDrafts();
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
      const savedTablesSummaryText = document.getElementById("mainTableSavedSummaryText");
      const savedTablesList = document.getElementById("mainTableSavedList");
      const savedTableRecords = ensureMainTableSavedRecordsLoaded();
      const mainDisplayContext = getMainTableDisplaySnapshotContext(savedTableRecords);
      const departmentPdfArchiveSummaryText = document.getElementById("departmentPdfArchiveSummaryText");
      const departmentPdfArchiveList = document.getElementById("departmentPdfArchiveList");
      const departmentPdfArchiveRecords = ensureDepartmentPdfArchiveRecordsLoaded();
      const selectedSavedRecord = getSelectedMainTableSavedRecord(savedTableRecords);
      const shiftTransferSummaryText = document.getElementById("shiftTransferSummaryText");
      const shiftTransferStatusText = document.getElementById("shiftTransferStatusText");
      const shiftAutoTransferToggle = document.getElementById("shiftAutoTransferToggle");
      const applyDayShiftNowBtn = document.getElementById("applyDayShiftNowBtn");
      const applyDischargeShiftNowBtn = document.getElementById("applyDischargeShiftNowBtn");
      const shiftTransferBusy = Boolean(state.shiftTransferInFlightMode || state.mainTableSaveInFlight);

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
          ? `Самые старые данные: ${stats.oldestRow.department} — ${formatTimestamp(getRowEffectiveUpdatedAt(stats.oldestRow))} (${formatAge(getRowEffectiveUpdatedAt(stats.oldestRow))})`
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
        const nextArchiveSummary = getArchiveSummaryText(archiveRecords);
        if (archiveSummaryText.textContent !== nextArchiveSummary) {
          archiveSummaryText.textContent = nextArchiveSummary;
        }
      }
      if (archiveList) {
        const archiveRenderKey = getArchivePickerRenderKey(archiveRecords);
        if (archiveList.dataset.renderKey !== archiveRenderKey) {
          archiveList.innerHTML = buildArchivePicker(archiveRecords);
          archiveList.dataset.renderKey = archiveRenderKey;
        }
      }
      syncArchivePickerUi();
      if (savedTablesSummaryText) {
        const nextSavedTablesSummary = savedTableRecords.length
          ? `Сохранённых таблиц: ${savedTableRecords.length}. ${state.activeMainTableSavedPreviewKey ? "Показан" : "Выбран"} снимок: ${buildMainTableSavedSelectionText(selectedSavedRecord)}.`
          : "Сохранённых таблиц пока нет. После ручного сохранения здесь появятся две рабочие версии за сутки.";
        if (savedTablesSummaryText.textContent !== nextSavedTablesSummary) {
          savedTablesSummaryText.textContent = nextSavedTablesSummary;
        }
      }
      if (savedTablesList) {
        const savedNavigatorRenderKey = getMainTableSavedNavigatorRenderKey(savedTableRecords);
        if (savedTablesList.dataset.renderKey !== savedNavigatorRenderKey) {
          savedTablesList.innerHTML = buildMainTableSavedNavigator(savedTableRecords);
          savedTablesList.dataset.renderKey = savedNavigatorRenderKey;
          attachMainTableSavedNavigatorEvents(savedTablesList);
        }
      }
      syncMainTableSavedNavigatorUi();
      refreshMainTableSaveState();
      if (shiftTransferSummaryText) {
        shiftTransferSummaryText.textContent = getShiftTransferSummaryText();
      }
      if (shiftTransferStatusText) {
        const statusText = getShiftTransferStatusText();
        shiftTransferStatusText.textContent = statusText;
        shiftTransferStatusText.className = "hint";
      }
      if (shiftAutoTransferToggle instanceof HTMLInputElement) {
        shiftAutoTransferToggle.checked = Boolean(state.shiftAutoTransferEnabled);
        shiftAutoTransferToggle.disabled = shiftTransferBusy;
      }
      if (applyDayShiftNowBtn instanceof HTMLButtonElement) {
        applyDayShiftNowBtn.disabled = shiftTransferBusy;
      }
      if (applyDischargeShiftNowBtn instanceof HTMLButtonElement) {
        applyDischargeShiftNowBtn.disabled = shiftTransferBusy;
      }
      if (departmentPdfArchiveSummaryText) {
        departmentPdfArchiveSummaryText.textContent = getDepartmentPdfArchiveSummaryText(departmentPdfArchiveRecords);
      }
      if (departmentPdfArchiveList) {
        departmentPdfArchiveList.innerHTML = buildMainDepartmentPdfArchivePicker(departmentPdfArchiveRecords);
      }
      syncMainDepartmentPdfArchivePickerUi();
      refreshMainTablePhotoGalleryUi(mainDisplayContext);
      void refreshMainTablePhotoGalleryRecordsFromRemote(mainDisplayContext);
      refreshMainTableAndroidAppUi(mainDisplayContext);
      void refreshMainTableAndroidAppRecordsFromRemote(mainDisplayContext);
      refreshMainTableTelegramFormUi();
      void refreshMainTableTelegramFormRecordsFromRemote();

      state.snapshot.rows.forEach((row) => {
        const meta = getRowFreshnessMeta(row);
        const photoWorkflow = getDepartmentPhotoWorkflowMeta(row);
        const feedbackSource = getDepartmentFeedbackSourceMeta(row);
        const lastUpdateSource = getDepartmentLastUpdateSourceMeta(row);
        const statusEl = document.querySelector(`[data-department-status="${row.id}"]`);
        const updatedEl = document.querySelector(`[data-department-updated="${row.id}"]`);
        const ageEl = document.querySelector(`[data-department-age="${row.id}"]`);
        const openCardEl = document.querySelector(`[data-department-open-card="${row.id}"]`);
        const feedbackLinkEl = document.querySelector(`[data-department-feedback-link="${row.id}"]`);
        const feedbackSourceEl = document.querySelector(`[data-department-feedback-source="${row.id}"]`);
        const lastUpdateSourceEl = document.querySelector(`[data-department-last-source="${row.id}"]`);
        const deleteFeedbackBtn = document.querySelector(`[data-delete-feedback="${row.id}"]`);
        const listStatusEl = document.querySelector(`[data-update-status="${row.id}"]`);
        const listTimeEl = document.querySelector(`[data-update-time="${row.id}"]`);
        const listAgeEl = document.querySelector(`[data-update-age="${row.id}"]`);
        const sheetRowEl = document.querySelector(`tr.detail-row[data-row-id="${row.id}"]`);

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
          const openFeedbackId = getDepartmentOpenFeedbackId(row);
          if (openFeedbackId) {
            feedbackLinkEl.setAttribute("href", appendQueryParams(config.getDepartmentPagePath(basePath, row.id), { tgFeedback: openFeedbackId }));
            feedbackLinkEl.textContent = "Открыть отправленное";
            feedbackLinkEl.setAttribute("data-open-mode", "feedback");
          } else {
            feedbackLinkEl.setAttribute("href", appendShareQuery(config.getDepartmentPagePath(basePath, row.id)));
            feedbackLinkEl.textContent = "Открыть отделение";
            feedbackLinkEl.setAttribute("data-open-mode", "department");
          }
        }
        if (feedbackSourceEl) {
          if (feedbackSource.label) {
            feedbackSourceEl.removeAttribute("hidden");
            feedbackSourceEl.textContent = feedbackSource.label;
            feedbackSourceEl.setAttribute("data-feedback-source-tone", feedbackSource.tone);
          } else {
            feedbackSourceEl.setAttribute("hidden", "");
            feedbackSourceEl.textContent = "";
            feedbackSourceEl.setAttribute("data-feedback-source-tone", "none");
          }
        }
        if (lastUpdateSourceEl) {
          if (lastUpdateSource.label) {
            lastUpdateSourceEl.removeAttribute("hidden");
            lastUpdateSourceEl.textContent = lastUpdateSource.label;
            lastUpdateSourceEl.setAttribute("data-update-source-tone", lastUpdateSource.tone);
          } else {
            lastUpdateSourceEl.setAttribute("hidden", "");
            lastUpdateSourceEl.textContent = "";
            lastUpdateSourceEl.setAttribute("data-update-source-tone", "none");
          }
        }
        if (deleteFeedbackBtn) {
          if (row.photoFeedbackId) {
            deleteFeedbackBtn.removeAttribute("hidden");
            deleteFeedbackBtn.setAttribute("data-feedback-id", String(row.photoFeedbackId));
          } else {
            deleteFeedbackBtn.setAttribute("hidden", "");
            deleteFeedbackBtn.removeAttribute("data-feedback-id");
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
        if (sheetRowEl) {
          const tableRow = getDepartmentRow(mainDisplayContext.snapshot, row.id) || row;
          const tableMeta = getRowFreshnessMeta(tableRow);
          const tableValidation = getDepartmentValidationStateForSnapshot(mainDisplayContext.snapshot, tableRow);
          const tableMainRowState = getDepartmentMainTableStateMeta(tableRow, tableValidation);
          sheetRowEl.setAttribute("data-row-freshness", tableMeta.level);
          const deptCellEl = sheetRowEl.querySelector(".dept-cell");
          if (deptCellEl) {
            deptCellEl.classList.remove(
              "dept-cell--state-auto",
              "dept-cell--state-manual",
              "dept-cell--state-waiting",
              "dept-cell--state-photo-pending",
              "dept-cell--state-control-error"
            );
            if (tableMainRowState && tableMainRowState.tone !== "none") {
              deptCellEl.classList.add(`dept-cell--state-${tableMainRowState.tone}`);
              deptCellEl.setAttribute("title", `${row.department}\n${tableMainRowState.title}`);
            } else {
              deptCellEl.setAttribute("title", row.department);
            }
          }
          if (mode === "main") {
            sheetRowEl.classList.toggle("main-fresh-row", tableMeta.level === "fresh" && !(tableValidation.applicable && !tableValidation.isValid));
            if (tableValidation.applicable) {
              sheetRowEl.setAttribute("data-row-validation", tableValidation.isValid ? "valid" : "invalid");
              sheetRowEl.classList.toggle("main-invalid-row", !tableValidation.isValid);
              if (!tableValidation.isValid) {
                sheetRowEl.setAttribute("title", tableValidation.failedChecks.map((item) => item.failureMessage).join(" "));
              } else {
                sheetRowEl.removeAttribute("title");
              }
            } else {
              sheetRowEl.removeAttribute("data-row-validation");
              sheetRowEl.classList.remove("main-invalid-row");
              sheetRowEl.classList.toggle("main-fresh-row", tableMeta.level === "fresh");
              sheetRowEl.removeAttribute("title");
            }
          } else {
            sheetRowEl.classList.toggle("main-fresh-row", meta.level === "fresh");
            sheetRowEl.removeAttribute("data-row-validation");
            sheetRowEl.classList.remove("main-invalid-row");
            sheetRowEl.removeAttribute("title");
          }
        }
      });
    }

    if (mode === "department") {
      syncDepartmentPdfArchivePickerUi();
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
    saveBtn.title = validation.isValid
      ? "Контрольные суммы совпадают, можно сохранять."
      : "Исправь данные: кнопка станет активной, когда контрольные суммы совпадут с формулами.";
    saveBtn.classList.add(validation.isValid ? "save-ready" : "save-blocked");

    if (ruleText) {
      ruleText.textContent = validation.message;
      ruleText.className = `hint save-rule-note ${validation.isValid ? "save-rule-note--valid" : "save-rule-note--invalid"}`;
    }
  }

  function refreshMainTableSaveState() {
    const saveBtn = document.getElementById("mainSaveBtn");
    const ruleText = document.getElementById("mainSaveRuleText");

    if (!saveBtn) {
      return;
    }

    const validation = getMainTableValidationState();
    const canSave = validation.applicable
      && validation.dirtyRows.length > 0
      && validation.isValid
      && !state.mainTableSaveInFlight;

    saveBtn.classList.remove("save-ready", "save-blocked");
    saveBtn.disabled = !canSave;
    saveBtn.setAttribute("aria-disabled", String(!canSave));
    saveBtn.title = state.mainTableSaveInFlight
      ? "Идёт сохранение главной таблицы."
      : validation.message;
    if (canSave) {
      saveBtn.classList.add("save-ready");
    } else if (validation.dirtyRows.length > 0 && !validation.isValid) {
      saveBtn.classList.add("save-blocked");
    }

    if (ruleText) {
      ruleText.textContent = state.mainTableSaveInFlight
        ? "Сохраняю главную таблицу..."
        : validation.message;
      const toneClass = canSave
        ? "save-rule-note--valid"
        : (validation.dirtyRows.length > 0 && !validation.isValid
          ? "save-rule-note--invalid"
          : "");
      ruleText.className = `hint save-rule-note ${toneClass}`.trim();
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
    const availableKeys = [];
    const previewKeys = [];

    if (structureOk) {
      applicableFields.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(values, field.key) || !recognizedKeys.has(field.key)) {
          return;
        }

        const normalized = config.normalizeCellValue(values[field.key]);
        if (normalized !== null) {
          availableKeys.push(field.key);
          previewKeys.push(field.key);
        }
      });
    }

    const suspectDetails = getPhotoImportSuspectDetails(row, recognizedKeys, values);

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
    state.photoImport.draftMode = false;

    return availableKeys.length;
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
      const canRecognize = sync.hasRemoteSync() && typeof sync.recognizeDepartmentPhoto === "function";
      const orientationNote = preparedPhoto.rotatedToLandscape
        ? " Фото автоматически выровнено: надпись SR перемещена вправо вверх."
        : "";
      setPhotoImportStatus(
        canRecognize
          ? `Фото готово: ${file.name || "image"}.${orientationNote} При необходимости поверните фото, затем нажмите "Распознать".`
          : `Фото готово: ${file.name || "image"}.${orientationNote} Распознавание доступно только в онлайн-режиме владельца.`,
        !canRecognize
      );
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
        ? `Фото перенесено с главного файла. Распознаю это отделение. Автоматическое открытие следующего фото отключено, в очереди осталось: ${state.photoImport.queueRemainingCount}.`
        : "Фото перенесено с главного файла. Распознаю это отделение. Это последнее фото из очереди.",
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
      if (state.photoImport.suspectReason) {
        setPhotoImportStatus(`Значения подставлены локально, но контрольные суммы не сошлись. ${state.photoImport.suspectReason}`, false);
      }
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

  function resetPhotoImportAfterSuccessfulSave() {
    const hadPhoto = Boolean(
      state.photoImport
        && (
          state.photoImport.imageDataUrl
          || state.photoImport.feedbackId
          || (Array.isArray(state.photoImport.lastAppliedKeys) && state.photoImport.lastAppliedKeys.length)
        )
    );
    state.photoImport = buildInitialPhotoImportState();
    if (hadPhoto) {
      state.photoImport.status = "Данные сохранены. Фото очищено, страница готова к новой загрузке бланка.";
      state.photoImport.isError = false;
    }
  }

  function clearPhotoImportSelection() {
    const keepDraft = Boolean(state.photoImport && state.photoImport.draftMode);
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

  function syncDepartmentMorningDraftState(sourceState, referenceStatus, selectedStatus) {
    if (!sourceState || !Array.isArray(sourceState.lastAppliedKeys)) {
      return;
    }

    const nextAppliedKeys = getDepartmentSourceTransferKeys(sourceState.lastAppliedKeys);
    const changed = nextAppliedKeys.length !== sourceState.lastAppliedKeys.length;
    sourceState.lastAppliedKeys = nextAppliedKeys;
    if (!changed) {
      return;
    }

    if (!nextAppliedKeys.length) {
      sourceState.draftMode = false;
      sourceState.workflowStatus = sourceState.feedbackId || sourceState.imageDataUrl ? "processed" : "idle";
      sourceState.status = referenceStatus;
    } else if (sourceState.draftMode) {
      sourceState.status = selectedStatus;
    }
    sourceState.isError = false;
  }

  function lockDepartmentMorningCells() {
    resetDepartmentRowValuesFromLoaded(DEPARTMENT_MORNING_CONTROL_KEYS);
    syncDepartmentMorningDraftState(
      state.photoImport,
      "Photo kept only for reference. Cells 1-3 now come from the saved row again.",
      "Photo source stays selected, but cells 1-3 were restored from the saved row."
    );
    syncDepartmentMorningDraftState(
      state.telegramFormReview,
      "Telegram form kept only for reference. Cells 1-3 now come from the saved row again.",
      "Telegram source stays selected, but cells 1-3 were restored from the saved row."
    );
  }

  function handleDepartmentMorningLockToggle(unlocked) {
    state.departmentTopCellsUnlocked = Boolean(unlocked);
    if (!state.departmentTopCellsUnlocked) {
      lockDepartmentMorningCells();
      setInfo("Cells 1-3 are locked again. OCR, Telegram form and manual input no longer change them.", false);
    } else {
      setInfo("Cells 1-3 are unlocked. OCR, Telegram form and manual input can change them again.", false);
    }
    renderPage();
  }

  function resetDepartmentRowValuesFromLoaded(keys) {
    const currentRow = getCurrentRow();
    const loadedRow = getCurrentLoadedRow();
    if (!currentRow || !loadedRow || !Array.isArray(keys)) {
      return;
    }

    keys.forEach((key) => {
      if (typeof key !== "string") {
        return;
      }
      currentRow.values[key] = Object.prototype.hasOwnProperty.call(loadedRow.values || {}, key)
        ? loadedRow.values[key]
        : null;
    });
  }

  function cancelAutoAppliedTelegramSelectionIfNeeded() {
    const feedbackQueryId = queryParams.get("tgFeedback") || "";
    const reviewState = state.telegramFormReview || buildInitialTelegramFormReviewState();
    if (
      mode !== "department"
      || !feedbackQueryId
      || !reviewState.draftMode
      || reviewState.workflowStatus !== "pending"
      || String(reviewState.feedbackId || "") !== feedbackQueryId
    ) {
      return;
    }

    resetDepartmentRowValuesFromLoaded(reviewState.lastAppliedKeys || []);
    reviewState.draftMode = false;
    reviewState.workflowStatus = "processed";
    reviewState.status = "Открыта отправленная Telegram форма. Выберите источник обновления кнопкой ниже.";
    reviewState.isError = false;
    state.telegramFormReview = reviewState;
    setInfo("Открыта отправленная Telegram форма. Выберите, брать данные из фото или из Telegram формы.", false);
    renderPage();
  }

  function setPhotoSourceReferenceStatus() {
    if (!state.photoImport || (!state.photoImport.feedbackId && !state.photoImport.imageDataUrl)) {
      return;
    }
    state.photoImport.draftMode = false;
    state.photoImport.workflowStatus = "processed";
    state.photoImport.status = "Фото оставлено для сверки. Чтобы обновить таблицу по нему, нажмите «Взять данные из фото»." ;
    state.photoImport.isError = false;
  }

  function setTelegramSourceReferenceStatus() {
    if (!state.telegramFormReview || !state.telegramFormReview.feedbackId) {
      return;
    }
    state.telegramFormReview.draftMode = false;
    state.telegramFormReview.workflowStatus = "processed";
    state.telegramFormReview.status = "Telegram форма оставлена для сверки. Чтобы обновить таблицу по ней, нажмите «Взять данные из Telegram формы».";
    state.telegramFormReview.isError = false;
  }

  function handleApplyPhotoSourceToDepartment() {
    const row = getCurrentRow();
    const photoState = state.photoImport || buildInitialPhotoImportState();
    const previewValues = photoState.recognizedValues && typeof photoState.recognizedValues === "object"
      ? photoState.recognizedValues
      : null;
    const recognizedKeys = Array.isArray(photoState.lastAppliedKeys) ? photoState.lastAppliedKeys : [];
    if (!row || !previewValues) {
      setInfo("Open or load a photo first.", true);
      return;
    }

    const transferableKeys = getDepartmentSourceTransferKeys(getRecognizablePhotoFields(row).map((field) => field.key));
    const allowedRecognizedKeys = getDepartmentSourceTransferKeys(recognizedKeys);
    const skippedMorningCells = hasLockedDepartmentMorningSourceValues(previewValues);
    resetDepartmentRowValuesFromLoaded(transferableKeys);
    const appliedKeys = applyPreviewValuesToDepartmentRow(row, previewValues, allowedRecognizedKeys);
    if (!appliedKeys.length) {
      if (skippedMorningCells) {
        setInfo("Cells 1-3 are locked, so photo values for them were not copied.", true);
        return;
      }
      setInfo("No photo values can be copied into this department row.", true);
      return;
    }

    state.photoImport.draftMode = true;
    state.photoImport.workflowStatus = "selected";
    state.photoImport.lastAppliedKeys = appliedKeys;
    state.photoImport.status = skippedMorningCells
      ? "Photo source selected. Cells 1-3 stayed on the saved row because the lock is closed."
      : "Photo source selected. Review the row and click Save.";
    state.photoImport.isError = false;
    setTelegramSourceReferenceStatus();
    setInfo(
      skippedMorningCells
        ? "Photo values copied locally. Cells 1-3 stayed unchanged because the lock is closed."
        : "Photo values copied locally. Review the row and click Save.",
      false
    );
    renderPage();
  }

  function handleApplyTelegramSourceToDepartment() {
    const row = getCurrentRow();
    const reviewState = state.telegramFormReview || buildInitialTelegramFormReviewState();
    const previewValues = reviewState.recognizedValues && typeof reviewState.recognizedValues === "object"
      ? reviewState.recognizedValues
      : null;
    const recognizedKeys = Array.isArray(reviewState.lastAppliedKeys) ? reviewState.lastAppliedKeys : [];
    if (!row || !previewValues) {
      setInfo("Open Telegram form data first.", true);
      return;
    }

    const transferableKeys = getDepartmentSourceTransferKeys(getRecognizablePhotoFields(row).map((field) => field.key));
    const allowedRecognizedKeys = getDepartmentSourceTransferKeys(recognizedKeys);
    const skippedMorningCells = hasLockedDepartmentMorningSourceValues(previewValues);
    resetDepartmentRowValuesFromLoaded(transferableKeys);
    const appliedKeys = applyTelegramFormValuesToDepartmentRow(row, previewValues, allowedRecognizedKeys);
    if (!appliedKeys.length) {
      if (skippedMorningCells) {
        setInfo("Cells 1-3 are locked, so Telegram values for them were not copied.", true);
        return;
      }
      setInfo("No Telegram form values can be copied into this department row.", true);
      return;
    }

    state.telegramFormReview.draftMode = true;
    state.telegramFormReview.workflowStatus = "selected";
    state.telegramFormReview.lastAppliedKeys = appliedKeys;
    state.telegramFormReview.status = skippedMorningCells
      ? "Telegram source selected. Cells 1-3 stayed on the saved row because the lock is closed."
      : "Telegram source selected. Review the row and click Save.";
    state.telegramFormReview.isError = false;
    setPhotoSourceReferenceStatus();
    setInfo(
      skippedMorningCells
        ? "Telegram values copied locally. Cells 1-3 stayed unchanged because the lock is closed."
        : "Telegram values copied locally. Review the row and click Save.",
      false
    );
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

  function openPhotoLightbox(imageDataUrl, alt, sourceKind = "", sourceId = "") {
    if (!imageDataUrl) {
      return;
    }
    state.photoLightbox = {
      ...buildInitialPhotoLightboxState(),
      open: true,
      imageDataUrl,
      alt: alt || "Фото бланка",
      sourceKind: typeof sourceKind === "string" ? sourceKind : "",
      sourceId: sourceId == null ? "" : String(sourceId),
      isRotating: false,
      isRechecking: false,
      isSaving: false,
      status: "",
      statusIsError: false
    };
    renderPage();
  }

  function persistPhotoLightboxImageLocally(imageDataUrl) {
    const lightbox = state.photoLightbox || buildInitialPhotoLightboxState();
    const sourceKind = String(lightbox.sourceKind || "");
    const sourceId = String(lightbox.sourceId || "");

    if ((sourceKind === "main-table-gallery" || sourceKind === "photo-import") && sourceId) {
      storeOcrFeedbackImageOverride(sourceId, imageDataUrl);
    }

    if (sourceKind === "main-route") {
      state.mainPhotoRoute.imageDataUrl = imageDataUrl;
    }

    if (sourceKind === "photo-import") {
      state.photoImport.imageDataUrl = imageDataUrl;
    }

    if (sourceKind === "main-table-gallery" || sourceKind === "photo-import") {
      state.mainTablePhotoGallery.records = ensureMainTablePhotoGalleryRecordsLoaded().map((record) => {
        if (Number(record?.id) === Number(sourceId)) {
          return {
            ...record,
            imageDataUrl
          };
        }
        return record;
      });
    }
  }

  async function persistPhotoLightboxImage(imageDataUrl) {
    const lightbox = state.photoLightbox || buildInitialPhotoLightboxState();
    const sourceKind = String(lightbox.sourceKind || "");
    const sourceId = String(lightbox.sourceId || "");

    persistPhotoLightboxImageLocally(imageDataUrl);

    const canSaveRemote = (
      sourceKind === "main-table-gallery"
      || sourceKind === "photo-import"
    ) && Number.isFinite(Number(sourceId))
      && sync.hasRemoteSync?.()
      && typeof sync.updateOcrFeedbackImage === "function";

    if (!canSaveRemote) {
      return null;
    }

    const savedRecord = await sync.updateOcrFeedbackImage(sourceId, imageDataUrl);
    const normalizedRecord = normalizeMainTablePhotoGalleryRecord(savedRecord);
    if (normalizedRecord) {
      const normalizedId = Number(normalizedRecord.id);
      const existingRecords = ensureMainTablePhotoGalleryRecordsLoaded();
      const nextRecords = [];
      let replaced = false;
      existingRecords.forEach((record) => {
        if (Number(record?.id) === normalizedId) {
          nextRecords.push(normalizedRecord);
          replaced = true;
          return;
        }
        nextRecords.push(record);
      });
      if (!replaced) {
        nextRecords.push(normalizedRecord);
      }
      state.mainTablePhotoGallery.records = nextRecords;
    }

    return savedRecord;
  }

  async function handleRotatePhotoLightbox() {
    const lightbox = state.photoLightbox || buildInitialPhotoLightboxState();
    if (!lightbox.open || !lightbox.imageDataUrl || lightbox.isRotating || lightbox.isSaving || lightbox.isReassigning) {
      return;
    }

    state.photoLightbox = {
      ...lightbox,
      isRotating: true
    };
    renderPage();

    try {
      const rotatedDataUrl = await rotateImageDataUrl(lightbox.imageDataUrl, 90);
      await persistPhotoLightboxImage(rotatedDataUrl);
      state.photoLightbox = {
        ...state.photoLightbox,
        imageDataUrl: rotatedDataUrl,
        isRotating: false
      };
      renderPage();
    } catch (error) {
      state.photoLightbox = {
        ...state.photoLightbox,
        isRotating: false
      };
      renderPage();
      setInfo(error instanceof Error ? error.message : "Не удалось повернуть фото.", true);
    }
  }

  async function handlePhotoLightboxRecheck() {
    const lightbox = state.photoLightbox || buildInitialPhotoLightboxState();
    if (
      !lightbox.open
      || lightbox.isRechecking
      || lightbox.isSaving
      || lightbox.isReassigning
      || lightbox.sourceKind !== "main-table-gallery"
      || !lightbox.sourceId
    ) {
      return;
    }

    if (!sync.hasRemoteSync() || typeof sync.recognizeDepartmentPhoto !== "function") {
      state.photoLightbox = {
        ...lightbox,
        status: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 OCR \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u043E\u043D\u043B\u0430\u0439\u043D-\u0440\u0435\u0436\u0438\u043C\u0435 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430.",
        statusIsError: true
      };
      renderPage();
      return;
    }

    const record = getMainTablePhotoGalleryRecordById(lightbox.sourceId);
    if (!record) {
      state.photoLightbox = {
        ...lightbox,
        status: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0439\u0442\u0438 OCR feedback \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0444\u043E\u0442\u043E.",
        statusIsError: true
      };
      renderPage();
      return;
    }

    const context = getMainTablePhotoLightboxContext(lightbox);
    const departmentId = context?.departmentId || record.departmentId || "";
    if (!departmentId) {
      state.photoLightbox = {
        ...lightbox,
        status: "\u0423 \u044D\u0442\u043E\u0433\u043E \u0444\u043E\u0442\u043E \u043D\u0435\u0442 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0439 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0438 \u043A \u043E\u0442\u0434\u0435\u043B\u0435\u043D\u0438\u044E.",
        statusIsError: true
      };
      renderPage();
      return;
    }

    state.photoLightbox = {
      ...lightbox,
      isRechecking: true,
      status: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u044E \u0446\u0438\u0444\u0440\u044B \u043D\u0430 \u0431\u043B\u0430\u043D\u043A\u0435...",
      statusIsError: false
    };
    renderPage();

    try {
      const sourceDataUrl = state.photoLightbox?.imageDataUrl || record.imageDataUrl;
      const ocrImageDataUrl = await buildFocusedOcrImageDataUrl(sourceDataUrl);
      const alignedArtifacts = await buildAlignedRightOcrArtifacts(sourceDataUrl);
      const rightOcrImageDataUrl = alignedArtifacts
        ? alignedArtifacts.rightCropDataUrl
        : await buildCroppedImageDataUrl(sourceDataUrl, OCR_RIGHT_FOCUS_CROP);
      const rightCellCropDataUrls = alignedArtifacts
        ? alignedArtifacts.rightCellCropDataUrls
        : await buildRightCellCropDataUrls(sourceDataUrl);
      const result = await sync.recognizeDepartmentPhoto(
        departmentId,
        ocrImageDataUrl,
        [rightOcrImageDataUrl, ...rightCellCropDataUrls]
      );

      const recognizedValues = normalizePhotoPreviewValueObject(result?.values);
      const recognizedKeys = Array.isArray(result?.recognizedKeys) && result.recognizedKeys.length
        ? result.recognizedKeys.map((item) => String(item))
        : Object.keys(recognizedValues);
      const nextRecord = {
        ...record,
        departmentId,
        imageDataUrl: sourceDataUrl,
        reportDate: typeof result?.reportDate === "string" && result.reportDate.trim()
          ? result.reportDate.trim()
          : record.reportDate,
        recognizedKeys,
        changedKeys: [],
        recognizedValues,
        finalValues: recognizedValues,
        notes: Array.isArray(result?.notes) ? normalizeOcrNotes(result.notes) : record.notes,
        cellReviews: normalizePhotoCellReviews(result)
      };
      upsertMainTablePhotoGalleryRecord(nextRecord);

      const hasValues = recognizedKeys.length > 0
        && recognizedKeys.some((key) => Object.prototype.hasOwnProperty.call(recognizedValues, key));
      state.photoLightbox = {
        ...state.photoLightbox,
        recognizedValues,
        recognizedKeys,
        cellReviews: normalizePhotoCellReviews(result),
        isRechecking: false,
        status: hasValues
          ? "OCR-\u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u043F\u043E \u044D\u0442\u043E\u043C\u0443 \u0444\u043E\u0442\u043E."
          : "OCR \u043E\u0442\u0440\u0430\u0431\u043E\u0442\u0430\u043B\u043E, \u043D\u043E \u043D\u043E\u0432\u044B\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u043D\u0435 \u0431\u044B\u043B\u0438 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u044B.",
        statusIsError: !hasValues
      };
      renderPage();
    } catch (error) {
      state.photoLightbox = {
        ...state.photoLightbox,
        isRechecking: false,
        status: error instanceof Error ? error.message : "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 OCR.",
        statusIsError: true
      };
      renderPage();
    }
  }

  async function handlePhotoLightboxSave() {
    const lightbox = state.photoLightbox || buildInitialPhotoLightboxState();
    if (
      !lightbox.open
      || lightbox.isSaving
      || lightbox.isReassigning
      || lightbox.sourceKind !== "main-table-gallery"
      || !lightbox.sourceId
    ) {
      return;
    }

    if (!sync.hasRemoteSync() || typeof sync.saveDepartmentFromMain !== "function") {
      state.photoLightbox = {
        ...lightbox,
        status: "Сохранение OCR доступно только в онлайн-режиме владельца.",
        statusIsError: true
      };
      renderPage();
      return;
    }

    if (state.activeMainTableSavedPreviewKey) {
      state.photoLightbox = {
        ...lightbox,
        status: "Вернитесь к текущей таблице, чтобы сохранить OCR в главную строку.",
        statusIsError: true
      };
      renderPage();
      return;
    }

    if (getMainTableDirtyRows().length) {
      state.photoLightbox = {
        ...lightbox,
        status: "Сначала сохраните или снимите ручные изменения в главной таблице.",
        statusIsError: true
      };
      renderPage();
      return;
    }

    if (state.mainTableSaveInFlight) {
      state.photoLightbox = {
        ...lightbox,
        status: "Главная таблица уже сохраняется. Подождите.",
        statusIsError: true
      };
      renderPage();
      return;
    }

    const context = getMainTablePhotoLightboxContext(lightbox);
    if (!context?.record || !context.boundRow) {
      state.photoLightbox = {
        ...lightbox,
        status: "У этого фото нет корректной привязки к строке отделения.",
        statusIsError: true
      };
      renderPage();
      return;
    }

    if (!context.validation.applicable || !context.validation.isValid) {
      state.photoLightbox = {
        ...lightbox,
        status: context.validation.failedChecks.map((item) => item.failureMessage).join(" ") || "Контрольные суммы OCR не сошлись.",
        statusIsError: true
      };
      renderPage();
      return;
    }

    state.photoLightbox = {
      ...lightbox,
      isSaving: true,
      status: "Сохраняю OCR данные в строку отделения...",
      statusIsError: false
    };
    renderPage();

    try {
      let saveContext = context;
      if (saveContext.departmentChanged) {
        saveContext = await persistPhotoLightboxDepartmentAssignment(state.photoLightbox || lightbox);
      }
      if (!saveContext?.boundRow) {
        throw new Error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u0442\u044c \u0444\u043e\u0442\u043e \u043a \u043d\u0443\u0436\u043d\u043e\u043c\u0443 \u043e\u0442\u0434\u0435\u043b\u0435\u043d\u0438\u044e.");
      }

      const draftRow = deepCopy(saveContext.boundRow);
      const appliedKeys = applyPreviewValuesToDepartmentRow(draftRow, saveContext.previewValues, saveContext.recognizedKeys);
      if (!appliedKeys.length) {
        throw new Error("В OCR таблице нет значений для сохранения.");
      }

      const expectedValues = config.normalizeRowValues(draftRow.values);
      if (isQhCalcDepartment(draftRow)) {
        syncQhBaseValuesFromCurrentValues(expectedValues);
      }

      const payloadValues = deepCopy(expectedValues);
      const result = await sync.saveDepartmentFromMain(draftRow.id, state.snapshot.reportDate, payloadValues);
      const verification = verifySavedRowResult(draftRow.id, expectedValues, result.snapshot);
      if (!verification.ok) {
        throw new Error(verification.reason);
      }

      applyLoadedSnapshot(result);
      state.photoLightbox = {
        ...state.photoLightbox,
        isSaving: false,
        status: `OCR данные сохранены. Обновлено: ${formatTimestamp(verification.savedRow.updatedAt)}.`,
        statusIsError: false
      };
      setInfo(`OCR данные для ${draftRow.department} сохранены в основную таблицу.`, false);
      renderPage();
    } catch (error) {
      state.photoLightbox = {
        ...state.photoLightbox,
        isSaving: false,
        status: error instanceof Error ? error.message : "Не удалось сохранить OCR данные.",
        statusIsError: true
      };
      renderPage();
    }
  }

  function closePhotoLightbox() {
    if (!state.photoLightbox?.open) {
      return;
    }
    state.photoLightbox = buildInitialPhotoLightboxState();
    renderPage();
  }

  async function handleDeleteDepartmentFeedback(button) {
    const departmentIdToDelete = button.getAttribute("data-delete-feedback") || "";
    const row = getDepartmentRow(state.snapshot, departmentIdToDelete);
    const feedbackId = button.getAttribute("data-feedback-id") || (row && row.photoFeedbackId ? String(row.photoFeedbackId) : "");
    const department = config.getDepartmentById(departmentIdToDelete);
    const departmentName = department ? department.department : departmentIdToDelete;

    if (!departmentIdToDelete || !feedbackId) {
      setInfo("У этого отделения нет отправленных данных для удаления.", false);
      return;
    }

    if (typeof sync.deleteDepartmentFeedback !== "function") {
      setInfo("Удаление отправленных данных пока недоступно. Обновите файлы синхронизации.", true);
      return;
    }

    const confirmed = window.confirm(`Удалить отправленные данные отделения ${departmentName}? Основная таблица не изменится.`);
    if (!confirmed) {
      return;
    }

    button.disabled = true;
    setInfo(`Удаляю отправленные данные: ${departmentName}...`, false);
    try {
      const result = await sync.deleteDepartmentFeedback(departmentIdToDelete, feedbackId);
      applyLoadedSnapshot(result);
      setInfo(`Отправленные данные удалены: ${departmentName}.`, false);
      renderPage();
    } catch (error) {
      setInfo(error instanceof Error ? error.message : "Не удалось удалить отправленные данные.", true);
      button.disabled = false;
    }
  }

  function removeMainTablePhotoGalleryRecord(feedbackId) {
    const normalizedFeedbackId = Number(feedbackId);
    state.mainTablePhotoGallery.records = ensureMainTablePhotoGalleryRecordsLoaded().filter(
      (record) => Number(record?.id) !== normalizedFeedbackId
    );
    state.mainTableAndroidApp.records = ensureMainTableAndroidAppRecordsLoaded().filter(
      (record) => Number(record?.id) !== normalizedFeedbackId
    );
  }

  function upsertMainTablePhotoGalleryRecord(record) {
    const normalizedRecord = normalizeMainTablePhotoGalleryRecord(record);
    if (!normalizedRecord) {
      return;
    }

    const normalizedId = Number(normalizedRecord.id);
    const nextRecords = [];
    let replaced = false;
    ensureMainTablePhotoGalleryRecordsLoaded().forEach((currentRecord) => {
      if (Number(currentRecord?.id) === normalizedId) {
        nextRecords.push(normalizedRecord);
        replaced = true;
        return;
      }
      nextRecords.push(currentRecord);
    });
    if (!replaced) {
      nextRecords.push(normalizedRecord);
    }
    state.mainTablePhotoGallery.records = nextRecords;

    const nextAndroidRecords = [];
    let replacedAndroid = false;
    ensureMainTableAndroidAppRecordsLoaded().forEach((currentRecord) => {
      if (Number(currentRecord?.id) === normalizedId) {
        if (isAndroidMainTablePhotoRecord(normalizedRecord)) {
          nextAndroidRecords.push(normalizedRecord);
        }
        replacedAndroid = true;
        return;
      }
      nextAndroidRecords.push(currentRecord);
    });
    if (!replacedAndroid && isAndroidMainTablePhotoRecord(normalizedRecord)) {
      nextAndroidRecords.push(normalizedRecord);
    }
    state.mainTableAndroidApp.records = nextAndroidRecords;
  }

  async function handleDeleteMainTablePhotoGalleryFeedback(button) {
    const feedbackId = Number(button.getAttribute("data-main-table-photo-delete") || "");
    const departmentIdToDelete = button.getAttribute("data-main-table-photo-department-id") || "";
    const record = ensureMainTablePhotoGalleryRecordsLoaded()
      .map((item) => normalizeMainTablePhotoGalleryRecord(item))
      .find((item) => item && item.id === feedbackId);
    const department = config.getDepartmentById(departmentIdToDelete);
    const departmentName = department?.department || record?.departmentName || departmentIdToDelete || `feedback ${feedbackId}`;

    if (!Number.isFinite(feedbackId)) {
      setInfo("У этого фото нет корректной привязки к отделению для удаления.", true);
      return;
    }

    if (typeof sync.deleteDepartmentFeedback !== "function") {
      setInfo("Удаление фото пока недоступно. Обновите файлы синхронизации.", true);
      return;
    }

    const confirmed = window.confirm(`Удалить фото бланка отделения ${departmentName} с сервера?`);
    if (!confirmed) {
      return;
    }

    button.disabled = true;
    setInfo(`Удаляю фото: ${departmentName}...`, false);
    try {
      const result = await sync.deleteDepartmentFeedback(departmentIdToDelete || "", feedbackId);
      removeMainTablePhotoGalleryRecord(feedbackId);
      if (state.photoLightbox?.open && Number(state.photoLightbox.sourceId) === feedbackId) {
        closePhotoLightbox();
      }
      applyLoadedSnapshot(result);
      setInfo(`Фото удалено: ${departmentName}.`, false);
      renderPage();
    } catch (error) {
      setInfo(error instanceof Error ? error.message : "Не удалось удалить фото бланка.", true);
      button.disabled = false;
    }
  }

  async function handleDeleteAllMainTablePhotoGalleryFeedback(button) {
    const displayContext = getMainTableDisplaySnapshotContext();
    const bulkDeleteMeta = getMainTablePhotoGalleryBulkDeleteMeta(displayContext);
    const items = Array.isArray(bulkDeleteMeta.items) ? [...bulkDeleteMeta.items] : [];

    if (!items.length) {
      setInfo("Для текущей таблицы нет загруженных фото для удаления.", false);
      return;
    }
    if (bulkDeleteMeta.isDeletingAll) {
      return;
    }
    if (typeof sync.deleteDepartmentFeedback !== "function" || !sync.hasRemoteSync?.()) {
      setInfo("Массовое удаление фото доступно только в онлайн-режиме владельца.", true);
      return;
    }

    const confirmed = window.confirm(
      `Удалить с сервера все фото бланков из блока «Фото бланков текущей таблицы»? Сейчас будет удалено: ${items.length}.`
    );
    if (!confirmed) {
      return;
    }

    state.mainTablePhotoGallery.isDeletingAll = true;
    refreshMainTablePhotoGalleryUi(displayContext);

    let deletedCount = 0;
    let lastResult = null;
    let shouldCloseLightbox = false;
    const failedItems = [];

    try {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const departmentName = item.departmentName || item.departmentId || item.rowId || `feedback ${item.feedbackId}`;
        setInfo(`Удаляю фото ${index + 1} из ${items.length}: ${departmentName}...`, false);
        try {
          const result = await sync.deleteDepartmentFeedback(item.departmentId || item.rowId || "", item.feedbackId);
          lastResult = result;
          removeMainTablePhotoGalleryRecord(item.feedbackId);
          if (state.photoLightbox?.open && Number(state.photoLightbox.sourceId) === Number(item.feedbackId)) {
            shouldCloseLightbox = true;
          }
          deletedCount += 1;
        } catch (error) {
          failedItems.push({
            item,
            error
          });
        }
      }

      if (lastResult) {
        applyLoadedSnapshot(lastResult);
      }
      if (shouldCloseLightbox) {
        state.photoLightbox = buildInitialPhotoLightboxState();
      }

      if (failedItems.length) {
        const failureSummary = failedItems
          .slice(0, 3)
          .map(({ item, error }) => {
            const departmentName = item.departmentName || item.departmentId || item.rowId || `feedback ${item.feedbackId}`;
            const reason = error instanceof Error && error.message ? error.message : "ошибка удаления";
            return `${departmentName} (${reason})`;
          })
          .join("; ");
        const extraFailures = failedItems.length > 3 ? ` Ещё ошибок: ${failedItems.length - 3}.` : "";
        setInfo(`Удалено фото: ${deletedCount} из ${items.length}. Не удалось удалить: ${failureSummary}.${extraFailures}`, true);
      } else {
        setInfo(`Все фото бланков текущей таблицы удалены: ${deletedCount}.`, false);
      }
    } finally {
      state.mainTablePhotoGallery.isDeletingAll = false;
      renderPage();
    }
  }

  async function handleReassignMainTablePhotoGalleryFeedback(select) {
    const feedbackId = Number(select.getAttribute("data-main-table-photo-department-select") || "");
    const currentDepartmentId = select.getAttribute("data-current-department-id") || "";
    const nextDepartmentId = String(select.value || "").trim();
    const currentDepartment = config.getDepartmentById(currentDepartmentId);
    const nextDepartment = config.getDepartmentById(nextDepartmentId);

    if (!Number.isFinite(feedbackId) || !currentDepartmentId || !nextDepartmentId || nextDepartmentId === currentDepartmentId) {
      select.value = currentDepartmentId;
      return;
    }

    if (typeof sync.reassignOcrFeedbackDepartment !== "function") {
      setInfo("Переназначение фото пока недоступно. Обновите файлы синхронизации.", true);
      select.value = currentDepartmentId;
      return;
    }

    const confirmed = window.confirm(
      `Перенести фото из "${currentDepartment?.department || currentDepartmentId}" в "${nextDepartment?.department || nextDepartmentId}"?`
    );
    if (!confirmed) {
      select.value = currentDepartmentId;
      return;
    }

    select.disabled = true;
    setInfo(`Переназначаю фото в отделение ${nextDepartment?.department || nextDepartmentId}...`, false);
    try {
      const result = await sync.reassignOcrFeedbackDepartment(feedbackId, nextDepartmentId);
      upsertMainTablePhotoGalleryRecord(result?.record);
      applyLoadedSnapshot(result);
      setInfo(`Фото перенесено в отделение ${nextDepartment?.department || nextDepartmentId}.`, false);
      renderPage();
    } catch (error) {
      setInfo(error instanceof Error ? error.message : "Не удалось изменить отделение для фото.", true);
      select.value = currentDepartmentId;
      select.disabled = false;
    }
  }

  function removeMainTableTelegramFormRecord(feedbackId) {
    const normalizedFeedbackId = Number(feedbackId);
    state.mainTableTelegramForms.records = ensureMainTableTelegramFormRecordsLoaded().filter(
      (record) => Number(record?.id) !== normalizedFeedbackId
    );
    state.mainTableTelegramForms.lastLoadedAt = 0;
  }

  async function handleApplyMainTableTelegramForm(button) {
    const feedbackId = Number(button.getAttribute("data-main-table-telegram-form-apply") || "");
    if (!Number.isFinite(feedbackId)) {
      return;
    }

    if (!sync.hasRemoteSync() || typeof sync.saveDepartmentFromMain !== "function") {
      setInfo("Обновление по Telegram Web форме доступно только в онлайн-режиме владельца.", true);
      return;
    }
    if (state.activeMainTableSavedPreviewKey) {
      setInfo("Сначала вернитесь к текущей таблице, потом обновляйте её по Telegram Web форме.", true);
      return;
    }
    if (getMainTableDirtyRows().length) {
      setInfo("Сначала сохраните или отмените ручные изменения в главной таблице.", true);
      return;
    }
    if (state.mainTableSaveInFlight) {
      setInfo("Главная таблица уже сохраняется. Подождите пару секунд.", true);
      return;
    }

    const record = getMainTableTelegramFormRecordById(feedbackId);
    if (!record) {
      setInfo("Не удалось найти выбранную Telegram Web форму.", true);
      return;
    }

    const liveRow = getDepartmentRow(state.snapshot, record.departmentId);
    if (!liveRow) {
      setInfo("У этой Telegram Web формы нет корректной привязки к строке отделения.", true);
      return;
    }

    button.disabled = true;
    setInfo(`Обновляю основную таблицу по Telegram Web форме: ${liveRow.department}...`, false);

    try {
      const draftRow = deepCopy(liveRow);
      const previewValues = buildPhotoPreviewValuesFromRecord(record);
      const recognizedKeys = Array.isArray(record.recognizedKeys) && record.recognizedKeys.length
        ? record.recognizedKeys.map((item) => String(item))
        : Object.keys(previewValues);
      const appliedKeys = applyTelegramFormValuesToDepartmentRow(draftRow, previewValues, recognizedKeys);
      if (!appliedKeys.length) {
        throw new Error("В этой Telegram Web форме нет значений для записи в основную таблицу.");
      }

      const expectedValues = config.normalizeRowValues(draftRow.values);
      if (isQhCalcDepartment(draftRow)) {
        syncQhBaseValuesFromCurrentValues(expectedValues);
      }

      const result = await sync.saveDepartmentFromMain(
        draftRow.id,
        state.snapshot.reportDate,
        deepCopy(expectedValues)
      );
      const verification = verifySavedRowResult(draftRow.id, expectedValues, result.snapshot);
      if (!verification.ok) {
        throw new Error(verification.reason);
      }

      applyLoadedSnapshot(result);
      state.mainTableTelegramForms.lastLoadedAt = 0;
      setInfo(`Основная таблица обновлена по Telegram Web форме: ${draftRow.department}.`, false);
      renderPage();
    } catch (error) {
      setInfo(error instanceof Error ? error.message : "Не удалось обновить основную таблицу по Telegram Web форме.", true);
      button.disabled = false;
    }
  }

  async function handleDeleteMainTableTelegramForm(button) {
    const feedbackId = Number(button.getAttribute("data-main-table-telegram-form-delete") || "");
    const departmentId = String(button.getAttribute("data-main-table-telegram-form-department-id") || "").trim();
    const record = getMainTableTelegramFormRecordById(feedbackId);
    const department = config.getDepartmentById(departmentId);
    const departmentName = department?.department || record?.departmentName || departmentId || `feedback ${feedbackId}`;

    if (!Number.isFinite(feedbackId) || !departmentId) {
      setInfo("У этой Telegram Web формы нет корректной привязки к отделению для удаления.", true);
      return;
    }
    if (typeof sync.deleteDepartmentFeedback !== "function") {
      setInfo("Удаление Telegram Web формы пока недоступно. Обновите файлы синхронизации.", true);
      return;
    }

    const confirmed = window.confirm(`Удалить Telegram Web форму отделения ${departmentName}?`);
    if (!confirmed) {
      return;
    }

    button.disabled = true;
    setInfo(`Удаляю Telegram Web форму: ${departmentName}...`, false);
    try {
      const result = await sync.deleteDepartmentFeedback(departmentId, feedbackId);
      removeMainTableTelegramFormRecord(feedbackId);
      applyLoadedSnapshot(result);
      setInfo(`Telegram Web форма удалена: ${departmentName}.`, false);
      renderPage();
    } catch (error) {
      setInfo(error instanceof Error ? error.message : "Не удалось удалить Telegram Web форму.", true);
      button.disabled = false;
    }
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
    const canRecognize = sync.hasRemoteSync() && typeof sync.recognizeDepartmentPhoto === "function";
    setPhotoImportStatus(
      canRecognize
        ? "Фото перенесено на страницу отделения. Поверните его при необходимости, затем нажмите \"Распознать\"."
        : "Фото перенесено на страницу отделения. Для распознавания нужен онлайн-режим владельца.",
      !canRecognize
    );
    renderPage();
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

      const imageDataUrl = getOcrFeedbackImageOverride(feedbackId)
        || (typeof record.imageDataUrl === "string" ? record.imageDataUrl : "");
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

      const imageDataUrl = getOcrFeedbackImageOverride(feedbackId)
        || (typeof record.imageDataUrl === "string" ? record.imageDataUrl : "");
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

    const row = getCurrentRow();
    const feedbackQueryId = queryParams.get("tgFeedback") || "";
    const fallbackTelegramFormId = row && row.latestTelegramFormFeedbackId
      ? String(row.latestTelegramFormFeedbackId)
      : "";
    const candidateIds = [];

    if (feedbackQueryId) {
      candidateIds.push(feedbackQueryId);
    }
    if (fallbackTelegramFormId && !candidateIds.includes(fallbackTelegramFormId)) {
      candidateIds.push(fallbackTelegramFormId);
    }

    if (!candidateIds.length || !sync.hasRemoteSync() || typeof sync.loadTelegramPhotoFeedback !== "function") {
      return;
    }

    for (const candidateId of candidateIds) {
      try {
        const record = await sync.loadTelegramPhotoFeedback(candidateId, departmentId);
        if (!record) {
          continue;
        }

        const imageDataUrl = typeof record.imageDataUrl === "string" ? record.imageDataUrl : "";
        if (imageDataUrl.startsWith("data:image/")) {
          continue;
        }

        const applyToDepartment = Boolean(feedbackQueryId) && String(candidateId) === feedbackQueryId;
        state.telegramFormReview = buildTelegramFormReviewStateFromRecord(record, row, {
          applyToDepartment,
          feedbackId: candidateId
        });
        if (applyToDepartment && state.telegramFormReview.draftMode) {
          setInfo("Отправленная Telegram форма подставлена в таблицу отделения. После проверки нажмите Сохранить.", false);
        }
        renderPage();
        return;
      } catch (error) {
        if (String(candidateId) === feedbackQueryId) {
          state.telegramFormReview = buildInitialTelegramFormReviewState();
          state.telegramFormReview.feedbackId = String(candidateId);
          state.telegramFormReview.workflowStatus = "pending";
          state.telegramFormReview.status = error instanceof Error
            ? `Не удалось загрузить данные Telegram формы: ${error.message}`
            : "Не удалось загрузить данные Telegram формы.";
          state.telegramFormReview.isError = true;
          renderPage();
          return;
        }
      }
    }
  }

  async function maybeLoadStoredDepartmentPhotoAdjusted(forceReplace = false) {
    if (mode !== "department" || !sync.hasRemoteSync() || typeof sync.loadTelegramPhotoFeedback !== "function") {
      return;
    }

    const feedbackQueryId = queryParams.get("tgFeedback") || "";
    if (feedbackQueryId && !forceReplace && state.photoImport && state.photoImport.imageDataUrl) {
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

      const imageDataUrl = getOcrFeedbackImageOverride(feedbackId)
        || (typeof record.imageDataUrl === "string" ? record.imageDataUrl : "");
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
    // Department photos are recognized only after the user rotates/checks
    // the image and presses the recognition button manually.
    return;
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

  function handleMainTableEditToggle(unlocked) {
    state.mainTableUnlocked = Boolean(unlocked);
    renderPage();
    setInfo(
      state.mainTableUnlocked
        ? "Редактирование главной таблицы включено."
        : "Редактирование главной таблицы снова заблокировано.",
      false
    );
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
    state.departmentPdfArchiveRecords = readDepartmentPdfArchiveRecords();
    backfillDepartmentPdfArchiveFromSnapshot(state.snapshot);
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
      bindBackgroundPendingSyncEvents();
      bindShiftTransferEvents();
      startAutoRefreshIfNeeded();
      startFreshnessTicker();
      startClockTicker();
      scheduleBackgroundPendingSync({
        delayMs: AUTO_PENDING_SYNC_DELAY_MS
      });
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
      syncQhBaseValuesFromCurrentValues(expectedValues);
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
            captureDepartmentPdfArchiveFromSave(result.snapshot || state.snapshot, row.id);

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
            const wasPhotoQueueMode = Boolean(state.photoImport && state.photoImport.queueMode);

            state.photoImport.draftMode = false;
            if (state.photoImport.feedbackId) {
              state.photoImport.workflowStatus = "processed";
              if (state.photoImport.imageDataUrl) {
                state.photoImport.status = "Последний бланк сохранён вместе с данными отделения.";
                state.photoImport.isError = false;
              }
            }
            if (state.telegramFormReview && state.telegramFormReview.feedbackId && state.telegramFormReview.draftMode) {
              state.telegramFormReview.draftMode = false;
              state.telegramFormReview.workflowStatus = "processed";
              state.telegramFormReview.status = "Telegram форма проверена и сохранена в общую таблицу.";
              state.telegramFormReview.isError = false;
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
            if (result.source === "pending-sync") {
              setInfo(
                manual
                  ? "Данные отделения сохранены локально и добавлены в офлайн-очередь."
                  : "Изменения отделения сохранены и ждут синхронизации.",
                false
              );
            }
            state.warning = feedbackWarning || result.warning || "";
            resetPhotoImportAfterSuccessfulSave();
            renderPage();
            if (manual && wasPhotoQueueMode) {
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
      state.warning = result.warning || "";
      if (result.source === "pending-sync") {
        applyLoadedSnapshot(result);
      }
      setInfo(
        result.source === "pending-sync"
          ? "Дата документа сохранена локально и добавлена в офлайн-очередь."
          : "Дата документа сохранена.",
        false
      );
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

  async function persistMainTableChanges() {
    const validation = getMainTableValidationState();
    if (!validation.dirtyRows.length) {
      setInfo("В главной таблице пока нет новых изменений для сохранения.", false);
      refreshMainTableSaveState();
      return;
    }
    if (!validation.isValid) {
      setInfo(validation.message, true);
      refreshMainTableSaveState();
      return;
    }
    if (state.mainTableSaveInFlight) {
      return;
    }

    state.mainTableSaveInFlight = true;
    refreshMainTableSaveState();
    const saveId = ++state.mainTableSaveSequence;
    syncCurrentReportDate();
    setInfo(`Сохраняю главную таблицу: строк ${validation.dirtyRows.length}...`, false);

    try {
      let lastResult = null;

      for (const row of validation.dirtyRows) {
        const expectedValues = config.normalizeRowValues(row.values);
        if (isQhCalcDepartment(row)) {
          syncQhBaseValuesFromCurrentValues(expectedValues);
        }
        const payloadValues = deepCopy(expectedValues);
        const result = await sync.saveDepartmentFromMain(row.id, state.snapshot.reportDate, payloadValues);
        const verification = verifySavedRowResult(row.id, expectedValues, result.snapshot);
        if (!verification.ok) {
          throw new Error(verification.reason);
        }
        lastResult = result;
      }

      if (saveId !== state.mainTableSaveSequence || !lastResult) {
        return;
      }

      applyLoadedSnapshot(lastResult);
      const savedRecord = captureMainTableSavedSnapshot(state.snapshot);
      setInfo(
        lastResult.source === "pending-sync"
          ? savedRecord
            ? `Главная таблица сохранена локально и добавлена в офлайн-очередь. Снимок: ${savedRecord.dateLabel} ${savedRecord.slotLabel}.`
            : "Главная таблица сохранена локально и добавлена в офлайн-очередь."
          : savedRecord
            ? `Главная таблица сохранена. Снимок: ${savedRecord.dateLabel} ${savedRecord.slotLabel}.`
            : "Главная таблица сохранена.",
        false
      );
      refreshTableData();
    } catch (error) {
      if (saveId !== state.mainTableSaveSequence) {
        return;
      }
      setInfo(error instanceof Error ? error.message : "Не удалось сохранить главную таблицу.", true);
    } finally {
      if (saveId === state.mainTableSaveSequence) {
        state.mainTableSaveInFlight = false;
        refreshMainTableSaveState();
      }
    }
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

  async function runPendingSyncNow(options = {}) {
    const silent = Boolean(options.silent);
    const background = Boolean(options.background);
    const statusBefore = getPendingSyncStatus();
    clearBackgroundPendingSyncSchedule();
    if (!statusBefore.hasPending) {
      if (!silent) {
        setInfo("Очередь синхронизации пуста.", false);
      }
      refreshTableData();
      return {
        ok: true,
        syncedCount: 0,
        remainingCount: 0
      };
    }
    if (!sync.hasRemoteSync()) {
      const message = "Для отправки накопленных изменений включите онлайн-режим.";
      if (!silent) {
        setInfo(message, true);
      }
      refreshTableData();
      return {
        ok: false,
        error: message,
        remainingCount: statusBefore.count
      };
    }

    if (!silent) {
      setInfo(`Синхронизирую накопленные изменения: ${statusBefore.count}...`, false);
    }
    refreshTableData();

    try {
      const result = await sync.syncPendingChanges();
      const syncedCount = Number(result?.syncedCount) || statusBefore.count;
      state.pendingSyncAutoRetryAfter = 0;

      if (!background || !hasBlockingLocalWorkForBackgroundSync()) {
        const reloaded = await sync.loadSnapshot();
        applyLoadedSnapshot(reloaded);
        restorePendingMainSaveNotice();

        if (mode === "feedback") {
          await loadFeedbackRecords(false);
        }
        if (mode === "department") {
          await maybeLoadTelegramFeedbackValues();
          cancelAutoAppliedTelegramSelectionIfNeeded();
          await maybeLoadStoredDepartmentPhotoAdjusted();
          await maybeAutoRecognizeLoadedTelegramPhoto();
        }

        if (!silent) {
          setInfo(syncedCount > 0 ? `Накопленные изменения отправлены на сервер: ${syncedCount}.` : "Очередь синхронизации пуста.", false);
        }
        renderPage();
      } else {
        if (state.source === "pending-sync") {
          state.source = "remote";
        }
        if (typeof state.warning === "string" && state.warning) {
          state.warning = "";
        }
        restorePendingMainSaveNotice();
        refreshTableData();
        if (!silent) {
          setInfo(syncedCount > 0 ? `Накопленные изменения отправлены на сервер: ${syncedCount}.` : "Очередь синхронизации пуста.", false);
        }
      }
      return {
        ok: true,
        syncedCount,
        remainingCount: getPendingSyncStatus().count
      };
    } catch (error) {
      try {
        if (!background || !hasBlockingLocalWorkForBackgroundSync()) {
          const reloaded = await sync.loadSnapshot();
          applyLoadedSnapshot(reloaded);
        }
      } catch (_reloadError) {
      }

      const message = error instanceof Error ? error.message : "Не удалось синхронизировать накопленные изменения.";
      state.pendingSyncAutoRetryAfter = Date.now() + AUTO_PENDING_SYNC_RETRY_MS;
      if (!silent) {
        setInfo(message, true);
      } else {
        refreshTableData();
      }

      if (!background && mode === "feedback") {
        await loadFeedbackRecords(false);
      }
      if (!background) {
        renderPage();
      } else {
        scheduleBackgroundPendingSync({
          delayMs: AUTO_PENDING_SYNC_RETRY_MS
        });
      }
      return {
        ok: false,
        error: message,
        remainingCount: getPendingSyncStatus().count
      };
    }
  }

  async function refreshFromSource() {
    if (blockPhotoImportDraftAction("Сначала сохраните распознанные значения, потом обновите данные с сервера.")) {
      return;
    }
    if (mode === "main" && hasMainTablePendingLocalChanges()) {
      setInfo("Сначала сохраните изменения главной таблицы, потом обновляйте данные с сервера.", true);
      return;
    }

    syncCurrentReportDate();
    setInfo("Обновляю данные...", false);
    const result = await sync.loadSnapshot();
    applyLoadedSnapshot(result);
    state.photoImport = buildInitialPhotoImportState();
    state.telegramFormReview = buildInitialTelegramFormReviewState();
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
    if (mode === "department") {
      await maybeLoadTelegramFeedbackValues();
      cancelAutoAppliedTelegramSelectionIfNeeded();
      await maybeLoadStoredDepartmentPhotoAdjusted();
    }
  }

  function handleResetDepartment() {
    const currentRow = getCurrentRow();
    if (!currentRow) {
      return;
    }

    currentRow.values = deepCopy(config.zeroValues());
    if (!areDepartmentMorningCellsUnlocked()) {
      resetDepartmentRowValuesFromLoaded(DEPARTMENT_MORNING_CONTROL_KEYS);
    }
    state.photoImport = buildInitialPhotoImportState();
    renderPage();
    setInfo("Fields reset to 0. Save to send the update.", false);
    if (!areDepartmentMorningCellsUnlocked()) {
      setInfo("Fields reset to 0, and cells 1-3 stayed on the saved morning values.", false);
    }
    return;
  }

  function attachCommonEvents() {
    const zoomRange = document.getElementById("zoomRange");
    const printBtn = document.getElementById("printBtn");
    const refreshBtn = document.getElementById("refreshBtn");
    const pendingSyncBtn = document.getElementById("pendingSyncBtn");
    const sendTelegramPdfsBtn = document.getElementById("sendTelegramPdfsBtn");
    const sendShiftFormButtons = Array.from(document.querySelectorAll("[data-send-shift-form]"));
    const resetBtn = document.getElementById("resetBtn");
    const saveBtn = document.getElementById("saveBtn");
    const mainSaveBtn = document.getElementById("mainSaveBtn");
    const accessCodeField = document.getElementById("accessCodeField");
    const accessForm = document.getElementById("departmentAccessForm");
    const sheetBody = document.getElementById("sheetBody");
    const qhCalcPanel = document.getElementById("qhCalcPanel");
    const qhCalcApplyBtn = document.getElementById("qhCalcApplyBtn");
    const departmentCombinedCalcApplyBtn = document.getElementById("departmentCombinedCalcApplyBtn");
    const transferCalcPanel = document.getElementById("transferCalcPanel");
    const transferCalcApplyBtn = document.getElementById("transferCalcApplyBtn");
    const mainCalcDepartmentSelect = document.getElementById("mainCalcDepartmentSelect");
    const shiftAutoTransferToggle = document.getElementById("shiftAutoTransferToggle");
    const applyDayShiftNowBtn = document.getElementById("applyDayShiftNowBtn");
    const applyDischargeShiftNowBtn = document.getElementById("applyDischargeShiftNowBtn");

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

    sendShiftFormButtons.forEach((shiftFormButton) => {
      shiftFormButton.addEventListener("click", async () => {
        const button = shiftFormButton instanceof HTMLButtonElement ? shiftFormButton : null;
        const mode = shiftFormButton.getAttribute("data-send-shift-form") || "night";
        const label = mode === "day" ? "дневной смены"
          : mode === "discharge" ? "утренней выписки"
            : "ночной смены";
        if (button) {
          button.disabled = true;
        }

        setInfo(`Отправляю Telegram форму ${label}...`, false);
        try {
          if (typeof sync.sendShiftFormToTelegram !== "function") {
            throw new Error("Отправка Telegram формы пока недоступна.");
          }
          const result = await sync.sendShiftFormToTelegram(mode);
          const sent = result && result.result && typeof result.result.sent === "number"
            ? result.result.sent
            : 0;
          setInfo(`Telegram форма ${label} отправлена. Получателей: ${sent}.`, false);
        } catch (error) {
          setInfo(error instanceof Error ? error.message : "Не удалось отправить Telegram форму.", true);
        } finally {
          if (button) {
            button.disabled = false;
          }
        }
      });
    });

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

    if (mainSaveBtn) {
      mainSaveBtn.addEventListener("click", () => {
        void persistMainTableChanges();
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

    document.querySelectorAll("[data-delete-feedback]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button instanceof HTMLButtonElement) {
          handleDeleteDepartmentFeedback(button);
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
        openPhotoLightbox(state.mainPhotoRoute?.imageDataUrl || "", "Фото для определения отделения", "main-route");
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

    const applyPhotoSourceBtn = document.getElementById("applyPhotoSourceBtn");
    if (applyPhotoSourceBtn) {
      applyPhotoSourceBtn.addEventListener("click", () => {
        handleApplyPhotoSourceToDepartment();
      });
    }

    const applyTelegramSourceBtn = document.getElementById("applyTelegramSourceBtn");
    if (applyTelegramSourceBtn) {
      applyTelegramSourceBtn.addEventListener("click", () => {
        handleApplyTelegramSourceToDepartment();
      });
    }

    document.querySelectorAll("[data-photo-preview-key]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }
        const key = target.dataset.photoPreviewKey;
        if (!key) {
          return;
        }
        const sanitized = target.closest(".photo-lightbox")
          ? handlePhotoLightboxPreviewEdit(key, target.value)
          : handlePhotoImportPreviewEdit(key, target.value);
        target.value = sanitized.text;
      });
    });

    const departmentTopCellsToggle = document.getElementById("departmentTopCellsToggle");
    if (departmentTopCellsToggle instanceof HTMLInputElement) {
      departmentTopCellsToggle.addEventListener("change", () => {
        handleDepartmentMorningLockToggle(departmentTopCellsToggle.checked);
      });
    }

    const mainTableEditToggle = document.getElementById("mainTableEditToggle");
    if (mainTableEditToggle instanceof HTMLInputElement) {
      mainTableEditToggle.addEventListener("change", () => {
        handleMainTableEditToggle(mainTableEditToggle.checked);
      });
    }

    const photoZoomBtn = document.getElementById("photoZoomBtn");
    if (photoZoomBtn) {
      photoZoomBtn.addEventListener("click", () => {
        openPhotoLightbox(state.photoImport?.imageDataUrl || "", "Photo", "photo-import", state.photoImport?.feedbackId || "");
      });
    }

    document.querySelectorAll("[data-photo-zoom-trigger]").forEach((image) => {
      image.addEventListener("click", () => {
        const kind = image.getAttribute("data-photo-zoom-trigger");
        if (kind === "main") {
          openPhotoLightbox(state.mainPhotoRoute?.imageDataUrl || "", "Фото для определения отделения", "main-route");
          return;
        }
        openPhotoLightbox(state.photoImport?.imageDataUrl || "", "Photo", "photo-import", state.photoImport?.feedbackId || "");
      });
    });

    bindMainTablePhotoGalleryEvents(document);

    const mainTablePhotoGalleryDeleteAllBtn = document.getElementById("mainTablePhotoGalleryDeleteAllBtn");
    if (mainTablePhotoGalleryDeleteAllBtn) {
      mainTablePhotoGalleryDeleteAllBtn.addEventListener("click", () => {
        void handleDeleteAllMainTablePhotoGalleryFeedback(mainTablePhotoGalleryDeleteAllBtn);
      });
    }

    if (pendingSyncBtn) {
      pendingSyncBtn.addEventListener("click", () => {
        void runPendingSyncNow();
      });
    }

    if (shiftAutoTransferToggle instanceof HTMLInputElement) {
      shiftAutoTransferToggle.addEventListener("change", () => {
        writeShiftAutoTransferEnabled(shiftAutoTransferToggle.checked);
        refreshTableData();
        if (shiftAutoTransferToggle.checked) {
          void maybeAutoTransferShiftDrafts();
        }
      });
    }

    if (applyDayShiftNowBtn instanceof HTMLButtonElement) {
      applyDayShiftNowBtn.addEventListener("click", () => {
        void transferShiftDraftToMain("day", { automatic: false });
      });
    }

    if (applyDischargeShiftNowBtn instanceof HTMLButtonElement) {
      applyDischargeShiftNowBtn.addEventListener("click", () => {
        void transferShiftDraftToMain("discharge", { automatic: false });
      });
    }

    const mainTableTelegramFormDeleteAllBtn = document.getElementById("mainTableTelegramFormDeleteAllBtn");
    if (mainTableTelegramFormDeleteAllBtn) {
      mainTableTelegramFormDeleteAllBtn.addEventListener("click", () => {
        void handleDeleteAllMainTableTelegramForms(mainTableTelegramFormDeleteAllBtn);
      });
    }

    const photoLightboxClose = document.getElementById("photoLightboxClose");
    if (photoLightboxClose) {
      photoLightboxClose.addEventListener("click", () => {
        closePhotoLightbox();
      });
    }

    const photoLightboxRotate = document.getElementById("photoLightboxRotate");
    if (photoLightboxRotate) {
      photoLightboxRotate.addEventListener("click", () => {
        void handleRotatePhotoLightbox();
      });
    }

    const photoLightboxRecheck = document.getElementById("photoLightboxRecheck");
    if (photoLightboxRecheck) {
      photoLightboxRecheck.addEventListener("click", () => {
        void handlePhotoLightboxRecheck();
      });
    }

    const photoLightboxDepartmentSelect = document.getElementById("photoLightboxDepartmentSelect");
    if (photoLightboxDepartmentSelect instanceof HTMLSelectElement) {
      photoLightboxDepartmentSelect.addEventListener("change", () => {
        handlePhotoLightboxDepartmentChange(photoLightboxDepartmentSelect.value);
      });
    }

    const photoLightboxReassignBtn = document.getElementById("photoLightboxReassignBtn");
    if (photoLightboxReassignBtn) {
      photoLightboxReassignBtn.addEventListener("click", () => {
        void handlePhotoLightboxReassignDepartment();
      });
    }

    const photoLightboxSaveBtn = document.getElementById("photoLightboxSaveBtn");
    if (photoLightboxSaveBtn) {
      photoLightboxSaveBtn.addEventListener("click", () => {
        void handlePhotoLightboxSave();
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

    attachMainTableSavedNavigatorEvents();

    const departmentPdfArchiveSelect = document.getElementById("departmentPdfArchiveSelect");
    if (departmentPdfArchiveSelect) {
      departmentPdfArchiveSelect.addEventListener("change", () => {
        state.selectedDepartmentPdfArchiveKey = departmentPdfArchiveSelect.value || "";
        syncDepartmentPdfArchivePickerUi();
      });
    }

    const departmentPdfArchiveDateSelect = document.getElementById("departmentPdfArchiveDateSelect");
    if (departmentPdfArchiveDateSelect) {
      departmentPdfArchiveDateSelect.addEventListener("change", () => {
        state.selectedDepartmentPdfArchiveDate = departmentPdfArchiveDateSelect.value || "";
        syncMainDepartmentPdfArchivePickerUi();
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
        if (!hasPhotoImportDraft() && !(mode === "main" && hasMainTablePendingLocalChanges())) {
          return;
        }

        event.preventDefault();
        event.returnValue = "";
      });
      window.__sharshPhotoDraftGuardBound = true;
    }

    if (qhCalcPanel) {
      qhCalcPanel.addEventListener("input", (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) {
          return;
        }

        const key = input.dataset.qhCalcKey;
        if (!key) {
          return;
        }

        const row = getDepartmentCalcTargetRow();
        if (!row) {
          return;
        }

        const sanitized = sanitizeNumericInput(input.value);
        const normalizedValue = normalizeQhCalcInputValue(row, key, sanitized.value);
        input.value = normalizedValue === null || typeof normalizedValue === "undefined" ? sanitized.text : String(normalizedValue);
        row.values[key] = normalizedValue;
        if (key === "currentShar" || key === "currentSpa" || key === "currentPaym") {
          syncDepartmentRowInput(row.id, key, normalizedValue);
        }
        refreshQhCalcDisplay(row);
        if (mode === "department") {
          queueDepartmentSave();
        } else if (mode === "main") {
          refreshMainTableSaveState();
        }
      });
    }

    const leaveCalcPanel = document.getElementById("leaveCalcPanel");
    if (leaveCalcPanel) {
      leaveCalcPanel.addEventListener("input", (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) {
          return;
        }

        const key = input.dataset.leaveCalcKey;
        if (!key) {
          return;
        }

        const row = getDepartmentCalcTargetRow();
        if (!row) {
          return;
        }

        const sanitized = sanitizeNumericInput(input.value);
        const normalizedValue = normalizeLeaveCalcInputValue(row, key, sanitized.value);
        input.value = normalizedValue === null || typeof normalizedValue === "undefined" ? sanitized.text : String(normalizedValue);
        row.values[key] = normalizedValue;
        refreshLeaveCalcDisplay(row);
        if (mode === "department") {
          queueDepartmentSave();
        } else if (mode === "main") {
          refreshMainTableSaveState();
        }
      });
    }

    if (transferCalcPanel) {
      transferCalcPanel.addEventListener("input", (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) {
          return;
        }

        const key = input.dataset.transferCalcKey;
        if (!key) {
          return;
        }

        const row = getDepartmentCalcTargetRow();
        if (!row) {
          return;
        }

        const sanitized = sanitizeNumericInput(input.value);
        const normalizedValue = normalizeTransferCalcInputValue(row, key, sanitized.value);
        input.value = normalizedValue === null || typeof normalizedValue === "undefined" ? sanitized.text : String(normalizedValue);
        row.values[key] = normalizedValue;
        refreshTransferCalcDisplay(row);
        if (mode === "department") {
          queueDepartmentSave();
        } else if (mode === "main") {
          refreshMainTableSaveState();
        }
      });
    }

    if (qhCalcApplyBtn) {
      qhCalcApplyBtn.addEventListener("click", () => {
        const row = getDepartmentCalcTargetRow();
        if (shouldApplyDepartmentCombinedCalcFromPendingPanels(row)) {
          applyDepartmentCombinedCalc();
          return;
        }
        applyQhCalcToDepartment();
      });
    }

    const leaveCalcApplyBtn = document.getElementById("leaveCalcApplyBtn");
    if (leaveCalcApplyBtn) {
      leaveCalcApplyBtn.addEventListener("click", () => {
        const row = getDepartmentCalcTargetRow();
        if (shouldApplyDepartmentCombinedCalcFromPendingPanels(row)) {
          applyDepartmentCombinedCalc();
          return;
        }
        applyLeaveCalcToDepartment();
      });
    }

    if (transferCalcApplyBtn) {
      transferCalcApplyBtn.addEventListener("click", () => {
        const row = getDepartmentCalcTargetRow();
        if (shouldApplyDepartmentCombinedCalcFromPendingPanels(row)) {
          applyDepartmentCombinedCalc();
          return;
        }
        applyTransferCalcToDepartment();
      });
    }

    if (departmentCombinedCalcApplyBtn) {
      departmentCombinedCalcApplyBtn.addEventListener("click", () => {
        applyDepartmentCombinedCalc();
      });
    }

    if (mainCalcDepartmentSelect instanceof HTMLSelectElement) {
      mainCalcDepartmentSelect.addEventListener("change", () => {
        state.selectedMainCalcDepartmentId = String(mainCalcDepartmentSelect.value || "").trim();
        renderPage();
      });
    }

    if (mode === "main" && sheetBody) {
      sheetBody.addEventListener("click", (event) => {
        if (state.mainTableUnlocked) {
          return;
        }
        if (event.defaultPrevented || event.button !== 0) {
          return;
        }

        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        if (target.closest("a, button, input, textarea, select, label")) {
          return;
        }

        const rowEl = target.closest("tr[data-open-department-path]");
        if (!(rowEl instanceof HTMLTableRowElement)) {
          return;
        }

        const departmentPath = rowEl.getAttribute("data-open-department-path") || "";
        if (!departmentPath) {
          return;
        }

        window.location.href = departmentPath;
      });

      sheetBody.addEventListener("input", (event) => {
        if (!state.mainTableUnlocked) {
          return;
        }

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
        if (isQhCalcDepartment(row) && QH_CALC_CURRENT_KEYS.has(key)) {
          syncQhBaseValuesFromCurrentRow(row);
        }
        refreshComputedCells();
        refreshMainTableSaveState();
      });
    }

    if (sheetBody) {
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

    if (!sheetBody) {
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
      if (mode === "department" && isDepartmentMorningControlledKey(key) && !areDepartmentMorningCellsUnlocked()) {
        input.value = getDisplayValue(getEffectiveValue(state.snapshot, row, key)) || "0";
        return;
      }

      const sanitized = sanitizeNumericInput(input.value);
      input.value = sanitized.text;
      row.values[key] = sanitized.value;
      if (isQhCalcDepartment(row) && QH_CALC_CURRENT_KEYS.has(key)) {
        syncQhBaseValuesFromCurrentRow(row);
      }
      refreshTableData();
      if (mode === "department") {
        queueDepartmentSave();
      } else if (mode === "main") {
        refreshMainTableSaveState();
      }
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
      if (mode === "main" && (state.mainTableUnlocked || hasMainTablePendingLocalChanges())) {
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
          await maybeLoadTelegramFeedbackValues();
          cancelAutoAppliedTelegramSelectionIfNeeded();
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
      state.departmentPdfArchiveRecords = readDepartmentPdfArchiveRecords();
      const hasPrintableArchive = archiveKeyFromQuery
        ? Boolean(getArchiveRecordByKey(archiveKeyFromQuery))
        : departmentArchiveKeyFromQuery
          ? Boolean(getDepartmentPdfArchiveRecordByKey(departmentArchiveKeyFromQuery))
          : departmentArchiveDateFromQuery
            ? getDepartmentPdfArchiveRecordsForDate(departmentArchiveDateFromQuery).length > 0
            : false;
      state.initialized = true;
      state.info = "";
      renderPage();
      if (archiveAutoPrint && hasPrintableArchive) {
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
    bindBackgroundPendingSyncEvents();
    bindShiftTransferEvents();
    void refreshDepartmentPdfArchiveRecordsFromRemote();
    startAutoRefreshIfNeeded();
    startFreshnessTicker();
    startClockTicker();
    scheduleBackgroundPendingSync({
      delayMs: AUTO_PENDING_SYNC_DELAY_MS
    });
    await maybeResumeTransferredPhotoImport();
    await maybeLoadTelegramFeedbackPhotoAdjusted();
    await maybeLoadTelegramFeedbackValues();
    cancelAutoAppliedTelegramSelectionIfNeeded();
    await maybeLoadStoredDepartmentPhotoAdjusted();
    await maybeAutoRecognizeLoadedTelegramPhoto();
  }

  function refreshLeaveCalcDisplay(row) {
    if (!row) {
      return;
    }

    LEAVE_CALC_COLUMNS.forEach((column) => {
      document.querySelectorAll(`[data-leave-calc-base="${column.leaveKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(getNumber(state.snapshot, row, column.leaveKey)) || "0";
      });
      document.querySelectorAll(`[data-leave-calc-output="${column.leaveKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(calcLeaveRemainingValue(row, column.type)) || "0";
      });
      document.querySelectorAll(`[data-leave-calc-output="${column.presentKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(calcLeavePresentValue(row, column.type)) || "0";
      });

      [column.sentKey, column.returnedKey].forEach((key) => {
        const constraint = getLeaveCalcConstraint(row, key);
        const displayValue = getDisplayValue(
          normalizeLeaveCalcInputValue(row, key, getLeaveCalcSourceValue(row, key))
        ) || "0";

        document.querySelectorAll(`[data-leave-calc-key="${key}"]`).forEach((element) => {
          if (!(element instanceof HTMLInputElement)) {
            return;
          }

          if (document.activeElement !== element) {
            element.value = displayValue;
          }
          element.max = constraint ? String(constraint.limit) : "";
          element.disabled = Boolean(constraint && constraint.blocked);
          element.title = getLeaveCalcConstraintTitle(constraint);
          const cell = element.closest(".qh-calc-cell");
          if (cell) {
            cell.classList.toggle("qh-calc-cell--blocked", Boolean(constraint && constraint.blocked));
          }
        });
      });
    });

    const status = document.getElementById("leaveCalcStatus");
    if (!status) {
      return;
    }

    const invalidColumns = LEAVE_CALC_COLUMNS.filter((column) =>
      (calcLeaveRemainingValue(row, column.type) || 0) < 0
      || (calcLeavePresentValue(row, column.type) || 0) < 0
    );
    status.className = `qh-calc-status${invalidColumns.length ? " qh-calc-status--bad" : ""}`;
    status.innerHTML = invalidColumns.length
      ? invalidColumns.map((column) => (
        `<div>${escapeHtml(`${column.label}: չի կարող լինել բացասական արժեք`)}</div>`
      )).join("")
      : "";
  }

  function getSyncDescription() {
    if (state.source === "remote") {
      return "Данные объединяются между компьютерами через интернет.";
    }
    if (state.source === "pending-sync") {
      return "Часть изменений ещё не отправлена на сервер. Они сохранены локально и ждут синхронизации.";
    }
    if (state.source === "local-cache") {
      return "Сейчас показан локальный кэш. Сервер временно недоступен.";
    }
    return "Сейчас включён локальный режим. Между разными компьютерами данные ещё не объединяются.";
  }

  function getPendingSyncButtonLabel(status = getPendingSyncStatus()) {
    if (status.isSyncing) {
      return status.count > 0 ? `Синхр. накопл. (${status.count})...` : "Синхр. накопл....";
    }
    return status.count > 0 ? `Синхр. накопл. (${status.count})` : "Синхр. накопл.";
  }

  function getPendingSyncSummaryText(status = getPendingSyncStatus()) {
    if (status.hasPending) {
      if (!sync.hasRemoteSync()) {
        return `В очереди: ${status.count}. Сейчас оффлайн-режим, поэтому изменения ждут отправки.`;
      }
      return `В очереди: ${status.count}. Очередь отправится автоматически в фоне, а кнопка остаётся для ручной синхронизации.`;
    }
    if (status.lastSyncedAt) {
      return `Очередь пуста. Последняя успешная синхронизация: ${formatTimestamp(status.lastSyncedAt)}.`;
    }
    return sync.hasRemoteSync()
      ? "Очередь синхронизации пуста. Фоновая автосинхронизация включена."
      : "Сейчас оффлайн-режим. Новые изменения будут накапливаться локально.";
  }

  function getPendingSyncErrorText(status = getPendingSyncStatus()) {
    if (status.lastError) {
      return `Последняя ошибка синхронизации: ${status.lastError}`;
    }
    if (status.hasPending && !sync.hasRemoteSync()) {
      return "Чтобы отправить накопленные изменения, переключитесь в онлайн-режим.";
    }
    return "";
  }

  function renderPendingSyncControls() {
    const status = getPendingSyncStatus();
    const errorText = getPendingSyncErrorText(status);
    return `
      <div class="pending-sync-panel">
        <div class="pending-sync-panel__copy">
          <strong>Оффлайн-очередь</strong>
          <p id="pendingSyncSummaryText">${escapeHtml(getPendingSyncSummaryText(status))}</p>
          <p class="hint${errorText ? " warning-note" : ""}" id="pendingSyncErrorText">${escapeHtml(errorText)}</p>
        </div>
        <button
          type="button"
          id="pendingSyncBtn"
          class="pending-sync-panel__button${status.hasPending && sync.hasRemoteSync() && !status.isSyncing ? " save-ready" : ""}"
          ${(status.hasPending && !status.isSyncing && sync.hasRemoteSync()) ? "" : "disabled"}
        >${escapeHtml(getPendingSyncButtonLabel(status))}</button>
      </div>
    `;
  }

  function refreshTransferCalcDisplay(row, snapshot = state.snapshot) {
    if (!row) {
      return;
    }

    TRANSFER_CALC_COLUMNS.forEach((column) => {
      document.querySelectorAll(`[data-transfer-calc-base="${column.currentKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(getNumber(snapshot, row, column.currentKey)) || "0";
      });
      document.querySelectorAll(`[data-transfer-calc-output="${column.outputKey}"]`).forEach((element) => {
        element.textContent = getDisplayValue(calcTransferRemainingValue(row, column.type, snapshot)) || "0";
      });

      [column.incomingKey, column.outgoingKey].forEach((key) => {
        const constraint = getTransferCalcConstraint(row, key, snapshot);
        const displayValue = getTransferCalcDisplayValue(row, key, snapshot) || "0";
        document.querySelectorAll(`[data-transfer-calc-key="${key}"]`).forEach((element) => {
          if (!(element instanceof HTMLInputElement)) {
            return;
          }

          if (document.activeElement !== element) {
            element.value = displayValue;
          }
          element.max = constraint ? String(constraint.limit) : "";
          element.disabled = Boolean(constraint && constraint.blocked);
          element.title = constraint ? getTransferCalcConstraintTitle(constraint) : "";
          const cell = element.closest(".qh-calc-cell");
          if (cell) {
            cell.classList.toggle("qh-calc-cell--blocked", Boolean(constraint && constraint.blocked));
          }
        });
      });
    });

    const statusEl = document.getElementById("transferCalcStatus");
    if (!statusEl) {
      return;
    }

    const invalidColumns = getTransferCalcInvalidColumns(row, snapshot);
    if (invalidColumns.length) {
      statusEl.textContent = `Расчёт переводов не может быть применён: по категориям ${invalidColumns.map((column) => column.label).join(", ")} получается отрицательный остаток.`;
      statusEl.className = "qh-calc-status qh-calc-status--invalid";
      return;
    }

    statusEl.textContent = "";
    statusEl.className = "qh-calc-status";
  }

  window.SHARSH_APP_API = {
    syncPendingChanges: runPendingSyncNow,
    getPendingSyncStatus
  };

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
