// T04: 등록·상태 변경·수정·삭제·localStorage 저장에 더해
// 설명·우선순위·마감일·검색·필터·지연 표시를 구현한다.

const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
const STORAGE_KEY = "task-flow-v1";
const STATUSES = [
  { value: "TODO", label: "할 일" },
  { value: "DOING", label: "진행 중" },
  { value: "DONE", label: "완료" },
];
const PRIORITIES = [
  { value: "HIGH", label: "높음" },
  { value: "NORMAL", label: "보통" },
  { value: "LOW", label: "낮음" },
];
const STATUS_VALUES = STATUSES.map((status) => status.value);
const PRIORITY_VALUES = PRIORITIES.map((priority) => priority.value);
const DEFAULT_STATUS = "TODO";
const DEFAULT_PRIORITY = "NORMAL";

let tasks = [];
// 저장값이 손상되었거나 저장소를 쓸 수 없으면 false가 되어, 저장값을 덮어쓰지 않도록 변경을 막는다.
let canSave = true;
// 수정 중인 항목의 id와 입력 중인 값. 목록을 다시 그려도 입력 중인 값이 사라지지 않게 따로 보관한다.
let editingId = null;
let editDraft = null;
let editError = "";
// 제목 검색·상태·우선순위 필터. 빈 값은 전체를 뜻하며 모든 조건을 AND로 적용한다.
const filters = { query: "", status: "", priority: "" };

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const priorityInput = document.getElementById("task-priority");
const dueDateInput = document.getElementById("task-due-date");
const submitButton = form.querySelector("button[type='submit']");
const formError = document.getElementById("form-error");
const storageError = document.getElementById("storage-error");
const filterQueryInput = document.getElementById("filter-query");
const filterStatusInput = document.getElementById("filter-status");
const filterPriorityInput = document.getElementById("filter-priority");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");

function getLabel(options, value) {
  const option = options.find((item) => item.value === value);
  return option ? option.label : value;
}

function textLength(text) {
  return Array.from(text).length;
}

// 공백 제거 후 1~100자인지 검사한다. 오류가 없으면 빈 문자열을 반환한다.
function validateTitle(title) {
  const length = textLength(title);
  if (length === 0) {
    return "제목을 입력해 주세요.";
  }
  if (length > TITLE_MAX_LENGTH) {
    return `제목은 ${TITLE_MAX_LENGTH}자 이하로 입력해 주세요. (현재 ${length}자)`;
  }
  return "";
}

function validateDescription(description) {
  const length = textLength(description);
  if (length > DESCRIPTION_MAX_LENGTH) {
    return `설명은 ${DESCRIPTION_MAX_LENGTH}자 이하로 입력해 주세요. (현재 ${length}자)`;
  }
  return "";
}

// YYYY-MM-DD 형식이면서 실제 존재하는 날짜인지 검사한다. (예: 2026-02-30은 거절)
function isValidDateString(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

// 폼 입력값을 저장 형식으로 바꾸고 검사한다. 오류가 있으면 error를 반환한다.
function normalizeFields({ title, description, priority, due_date }) {
  const values = {
    title: title.trim(),
    description: description.trim(),
    priority,
    due_date: due_date === "" ? null : due_date,
  };

  const error =
    validateTitle(values.title) ||
    validateDescription(values.description) ||
    (PRIORITY_VALUES.includes(values.priority) ? "" : "우선순위를 선택해 주세요.") ||
    (values.due_date === null || isValidDateString(values.due_date)
      ? ""
      : "마감일은 YYYY-MM-DD 형식의 올바른 날짜로 입력해 주세요.");

  return error ? { error } : { values };
}

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    typeof task.id === "string" &&
    task.id !== "" &&
    typeof task.title === "string" &&
    task.title === task.title.trim() &&
    validateTitle(task.title) === "" &&
    typeof task.description === "string" &&
    validateDescription(task.description) === "" &&
    STATUS_VALUES.includes(task.status) &&
    PRIORITY_VALUES.includes(task.priority) &&
    (task.due_date === null || (typeof task.due_date === "string" && isValidDateString(task.due_date))) &&
    typeof task.created_at === "string"
  );
}

