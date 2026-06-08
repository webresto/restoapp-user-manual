import * as Tabs from "@radix-ui/react-tabs";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  CircleStop,
  Code2,
  Eye,
  EyeOff,
  FileCode2,
  GalleryHorizontalEnd,
  Image,
  Pin,
  PinOff,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const LONG_MESSAGE_LIMIT = 900;
const PREVIEW_REFRESH_INTERVAL_MS = 2500;
const RED = "#ff2d2d";

function cn(...items) {
  return items.filter(Boolean).join(" ");
}

function Button({ children, className, variant = "default", size = "default", ...props }) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "border-red-600 bg-red-600 text-white hover:bg-red-700",
        variant === "default" && "border-neutral-200 bg-white text-neutral-900 hover:border-red-300 hover:bg-red-50",
        variant === "ghost" && "border-transparent bg-transparent text-neutral-700 hover:bg-neutral-100",
        variant === "dark" && "border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800",
        variant === "danger" && "border-red-200 bg-white text-red-700 hover:bg-red-50",
        variant === "soft" && "border-neutral-200 bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
        size === "icon" ? "h-9 w-9 p-0" : "h-9 px-3",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function LinkButton({ children, className, variant = "default", ...props }) {
  return (
    <a
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium no-underline transition-colors",
        variant === "default" && "border-neutral-200 bg-white text-neutral-900 hover:border-red-300 hover:bg-red-50",
        variant === "dark" && "border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

function Badge({ children, tone = "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
        tone === "neutral" && "border-neutral-200 bg-neutral-50 text-neutral-600",
        tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "red" && "border-red-200 bg-red-50 text-red-700",
      )}
    >
      {children}
    </span>
  );
}

function ToolbarStatus({ status }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Button
        aria-label="Back"
        size="icon"
        type="button"
        variant="ghost"
        onClick={() => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = "/all";
          }
        }}
      >
        <ArrowLeft size={18} />
      </Button>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-normal text-neutral-950">Screenshot Annotator</h1>
          <Badge tone="green">
            <ShieldCheck size={13} /> Clean source
          </Badge>
        </div>
        <p className="truncate text-sm text-neutral-500" data-testid="status">
          {status}
        </p>
      </div>
    </div>
  );
}

