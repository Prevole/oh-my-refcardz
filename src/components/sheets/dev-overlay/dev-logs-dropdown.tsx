"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Check, Copy, RefreshCw, ScrollText, Trash2 } from "lucide-react";
import { useKeyboardScope } from "@/hooks/use-keyboard-context";
import { useAction } from "@/hooks/use-action";
import { ACTION_IDS } from "@/lib/keybindings";
import styles from "./dev-overlay.module.css";

type SessionEntry = {
  id: string;
  filename: string;
  startedAt: string;
  duration: number;
  eventCount: number;
  page: string;
  description?: string;
};

type ListResponse = {
  sessions: SessionEntry[];
};

/** Imperative handle exposed to the parent (dev keyboard scope drives the dropdown). */
export type DevLogsDropdownHandle = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
};

/**
 * Dropdown listing debug sessions stored under `.debug-sessions/`. Each entry
 * exposes a grouped copy/delete pair (clipboard / DELETE via
 * `/api/dev/debug?id=<id>`). The footer offers a refresh action and a
 * delete-all action (DELETE on `/api/dev/debug` without `?id`). The list is
 * fetched lazily when the dropdown opens.
 *
 * When the dropdown is open, the `dev-logs` keyboard scope is pushed so
 * dev-mode and sheet/global bindings are temporarily disabled. The following
 * keyboard actions are wired up:
 *   - `j` / `ArrowDown` : move cursor down
 *   - `k` / `ArrowUp`   : move cursor up
 *   - `y`               : copy filename of the selected session
 *   - `d`               : delete the selected session
 *   - `Shift+D`         : delete all sessions
 *   - `Shift+R`         : refresh the list
 *   - `Escape`          : close the dropdown
 *
 * Only rendered in development; in production builds the parent should not
 * mount this component, but we also gate the network calls defensively.
 *
 * Exposes an imperative handle so the developer-mode keyboard scope can
 * open/close the dropdown without prop drilling its state.
 */
