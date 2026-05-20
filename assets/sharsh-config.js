(function () {
  const STORAGE_NAMESPACE = "sarsh-kkzh-v2";
  const LEGACY_MAIN_STORAGE_KEY = "sharsh-kkzh-05-05-26-zero-v1";
  const LEGACY_ZOOM_STORAGE_KEY = `${LEGACY_MAIN_STORAGE_KEY}-zoom`;
  const DEFAULT_DATE = "05,05,26";
  const MAIN_PAGE_FILENAME = "index.html";
  const MAIN_BLANK_PDF_FILENAME = "Общий бланк отделений.pdf";
  const SETUP_PAGE_FILENAME = "setup.html";
  const FEEDBACK_PAGE_FILENAME = "ocr-feedback.html";
  const DEPARTMENT_DIRECTORY = "bgej6lyx";
  const DEPARTMENT_BLANKS_DIRECTORY = "Отделения";

  const columns = [
    "beenTotal",
    "beenSoldier",
    "beenSeries",
    "admittedTotal",
    "admittedSoldier",
    "admittedSeries",
    "dgTotal",
    "dgSoldier",
    "dgSeries",
    "transferFromDepartment",
    "transferToDepartment",
    "presentTotal",
    "currentShar",
    "currentSpa",
    "currentPaym",
    "currentZh",
    "family",
    "officer",
    "civil",
    "leaveSharq",
    "leaveSpa",
    "leavePaym",
    "leaveTotal"
  ];

  const valueKeys = [
    "beenTotal",
    "beenSoldier",
    "beenSeries",
    "admittedTotal",
    "admittedSoldier",
    "admittedSeries",
    "dgTotal",
    "dgSoldier",
    "dgSeries",
    "transferFromDepartment",
    "transferToDepartment",
    "currentShar",
    "currentSpa",
    "currentPaym",
    "currentZh",
    "family",
    "officer",
    "civil",
    "leaveSharq",
    "leaveSpa",
    "leavePaym",
    "qhBaseSoldier",
    "qhBaseOfficer",
    "qhBaseContract",
    "qhIncomingSoldier",
    "qhIncomingOfficer",
    "qhIncomingContract",
    "qhDischargedSoldier",
    "qhDischargedOfficer",
    "qhDischargedContract"
  ];

  const primaryEditableKeys = [
    "beenTotal", "beenSoldier", "beenSeries",
    "admittedTotal", "admittedSoldier", "admittedSeries",
    "dgTotal", "dgSoldier", "dgSeries",
    "currentShar", "currentSpa", "currentPaym", "currentZh",
    "family", "officer", "civil",
    "leaveSharq", "leaveSpa", "leavePaym"
  ];

  const extraEditableKeys = [
    "beenTotal", "beenSoldier", "beenSeries",
    "admittedTotal", "admittedSoldier", "admittedSeries",
    "dgTotal", "dgSoldier", "dgSeries",
    "currentShar", "currentSpa", "currentPaym", "currentZh",
    "family", "officer", "civil",
    "leaveSharq", "leaveSpa", "leavePaym"
  ];

  const primaryPresentKeys = [
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

  const extraPresentKeys = [
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

  const departmentDefinitions = [
    {
      id: "r4",
      slug: "te9625wg",
      marker: "SR-4",
      group: "primary",
      department: "Վիրաբուժական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r5",
      slug: "1ei6dnv2",
      marker: "SR-5",
      group: "primary",
      department: "Դ/Ծ վ/բ բաժանմունք",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r6",
      slug: "du9wa6oq",
      marker: "SR-6",
      group: "primary",
      department: "Քիթ-կոկորդ բ-ք",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r7",
      slug: "08xa44ew",
      marker: "SR-7",
      group: "primary",
      department: "Ակնաբուժական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r8",
      slug: "v1914tm9",
      marker: "SR-8",
      group: "primary",
      department: "Վնասվածքաբանական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r9",
      slug: "c3usp3r9",
      marker: "SR-9",
      group: "primary",
      department: "Կրծքային վ/բ",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r10",
      slug: "g5u3jca0",
      marker: "SR-10",
      group: "primary",
      department: "Ուռոլոգիական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r11",
      slug: "4k6uv2xu",
      marker: "SR-11",
      group: "primary",
      department: "Նեյրովիրաբուժական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r12",
      slug: "ltndeohl",
      marker: "SR-12",
      group: "primary",
      department: "Թռիչքային",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r13",
      slug: "ptf9nvbv",
      marker: "SR-13",
      group: "primary",
      department: "Թերապիա",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r14",
      slug: "9htuxle8",
      marker: "SR-14",
      group: "primary",
      department: "Վերակենդանացման",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r15",
      slug: "ldvp99z7",
      marker: "SR-15",
      group: "primary",
      department: "Նյարդաբանական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r16",
      slug: "zzphaoqo",
      marker: "SR-16",
      group: "primary",
      department: "Գինեկոլոգիական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r17",
      slug: "4zby7qi3",
      marker: "SR-17",
      group: "primary",
      department: "Անոթային",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r19",
      slug: "c5mv5bh4",
      marker: "SR-19",
      group: "extra",
      department: "ԻՆՖ",
      editableKeys: extraEditableKeys,
      presentKeys: extraPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r20",
      slug: "5s7rrwg9",
      marker: "SR-20",
      group: "extra",
      department: "ԱՏԴ",
      editableKeys: extraEditableKeys,
      presentKeys: extraPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r21",
      slug: "3ofsacp6",
      marker: "SR-21",
      group: "extra",
      department: "Ք/Հ",
      editableKeys: extraEditableKeys,
      presentKeys: extraPresentKeys,
      hasLeaveTotal: true
    }
  ];

  const linkedCells = {};
  const departmentBlankFilesById = {
    r4: { folder: "Վիրաբուժական", file: "Վիրաբուժական.pdf" },
    r5: { folder: "Դիմածնոտային վիր", file: "Դիմածնոտային վիր.pdf" },
    r6: { folder: "Քիթ-կոկորդ բ-ք", file: "Քիթ-կոկորդ բ-ք.pdf" },
    r7: { folder: "Ակնաբուժական", file: "Ակնաբուժական.pdf" },
    r8: { folder: "Վնասվածքաբանական", file: "Վնասվածքաբանական.pdf" },
    r9: { folder: "Կրծքային մ-բ", file: "Կրծքային մ-բ.pdf" },
    r10: { folder: "Ուռոլոգիական", file: "Ուռոլոգիական.pdf" },
    r11: { folder: "Նեյրովիրաբուժական", file: "Նեյրովիրաբուժական.pdf" },
    r12: { folder: "Թռիչքային", file: "Թռիչքային.pdf" },
    r13: { folder: "Թերապիա", file: "Թերապիա.pdf" },
    r14: { folder: "Վերակենդանացման", file: "Վերակենդանացման.pdf" },
    r15: { folder: "Նյարդաբանական", file: "Նյարդաբանական.pdf" },
    r16: { folder: "Գինեկոլոգիական", file: "Գինեկոլոգիական.pdf" },
    r17: { folder: "ԱՆՈԹԱՅԻՆ", file: "ԱՆՈԹԱՅԻՆ.pdf" },
    r19: { folder: "ԻՆՖ", file: "ԻՆՖ.pdf" },
    r20: { folder: "ԱՏԴ", file: "ԱՏԴ.pdf" },
    r21: { folder: "Ք-Հ", file: "Ք-Հ.pdf" }
  };

  const summaryAccentKeys = new Set(["beenSoldier", "presentTotal", "currentShar", "leaveTotal"]);
  const columnOrder = new Map(columns.map((key, index) => [key, index]));
  const departmentById = new Map(departmentDefinitions.map((item) => [item.id, item]));
  const departmentBySlug = new Map(departmentDefinitions.map((item) => [item.slug, item]));
  const departmentByMarker = new Map(
    departmentDefinitions
      .map((item) => [normalizeDepartmentMarker(item.marker || ""), item])
      .filter(([marker]) => marker)
  );

  function normalizeDepartmentMarker(text) {
    return String(text || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function zeroValues() {
    return {
      beenTotal: 0,
      beenSoldier: 0,
      beenSeries: 0,
      admittedTotal: 0,
      admittedSoldier: 0,
      admittedSeries: 0,
      dgTotal: 0,
      dgSoldier: 0,
      dgSeries: 0,
      transferFromDepartment: 0,
      transferToDepartment: 0,
      currentShar: 0,
      currentSpa: 0,
      currentPaym: 0,
      currentZh: 0,
      family: 0,
      officer: 0,
      civil: 0,
      leaveSharq: 0,
      leaveSpa: 0,
      leavePaym: 0,
      qhBaseSoldier: 0,
      qhBaseOfficer: 0,
      qhBaseContract: 0,
      qhIncomingSoldier: 0,
      qhIncomingOfficer: 0,
      qhIncomingContract: 0,
      qhDischargedSoldier: 0,
      qhDischargedOfficer: 0,
      qhDischargedContract: 0
    };
  }

  function normalizeCellValue(value) {
    if (value === "" || value === null || typeof value === "undefined") {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.trunc(parsed));
  }

  function normalizeRowValues(values) {
    const nextValues = zeroValues();
    if (!values || typeof values !== "object") {
      return nextValues;
    }
    valueKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        nextValues[key] = normalizeCellValue(values[key]);
      }
    });
    return nextValues;
  }

  function buildRow(definition, sourceRow) {
    return {
      id: definition.id,
      slug: definition.slug,
      marker: definition.marker || "",
      group: definition.group,
      department: definition.department,
      editableKeys: [...definition.editableKeys],
      presentKeys: [...definition.presentKeys],
      hasLeaveTotal: definition.hasLeaveTotal,
      values: normalizeRowValues(sourceRow && sourceRow.values),
      updatedAt: sourceRow && sourceRow.updatedAt ? String(sourceRow.updatedAt) : null,
      photoWorkflowStatus: sourceRow && sourceRow.photoWorkflowStatus
        ? String(sourceRow.photoWorkflowStatus)
        : "idle",
      photoFeedbackId: sourceRow && sourceRow.photoFeedbackId !== null && typeof sourceRow.photoFeedbackId !== "undefined"
        ? Number(sourceRow.photoFeedbackId)
        : null,
      latestFeedbackId: sourceRow && sourceRow.latestFeedbackId !== null && typeof sourceRow.latestFeedbackId !== "undefined"
        ? Number(sourceRow.latestFeedbackId)
        : null,
      latestTelegramFormFeedbackId: sourceRow && sourceRow.latestTelegramFormFeedbackId !== null && typeof sourceRow.latestTelegramFormFeedbackId !== "undefined"
        ? Number(sourceRow.latestTelegramFormFeedbackId)
        : null,
      photoFeedbackUpdatedAt: sourceRow && sourceRow.photoFeedbackUpdatedAt
        ? String(sourceRow.photoFeedbackUpdatedAt)
        : null,
      photoName: sourceRow && sourceRow.photoName ? String(sourceRow.photoName) : "",
      hasTelegramFormFeedback: Boolean(sourceRow && sourceRow.hasTelegramFormFeedback),
      hasPhotoFeedback: Boolean(sourceRow && sourceRow.hasPhotoFeedback)
    };
  }

  function buildTemplateRows() {
    return departmentDefinitions.map((definition) => buildRow(definition, null));
  }

  function buildDefaultSnapshot() {
    return {
      reportDate: DEFAULT_DATE,
      rows: buildTemplateRows(),
      updatedAt: null
    };
  }

  function buildSnapshotFromSaved(saved) {
    const fallback = buildDefaultSnapshot();
    if (!saved || typeof saved !== "object") {
      return fallback;
    }

    const reportDate = typeof saved.reportDate === "string" && saved.reportDate.trim()
      ? saved.reportDate
      : (typeof saved.date === "string" && saved.date.trim() ? saved.date : DEFAULT_DATE);

    const rawRows = Array.isArray(saved.rows)
      ? saved.rows
      : (Array.isArray(saved.departments)
        ? saved.departments.map((item) => ({
            id: item.id || item.departmentId,
            values: item.values,
            updatedAt: item.updatedAt,
            photoWorkflowStatus: item.photoWorkflowStatus,
            photoFeedbackId: item.photoFeedbackId,
            latestFeedbackId: item.latestFeedbackId,
            latestTelegramFormFeedbackId: item.latestTelegramFormFeedbackId,
            photoFeedbackUpdatedAt: item.photoFeedbackUpdatedAt,
            photoName: item.photoName,
            hasTelegramFormFeedback: item.hasTelegramFormFeedback,
            hasPhotoFeedback: item.hasPhotoFeedback
          }))
        : []);

    const savedRows = new Map(rawRows.map((row) => [row.id, row]));

    return {
      reportDate,
      rows: departmentDefinitions.map((definition) => buildRow(definition, savedRows.get(definition.id))),
      updatedAt: saved.updatedAt ? String(saved.updatedAt) : null
    };
  }

  function getDepartmentById(id) {
    return departmentById.get(id) || null;
  }

  function getDepartmentBySlug(slug) {
    return departmentBySlug.get(slug) || null;
  }

  function detectDepartmentIdFromText(text) {
    if (typeof text !== "string" || !text.trim()) {
      return "";
    }

    const normalized = text.trim();
    const normalizedMarkerText = normalizeDepartmentMarker(normalized);

    if (normalizedMarkerText) {
      for (const [marker, definition] of departmentByMarker.entries()) {
        if (normalizedMarkerText.includes(marker)) {
          return definition.id;
        }
      }
    }

    for (const definition of departmentDefinitions) {
      if (
        normalized.includes(`${definition.slug}.html`)
        || normalized.includes(`${DEPARTMENT_DIRECTORY}/${definition.slug}`)
        || normalized.includes(definition.slug)
      ) {
        return definition.id;
      }
    }

    return "";
  }

  function buildSiteProxyPath(relativePath) {
    return `${window.location.origin}/functions/v1/site?path=${encodeURIComponent(relativePath)}`;
  }

  function getDepartmentPagePath(basePath, departmentId) {
    const definition = getDepartmentById(departmentId);
    if (!definition) {
      return null;
    }
    if (basePath === "@site") {
      return buildSiteProxyPath(`${DEPARTMENT_DIRECTORY}/${definition.slug}.html`);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return `${prefix}${DEPARTMENT_DIRECTORY}/${definition.slug}.html`;
  }

  function getDepartmentBlankPdfPath(basePath, departmentId) {
    const blank = departmentBlankFilesById[departmentId];
    if (!blank) {
      return null;
    }
    const relativePath = `${DEPARTMENT_BLANKS_DIRECTORY}/${blank.folder}/${blank.file}`;
    if (basePath === "@site") {
      return buildSiteProxyPath(relativePath);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return `${prefix}${relativePath}`;
  }

  function getMainPagePath(basePath) {
    if (basePath === "@site") {
      return buildSiteProxyPath(MAIN_PAGE_FILENAME);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return `${prefix}${MAIN_PAGE_FILENAME}`;
  }

  function getMainBlankPdfPath(basePath) {
    const relativePath = `${DEPARTMENT_BLANKS_DIRECTORY}/${MAIN_BLANK_PDF_FILENAME}`;
    if (basePath === "@site") {
      return buildSiteProxyPath(relativePath);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return `${prefix}${relativePath}`;
  }

  function getSetupPagePath(basePath) {
    if (basePath === "@site") {
      return buildSiteProxyPath(SETUP_PAGE_FILENAME);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return `${prefix}${SETUP_PAGE_FILENAME}`;
  }

  function getFeedbackPagePath(basePath) {
    if (basePath === "@site") {
      return buildSiteProxyPath(FEEDBACK_PAGE_FILENAME);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return `${prefix}${FEEDBACK_PAGE_FILENAME}`;
  }

  function getDepartmentStorageKey(departmentId) {
    return `${STORAGE_NAMESPACE}:department:${departmentId}`;
  }

  function getReportDateStorageKey() {
    return `${STORAGE_NAMESPACE}:report-date`;
  }

  function getMainCacheStorageKey() {
    return `${STORAGE_NAMESPACE}:main-cache`;
  }

  function getZoomStorageKey(scope) {
    return `${STORAGE_NAMESPACE}:zoom:${scope}`;
  }

  function getAccessCodeStorageKey(departmentId) {
    return `${STORAGE_NAMESPACE}:access-code:${departmentId}`;
  }

  window.SHARSH_CONFIG = {
    STORAGE_NAMESPACE,
    LEGACY_MAIN_STORAGE_KEY,
    LEGACY_ZOOM_STORAGE_KEY,
    DEFAULT_DATE,
    MAIN_PAGE_FILENAME,
    MAIN_BLANK_PDF_FILENAME,
    SETUP_PAGE_FILENAME,
    FEEDBACK_PAGE_FILENAME,
    DEPARTMENT_DIRECTORY,
    DEPARTMENT_BLANKS_DIRECTORY,
    columns,
    valueKeys,
    summaryAccentKeys,
    columnOrder,
    departmentDefinitions,
    linkedCells,
    deepCopy,
    zeroValues,
    normalizeCellValue,
    normalizeRowValues,
    buildTemplateRows,
    buildDefaultSnapshot,
    buildSnapshotFromSaved,
    getDepartmentById,
    getDepartmentBySlug,
    detectDepartmentIdFromText,
    getDepartmentPagePath,
    getDepartmentBlankPdfPath,
    getMainPagePath,
    getMainBlankPdfPath,
    getSetupPagePath,
    getFeedbackPagePath,
    getDepartmentStorageKey,
    getReportDateStorageKey,
    getMainCacheStorageKey,
    getZoomStorageKey,
    getAccessCodeStorageKey
  };
})();
