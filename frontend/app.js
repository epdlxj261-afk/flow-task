// T02: 제목 입력·등록·목록 표시와 localStorage 저장·복원을 구현한다.

const TITLE_MAX_LENGTH = 100;
const STORAGE_KEY = "task-flow-v1";

let tasks = [];
// 저장값이 손상되었거나 저장소를 쓸 수 없으면 false가 되어, 저장값을 덮어쓰지 않도록 등록을 막는다.
let canSave = true;

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
    typeof task.created_at === "string"
  );
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

  const ids = new Set();
  const isValid =
    Array.isArray(parsed) &&
    parsed.every((task) => {
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

  return { tasks: parsed };
}

function saveTasks(nextTasks) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
    return true;
  } catch (error) {
    return false;
  }
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

function renderTasks() {
  taskList.replaceChildren();

  for (const task of tasks) {
    const item = document.createElement("li");
    item.dataset.id = task.id;
    // 사용자 입력은 HTML로 해석하지 않고 글자로만 표시한다.
    item.textContent = task.title;
    taskList.appendChild(item);
  }

  taskCount.textContent = String(tasks.length);
  emptyMessage.hidden = tasks.length > 0;
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
      created_at: new Date().toISOString(),
    },
  ];

  // 저장에 성공한 경우에만 화면 목록을 바꿔, 화면과 저장값이 어긋나지 않게 한다.
  if (!saveTasks(nextTasks)) {
    showError("저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.");
    return;
  }

  tasks = nextTasks;
  showError("");
  titleInput.value = "";
  titleInput.focus();
  renderTasks();
});

const loaded = loadTasks();
if (loaded.error) {
  blockSaving(loaded.error);
} else {
  tasks = loaded.tasks;
}
renderTasks();