export const DevLogsDropdown = forwardRef<DevLogsDropdownHandle>(function DevLogsDropdown(
  _props,
  ref
) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedFilename, setCopiedFilename] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLSpanElement>(null);
  const selectedItemRef = useRef<HTMLLIElement>(null);

  // Push the dedicated `dev-logs` scope on top of `dev` when the dropdown is
  // open. This neutralizes the dev-scope shortcuts (s/w/r/o, Shift+G) and the
  // sheet/global ones while the user is navigating logs.
  useKeyboardScope("dev-logs", open, { modal: true });

  const fetchSessions = useCallback(async () => {
    if (process.env.NODE_ENV !== "development") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/debug");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ListResponse = await res.json();
      setSessions(data.sessions);
      // Reset cursor whenever we receive a fresh list so it stays in bounds.
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Auto-scroll selected item into view when the cursor moves.
  useEffect(() => {
    if (!open) return;
    selectedItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex]);

  const handleCopy = useCallback(async (filename: string) => {
    try {
      await navigator.clipboard.writeText(filename);
      setCopiedFilename(filename);
      setTimeout(() => {
        setCopiedFilename((cur) => (cur === filename ? null : cur));
      }, 1500);
    } catch {
      // Clipboard not available; ignore silently.
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(
        `/api/dev/debug?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSessions((cur) => {
        if (!cur) return cur;
        const idx = cur.findIndex((s) => s.id === id);
        const next = cur.filter((s) => s.id !== id);
        // Clamp selectedIndex so it stays on a valid item after removal.
        if (idx !== -1) {
          setSelectedIndex((sel) => {
            if (next.length === 0) return 0;
            if (sel >= next.length) return next.length - 1;
            return sel;
          });
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }, []);

  const handleDeleteAll = useCallback(async () => {
    if (process.env.NODE_ENV !== "development") return;
    try {
      const res = await fetch("/api/dev/debug", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSessions([]);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete all");
    }
  }, []);

  const openDropdown = useCallback(() => {
    setOpen((cur) => {
      if (cur) return cur;
      setSelectedIndex(0);
      // Always refresh on open to reflect any session recorded externally
      // (e.g. via the recorder button or other tabs).
      void fetchSessions();
      return true;
    });
  }, [fetchSessions]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleDropdown = useCallback(() => {
    setOpen((cur) => {
      const next = !cur;
      if (next) {
        setSelectedIndex(0);
        void fetchSessions();
      }
      return next;
    });
  }, [fetchSessions]);

  useImperativeHandle(
    ref,
    () => ({
      open: openDropdown,
      close: closeDropdown,
      toggle: toggleDropdown,
      isOpen: () => open,
    }),
    [openDropdown, closeDropdown, toggleDropdown, open]
  );

  // Keyboard handlers scoped to `dev-logs` — only fire while the dropdown is
  // open (the scope is pushed in the effect above and unbound on close).
  const currentItem =
    sessions && sessions.length > 0 ? sessions[selectedIndex] : null;
  const hasItems = (sessions?.length ?? 0) > 0;

  useAction(ACTION_IDS.DEV_LOGS_CURSOR_DOWN, "dev-logs", () => {
    if (hasItems) {
      setSelectedIndex((cur) => (cur + 1) % (sessions?.length ?? 1));
    }
  });

  useAction(ACTION_IDS.DEV_LOGS_CURSOR_UP, "dev-logs", () => {
    if (hasItems) {
      const len = sessions?.length ?? 1;
      setSelectedIndex((cur) => (cur - 1 + len) % len);
    }
  });

  useAction(ACTION_IDS.DEV_LOGS_COPY_FILENAME, "dev-logs", () => {
    if (currentItem) void handleCopy(currentItem.filename);
  });

  useAction(ACTION_IDS.DEV_LOGS_DELETE, "dev-logs", () => {
    if (currentItem) void handleDelete(currentItem.id);
  });

  useAction(ACTION_IDS.DEV_LOGS_DELETE_ALL, "dev-logs", () => {
    void handleDeleteAll();
  });

  useAction(ACTION_IDS.DEV_LOGS_REFRESH, "dev-logs", () => {
    void fetchSessions();
  });

  useAction(ACTION_IDS.DEV_LOGS_CLOSE, "dev-logs", () => {
    closeDropdown();
  });

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <span className={styles.logsContainer} ref={containerRef}>
      <button
        type="button"
        className={styles.toolbarButton}
        onClick={toggleDropdown}
        title="Browse recorded debug sessions"
        aria-label="Open debug logs"
      >
        <ScrollText className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
        {sessions ? (
          <span className={styles.toolbarCount}>{sessions.length}</span>
        ) : null}
      </button>

      {open ? (
        <div className={styles.logsDropdown} role="dialog">
          {loading ? (
            <div className={styles.logsState}>Loading…</div>
          ) : error ? (
            <div className={styles.logsState}>{error}</div>
          ) : !sessions || sessions.length === 0 ? (
            <div className={styles.logsState}>No sessions recorded.</div>
          ) : (
            <ul className={styles.logsList} role="listbox" aria-label="Recorded debug sessions">
              {sessions.map((session, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <li
                    key={session.id}
                    ref={isSelected ? selectedItemRef : null}
                    className={`${styles.logsItem} ${
                      isSelected ? styles.logsItemSelected : ""
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className={styles.logsItemMain}>
                      <span className={styles.logsItemFilename}>
                        {session.filename}
                      </span>
                      <span className={styles.logsItemMeta}>
                        {session.eventCount} events · {session.page}
                        {session.description ? ` · ${session.description}` : ""}
                      </span>
                    </div>
                    <div className={styles.logsItemActions}>
                      <span className={styles.toolbarGroup}>
                        <button
                          type="button"
                          className={`${styles.toolbarButton} ${styles.toolbarButtonGrouped}`}
                          onClick={() => handleCopy(session.filename)}
                          title={
                            copiedFilename === session.filename
                              ? "Copied to clipboard"
                              : "Copy filename to clipboard"
                          }
                          aria-label="Copy filename to clipboard"
                        >
                          {copiedFilename === session.filename ? (
                            <Check className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
                          ) : (
                            <Copy className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
                          )}
                        </button>
                        <button
                          type="button"
                          className={`${styles.toolbarButton} ${styles.toolbarButtonGrouped}`}
                          onClick={() => handleDelete(session.id)}
                          title="Delete this session"
                          aria-label="Delete this session"
                        >
                          <Trash2 className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className={styles.logsFooter}>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={handleDeleteAll}
              disabled={loading || !sessions || sessions.length === 0}
              title="Delete all recorded sessions"
              aria-label="Delete all recorded sessions"
            >
              <Trash2 className={styles.toolbarIcon} size={14} strokeWidth={2} aria-hidden="true" />
              <span className={styles.toolbarButtonText}>all</span>
            </button>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={fetchSessions}
              disabled={loading}
              title="Refresh session list"
              aria-label="Refresh session list"
            >
              <RefreshCw
                className={`${styles.toolbarIcon} ${loading ? styles.spinner : ""}`}
                size={14}
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
});
