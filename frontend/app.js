// T01: 제목 입력·등록·목록 표시만 구현한다. 저장은 하지 않으므로 새로고침하면 사라진다.

const TITLE_MAX_LENGTH = 100;

const tasks = [];

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const formError = document.getElementById("form-error");
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

  const title = titleInput.value.trim();
  const error = validateTitle(title);
  if (error) {
    showError(error);
    titleInput.focus();
    return;
  }

  tasks.push({
    id: createId(),
    title,
    created_at: new Date().toISOString(),
  });

  showError("");
  titleInput.value = "";
  titleInput.focus();
  renderTasks();
});

renderTasks();
