"use client";

import { useRef, useState } from "react";
import { CommandExampleModal } from "@/components/sheets/command-example-modal";
// TODO: Re-enable after entry-based copy is implemented
// import { CommandCopyModal } from "@/components/sheets/command-copy-modal";
// import { useKeybindings } from "@/hooks/use-keybindings";
// import { ACTION_IDS } from "@/lib/keybindings";
import { renderInlineCode } from "./render-inline-code";
import sheetCommandStyles from "./sheet-commands.module.css";

type SheetCommandProps = {
  title: string;
  command: string;
  aliases?: string[];
  description?: string;
  example?: string;
};

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

// TODO: Re-enable after entry-based copy is implemented
// function IconCopy() { ... }
// function IconCheck() { ... }

export function SheetCommand({ title, command, aliases, description, example }: SheetCommandProps) {
  const [showExample, setShowExample] = useState(false);
  // TODO: Re-enable after entry-based copy is implemented
  // const [showCopy, setShowCopy] = useState(false);
  // const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const aliasDisplayValue = aliases?.length
    ? `git ${aliases.length === 1 ? aliases[0] : `(${aliases.join("|")})`}`
    : null;

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
        // TODO: Re-enable after entry-based copy/navigation is implemented
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
            {/* TODO: Re-enable copy button after entry-based copy is implemented */}
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

      {/* TODO: Re-enable after entry-based copy is implemented */}
    </>
  );
}
