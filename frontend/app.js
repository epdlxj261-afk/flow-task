// T03: 등록·목록·localStorage 저장에 더해 상태 변경, 제목 수정, 삭제 확인을 구현한다.

const TITLE_MAX_LENGTH = 100;
const STORAGE_KEY = "task-flow-v1";
const STATUSES = [
  { value: "TODO", label: "할 일" },
  { value: "DOING", label: "진행 중" },
  { value: "DONE", label: "완료" },
];
const STATUS_VALUES = STATUSES.map((status) => status.value);
const DEFAULT_STATUS = "TODO";

let tasks = [];
// 저장값이 손상되었거나 저장소를 쓸 수 없으면 false가 되어, 저장값을 덮어쓰지 않도록 변경을 막는다.
let canSave = true;
// 제목을 수정 중인 항목의 id. 수정 중이 아니면 null이다.
let editingId = null;
let editError = "";

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const submitButton = form.querySelector("button[type='submit']");
const formError = document.getElementById("form-error");
const storageError = document.getElementById("storage-error");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");

// 공백 제거 후 1~100자인지 검사한다. 오류가 없으면 빈 문자열을 반환한다.
function validateTitle(title) {
  const length = Array.from(title).length;
  if (length === 0) {
    return "제목을 입력해 주세요.";
  }
  if (length > TITLE_MAX_LENGTH) {
    return `제목은 ${TITLE_MAX_LENGTH}자 이하로 입력해 주세요. (현재 ${length}자)`;
  }
  return "";
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
    STATUS_VALUES.includes(task.status) &&
    typeof task.created_at === "string"
  );
}

// T02에서 저장한 항목에는 status가 없으므로 기본값 TODO를 채운다. 잘못된 status 값은 채우지 않는다.
function withDefaults(task) {
  if (task !== null && typeof task === "object" && !Array.isArray(task) && !("status" in task)) {
    return { ...task, status: DEFAULT_STATUS };
  }
  return task;
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

function showError(message) {
  formError.textContent = message;
  titleInput.setAttribute("aria-invalid", message ? "true" : "false");
}

function blockSaving(message) {
  canSave = false;
  storageError.textContent = message;
  storageError.hidden = false;
  titleInput.disabled = true;
  submitButton.disabled = true;
}

function createButton(label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  return button;
}

function createStatusSelect(task) {
  const select = document.createElement("select");
  select.className = "task-status";
  select.dataset.action = "status";
  select.setAttribute("aria-label", "상태");
  for (const status of STATUSES) {
    const option = document.createElement("option");
    option.value = status.value;
    option.textContent = status.label;
    select.appendChild(option);
  }
  select.value = task.status;
  return select;
}

function renderViewItem(item, task) {
  const title = document.createElement("span");
  title.className = "task-title";
  // 사용자 입력은 HTML로 해석하지 않고 글자로만 표시한다.
  title.textContent = task.title;

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(createStatusSelect(task), createButton("수정", "edit"), createButton("삭제", "delete"));

  item.append(title, actions);
}

function renderEditItem(item, task) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "task-edit-input";
  input.value = task.title;
  input.setAttribute("aria-label", "제목 수정");
  input.setAttribute("aria-invalid", editError ? "true" : "false");

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(createButton("저장", "save"), createButton("취소", "cancel"));

  const error = document.createElement("p");
  error.className = "form-error task-edit-error";
  error.setAttribute("role", "alert");
  error.textContent = editError;

  item.append(input, actions, error);
}

function renderTasks() {
  taskList.replaceChildren();

  for (const task of tasks) {
    const item = document.createElement("li");
    item.dataset.id = task.id;
    item.className = `task-item status-${task.status.toLowerCase()}`;
    if (task.id === editingId) {
      item.classList.add("editing");
      renderEditItem(item, task);
    } else {
      renderViewItem(item, task);
    }
    taskList.appendChild(item);
  }

  taskCount.textContent = String(tasks.length);
  emptyMessage.hidden = tasks.length > 0;
}

function focusEditInput() {
  const input = taskList.querySelector(".task-edit-input");
  if (input) {
    input.focus();
  }
}

function startEdit(id) {
  editingId = id;
  editError = "";
  renderTasks();
  focusEditInput();
}

function cancelEdit() {
  editingId = null;
  editError = "";
  renderTasks();
}

function saveEdit(id, rawTitle) {
  const title = rawTitle.trim();
  const error = validateTitle(title);
  if (error) {
    editError = error;
    renderTasks();
    focusEditInput();
    return;
  }

  const nextTasks = tasks.map((task) => (task.id === id ? { ...task, title } : task));
  if (!commitTasks(nextTasks)) {
    editError = "저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.";
    renderTasks();
    return;
  }

  editingId = null;
  editError = "";
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
    editingId = null;
    editError = "";
  }
  renderTasks();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!canSave) {
    return;
  }

  const title = titleInput.value.trim();
  const error = validateTitle(title);
  if (error) {
    showError(error);
    titleInput.focus();
    return;
  }

  const nextTasks = [
    ...tasks,
    {
      id: createId(),
      title,
      status: DEFAULT_STATUS,
      created_at: new Date().toISOString(),
    },
  ];

  if (!commitTasks(nextTasks)) {
    showError("저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.");
    return;
  }

  showError("");
  titleInput.value = "";
  titleInput.focus();
  renderTasks();
});

// 수정·삭제는 화면 순번이 아닌 항목의 고유 id(data-id)로 처리한다.
function getTaskId(target) {
  const item = target.closest("li[data-id]");
  return item ? item.dataset.id : null;
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
    case "save": {
      const input = button.closest("li").querySelector(".task-edit-input");
      saveEdit(id, input.value);
      break;
    }
    case "cancel":
      cancelEdit();
      break;
  }
});

taskList.addEventListener("change", (event) => {
  if (event.target.dataset.action !== "status") {
    return;
  }
  const id = getTaskId(event.target);
  if (id) {
    changeStatus(id, event.target.value);
  }
});

taskList.addEventListener("keydown", (event) => {
  // 한글 입력 조합 중의 Enter는 글자 확정용이므로 저장하지 않는다.
  if (!event.target.classList.contains("task-edit-input") || event.isComposing) {
    return;
  }
  const id = getTaskId(event.target);
  if (event.key === "Enter") {
    event.preventDefault();
    saveEdit(id, event.target.value);
  } else if (event.key === "Escape") {
    cancelEdit();
  }
});

const loaded = loadTasks();
if (loaded.error) {
  blockSaving(loaded.error);
} else {
  tasks = loaded.tasks;
}
renderTasks();
