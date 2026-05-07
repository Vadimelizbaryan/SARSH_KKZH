(function () {
  const STORAGE_NAMESPACE = "sarsh-kkzh-v2";
  const LEGACY_MAIN_STORAGE_KEY = "sharsh-kkzh-05-05-26-zero-v1";
  const LEGACY_ZOOM_STORAGE_KEY = `${LEGACY_MAIN_STORAGE_KEY}-zoom`;
  const DEFAULT_DATE = "05,05,26";
  const MAIN_PAGE_FILENAME = "ykow8ru3.html";
  const SETUP_PAGE_FILENAME = "eti77ylq.html";
  const DEPARTMENT_DIRECTORY = "bgej6lyx";

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
    "zh",
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
    "zh",
    "family",
    "officer",
    "civil",
    "leaveSharq",
    "leaveSpa",
    "leavePaym"
  ];

  const primaryEditableKeys = [
    "beenTotal", "beenSoldier", "beenSeries",
    "admittedTotal", "admittedSoldier", "admittedSeries",
    "dgTotal", "dgSoldier", "dgSeries",
    "currentShar", "currentSpa", "currentPaym",
    "zh", "family", "officer", "civil",
    "leaveSharq", "leaveSpa", "leavePaym"
  ];

  const extraEditableKeys = [
    "beenTotal", "beenSoldier", "beenSeries",
    "admittedTotal", "admittedSoldier", "admittedSeries",
    "dgTotal", "dgSoldier", "dgSeries",
    "currentShar", "currentSpa", "currentPaym",
    "zh", "family", "officer"
  ];

  const primaryPresentKeys = [
    "currentShar",
    "currentSpa",
    "currentPaym",
    "zh",
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
    "zh",
    "family",
    "officer"
  ];

  const departmentDefinitions = [
    {
      id: "r4",
      slug: "te9625wg",
      group: "primary",
      department: "Վիրաբուժական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r5",
      slug: "1ei6dnv2",
      group: "primary",
      department: "Դ/Ծ վ/բ բաժանմունք",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r6",
      slug: "du9wa6oq",
      group: "primary",
      department: "Քիթ-կոկորդ բ-ք",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r7",
      slug: "08xa44ew",
      group: "primary",
      department: "Ակնաբուժական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r8",
      slug: "v1914tm9",
      group: "primary",
      department: "Վնասվածքաբանական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r9",
      slug: "c3usp3r9",
      group: "primary",
      department: "Կրծքային վ/բ",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r10",
      slug: "g5u3jca0",
      group: "primary",
      department: "Ուռոլոգիական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r11",
      slug: "4k6uv2xu",
      group: "primary",
      department: "Նեյրովիրաբուժական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r12",
      slug: "ltndeohl",
      group: "primary",
      department: "Թռիչքային",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r13",
      slug: "ptf9nvbv",
      group: "primary",
      department: "Թերապիա",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r14",
      slug: "9htuxle8",
      group: "primary",
      department: "Վերակենդանացման",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r15",
      slug: "ldvp99z7",
      group: "primary",
      department: "Նյարդաբանական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r16",
      slug: "zzphaoqo",
      group: "primary",
      department: "Գինեկոլոգիական",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r17",
      slug: "4zby7qi3",
      group: "primary",
      department: "Անոթային",
      editableKeys: primaryEditableKeys,
      presentKeys: primaryPresentKeys,
      hasLeaveTotal: true
    },
    {
      id: "r19",
      slug: "c5mv5bh4",
      group: "extra",
      department: "ԻՆՖ",
      editableKeys: extraEditableKeys,
      presentKeys: extraPresentKeys,
      hasLeaveTotal: false
    },
    {
      id: "r20",
      slug: "5s7rrwg9",
      group: "extra",
      department: "ԱՏԴ",
      editableKeys: extraEditableKeys,
      presentKeys: extraPresentKeys,
      hasLeaveTotal: false
    },
    {
      id: "r21",
      slug: "3ofsacp6",
      group: "extra",
      department: "Ք/Հ",
      editableKeys: extraEditableKeys,
      presentKeys: extraPresentKeys,
      hasLeaveTotal: false
    }
  ];

  const linkedCells = {};

  const summaryAccentKeys = new Set(["beenSoldier", "presentTotal", "currentShar", "leaveTotal"]);
  const columnOrder = new Map(columns.map((key, index) => [key, index]));
  const departmentById = new Map(departmentDefinitions.map((item) => [item.id, item]));

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
      zh: 0,
      family: 0,
      officer: 0,
      civil: 0,
      leaveSharq: 0,
      leaveSpa: 0,
      leavePaym: 0
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
      group: definition.group,
      department: definition.department,
      editableKeys: [...definition.editableKeys],
      presentKeys: [...definition.presentKeys],
      hasLeaveTotal: definition.hasLeaveTotal,
      values: normalizeRowValues(sourceRow && sourceRow.values),
      updatedAt: sourceRow && sourceRow.updatedAt ? String(sourceRow.updatedAt) : null
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
            updatedAt: item.updatedAt
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

  function getMainPagePath(basePath) {
    if (basePath === "@site") {
      return buildSiteProxyPath(MAIN_PAGE_FILENAME);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return `${prefix}${MAIN_PAGE_FILENAME}`;
  }

  function getSetupPagePath(basePath) {
    if (basePath === "@site") {
      return buildSiteProxyPath(SETUP_PAGE_FILENAME);
    }
    const prefix = basePath && basePath !== "." ? `${basePath}/` : "";
    return `${prefix}${SETUP_PAGE_FILENAME}`;
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
    SETUP_PAGE_FILENAME,
    DEPARTMENT_DIRECTORY,
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
    getDepartmentPagePath,
    getMainPagePath,
    getSetupPagePath,
    getDepartmentStorageKey,
    getReportDateStorageKey,
    getMainCacheStorageKey,
    getZoomStorageKey,
    getAccessCodeStorageKey
  };
})();
