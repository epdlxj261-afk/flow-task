// T08: 할 일 저장을 localStorage에서 Task Flow API 호출로 바꾼다.
// 등록·수정·삭제에 성공하면 서버 목록을 다시 불러와 화면과 서버 데이터를 맞춘다.
// 검색·필터는 불러온 전체 목록에 화면에서 적용한다.

const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
// 개발 단계(정적 서버 5500번)에서는 같은 호스트의 8000번 API를 부르고,
// 그 밖에는 같은 주소의 /api를 부른다(5장에서 Nginx가 /api를 API 서버로 전달).
const API_BASE =
  window.location.port === "5500"
    ? `${window.location.protocol}//${window.location.hostname}:8000/api`
    : "/api";
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
const DEFAULT_PRIORITY = "NORMAL";
// 응답이 오지 않는 요청을 끝없이 기다리지 않도록 제한 시간을 둔다.
const REQUEST_TIMEOUT_MS = 10000;

let tasks = [];
// 목록 불러오기 상태: "loading"(처음 불러오는 중), "ready"(한 번이라도 성공), "error"(처음부터 실패).
let loadState = "loading";
// 요청이 진행 중이면 true. 같은 요청이 중복으로 보내지지 않게 버튼을 막는다.
let busy = false;
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
const apiError = document.getElementById("api-error");
const filterQueryInput = document.getElementById("filter-query");
const filterStatusInput = document.getElementById("filter-status");
const filterPriorityInput = document.getElementById("filter-priority");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");

// API 호출 실패를 화면에 보여 줄 문장으로 바꾸기 위한 오류.
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

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

// 폼 입력값을 API 요청 형식으로 바꾸고 검사한다. 서버도 같은 규칙으로 다시 검사한다.
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

// 422 응답의 detail(검증 오류 목록)을 한 줄로 요약한다.
function describeValidationError(detail) {
  if (!Array.isArray(detail) || detail.length === 0) {
    return "입력값을 확인해 주세요.";
  }
  const first = detail[0];
  const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "";
  return `입력값을 확인해 주세요. (${field}: ${first.msg})`;
}

async function apiRequest(method, path, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  // 연결이 거부되지 않고 응답만 없는 경우(예: WSL 포트 전달)에도 제한 시간 뒤 실패로 처리한다.
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  options.signal = controller.signal;

  let response;
  try {
    response = await window.fetch(`${API_BASE}${path}`, options);
  } catch (error) {
    const reason = controller.signal.aborted ? "API 서버가 응답하지 않습니다." : "API 서버에 연결할 수 없습니다.";
    throw new ApiError(`${reason} API 서버가 실행 중인지 확인해 주세요.`, 0);
  } finally {
    window.clearTimeout(timer);
  }

  if (response.status === 204) {
    return null;
  }

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new ApiError("이미 삭제되었거나 없는 할 일입니다. 목록을 새로 불러왔습니다.", 404);
    }
    if (response.status === 422) {
      throw new ApiError(describeValidationError(data && data.detail), 422);
    }
    throw new ApiError(`API 요청에 실패했습니다. (HTTP ${response.status})`, response.status);
  }
  return data;
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

function showApiError(message) {
  apiError.textContent = message;
  apiError.hidden = message === "";
}

function setBusy(value) {
  busy = value;
  submitButton.disabled = value;
  for (const button of taskList.querySelectorAll("button")) {
    button.disabled = value;
  }
  for (const select of taskList.querySelectorAll("select")) {
    select.disabled = value;
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
    item.dataset.id = String(task.id);
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
  if (loadState === "loading") {
    emptyMessage.textContent = "불러오는 중...";
  } else if (loadState === "error") {
    emptyMessage.textContent = "할 일 목록을 불러오지 못했습니다.";
  } else if (tasks.length === 0) {
    emptyMessage.textContent = "등록된 할 일이 없습니다.";
  } else {
    emptyMessage.textContent = "조건에 맞는 할 일이 없습니다.";
  }
  emptyMessage.hidden = visibleTasks.length > 0;
  setBusy(busy);
}

// 서버에서 전체 목록을 다시 불러온다. 실패하면 마지막으로 불러온 목록을 유지한다.
async function reloadTasks() {
  try {
    tasks = await apiRequest("GET", "/tasks");
    loadState = "ready";
    showApiError("");
  } catch (error) {
    if (loadState === "loading") {
      loadState = "error";
    }
    showApiError(error.message);
  }
  // 수정 중이던 항목이 서버에서 사라졌으면 수정 상태를 끝낸다.
  if (editingId !== null && !tasks.some((task) => task.id === editingId)) {
    stopEdit();
  }
  renderTasks();
}

// 변경 요청을 보내고, 성공하면 서버 목록을 다시 불러온다. 성공 여부를 반환한다.
async function mutate(request, onError) {
  if (busy) {
    return false;
  }
  setBusy(true);
  let succeeded = false;
  try {
    let shouldReload = true;
    try {
      await request();
      succeeded = true;
    } catch (error) {
      onError(error);
      if (error.status === 0) {
        showApiError(error.message);
      }
      // 404는 다른 곳(curl 등)에서 삭제된 경우이므로 목록을 다시 불러온다.
      // 연결 실패·입력 오류는 서버 데이터가 바뀌지 않았으므로 다시 불러오지 않는다.
      shouldReload = error.status === 404;
    }
    if (shouldReload) {
      await reloadTasks();
    }
  } finally {
    // 예상하지 못한 오류가 나도 버튼이 막힌 채로 남지 않게 한다.
    busy = false;
    renderTasks();
  }
  return succeeded;
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

async function saveEdit(id) {
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

  editError = "";
  const succeeded = await mutate(
    () => apiRequest("PATCH", `/tasks/${id}`, result.values),
    (error) => {
      // 404면 다시 불러온 목록에서 항목이 사라져 수정 칸도 닫히므로 폼 아래에 알린다.
      if (error.status === 404) {
        showError(`수정 실패: ${error.message}`);
      } else {
        editError = error.message;
      }
    },
  );
  if (succeeded) {
    stopEdit();
    renderTasks();
  }
}

async function changeStatus(id, status) {
  if (!STATUS_VALUES.includes(status)) {
    return;
  }
  showError("");
  await mutate(
    () => apiRequest("PATCH", `/tasks/${id}`, { status }),
    (error) => showError(`상태 변경 실패: ${error.message}`),
  );
  // 실패하면 tasks가 바뀌지 않았으므로 mutate의 다시 그리기로 이전 상태가 표시된다.
}

async function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) {
    return;
  }
  if (!window.confirm(`"${task.title}" 할 일을 삭제할까요?`)) {
    return;
  }

  showError("");
  const succeeded = await mutate(
    () => apiRequest("DELETE", `/tasks/${id}`),
    (error) => showError(`삭제 실패: ${error.message}`),
  );
  if (succeeded && editingId === id) {
    stopEdit();
    renderTasks();
  }
}

function resetForm() {
  titleInput.value = "";
  descriptionInput.value = "";
  priorityInput.value = DEFAULT_PRIORITY;
  dueDateInput.value = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

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

  showError("");
  const succeeded = await mutate(
    () => apiRequest("POST", "/tasks", result.values),
    (error) => showError(`등록 실패: ${error.message}`),
  );
  if (succeeded) {
    resetForm();
    titleInput.focus();
  }
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
  return item ? Number(item.dataset.id) : null;
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
  if (id === null) {
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
    if (id !== null) {
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

renderTasks();
reloadTasks();