// 이전 단계에서 저장한 항목에 없는 필드만 기본값으로 채운다. 잘못된 값은 채우지 않는다.
function withDefaults(task) {
  if (task === null || typeof task !== "object" || Array.isArray(task)) {
    return task;
  }
  const defaults = {
    description: "",
    status: DEFAULT_STATUS,
    priority: DEFAULT_PRIORITY,
    due_date: null,
  };
  const filled = { ...task };
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in filled)) {
      filled[key] = value;
    }
  }
  return filled;
}

// 저장값을 읽는다. 값이 없으면 빈 목록, 형식이 잘못되었으면 error를 반환한다.
function loadTasks() {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return { error: "브라우저 저장소를 사용할 수 없어 할 일을 저장할 수 없습니다." };
  }

  if (raw === null) {
    return { tasks: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    parsed = undefined;
  }

  const loadedTasks = Array.isArray(parsed) ? parsed.map(withDefaults) : null;
  const ids = new Set();
  const isValid =
    loadedTasks !== null &&
    loadedTasks.every((task) => {
      if (!isValidTask(task) || ids.has(task.id)) {
        return false;
      }
      ids.add(task.id);
      return true;
    });

  if (!isValid) {
    return {
      error:
        `저장된 데이터(${STORAGE_KEY})가 손상되어 불러오지 못했습니다. ` +
        "기존 데이터를 보호하기 위해 등록을 막았습니다.",
    };
  }

  return { tasks: loadedTasks };
}

function saveTasks(nextTasks) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
    return true;
  } catch (error) {
    return false;
  }
}

// 저장에 성공한 경우에만 화면 목록을 바꿔, 화면과 저장값이 어긋나지 않게 한다.
function commitTasks(nextTasks) {
  if (!canSave || !saveTasks(nextTasks)) {
    return false;
  }
  tasks = nextTasks;
  return true;
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// 로컬 달력 날짜를 YYYY-MM-DD로 반환한다. (UTC 기준이면 한국 시간 오전에 날짜가 하루 어긋난다.)
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isOverdue(task, today) {
  return task.due_date !== null && task.due_date < today && task.status !== "DONE";
}

function matchesFilters(task) {
  const query = filters.query.trim().toLowerCase();
  return (
    (query === "" || task.title.toLowerCase().includes(query)) &&
    (filters.status === "" || task.status === filters.status) &&
    (filters.priority === "" || task.priority === filters.priority)
  );
}

function hasActiveFilters() {
  return filters.query.trim() !== "" || filters.status !== "" || filters.priority !== "";
}

function showError(message) {
  formError.textContent = message;
}

function blockSaving(message) {
  canSave = false;
  storageError.textContent = message;
  storageError.hidden = false;
  for (const input of [titleInput, descriptionInput, priorityInput, dueDateInput, submitButton]) {
    input.disabled = true;
  }
}

function createButton(label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  return button;
}

function createSelect(options, value, label) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);
  for (const item of options) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  }
  select.value = value;
  return select;
}

function createBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function renderViewItem(item, task, today) {
  const main = document.createElement("div");
  main.className = "task-main";

  const header = document.createElement("div");
  header.className = "task-header";
  const title = document.createElement("span");
  title.className = "task-title";
  // 사용자 입력은 HTML로 해석하지 않고 글자로만 표시한다.
  title.textContent = task.title;
  header.append(title, createBadge(getLabel(PRIORITIES, task.priority), `priority-${task.priority.toLowerCase()}`));
  if (isOverdue(task, today)) {
    header.appendChild(createBadge("지연", "overdue"));
  }
  main.appendChild(header);

  if (task.description !== "") {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    main.appendChild(description);
  }

  const meta = document.createElement("p");
  meta.className = "task-meta";
  meta.textContent = task.due_date === null ? "마감일 없음" : `마감 ${task.due_date}`;
  main.appendChild(meta);

  const statusSelect = createSelect(STATUSES, task.status, "상태");
  statusSelect.className = "task-status";
  statusSelect.dataset.action = "status";

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(statusSelect, createButton("수정", "edit"), createButton("삭제", "delete"));

  item.append(main, actions);
}

