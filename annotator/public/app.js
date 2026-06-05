const editor = document.querySelector("#config-editor");
const statusEl = document.querySelector("#status");
const countEl = document.querySelector("#annotation-count");
const preview = document.querySelector("#preview");
const renderButton = document.querySelector("#render");
const saveRenderButton = document.querySelector("#save-render");
const calibrateButton = document.querySelector("#calibrate");
const showInputButton = document.querySelector("#show-input");
const showOutputButton = document.querySelector("#show-output");
const togglePreviewButton = document.querySelector("#toggle-preview");
const pinPreviewButton = document.querySelector("#pin-preview");
const previewPanel = document.querySelector(".preview-panel");
const currentConfigEl = document.querySelector("#current-config");
const agentStatusEl = document.querySelector("#agent-status");
const agentIndicatorEl = document.querySelector("#agent-indicator");
const agentLogEl = document.querySelector("#agent-log");
const agentForm = document.querySelector("#agent-form");
const agentMessage = document.querySelector("#agent-message");
const agentSendButton = document.querySelector("#agent-send");
const agentStopButton = document.querySelector("#agent-stop");

const params = new URLSearchParams(window.location.search);
const selectedConfig = params.get("config");
const selectedImage = params.get("image");

let state = null;
let previewMode = "output";
let activeAgentJobId = null;
let lastRenderedAgentLogLength = 0;
let agentPollTimer = null;
let lastPreviewRefreshAt = 0;
let isPreviewOpen = false;
let isPreviewPinned = false;
let previewAutoCloseTimer = null;

const LONG_MESSAGE_LIMIT = 900;
const PREVIEW_REFRESH_INTERVAL_MS = 2500;

async function init() {
  const [configText, nextState] = await Promise.all([
    fetchText(withConfig("/api/config")),
    fetchJson(withConfig("/api/state")),
  ]);

  editor.value = configText;
  updateState(nextState);
}

async function render(save) {
  setStatus(save ? "Saving and rendering..." : "Rendering...");

  const nextState = await fetchJson(withConfig("/api/render"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      configText: editor.value,
      save,
    }),
  });

  updateState(nextState);
}

function updateState(nextState, options = {}) {
  state = nextState;
  countEl.textContent = `${state.annotationCount} annotations`;
  if (!options.preserveStatus) {
    setStatus(`Ready: ${state.outputPath}`);
  }
  if (currentConfigEl) {
    currentConfigEl.textContent = state.configPath;
  }
  updatePreview();
}

function updatePreview() {
  if (!state) {
    return;
  }

  const nextSrc = previewMode === "input" || !state.outputUrl ? state.inputUrl : state.outputUrl;
  preview.src = nextSrc;
  showInputButton.classList.toggle("active", previewMode === "input");
  showOutputButton.classList.toggle("active", previewMode === "output" && Boolean(state.outputUrl));
}

function updatePreviewPanelState() {
  previewPanel.classList.toggle("preview-panel--open", isPreviewOpen || isPreviewPinned);
  previewPanel.classList.toggle("preview-panel--pinned", isPreviewPinned);
  togglePreviewButton.textContent = isPreviewOpen || isPreviewPinned ? "Hide Preview" : "Show Preview";
  pinPreviewButton.textContent = isPreviewPinned ? "Unpin" : "Pin";
  pinPreviewButton.classList.toggle("active", isPreviewPinned);
}

function setPreviewOpen(isOpen, { autoClose = false } = {}) {
  isPreviewOpen = isOpen;
  updatePreviewPanelState();

  if (previewAutoCloseTimer) {
    window.clearTimeout(previewAutoCloseTimer);
    previewAutoCloseTimer = null;
  }

  if (autoClose && isOpen && !isPreviewPinned) {
    previewAutoCloseTimer = window.setTimeout(() => {
      isPreviewOpen = false;
      updatePreviewPanelState();
    }, 4500);
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

function setAgentStatus(message) {
  agentStatusEl.textContent = message;
}

function setAgentProcessState(status) {
  agentIndicatorEl.classList.toggle("agent-indicator--running", status === "running");
  agentIndicatorEl.classList.toggle("agent-indicator--stopped", status && status !== "running");
}

function withConfig(endpoint) {
  if (!selectedConfig && !selectedImage) {
    return endpoint;
  }

  const url = new URL(endpoint, window.location.origin);

  if (selectedConfig) {
    url.searchParams.set("config", selectedConfig);
  }

  if (selectedImage) {
    url.searchParams.set("image", selectedImage);
  }

  return `${url.pathname}${url.search}`;
}

async function fetchText(endpoint) {
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.text();
}

async function fetchJson(endpoint, options) {
  const response = await fetch(endpoint, options);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || response.statusText);
  }

  return json;
}

async function startAgentJob(mode, message) {
  if (activeAgentJobId) {
    return;
  }

  setAgentBusy(true);
  lastRenderedAgentLogLength = 0;
  agentLogEl.innerHTML = "";
  appendAgentMessage("user", mode === "calibrate" ? "Calibrate current annotation" : message);
  setAgentStatus(mode === "calibrate" ? "Starting calibration..." : "Starting agent...");

  const job = await fetchJson(withConfig("/api/agent"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      message,
      configText: editor.value,
    }),
  });

  activeAgentJobId = job.id;
  renderAgentJob(job);
  pollAgentJob();
}