function EditorApp() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const selectedConfig = params.get("config");
  const selectedImage = params.get("image");
  const agentStorageKey = `annotator:agent:${selectedConfig || selectedImage || "default"}`;
  const storedAgent = useMemo(() => {
    try {
      const raw = window.localStorage.getItem(agentStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [agentStorageKey]);
  const [configText, setConfigText] = useState("");
  const [state, setState] = useState(null);
  const [status, setStatus] = useState("Loading...");
  const storedPreview = useMemo(() => {
    try {
      const raw = window.localStorage.getItem("annotator:preview");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
  const [previewMode, setPreviewMode] = useState(storedPreview?.previewMode ?? "output");
  const [previewOpen, setPreviewOpenState] = useState(true);
  const [previewPinned, setPreviewPinned] = useState(storedPreview?.previewPinned ?? false);
  const [agentStatus, setAgentStatus] = useState(storedAgent?.agentStatus ?? "Idle");
  const [agentJob, setAgentJob] = useState(storedAgent?.agentJob ?? null);
  const [activeAgentJobId, setActiveAgentJobId] = useState(storedAgent?.activeAgentJobId ?? null);
  const [agentMessage, setAgentMessage] = useState("");
  const [agentEngine, setAgentEngine] = useState(() => {
    try {
      return window.localStorage.getItem("annotator:engine") || "codex";
    } catch {
      return "codex";
    }
  });
  const [expandedMessages, setExpandedMessages] = useState(new Set());
  const lastPreviewRefreshAt = useRef(0);
  const previewAutoCloseTimer = useRef(null);
  const agentLogRef = useRef(null);
  // Tracks the last text persisted to disk so the autosave effect only fires on real edits.
  const savedConfigRef = useRef(null);

  const withConfig = (endpoint) => {
    if (!selectedConfig && !selectedImage) return endpoint;
    const url = new URL(endpoint, window.location.origin);
    if (selectedConfig) url.searchParams.set("config", selectedConfig);
    if (selectedImage) url.searchParams.set("image", selectedImage);
    return `${url.pathname}${url.search}`;
  };

  const updateState = (nextState, options = {}) => {
    setState(nextState);
    if (!options.preserveStatus) {
      setStatus(`Ready: ${nextState.outputPath}`);
    }
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchText(withConfig("/api/config")), fetchJson(withConfig("/api/state"))])
      .then(([text, nextState]) => {
        if (!mounted) return;
        savedConfigRef.current = text;
        setConfigText(text);
        updateState(nextState);
      })
      .catch((error) => setStatus(`Error: ${error.message}`));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (agentLogRef.current) {
      agentLogRef.current.scrollTop = agentLogRef.current.scrollHeight;
    }
  }, [agentJob?.log?.length]);

  useEffect(() => {
    try {
      window.localStorage.setItem(agentStorageKey, JSON.stringify({ agentJob, activeAgentJobId, agentStatus }));
    } catch {
      // ignore storage quota / serialization errors
    }
  }, [agentStorageKey, agentJob, activeAgentJobId, agentStatus]);

  useEffect(() => {
    try {
      window.localStorage.setItem("annotator:preview", JSON.stringify({ previewMode, previewPinned }));
    } catch {
      // ignore storage quota / serialization errors
    }
  }, [previewMode, previewPinned]);

  useEffect(() => {
    try {
      window.localStorage.setItem("annotator:engine", agentEngine);
    } catch {
      // ignore storage quota errors
    }
  }, [agentEngine]);

  // Debounced autosave: persist + re-render whenever the config text changes.
  useEffect(() => {
    if (savedConfigRef.current === null) return undefined; // not loaded yet
    if (activeAgentJobId) return undefined; // don't fight a running agent
    if (configText === savedConfigRef.current) return undefined; // no real change
    const handle = window.setTimeout(() => {
      render(true).catch((error) => setStatus(`Error: ${error.message}`));
    }, 900);
    return () => window.clearTimeout(handle);
  }, [configText, activeAgentJobId]);

  // Pick up external changes (direct file edits, API, agent) and refresh editor + preview.
  useEffect(() => {
    if (activeAgentJobId) return undefined; // agent job has its own polling
    const interval = window.setInterval(async () => {
      // Skip while the user has unsaved local edits, so we never clobber them.
      if (savedConfigRef.current !== null && configText !== savedConfigRef.current) return;
      try {
        const [text, nextState] = await Promise.all([
          fetchText(withConfig("/api/config")),
          fetchJson(withConfig("/api/state")),
        ]);
        if (text !== savedConfigRef.current) {
          savedConfigRef.current = text;
          setConfigText(text);
          setStatus("Updated from disk");
        }
        if (nextState.outputUrl !== state?.outputUrl || nextState.inputUrl !== state?.inputUrl) {
          updateState(nextState, { preserveStatus: true });
        }
      } catch {
        // ignore transient polling errors
      }
    }, PREVIEW_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [activeAgentJobId, configText, state?.outputUrl, state?.inputUrl]);

  // Fall back to the clean source if the annotated output transiently fails to load
  // (e.g. while it is being re-rendered), so the preview never goes blank.
  const [outputError, setOutputError] = useState(false);
  useEffect(() => {
    setOutputError(false);
  }, [state?.outputUrl]);
  const showOutput = previewMode !== "input" && Boolean(state?.outputUrl) && !outputError;
  const previewSrc = showOutput ? state?.outputUrl : state?.inputUrl;
  const previewVisible = previewOpen || previewPinned;
  const isAgentBusy = Boolean(activeAgentJobId);

  function setPreviewOpen(isOpen, { autoClose = false } = {}) {
    setPreviewOpenState(isOpen);
    if (previewAutoCloseTimer.current) {
      window.clearTimeout(previewAutoCloseTimer.current);
      previewAutoCloseTimer.current = null;
    }
    if (autoClose && isOpen && !previewPinned) {
      previewAutoCloseTimer.current = window.setTimeout(() => setPreviewOpenState(false), 4500);
    }
  }

  async function render(save) {
    setStatus(save ? "Saving..." : "Rendering...");
    const textAtCall = configText;
    const nextState = await fetchJson(withConfig("/api/render"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configText: textAtCall, save }),
    });
    if (save) savedConfigRef.current = textAtCall;
    updateState(nextState);
  }

  async function startAgentJob(mode, message) {
    if (activeAgentJobId) return;
    setExpandedMessages(new Set());
    setAgentJob({ mode, status: "running", log: [{ stream: "user", text: mode === "calibrate" ? "Calibrate current annotation" : message }] });
    setAgentStatus(mode === "calibrate" ? "Starting calibration..." : "Starting agent...");
    const job = await fetchJson(withConfig("/api/agent"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, message, configText, agent: agentEngine }),
    });
    setActiveAgentJobId(job.id);
    setAgentJob(job);
  }

  async function stopAgentJob() {
    if (!activeAgentJobId) return;
    setAgentStatus("Stopping...");
    const job = await fetchJson(`/api/agent/${activeAgentJobId}/stop`, { method: "POST" });
    setAgentJob(job);
  }

  useEffect(() => {
    if (!activeAgentJobId) return undefined;
    let cancelled = false;
    let timer = null;

    async function poll() {
      try {
        const job = await fetchJson(`/api/agent/${activeAgentJobId}`);
        if (cancelled) return;
        setAgentJob(job);
        setAgentStatus(`${job.mode}: ${job.status}`);
        if (job.status === "running") {
          await refreshRunningPreview();
          timer = window.setTimeout(poll, 1600);
          return;
        }
        setActiveAgentJobId(null);
        if (job.state) {
          updateState(job.state);
          const latestConfig = await fetchText(withConfig("/api/config"));
          savedConfigRef.current = latestConfig;
          setConfigText(latestConfig);
        }
        setAgentStatus(finalAgentStatusLabel(job.status));
      } catch (error) {
        if (cancelled) return;
        setActiveAgentJobId(null);
        setAgentStatus("Error");
        setAgentJob((job) => ({
          ...(job || { mode: "agent", status: "failed" }),
          status: "failed",
          log: [...(job?.log || []), { stream: "error", text: error.message }],
        }));
      }
    }

    async function refreshRunningPreview() {
      const now = Date.now();
      if (now - lastPreviewRefreshAt.current < PREVIEW_REFRESH_INTERVAL_MS) return;
      lastPreviewRefreshAt.current = now;
      try {
        const nextState = await fetchJson(withConfig("/api/state"));
        if (nextState.outputUrl !== state?.outputUrl || nextState.inputUrl !== state?.inputUrl) {
          updateState(nextState, { preserveStatus: true });
          setPreviewOpen(true, { autoClose: true });
        }
      } catch (error) {
        setAgentJob((job) => ({
          ...(job || { mode: "agent", status: "running" }),
          log: [...(job?.log || []), { stream: "error", text: `Preview refresh failed: ${error.message}` }],
        }));
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [activeAgentJobId, state?.inputUrl, state?.outputUrl]);

  function submitAgent(event) {
    event.preventDefault();
    const message = agentMessage.trim();
    if (!message) {
      setAgentStatus("Enter a request first");
      return;
    }
    setAgentMessage("");
    startAgentJob("chat", message).catch((error) => {
      setAgentStatus("Error");
      setAgentJob({ mode: "chat", status: "failed", log: [{ stream: "error", text: error.message }] });
    });
  }

  function toggleMessage(index) {
    setExpandedMessages((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className={cn("min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-neutral-950", previewPinned && "is-preview-pinned")}>
      <header className="z-30 border-b border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ToolbarStatus status={status} />
          <div className="toolbar-actions flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
            <LinkButton href="/all">
              <GalleryHorizontalEnd size={16} /> Preview All
            </LinkButton>
            <div className="inline-flex items-center rounded-md border border-neutral-200 bg-white p-0.5" role="group" aria-label="Agent engine" data-testid="engine-select">
              {["codex", "claude"].map((eng) => (
                <button
                  key={eng}
                  type="button"
                  disabled={isAgentBusy}
                  onClick={() => setAgentEngine(eng)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-50",
                    agentEngine === eng ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-900",
                  )}
                  data-testid={`engine-${eng}`}
                >
                  {eng}
                </button>
              ))}
            </div>
            <Button variant="soft" onClick={() => startAgentJob("calibrate", "").catch((error) => setAgentStatus(error.message))} disabled={isAgentBusy}>
              <Sparkles size={16} /> Calibrate
            </Button>
          </div>
        </div>
      </header>

      <main className={cn("editor-workspace", previewPinned && "editor-workspace--preview-floating")}>
        <section className="editor-card editor-card--code">
          <PanelHeader
            icon={<FileCode2 size={16} />}
            title="Annotation YAML"
            subtitle={state?.configPath || "Config"}
            aside={<Badge>{state?.annotationCount ?? 0} annotations</Badge>}
          />
          <textarea
            className="h-full w-full resize-none border-0 bg-[#101114] p-4 font-mono text-[13px] leading-6 text-neutral-50 outline-none"
            data-testid="config-editor"
            spellCheck="false"
            value={configText}
            onChange={(event) => setConfigText(event.target.value)}
          />
        </section>

        <section className={cn("editor-card preview-card-live", previewPinned && "preview-card-live--floating", !previewVisible && "preview-card-live--collapsed")}>
          <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2">
            <Tabs.Root className="min-w-0" value={previewMode} onValueChange={setPreviewMode}>
              <Tabs.List className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-1">
                <Tabs.Trigger className="inline-flex h-8 items-center gap-2 rounded px-3 text-sm font-medium text-neutral-600 data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm" value="output">
                  <Settings2 size={15} /> Annotated
                </Tabs.Trigger>
                <Tabs.Trigger className="inline-flex h-8 items-center gap-2 rounded px-3 text-sm font-medium text-neutral-600 data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm" value="input">
                  <Image size={15} /> Original
                </Tabs.Trigger>
              </Tabs.List>
            </Tabs.Root>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" type="button" aria-label={previewVisible ? "Hide preview" : "Show preview"} data-testid="toggle-preview" onClick={() => setPreviewOpen(!previewVisible)}>
                {previewVisible ? <EyeOff size={17} /> : <Eye size={17} />}
              </Button>
              <Button
                variant={previewPinned ? "default" : "ghost"}
                size="icon"
                type="button"
                aria-label={previewPinned ? "Unpin preview" : "Pin preview"}
                data-testid="pin-preview"
                onClick={() => {
                  setPreviewPinned((value) => !value);
                  setPreviewOpenState(true);
                }}
              >
                {previewPinned ? <PinOff size={17} /> : <Pin size={17} />}
              </Button>
            </div>
          </div>
          <div className="min-h-0 overflow-auto bg-checker p-3">
            {previewSrc ? (
              <div className="flex min-h-full items-center justify-center">
                <img className="max-h-[calc(100vh-170px)] max-w-full rounded-md border border-neutral-200 bg-white shadow-sm" src={previewSrc} alt="Screenshot preview" data-testid="preview-image" onError={() => showOutput && setOutputError(true)} />
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-neutral-500">No rendered output yet</div>
            )}
          </div>
        </section>

        <section className="editor-card agent-card">
          <PanelHeader
            icon={<Bot size={16} />}
            title="Calibration Agent"
            subtitle="Scoped edits for this annotation file"
            aside={<AgentStatus status={agentJob?.status} label={agentStatus} />}
          />
          <div ref={agentLogRef} className="grid content-start gap-2 overflow-auto bg-neutral-50 p-3" data-testid="agent-log" aria-live="polite">
            {(agentJob?.log || []).length ? (
              agentJob.log.map((entry, index) => (
                <AgentMessage key={`${index}-${entry.at || ""}`} entry={entry} expanded={expandedMessages.has(index)} onToggle={() => toggleMessage(index)} />
              ))
            ) : (
              <div className="flex h-full min-h-32 items-center justify-center text-sm text-neutral-500">Agent output will appear here.</div>
            )}
          </div>
          <form className="grid gap-2 border-t border-neutral-200 p-3" data-testid="agent-form" onSubmit={submitAgent}>
            <textarea
              className="min-h-16 resize-y rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
              data-testid="agent-message"
              placeholder="Ask the agent to adjust only this annotation..."
              value={agentMessage}
              disabled={isAgentBusy}
              onChange={(event) => setAgentMessage(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button className="w-full" variant="danger" type="button" disabled={!isAgentBusy} data-testid="agent-stop" onClick={() => stopAgentJob().catch((error) => setAgentStatus(error.message))}>
                <CircleStop size={16} /> Stop
              </Button>
              <Button className="w-full" variant="dark" type="submit" disabled={isAgentBusy} data-testid="agent-send">
                <Send size={16} /> Send
              </Button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function PanelHeader({ icon, title, subtitle, aside }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-neutral-200 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="rounded-md border border-neutral-200 bg-neutral-50 p-1.5 text-neutral-600">{icon}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-900">{title}</div>
          {subtitle && <div className="truncate text-xs text-neutral-500">{subtitle}</div>}
        </div>
      </div>
      {aside}
    </div>
  );
}

function AgentStatus({ status, label }) {
  const running = status === "running";
  const failed = status && !["running", "finished"].includes(status);
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-neutral-500" data-testid="agent-status">
      <span className={cn("h-2.5 w-2.5 rounded-full", running && "animate-pulse bg-emerald-500", failed && "bg-red-600", !running && !failed && "bg-neutral-400")} data-testid="agent-indicator" />
      <span className="truncate">{label}</span>
    </span>
  );
}

const STREAM_META = {
  user: { label: "You", border: "border-blue-200", chip: "bg-blue-100 text-blue-700" },
  thinking: { label: "Thinking", border: "border-violet-200", chip: "bg-violet-100 text-violet-700", muted: true },
  tool: { label: "Tool", border: "border-amber-200", chip: "bg-amber-100 text-amber-700" },
  stdout: { label: "Agent", border: "border-emerald-200", chip: "bg-emerald-100 text-emerald-700" },
  system: { label: "System", border: "border-neutral-200", chip: "bg-neutral-100 text-neutral-600" },
  stderr: { label: "Error", border: "border-red-200", chip: "bg-red-100 text-red-700" },
  error: { label: "Error", border: "border-red-200", chip: "bg-red-100 text-red-700" },
};

function AgentMessage({ entry, expanded, onToggle }) {
  const text = String(entry.text || "").trim() || "(empty)";
  const isLong = text.length > LONG_MESSAGE_LIMIT || text.split("\n").length > 14;
  const stream = entry.stream || "system";
  const meta = STREAM_META[stream] || STREAM_META.system;
  return (
    <article className={cn("grid gap-1 rounded-md border bg-white p-3 shadow-sm", meta.border)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", meta.chip)}>{meta.label}</span>
        {stream === "system" && <CheckCircle2 className="text-emerald-600" size={14} />}
      </div>
      <pre
        className={cn(
          "whitespace-pre-wrap break-words font-mono text-xs leading-5 text-neutral-900",
          meta.muted && "italic text-neutral-500",
          isLong && !expanded && "max-h-28 overflow-hidden",
        )}
      >
        {text}
      </pre>
      {isLong && (
        <Button className="h-7 justify-self-start px-2 text-xs" variant="ghost" type="button" onClick={onToggle}>
          {expanded ? "Hide message" : "Show full message"}
        </Button>
      )}
    </article>
  );
}

function AllPreviewsApp() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [status, setStatus] = useState("Loading previews...");
  const [data, setData] = useState(null);
  const [selectedLanguage, setSelectedLanguageState] = useState((params.get("lang") || "all").toLowerCase());

  useEffect(() => {
    fetchJson("/api/all-annotations")
      .then((nextData) => {
        setData(nextData);
        setStatus(`Loaded ${countItems(nextData, selectedLanguage)} screenshot preview(s)`);
      })
      .catch((error) => setStatus(`Error: ${error.message}`));
  }, []);

  const languages = data?.languages || [];
  const visibleLanguages = languages.filter((language) => selectedLanguage === "all" || String(language.language).toLowerCase() === selectedLanguage);

  function setSelectedLanguage(language) {
    const next = language.toLowerCase();
    setSelectedLanguageState(next);
    const nextUrl = new URL(window.location.href);
    if (next === "all") nextUrl.searchParams.delete("lang");
    else nextUrl.searchParams.set("lang", next);
    window.history.replaceState({}, "", nextUrl);
    if (data) setStatus(`Loaded ${countItems(data, next)} screenshot preview(s)`);
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-neutral-950">
      <header className="z-30 border-b border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-neutral-200 bg-neutral-50 p-1.5 text-neutral-600">
                <GalleryHorizontalEnd size={16} />
              </span>
              <h1 className="text-lg font-semibold tracking-normal text-neutral-950">All Annotation Previews</h1>
            </div>
            <p className="truncate text-sm text-neutral-500" data-testid="all-status">
              {status}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-1" data-testid="language-filter">
            {["all", ...languages.map((language) => String(language.language).toLowerCase())].map((language) => (
              <Button key={language} variant={language === selectedLanguage ? "dark" : "default"} onClick={() => setSelectedLanguage(language)}>
                {language.toUpperCase()}
              </Button>
            ))}
            <LinkButton href="/">
              <Code2 size={16} /> Open Editor
            </LinkButton>
          </div>
        </div>
      </header>
      <main className="grid gap-5 p-4" data-testid="all-previews">
        {visibleLanguages.map((language) => (
          <section key={language.manifestPath} className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-base font-semibold text-neutral-950 shadow-sm">{String(language.language).toUpperCase()}</h2>
              <p className="text-xs text-neutral-500">{language.manifestPath}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(language.items || []).map((item) => (
                <PreviewCard key={`${language.language}-${item.image}-${item.configPath}`} item={item} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

function PreviewCard({ item }) {
  const [imageSize, setImageSize] = useState({ width: item.width || 0, height: item.height || 0 });
  const imageRef = useRef(null);
  const sourceWidth = item.width || imageSize.width;
  const sourceHeight = item.height || imageSize.height;
  const crop = normalizeCrop(item.crop, sourceWidth, sourceHeight);
  const width = crop ? crop.width : sourceWidth;
  const height = crop ? crop.height : sourceHeight;
  const annotations = crop ? (item.annotations || []).map((annotation) => transformAnnotationForCrop(annotation, crop)) : item.annotations || [];

  function onImageLoad() {
    const image = imageRef.current;
    if (image) setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
  }

  return (
    <article className="max-w-[900px] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition-colors hover:border-neutral-300">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 p-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-neutral-950">{item.title}</h3>
          <p className="mt-1 text-xs text-neutral-500">{[item.page, item.configPath ? item.name : item.image].filter(Boolean).join(" · ")}</p>
        </div>
        {item.editorUrl ? (
          <LinkButton href={item.editorUrl}>{item.annotations?.length ? "Edit" : "Create"}</LinkButton>
        ) : (
          <Badge>No config</Badge>
        )}
      </div>
      <div className="overflow-auto bg-checker p-4">
        <div className={cn("relative inline-block", crop && "max-w-full overflow-hidden")} style={crop ? { aspectRatio: `${crop.width} / ${crop.height}`, width: `min(${crop.width}px, 100%)` } : undefined}>
          <img
            ref={imageRef}
            className="block max-h-[360px] max-w-full bg-white"
            src={item.inputUrl}
            alt={item.title}
            onLoad={onImageLoad}
            style={
              crop && sourceWidth
                ? {
                    width: `${(sourceWidth / crop.width) * 100}%`,
                    maxWidth: "none",
                    transform: `translate(${(-crop.left / sourceWidth) * 100}%, ${(-crop.top / sourceHeight) * 100}%)`,
                    transformOrigin: "top left",
                  }
                : undefined
            }
          />
          {width > 0 && height > 0 && annotations.length > 0 && (
            <div className="pointer-events-none absolute inset-0" dangerouslySetInnerHTML={{ __html: renderSvgOverlay(width, height, annotations) }} />
          )}
        </div>
      </div>
    </article>
  );
}

async function fetchText(endpoint) {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(await response.text());
  return response.text();
}

async function fetchJson(endpoint, options) {
  const response = await fetch(endpoint, options);
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || response.statusText);
  return json;
}

function finalAgentStatusLabel(status) {
  if (status === "finished") return "Finished";
  if (status === "cancelled") return "Cancelled";
  if (status === "timed_out") return "Timed out";
  return "Failed";
}

function countItems(data, selectedLanguage) {
  return (data.languages || []).reduce((sum, language) => {
    if (selectedLanguage !== "all" && String(language.language).toLowerCase() !== selectedLanguage) return sum;
    return sum + (language.items || []).length;
  }, 0);
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function estimateTextWidth(text) {
  return Array.from(String(text)).reduce((sum, char) => sum + (char.charCodeAt(0) > 127 ? 11 : 9), 0);
}

function renderLabel(x, y, text) {
  const width = Math.max(80, estimateTextWidth(text) + 24);
  const safeY = Math.max(8, y);
  return `<rect class="annotation-fill" x="${x}" y="${safeY}" width="${width}" height="28" rx="6" /><text class="annotation-label" x="${x + 12}" y="${safeY + 20}">${escapeXml(text)}</text>`;
}

function renderAnnotation(annotation, imageWidth, imageHeight) {
  switch (annotation.type) {
    case "rect":
      return `<rect x="${annotation.x}" y="${annotation.y}" width="${annotation.width}" height="${annotation.height}" rx="${annotation.rx ?? 8}" fill="${RED}" fill-opacity="0.08" class="annotation-stroke" />${annotation.label ? renderLabel(annotation.x, annotation.y - 34, annotation.label) : ""}`;
    case "oval": {
      const cx = annotation.x + annotation.width / 2;
      const cy = annotation.y + annotation.height / 2;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${annotation.width / 2}" ry="${annotation.height / 2}" fill="${RED}" fill-opacity="0.08" class="annotation-stroke" />${annotation.label ? renderLabel(annotation.x, annotation.y - 34, annotation.label) : ""}`;
    }
    case "arrow": {
      const [x1, y1] = annotation.from;
      const [x2, y2] = annotation.to;
      return `<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="${RED}" stroke-width="4" fill="none" marker-end="url(#arrowhead)" />${annotation.label ? renderLabel(x1 + 10, y1 - 34, annotation.label) : ""}`;
    }
    case "marker":
      return `<circle class="annotation-fill" cx="${annotation.x}" cy="${annotation.y}" r="${annotation.radius || 18}" /><text class="annotation-marker-text" x="${annotation.x}" y="${annotation.y}">${escapeXml(annotation.text || "")}</text>`;
    case "spotlight":
      return renderSpotlight(annotation, imageWidth, imageHeight);
    default:
      return "";
  }
}

function renderSpotlight(annotation, imageWidth, imageHeight) {
  const opacity = annotation.opacity ?? 0.55;
  const label = annotation.label ? renderLabel(annotation.x, annotation.y - 34, annotation.label) : "";
  if (annotation.shape === "oval") {
    const cx = annotation.x + annotation.width / 2;
    const cy = annotation.y + annotation.height / 2;
    return `<path fill="black" fill-opacity="${opacity}" fill-rule="evenodd" d="M 0 0 H ${imageWidth} V ${imageHeight} H 0 Z M ${cx - annotation.width / 2} ${cy} a ${annotation.width / 2} ${annotation.height / 2} 0 1 0 ${annotation.width} 0 a ${annotation.width / 2} ${annotation.height / 2} 0 1 0 -${annotation.width} 0" /><ellipse cx="${cx}" cy="${cy}" rx="${annotation.width / 2}" ry="${annotation.height / 2}" fill="none" class="annotation-stroke" />${label}`;
  }
  return `<path fill="black" fill-opacity="${opacity}" fill-rule="evenodd" d="M 0 0 H ${imageWidth} V ${imageHeight} H 0 Z M ${annotation.x} ${annotation.y} H ${annotation.x + annotation.width} V ${annotation.y + annotation.height} H ${annotation.x} Z" /><rect x="${annotation.x}" y="${annotation.y}" width="${annotation.width}" height="${annotation.height}" rx="${annotation.rx ?? 8}" fill="none" class="annotation-stroke" />${label}`;
}

function renderSvgOverlay(width, height, annotations) {
  const items = annotations.map((annotation) => renderAnnotation(annotation, width, height)).join("\n");
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${RED}" /></marker></defs><style>.annotation-stroke{stroke:${RED};stroke-width:4}.annotation-fill{fill:${RED}}.annotation-label{fill:white;font-family:Arial,sans-serif;font-size:18px;font-weight:700}.annotation-marker-text{fill:white;font-family:Arial,sans-serif;font-size:20px;font-weight:700;text-anchor:middle;dominant-baseline:central}</style>${items}</svg>`;
}

function normalizeCrop(crop, sourceWidth, sourceHeight) {
  if (!crop || !sourceWidth || !sourceHeight) return null;
  const left = clampNumber(crop.x, 0, sourceWidth);
  const top = clampNumber(crop.y, 0, sourceHeight);
  const right = clampNumber(Number(crop.x) + Number(crop.width), 0, sourceWidth);
  const bottom = clampNumber(Number(crop.y) + Number(crop.height), 0, sourceHeight);
  const width = right - left;
  const height = bottom - top;
  return width > 0 && height > 0 ? { left, top, width, height } : null;
}

function transformAnnotationForCrop(annotation, crop) {
  const next = { ...annotation };
  if (hasNumber(next.x)) next.x = Number(next.x) - crop.left;
  if (hasNumber(next.y)) next.y = Number(next.y) - crop.top;
  if (Array.isArray(next.from)) next.from = [Number(next.from[0]) - crop.left, Number(next.from[1]) - crop.top];
  if (Array.isArray(next.to)) next.to = [Number(next.to[0]) - crop.left, Number(next.to[1]) - crop.top];
  return next;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(Math.round(Number(value) || 0), min), max);
}

function hasNumber(value) {
  return value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value));
}

const root = createRoot(document.querySelector("#root"));
root.render(window.location.pathname === "/all" ? <AllPreviewsApp /> : <EditorApp />);