function createEditField(tag, field, value, label) {
  const input = document.createElement(tag);
  input.className = `task-edit-${field.replace("_", "-")}`;
  input.dataset.field = field;
  input.value = value;
  input.setAttribute("aria-label", label);
  return input;
}

function renderEditItem(item) {
  const fields = document.createElement("div");
  fields.className = "task-edit-fields";

  const titleField = createEditField("input", "title", editDraft.title, "제목 수정");
  titleField.type = "text";
  titleField.classList.add("task-edit-input");

  const descriptionField = createEditField("textarea", "description", editDraft.description, "설명 수정");
  descriptionField.rows = 3;

  const priorityField = createSelect(PRIORITIES, editDraft.priority, "우선순위 수정");
  priorityField.className = "task-edit-priority";
  priorityField.dataset.field = "priority";

  const dueDateField = createEditField("input", "due_date", editDraft.due_date, "마감일 수정");
  dueDateField.type = "date";

  const row = document.createElement("div");
  row.className = "task-edit-row";
  row.append(priorityField, dueDateField);
  fields.append(titleField, descriptionField, row);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(createButton("저장", "save"), createButton("취소", "cancel"));

  const error = document.createElement("p");
  error.className = "form-error task-edit-error";
  error.setAttribute("role", "alert");
  error.textContent = editError;

  item.append(fields, actions, error);
}

function renderTasks() {
  const today = getLocalDateString();
  const visibleTasks = tasks.filter(matchesFilters);

  taskList.replaceChildren();
  for (const task of visibleTasks) {
    const item = document.createElement("li");
    item.dataset.id = task.id;
    item.className = `task-item status-${task.status.toLowerCase()}`;
    if (task.id === editingId) {
      item.classList.add("editing");
      renderEditItem(item);
    } else {
      if (isOverdue(task, today)) {
        item.classList.add("is-overdue");
      }
      renderViewItem(item, task, today);
    }
    taskList.appendChild(item);
  }

  taskCount.textContent = hasActiveFilters()
    ? `${visibleTasks.length} / ${tasks.length}`
    : String(tasks.length);
  emptyMessage.textContent =
    tasks.length === 0 ? "등록된 할 일이 없습니다." : "조건에 맞는 할 일이 없습니다.";
  emptyMessage.hidden = visibleTasks.length > 0;
}

function focusEditInput() {
  const input = taskList.querySelector(".task-edit-input");
  if (input) {
    input.focus();
  }
}

function startEdit(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) {
    return;
  }
  editingId = id;
  editDraft = {
    title: task.title,
    description: task.description,
    priority: task.priority,
    due_date: task.due_date === null ? "" : task.due_date,
  };
  editError = "";
  renderTasks();
  focusEditInput();
}

function stopEdit() {
  editingId = null;
  editDraft = null;
  editError = "";
}

function cancelEdit() {
  stopEdit();
  renderTasks();
}

function saveEdit(id) {
  if (id !== editingId || editDraft === null) {
    return;
  }

  const result = normalizeFields(editDraft);
  if (result.error) {
    editError = result.error;
    renderTasks();
    focusEditInput();
    return;
  }

  const nextTasks = tasks.map((task) => (task.id === id ? { ...task, ...result.values } : task));
  if (!commitTasks(nextTasks)) {
    editError = "저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.";
    renderTasks();
    return;
  }

  stopEdit();
  renderTasks();
}