async function pollAgentJob() {
  if (!activeAgentJobId) {
    return;
  }

  const job = await fetchJson(`/api/agent/${activeAgentJobId}`);
  renderAgentJob(job);

  if (job.status === "running") {
    await refreshRunningPreview();
    agentPollTimer = window.setTimeout(() => {
      pollAgentJob().catch((error) => finishAgentWithError(error));
    }, 1600);
    return;
  }

  activeAgentJobId = null;
  setAgentBusy(false);

  if (job.state) {
    updateState(job.state);
    editor.value = await fetchText(withConfig("/api/config"));
  }

  setAgentStatus(finalAgentStatusLabel(job.status));
}

function renderAgentJob(job) {
  setAgentStatus(`${job.mode}: ${job.status}`);
  setAgentProcessState(job.status);

  const entries = Array.isArray(job.log) ? job.log : [];
  entries.slice(lastRenderedAgentLogLength).forEach((entry) => {
    appendAgentMessage(entry.stream, entry.text);
  });
  lastRenderedAgentLogLength = entries.length;
}

function appendAgentMessage(stream, text) {
  const messageText = String(text || "").trim() || "(empty)";
  const isLong = messageText.length > LONG_MESSAGE_LIMIT || messageText.split("\n").length > 14;
  const block = document.createElement("div");
  block.className = `agent-message agent-message--${stream}`;
  block.classList.toggle("agent-message--collapsed", isLong);

  const label = document.createElement("div");
  label.className = "agent-message__label";
  label.textContent = stream;

  const body = document.createElement("pre");
  body.textContent = messageText;

  block.append(label, body);

  if (isLong) {
    const toggle = document.createElement("button");
    toggle.className = "agent-message__toggle";
    toggle.type = "button";
    toggle.textContent = "Show full message";
    toggle.addEventListener("click", () => {
      const isCollapsed = block.classList.toggle("agent-message--collapsed");
      toggle.textContent = isCollapsed ? "Show full message" : "Hide message";
      agentLogEl.scrollTop = block.offsetTop;
    });
    block.appendChild(toggle);
  }

  agentLogEl.appendChild(block);
  agentLogEl.scrollTop = agentLogEl.scrollHeight;
}

async function refreshRunningPreview() {
  const now = Date.now();
  if (now - lastPreviewRefreshAt < PREVIEW_REFRESH_INTERVAL_MS) {
    return;
  }

  lastPreviewRefreshAt = now;

  try {
    const nextState = await fetchJson(withConfig("/api/state"));
    if (nextState.outputUrl !== state?.outputUrl || nextState.inputUrl !== state?.inputUrl) {
      updateState(nextState, { preserveStatus: true });
      setPreviewOpen(true, { autoClose: true });
    } else if (previewMode === "output" && nextState.outputUrl) {
      preview.src = addCacheBust(nextState.outputUrl);
      setPreviewOpen(true, { autoClose: true });
    }
  } catch (error) {
    appendAgentMessage("error", `Preview refresh failed: ${error.message}`);
  }
}

function addCacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}live=${Date.now()}`;
}

function setAgentBusy(isBusy) {
  agentSendButton.disabled = isBusy;
  calibrateButton.disabled = isBusy;
  agentMessage.disabled = isBusy;
  agentStopButton.disabled = !isBusy;
}

function finalAgentStatusLabel(status) {
  if (status === "finished") {
    return "Finished";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  if (status === "timed_out") {
    return "Timed out";
  }

  return "Failed";
}

function finishAgentWithError(error) {
  activeAgentJobId = null;
  if (agentPollTimer) {
    window.clearTimeout(agentPollTimer);
    agentPollTimer = null;
  }
  setAgentBusy(false);
  setAgentStatus("Error");
  setAgentProcessState("failed");
  appendAgentMessage("error", error.message);
}

async function stopAgentJob() {
  if (!activeAgentJobId) {
    return;
  }

  setAgentStatus("Stopping...");
  const job = await fetchJson(`/api/agent/${activeAgentJobId}/stop`, {
    method: "POST",
  });
  renderAgentJob(job);
}

renderButton.addEventListener("click", () => {
  render(false).catch((error) => setStatus(`Error: ${error.message}`));
});

saveRenderButton.addEventListener("click", () => {
  render(true).catch((error) => setStatus(`Error: ${error.message}`));
});

calibrateButton.addEventListener("click", () => {
  startAgentJob("calibrate", "").catch((error) => finishAgentWithError(error));
});

agentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = agentMessage.value.trim();
  if (!message) {
    setAgentStatus("Enter a request first");
    return;
  }

  agentMessage.value = "";
  startAgentJob("chat", message).catch((error) => finishAgentWithError(error));
});

agentStopButton.addEventListener("click", () => {
  stopAgentJob().catch((error) => finishAgentWithError(error));
});

showInputButton.addEventListener("click", () => {
  previewMode = "input";
  updatePreview();
});

showOutputButton.addEventListener("click", () => {
  previewMode = "output";
  updatePreview();
});

togglePreviewButton.addEventListener("click", () => {
  setPreviewOpen(!(isPreviewOpen || isPreviewPinned));
});

pinPreviewButton.addEventListener("click", () => {
  isPreviewPinned = !isPreviewPinned;
  isPreviewOpen = isPreviewPinned || isPreviewOpen;
  updatePreviewPanelState();
});

updatePreviewPanelState();

init().catch((error) => setStatus(`Error: ${error.message}`));
