"use client";

import { useRef, useState } from "react";
import { CommandExampleModal } from "@/components/sheets/command-example-modal";
import { CommandCopyModal } from "@/components/sheets/command-copy-modal";
import { useKeybindings } from "@/hooks/use-keybindings";
import { ACTION_IDS } from "@/lib/keybindings";
import { renderInlineCode } from "./render-inline-code";
import sheetCommandStyles from "./sheet-commands.module.css";

type SheetCommandProps = {
  title: string;
  command: string;
  aliases?: string[];
  description?: string;
  example?: string;
};

function parsePlaceholders(command: string | undefined): string[] {
  if (!command) return [];
  const matches = [...command.matchAll(/<([^>]+)>/g)];
  const unique = [...new Set(matches.map((m) => m[1]))];
  return unique;
}

function IconInfo() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="8.5" />
      <line x1="12" y1="11" x2="12" y2="16" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function SheetCommand({ title, command, aliases, description, example }: SheetCommandProps) {
  const [showExample, setShowExample] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { matchesAction } = useKeybindings();

  const placeholders = parsePlaceholders(command);
  const hasPlaceholders = placeholders.length > 0;
  const primaryAliasCommand = aliases?.[0];
  const copyValue = primaryAliasCommand ? `git ${primaryAliasCommand}` : command;
  const aliasDisplayValue = aliases?.length
    ? `git ${aliases.length === 1 ? aliases[0] : `(${aliases.join("|")})`}`
    : null;

  function handleCopyDirect() {
    navigator.clipboard.writeText(copyValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  function handleCopyAction() {
    if (hasPlaceholders) {
      setShowCopy(true);
    } else {
      handleCopyDirect();
    }
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-sheet-command-actions]")) return;
    const el = ref.current;
    if (!el) return;
    document.querySelectorAll<HTMLElement>("[data-sheet-command]").forEach((n) => {
      n.dataset.navFocused = "false";
    });
    el.dataset.navFocused = "true";
    el.focus({ preventScroll: true });
  }

  return (
    <>
      <div
        ref={ref}
        className={sheetCommandStyles.command}
        tabIndex={0}
        data-sheet-command
        data-nav-focused="false"
        aria-label={title}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (matchesAction(e.nativeEvent, ACTION_IDS.COPY_COMMAND)) {
            e.preventDefault();
            handleCopyAction();
          }
          if (matchesAction(e.nativeEvent, ACTION_IDS.SHOW_EXAMPLE) && example) {
            e.preventDefault();
            setShowExample(true);
          }
        }}
      >
        <div className={sheetCommandStyles.commandHeader}>
          <p className={sheetCommandStyles.commandTitle}>{title}</p>
          <div className={sheetCommandStyles.commandActions} data-sheet-command-actions>
            {example ? (
              <button
                type="button"
                className={sheetCommandStyles.commandActionButton}
                aria-label={`Show example for ${title}`}
                title="Show example (i)"
                onClick={() => setShowExample(true)}
              >
                <IconInfo />
              </button>
            ) : null}
            <button
              type="button"
              className={`${sheetCommandStyles.commandActionButton} ${copied ? sheetCommandStyles.commandActionButtonCopied : ""}`}
              aria-label={`Copy ${aliases?.length ? "alias" : "command"}: ${title}`}
              title={hasPlaceholders ? "Fill and copy (y)" : "Copy (y)"}
              onClick={handleCopyAction}
            >
              {copied ? <IconCheck /> : <IconCopy />}
            </button>
          </div>
        </div>
        {aliasDisplayValue ? (
          <>
            <p className={sheetCommandStyles.commandBlockLabel}>Alias</p>
            <p className={`${sheetCommandStyles.commandTerminal} ${sheetCommandStyles.commandAliasTerminal}`}>
              $ {aliasDisplayValue}
            </p>
            <p className={sheetCommandStyles.commandBlockLabel}>Original command</p>
            <p className={sheetCommandStyles.commandTerminal}>$ {command}</p>
          </>
        ) : (
          <p className={sheetCommandStyles.commandTerminal}>$ {command}</p>
        )}
        {description ? <p className={sheetCommandStyles.commandDescription}>{renderInlineCode(description)}</p> : null}
      </div>

      {showExample && example ? (
        <CommandExampleModal
          title={title}
          command={`$ ${command}`}
          example={`$ ${example}`}
          onClose={() => setShowExample(false)}
        />
      ) : null}

      {showCopy && command ? (
        <CommandCopyModal
          title={title}
          command={command}
          placeholders={placeholders}
          onClose={() => setShowCopy(false)}
        />
      ) : null}
    </>
  );
}