function changeStatus(id, status) {
  if (!STATUS_VALUES.includes(status)) {
    return;
  }
  const nextTasks = tasks.map((task) => (task.id === id ? { ...task, status } : task));
  if (!commitTasks(nextTasks)) {
    showError("상태 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.");
  }
  // 실패하면 이전 상태로 다시 그려 화면과 저장값을 맞춘다.
  renderTasks();
}

function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) {
    return;
  }
  if (!window.confirm(`"${task.title}" 할 일을 삭제할까요?`)) {
    return;
  }

  const nextTasks = tasks.filter((item) => item.id !== id);
  if (!commitTasks(nextTasks)) {
    showError("삭제 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.");
    return;
  }

  if (editingId === id) {
    stopEdit();
  }
  renderTasks();
}

function resetForm() {
  titleInput.value = "";
  descriptionInput.value = "";
  priorityInput.value = DEFAULT_PRIORITY;
  dueDateInput.value = "";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!canSave) {
    return;
  }

  const result = normalizeFields({
    title: titleInput.value,
    description: descriptionInput.value,
    priority: priorityInput.value,
    due_date: dueDateInput.value,
  });
  if (result.error) {
    showError(result.error);
    titleInput.focus();
    return;
  }

  const nextTasks = [
    ...tasks,
    {
      id: createId(),
      ...result.values,
      status: DEFAULT_STATUS,
      created_at: new Date().toISOString(),
    },
  ];

  if (!commitTasks(nextTasks)) {
    showError("저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.");
    return;
  }

  showError("");
  resetForm();
  titleInput.focus();
  renderTasks();
});

filterQueryInput.addEventListener("input", () => {
  filters.query = filterQueryInput.value;
  renderTasks();
});

filterStatusInput.addEventListener("change", () => {
  filters.status = filterStatusInput.value;
  renderTasks();
});

filterPriorityInput.addEventListener("change", () => {
  filters.priority = filterPriorityInput.value;
  renderTasks();
});

// 수정·삭제는 화면 순번이 아닌 항목의 고유 id(data-id)로 처리한다.
function getTaskId(target) {
  const item = target.closest("li[data-id]");
  return item ? item.dataset.id : null;
}

function updateDraft(target) {
  const field = target.dataset.field;
  if (editDraft !== null && field && field in editDraft) {
    editDraft[field] = target.value;
  }
}

taskList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const id = getTaskId(button);
  if (!id) {
    return;
  }

  switch (button.dataset.action) {
    case "edit":
      startEdit(id);
      break;
    case "delete":
      deleteTask(id);
      break;
    case "save":
      saveEdit(id);
      break;
    case "cancel":
      cancelEdit();
      break;
  }
});

taskList.addEventListener("input", (event) => {
  updateDraft(event.target);
});

taskList.addEventListener("change", (event) => {
  if (event.target.dataset.action === "status") {
    const id = getTaskId(event.target);
    if (id) {
      changeStatus(id, event.target.value);
    }
    return;
  }
  updateDraft(event.target);
});

taskList.addEventListener("keydown", (event) => {
  // 한글 입력 조합 중의 키 입력은 글자 확정용이므로 처리하지 않는다.
  if (!event.target.dataset.field || event.isComposing) {
    return;
  }
  const id = getTaskId(event.target);
  if (event.key === "Escape") {
    cancelEdit();
  } else if (event.key === "Enter" && event.target.classList.contains("task-edit-input")) {
    // 설명(textarea)의 Enter는 줄바꿈이므로 제목 입력칸에서만 저장한다.
    event.preventDefault();
    updateDraft(event.target);
    saveEdit(id);
  }
});

const loaded = loadTasks();
if (loaded.error) {
  blockSaving(loaded.error);
} else {
  tasks = loaded.tasks;
}
renderTasks();
