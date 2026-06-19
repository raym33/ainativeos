import { useEveAgent } from "eve/react";
import type { EveMessage, EveMessagePart } from "eve/client";
import { summarizeGuardedAction, summarizeNativeApprovalAction } from "../agent/lib/guardedTools.js";
import {
  RotateCcw,
  Send,
  ShieldAlert,
  Square,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createRoot } from "react-dom/client";
import { type Lang, loadLang, saveLang, t } from "./i18n.js";
import { OS_ICONS } from "./osIcons.js";
import { OS_APPS, type OsApp } from "./osApps.js";
import "./styles.css";

function App() {
  const agent = useEveAgent({ host: "" });
  const [lang, setLang] = useState<Lang>(loadLang);
  const [input, setInput] = useState("");
  const [osOpen, setOsOpen] = useState(false);

  const messages = agent.data.messages ?? [];

  const pendingApproval = useMemo(() => {
    // Scan newest-first so the card always reflects the latest pending request.
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      for (const part of messages[i].parts) {
        if (part.type === "dynamic-tool" && part.state === "approval-requested") {
          return part;
        }
      }
    }
    return null;
  }, [messages]);

  async function respondToApproval(requestId: string, optionId: string) {
    if (agent.status === "submitted" || agent.status === "streaming") {
      return;
    }
    await agent.send({ inputResponses: [{ requestId, optionId }] });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(input);
  }

  async function sendMessage(value: string) {
    const message = value.trim();
    if (!message || agent.status === "submitted" || agent.status === "streaming") {
      return;
    }
    setInput("");
    await agent.send({ message });
  }

  function changeLang(next: Lang) {
    setLang(next);
    saveLang(next);
  }

  return (
    <main className="app-shell">
      <section className="sidebar" aria-label={t(lang, "aria.systemStatus")}>
        <div className="brand-lockup">
          <p className="eyebrow">{t(lang, "brand.eyebrow")}</p>
          <h1>AI Native OS</h1>
          <span>{t(lang, "brand.subtitle")}</span>
        </div>

        <button className="os-launch" onClick={() => setOsOpen(true)} type="button">
          {t(lang, "os.launch")}
        </button>

        <div className="lang-toggle" aria-label={t(lang, "aria.langToggle")}>
          {(["es", "en"] as const).map((option) => (
            <button
              aria-pressed={lang === option}
              className={lang === option ? "active" : ""}
              key={option}
              onClick={() => changeLang(option)}
              type="button"
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="status-panel">
          <span className={`status-dot ${agent.status}`} />
          <div>
            <strong>{statusLabel(agent.status, lang)}</strong>
            <p>{t(lang, "status.backend")}</p>
          </div>
        </div>

        <div className="settings-block">
          <span>{t(lang, "model.label")}</span>
          <strong>{import.meta.env.VITE_MODEL_LABEL || t(lang, "model.fallback")}</strong>
        </div>

        <button
          className="secondary-button tooltip-control"
          data-tooltip={t(lang, "reset.tooltip")}
          onClick={agent.reset}
          title={t(lang, "reset.tooltip")}
          type="button"
        >
          <RotateCcw size={16} />
          {t(lang, "reset.label")}
        </button>
      </section>

      <section className="chat-panel" aria-label={t(lang, "aria.chat")}>
        <div className="messages">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-inner">
                <h2 className="welcome-greeting">{t(lang, "welcome.greeting")}</h2>
                <p className="welcome-sub">{t(lang, "welcome.sub")}</p>
                <div className="welcome-chips">
                  {INTENT_EXAMPLES.map((example) => (
                    <button
                      className="welcome-chip"
                      disabled={agent.status !== "ready"}
                      key={example.en}
                      onClick={() => sendMessage(example[lang])}
                      type="button"
                    >
                      {example[lang]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => <ChatMessage key={message.id} lang={lang} message={message} />)
          )}
        </div>

        {agent.error ? <div className="error-box">{String(agent.error.message ?? agent.error)}</div> : null}

        {pendingApproval ? (
          <ApprovalCard
            busy={agent.status === "submitted" || agent.status === "streaming"}
            lang={lang}
            onRespond={respondToApproval}
            part={pendingApproval}
          />
        ) : null}

        <form className="composer" onSubmit={onSubmit}>
          <textarea
            aria-label={t(lang, "aria.message")}
            disabled={Boolean(pendingApproval)}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={
              pendingApproval
                ? t(lang, "composer.pending")
                : t(lang, "composer.placeholder")
            }
            value={input}
          />
          {agent.status === "submitted" || agent.status === "streaming" ? (
            <button
              aria-label={t(lang, "composer.stop")}
              className="tooltip-control"
              data-tooltip={t(lang, "composer.stopTooltip")}
              onClick={agent.stop}
              title={t(lang, "composer.stopTooltip")}
              type="button"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              aria-label={t(lang, "composer.send")}
              className="tooltip-control"
              data-tooltip={t(lang, "composer.sendTooltip")}
              disabled={!input.trim() || Boolean(pendingApproval)}
              title={t(lang, "composer.sendTooltip")}
              type="submit"
            >
              <Send size={18} />
            </button>
          )}
        </form>
      </section>

      {osOpen ? (
        <OsDesktop
          lang={lang}
          onClose={() => setOsOpen(false)}
          onLaunch={(app) => {
            if (app.kind === "prompt" && app.prompt) {
              void sendMessage(app.prompt[lang]);
              setOsOpen(false);
            }
          }}
          onPrompt={(text) => {
            void sendMessage(text);
            setOsOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

type FileEntry = {
  name: string;
  type: "dir" | "file";
  size: number;
  modifiedAt: string;
};

type FileListing = {
  root: string;
  path: string;
  parent: string | null;
  entries: FileEntry[];
  error?: string;
};

type FilePreview =
  | { kind: "loading" }
  | { kind: "text"; content: string; truncated: boolean; size: number }
  | { kind: "image"; dataUrl: string; size: number }
  | { kind: "pdf"; size: number }
  | { kind: "other"; size: number; reason?: string }
  | { kind: "error"; error?: string };

const EXPLORER_PATH_KEY = "ainativeos.explorer.path";
const OS_SESSION_KEY = "ainativeos.os.session";
const OS_VERSION = "0.1 (preview)";
type OsWindowId = "programs" | "explorer" | "about";
type OsWindowState = { id: OsWindowId; z: number; x: number; y: number; minimized: boolean };
type PersistedOsWindowState = Pick<OsWindowState, "id" | "x" | "y" | "minimized">;

const WINDOW_TITLES: Record<OsWindowId, Record<Lang, string>> = {
  programs: { es: "Programas", en: "Programs" },
  explorer: { es: "Explorador", en: "Explorer" },
  about: { es: "Acerca de", en: "About" },
};

const INITIAL_WINDOWS: OsWindowState[] = [{ id: "programs", z: 1, x: 116, y: 28, minimized: false }];
const KNOWN_WINDOW_IDS = new Set<OsWindowId>(["programs", "explorer", "about"]);

function OsDesktop({
  lang,
  onClose,
  onLaunch,
  onPrompt,
}: {
  lang: Lang;
  onClose: () => void;
  onLaunch: (app: OsApp) => void;
  onPrompt: (text: string) => void;
}) {
  const [windows, setWindows] = useState<OsWindowState[]>(readStoredOsSession);
  const [zCounter, setZCounter] = useState(() => Math.max(...readStoredOsSession().map((windowState) => windowState.z), 0) + 1);
  const [clock, setClock] = useState(() => formatClock());
  const [startOpen, setStartOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const desktopApps = useMemo(() => OS_APPS.filter((app) => app.onDesktop), []);

  useEffect(() => {
    try {
      const payload: PersistedOsWindowState[] = windows.map(({ id, x, y, minimized }) => ({ id, x, y, minimized }));
      localStorage.setItem(OS_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Keep the desktop usable even when browser storage is unavailable.
    }
  }, [windows]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatClock()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function nextZ() {
    const z = zCounter;
    setZCounter((current) => current + 1);
    return z;
  }

  function openWindow(id: OsWindowId) {
    const z = nextZ();
    setWindows((current) => {
      const existing = current.find((windowState) => windowState.id === id);
      if (existing) {
        return current.map((windowState) => windowState.id === id ? { ...windowState, minimized: false, z } : windowState);
      }
      const position = getDefaultWindowPosition(id);
      return [...current, { id, z, minimized: false, ...position }];
    });
  }

  function focusWindow(id: OsWindowId) {
    const z = nextZ();
    setWindows((current) => current.map((windowState) => windowState.id === id ? { ...windowState, minimized: false, z } : windowState));
  }

  function closeWindow(id: OsWindowId) {
    setWindows((current) => current.filter((windowState) => windowState.id !== id));
  }

  function minimizeWindow(id: OsWindowId) {
    setWindows((current) => current.map((windowState) => windowState.id === id ? { ...windowState, minimized: true } : windowState));
  }

  function toggleTaskbarWindow(id: OsWindowId) {
    const target = windows.find((windowState) => windowState.id === id);
    if (!target) {
      openWindow(id);
      return;
    }
    const focusedWindow = windows
      .filter((windowState) => !windowState.minimized)
      .reduce<OsWindowState | null>((focused, windowState) => (
        !focused || windowState.z > focused.z ? windowState : focused
      ), null);
    if (target.minimized) {
      focusWindow(id);
      return;
    }
    if (focusedWindow?.id === id) {
      minimizeWindow(id);
      return;
    }
    focusWindow(id);
  }

  function moveWindow(id: OsWindowId, x: number, y: number) {
    setWindows((current) => current.map((windowState) => windowState.id === id ? { ...windowState, x, y } : windowState));
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>, windowState: OsWindowState) {
    if ((event.target as HTMLElement).closest(".os-close, .os-min")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    focusWindow(windowState.id);
    const overlay = overlayRef.current;
    const frame = event.currentTarget.closest(".os-window");
    if (!overlay || !(frame instanceof HTMLElement)) {
      return;
    }
    const overlayRect = overlay.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const titlebarHeight = event.currentTarget.getBoundingClientRect().height;
    const offsetX = event.clientX - frameRect.left;
    const offsetY = event.clientY - frameRect.top;

    function onPointerMove(moveEvent: PointerEvent) {
      const maxX = Math.max(0, overlayRect.width - 80);
      const maxY = Math.max(0, overlayRect.height - 40 - titlebarHeight);
      const nextX = clamp(moveEvent.clientX - overlayRect.left - offsetX, 0, maxX);
      const nextY = clamp(moveEvent.clientY - overlayRect.top - offsetY, 0, maxY);
      moveWindow(windowState.id, nextX, nextY);
    }

    function stopDrag() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
  }

  function launch(app: OsApp) {
    setStartOpen(false);
    if (app.kind === "explorer") {
      openWindow("explorer");
      return;
    }
    onLaunch(app);
  }

  return (
    <div
      className="os-overlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, "os.title")}
      onPointerDown={(event) => {
        if (!(event.target as HTMLElement).closest(".os-start, .os-start-menu")) {
          setStartOpen(false);
        }
      }}
    >
      <div className="os-desktop-area">
        <div className="os-desktop-icons" aria-label={t(lang, "os.programs")}>
          {desktopApps.map((app) => {
            const Icon = OS_ICONS[app.iconId] ?? OS_ICONS.document;
            return (
              <button
                className="os-desktop-icon"
                key={app.id}
                onClick={() => launch(app)}
                type="button"
              >
                <span className="os-desktop-icon-art">
                  <Icon size={32} />
                </span>
                <span>{app.label[lang]}</span>
              </button>
            );
          })}
        </div>
        {windows.map((windowState) => {
          if (windowState.minimized) {
            return null;
          }
          const style = { left: windowState.x, top: windowState.y, zIndex: windowState.z };
          if (windowState.id === "programs") {
            return (
              <section
                className="os-window os-program-manager"
                key={windowState.id}
                onPointerDown={() => focusWindow(windowState.id)}
                style={style}
              >
                <div className="os-titlebar" onPointerDown={(event) => startDrag(event, windowState)}>
                  <span>{t(lang, "os.title")}</span>
                  <div className="os-titlebar-actions">
                    <button className="os-min" onClick={() => minimizeWindow("programs")} type="button" aria-label={t(lang, "os.min")}>
                      _
                    </button>
                    <button className="os-close" onClick={() => closeWindow("programs")} type="button" aria-label={t(lang, "os.close")}>
                      ✕
                    </button>
                  </div>
                </div>
                <div className="os-window-body">
                  <p className="os-hint">{t(lang, "os.hint")}</p>
                  <div className="os-icon-grid">
                    {OS_APPS.map((app) => {
                      const Icon = OS_ICONS[app.iconId] ?? OS_ICONS.document;
                      return (
                        <button
                          className="os-icon"
                          key={app.id}
                          onClick={() => launch(app)}
                          type="button"
                        >
                          <span className="os-icon-tile">
                            <Icon size={32} />
                          </span>
                          <span className="os-icon-label">{app.label[lang]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          }

          if (windowState.id === "about") {
            return (
              <section
                className="os-window os-about"
                key={windowState.id}
                onPointerDown={() => focusWindow(windowState.id)}
                style={style}
              >
                <div className="os-titlebar" onPointerDown={(event) => startDrag(event, windowState)}>
                  <span>{t(lang, "os.about.title")}</span>
                  <div className="os-titlebar-actions">
                    <button className="os-min" onClick={() => minimizeWindow("about")} type="button" aria-label={t(lang, "os.min")}>
                      _
                    </button>
                    <button className="os-close" onClick={() => closeWindow("about")} type="button" aria-label={t(lang, "os.close")}>
                      ✕
                    </button>
                  </div>
                </div>
                <div className="os-window-body">
                  <strong className="os-about-name">AI Native OS</strong>
                  <p className="os-about-tagline">{t(lang, "os.about.tagline")}</p>
                  <p className="os-about-version">
                    {t(lang, "os.about.version")}: {OS_VERSION}
                  </p>
                  <p className="os-about-credits">{t(lang, "os.about.credits")}</p>
                  <button className="os-raised-button" onClick={() => closeWindow("about")} type="button">
                    {t(lang, "os.about.ok")}
                  </button>
                </div>
              </section>
            );
          }

          return (
            <FileExplorer
              key={windowState.id}
              lang={lang}
              onClose={() => closeWindow("explorer")}
              onFocus={() => focusWindow("explorer")}
              onMinimize={() => minimizeWindow("explorer")}
              onPrompt={onPrompt}
              onTitlebarPointerDown={(event) => startDrag(event, windowState)}
              style={style}
            />
          );
        })}
      </div>

      {startOpen ? (
        <div className="os-start-menu" role="menu" aria-label={t(lang, "os.start")}>
          {OS_APPS.map((app) => {
            const Icon = OS_ICONS[app.iconId] ?? OS_ICONS.document;
            return (
              <button
                className="os-start-menu-row"
                key={app.id}
                onClick={() => launch(app)}
                role="menuitem"
                type="button"
              >
                <Icon size={24} />
                <span>{app.label[lang]}</span>
              </button>
            );
          })}
          <div className="os-start-menu-separator" role="separator" />
          <button
            className="os-start-menu-row"
            onClick={() => {
              openWindow("programs");
              setStartOpen(false);
            }}
            role="menuitem"
            type="button"
          >
            {(() => {
              const Icon = OS_ICONS.files;
              return <Icon size={24} />;
            })()}
            <span>{t(lang, "os.programs")}</span>
          </button>
          <div className="os-start-menu-separator" role="separator" />
          <button
            className="os-start-menu-row"
            onClick={() => {
              openWindow("about");
              setStartOpen(false);
            }}
            role="menuitem"
            type="button"
          >
            {(() => {
              const Icon = OS_ICONS.document;
              return <Icon size={24} />;
            })()}
            <span>{t(lang, "os.about")}</span>
          </button>
          <button
            className="os-start-menu-row os-start-menu-exit"
            onClick={onClose}
            role="menuitem"
            type="button"
          >
            <span className="os-start-exit-glyph" aria-hidden="true">X</span>
            <span>{t(lang, "os.exit")}</span>
          </button>
        </div>
      ) : null}

      <div className="os-taskbar">
        <button
          className={`os-start ${startOpen ? "active" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            setStartOpen((open) => !open);
          }}
          type="button"
        >
          {(() => {
            const Icon = OS_ICONS.files;
            return <Icon size={18} />;
          })()}
          <span>{t(lang, "os.start")}</span>
        </button>
        <div className="os-task-buttons">
          {getTaskbarWindowIds(windows).map((id) => {
            const windowState = windows.find((state) => state.id === id);
            const isFocused = Boolean(
              windowState &&
              !windowState.minimized &&
              windowState.z === Math.max(...windows.filter((state) => !state.minimized).map((state) => state.z), 0)
            );
            return (
              <button
                className={`os-task-button ${windowState ? "open" : ""} ${isFocused ? "active" : ""}`}
                key={id}
                onClick={() => toggleTaskbarWindow(id)}
                type="button"
              >
                {WINDOW_TITLES[id][lang]}
              </button>
            );
          })}
        </div>
        <div className="os-clock" aria-label={t(lang, "os.clock")}>{clock}</div>
      </div>
    </div>
  );
}

function FileExplorer({
  lang,
  onClose,
  onFocus,
  onMinimize,
  onPrompt,
  onTitlebarPointerDown,
  style,
}: {
  lang: Lang;
  onClose: () => void;
  onFocus: () => void;
  onMinimize: () => void;
  onPrompt: (text: string) => void;
  onTitlebarPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  style: CSSProperties;
}) {
  const [currentPath, setCurrentPath] = useState(() => readStoredExplorerPath());
  const [listing, setListing] = useState<FileListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);

  useEffect(() => {
    setSelectedFileName(null);
    try {
      localStorage.setItem(EXPLORER_PATH_KEY, currentPath);
    } catch {
      // Keep the explorer usable even when browser storage is unavailable.
    }
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/files?path=${encodeURIComponent(currentPath)}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<FileListing>)
      .then(setListing)
      .catch((error) => {
        if (!controller.signal.aborted) {
          setListing({
            root: "",
            path: currentPath,
            parent: null,
            entries: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [currentPath]);

  const pathParts = currentPath ? currentPath.split("/").filter(Boolean) : [];
  const visibleEntries = listing?.entries ?? [];
  const selectedEntry = visibleEntries.find((entry) => entry.type === "file" && entry.name === selectedFileName) ?? null;
  const selectedRelativePath = selectedEntry ? [currentPath, selectedEntry.name].filter(Boolean).join("/") : null;
  const selectedAbsolutePath = selectedEntry && listing
    ? `${listing.root}/${listing.path ? `${listing.path}/` : ""}${selectedEntry.name}`
    : null;
  const selectedActions = selectedEntry && selectedAbsolutePath
    ? getExplorerActions(lang, selectedEntry.name, selectedAbsolutePath)
    : [];

  useEffect(() => {
    if (!selectedRelativePath) {
      setPreview(null);
      return;
    }

    const controller = new AbortController();
    setPreview({ kind: "loading" });
    fetch(`/api/file?path=${encodeURIComponent(selectedRelativePath)}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<FilePreview>)
      .then((payload) => {
        if (!controller.signal.aborted) {
          setPreview(payload);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPreview({ kind: "error" });
        }
      });

    return () => controller.abort();
  }, [selectedRelativePath]);

  return (
    <section className="os-window os-explorer" onPointerDown={onFocus} style={style}>
      <div className="os-titlebar" onPointerDown={onTitlebarPointerDown}>
        <span>{t(lang, "os.explorer.title")}</span>
        <div className="os-titlebar-actions">
          <button className="os-min" onClick={onMinimize} type="button" aria-label={t(lang, "os.min")}>
            _
          </button>
          <button className="os-close" onClick={onClose} type="button" aria-label={t(lang, "os.close")}>
            ✕
          </button>
        </div>
      </div>
      <div className="os-window-body">
        <div className="explorer-toolbar">
          <button
            className="os-raised-button"
            disabled={!listing?.parent && currentPath === ""}
            onClick={() => setCurrentPath(listing?.parent ?? "")}
            type="button"
          >
            {t(lang, "os.explorer.up")}
          </button>
          <div className="explorer-path" aria-label={t(lang, "os.explorer.title")}>
            <button type="button" onClick={() => setCurrentPath("")}>
              {t(lang, "os.explorer.root")}
            </button>
            {pathParts.map((part, index) => {
              const nextPath = pathParts.slice(0, index + 1).join("/");
              return (
                <button key={nextPath} type="button" onClick={() => setCurrentPath(nextPath)}>
                  {part}
                </button>
              );
            })}
          </div>
        </div>

        <p className="explorer-root">
          {t(lang, "os.explorer.root")}: {listing?.root || "..."}
        </p>
        {listing?.error ? <div className="explorer-error">{listing.error}</div> : null}

        <div className="explorer-list" role="list" aria-busy={loading}>
          {visibleEntries.length === 0 ? (
            <div className="explorer-empty">{loading ? "..." : t(lang, "os.explorer.empty")}</div>
          ) : (
            visibleEntries.map((entry) => (
              <button
                className={`explorer-row ${entry.type} ${entry.type === "file" && selectedFileName === entry.name ? "selected" : ""}`}
                key={`${entry.type}:${entry.name}`}
                onClick={() => {
                  if (entry.type === "file") {
                    setSelectedFileName(entry.name);
                  }
                }}
                onDoubleClick={() => {
                  if (entry.type === "dir") {
                    setCurrentPath([currentPath, entry.name].filter(Boolean).join("/"));
                  }
                }}
                onKeyDown={(event) => {
                  if (entry.type === "dir" && event.key === "Enter") {
                    setCurrentPath([currentPath, entry.name].filter(Boolean).join("/"));
                  }
                }}
                role="listitem"
                type="button"
              >
                <span>{entry.type === "dir" ? "[DIR]" : "[FILE]"}</span>
                <strong>{entry.name}</strong>
                <em>{entry.type === "dir" ? "" : formatBytes(entry.size)}</em>
              </button>
            ))
          )}
        </div>
        {selectedEntry ? (
          <>
            <div className="explorer-preview">
              <FilePreviewPane lang={lang} preview={preview} />
            </div>
            <div className="explorer-actions">
              <span>
                {t(lang, "explorer.selected")}: <strong>{selectedEntry.name}</strong>
              </span>
              <div>
                {selectedActions.map((action) => (
                  <button
                    className="os-raised-button"
                    key={action.id}
                    onClick={() => onPrompt(action.prompt)}
                    type="button"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function FilePreviewPane({ lang, preview }: { lang: Lang; preview: FilePreview | null }) {
  if (!preview || preview.kind === "loading") {
    return <p className="explorer-preview-note">{t(lang, "explorer.preview.loading")}</p>;
  }

  if (preview.kind === "text") {
    return (
      <>
        <pre>{preview.content}</pre>
        {preview.truncated ? <p className="explorer-preview-note">{t(lang, "explorer.preview.truncated")}</p> : null}
      </>
    );
  }

  if (preview.kind === "image") {
    return <img src={preview.dataUrl} alt="" />;
  }

  if (preview.kind === "pdf") {
    return <p className="explorer-preview-note">{t(lang, "explorer.preview.pdf")}</p>;
  }

  if (preview.kind === "other") {
    return (
      <p className="explorer-preview-note">
        {t(lang, "explorer.preview.none")} ({formatBytes(preview.size)})
      </p>
    );
  }

  return <p className="explorer-preview-note">{t(lang, "explorer.preview.error")}</p>;
}

function getExplorerActions(lang: Lang, fileName: string, absolutePath: string) {
  const actions = [
    {
      id: "ask",
      label: t(lang, "explorer.action.ask"),
      prompt: lang === "es"
        ? `Tengo este archivo: "${absolutePath}". ¿Qué puedes hacer con él? Dime las opciones.`
        : `I have this file: "${absolutePath}". What can you do with it? Tell me the options.`,
    },
  ];
  if (/\.pdf$/i.test(fileName)) {
    actions.push(
      {
        id: "summarize",
        label: t(lang, "explorer.action.summarize"),
        prompt: lang === "es"
          ? `Resume el PDF "${absolutePath}". Si está escaneado usa OCR. Dame los puntos clave.`
          : `Summarize the PDF "${absolutePath}". If it is scanned, use OCR. Give me the key points.`,
      },
      {
        id: "invoice",
        label: t(lang, "explorer.action.invoice"),
        prompt: lang === "es"
          ? `Extrae los datos de la factura "${absolutePath}": NIF/CIF, IBAN, importes, fechas, nº de factura. Lee el texto y usa la herramienta de extracción.`
          : `Extract the invoice data from "${absolutePath}": NIF/CIF, IBAN, amounts, dates, invoice number. Read the text and use the extraction tool.`,
      },
    );
  }
  return actions;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatClock() {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

function getTaskbarWindowIds(windows: OsWindowState[]): OsWindowId[] {
  const ids = new Set<OsWindowId>(["programs"]);
  for (const windowState of windows) {
    ids.add(windowState.id);
  }
  return [...ids];
}

function getDefaultWindowPosition(id: OsWindowId): Pick<OsWindowState, "x" | "y"> {
  if (id === "explorer") {
    return { x: 132, y: 84 };
  }
  if (id === "about") {
    return { x: 300, y: 120 };
  }
  return { x: 116, y: 28 };
}

function isOsWindowId(value: unknown): value is OsWindowId {
  return typeof value === "string" && KNOWN_WINDOW_IDS.has(value as OsWindowId);
}

function readStoredOsSession(): OsWindowState[] {
  try {
    const raw = localStorage.getItem(OS_SESSION_KEY);
    if (!raw) {
      return INITIAL_WINDOWS;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return INITIAL_WINDOWS;
    }
    const seen = new Set<OsWindowId>();
    const windows: OsWindowState[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const candidate = item as Partial<PersistedOsWindowState>;
      if (
        isOsWindowId(candidate.id) &&
        !seen.has(candidate.id) &&
        typeof candidate.x === "number" &&
        Number.isFinite(candidate.x) &&
        typeof candidate.y === "number" &&
        Number.isFinite(candidate.y) &&
        typeof candidate.minimized === "boolean"
      ) {
        seen.add(candidate.id);
        windows.push({
          id: candidate.id,
          x: candidate.x,
          y: candidate.y,
          minimized: candidate.minimized,
          z: windows.length + 1,
        });
      }
    }
    return windows.length > 0 ? windows : INITIAL_WINDOWS;
  } catch {
    return INITIAL_WINDOWS;
  }
}

function readStoredExplorerPath() {
  try {
    return localStorage.getItem(EXPLORER_PATH_KEY) ?? "";
  } catch {
    return "";
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ChatMessage({ lang, message }: { lang: Lang; message: EveMessage }) {
  const text = message.parts.map(partToText).filter(Boolean).join("\n\n");

  if (!text.trim()) {
    return null;
  }

  return (
    <article className={`message ${message.role}`}>
      <div className="message-role">{message.role === "user" ? t(lang, "user.you") : "Eve"}</div>
      <div className="message-body">{text}</div>
    </article>
  );
}

const INTENT_EXAMPLES: Record<Lang, string>[] = [
  { es: "Resume estos PDFs", en: "Summarize these PDFs" },
  { es: "Redacta un email a un cliente", en: "Draft an email to a client" },
  { es: "Consulta una ley en el BOE", en: "Look up a Spanish law (BOE)" },
  { es: "Busca en la web y resume", en: "Search the web and summarize" },
  { es: "Ordena mis archivos", en: "Organize my files" },
];

function ApprovalCard({
  busy,
  lang,
  onRespond,
  part,
}: {
  busy: boolean;
  lang: Lang;
  onRespond: (requestId: string, optionId: string) => void;
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
}) {
  const request = part.toolMetadata?.eve?.inputRequest;
  if (!request) {
    return null;
  }

  const input = (part.input ?? {}) as { skill?: unknown; tool?: unknown; params?: unknown };
  const summary =
    typeof input.skill === "string" && typeof input.tool === "string"
      ? summarizeGuardedAction(
          input.skill,
          input.tool,
          (input.params as Record<string, unknown>) ?? {},
          lang,
        )
      : summarizeNativeApprovalAction(part.toolName, (part.input as Record<string, unknown>) ?? {}, lang) ??
        request.prompt;

  const options =
    request.options && request.options.length > 0
      ? request.options
      : [
          { id: "approve", label: t(lang, "approval.approve"), style: "primary" as const },
          { id: "deny", label: t(lang, "approval.cancel"), style: "danger" as const },
        ];

  return (
    <div className="approval-card" role="alertdialog" aria-label={t(lang, "approval.aria")}>
      <div className="approval-head">
        <ShieldAlert size={18} />
        <strong>{t(lang, "approval.title")}</strong>
      </div>
      <p className="approval-summary">{summary}</p>
      <div className="approval-actions">
        {options.map((option) => (
          <button
            className={`approval-button ${option.style === "danger" ? "danger" : "primary"}`}
            disabled={busy}
            key={option.id}
            onClick={() => onRespond(request.requestId, option.id)}
            type="button"
          >
            {option.id === "approve"
              ? t(lang, "approval.approve")
              : option.id === "deny"
                ? t(lang, "approval.cancel")
                : option.label}
          </button>
        ))}
      </div>
      <p className="approval-note">{t(lang, "approval.note")}</p>
    </div>
  );
}

function partToText(part: EveMessagePart) {
  if (part.type === "text") {
    return part.text;
  }

  return "";
}

function statusLabel(status: string, lang: Lang) {
  if (status === "submitted") {
    return t(lang, "status.sending");
  }
  if (status === "streaming") {
    return t(lang, "status.responding");
  }
  if (status === "error") {
    return t(lang, "status.error");
  }
  return t(lang, "status.ready");
}

// Reuse the React root across Vite HMR updates to avoid the "createRoot called
// twice on the same container" dev warning.
const rootContainer = window as unknown as { __aiNativeOsRoot?: ReturnType<typeof createRoot> };
const root = rootContainer.__aiNativeOsRoot ?? (rootContainer.__aiNativeOsRoot = createRoot(document.getElementById("root")!));
root.render(<App />);
