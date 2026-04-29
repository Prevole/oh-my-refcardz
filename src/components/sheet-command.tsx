"use client";

import { useEffect, useRef, useState } from "react";
import { CommandExampleModal } from "@/components/command-example-modal";
import { CommandCopyModal } from "@/components/command-copy-modal";

type SheetCommandProps = {
  title: string;
  command?: string;
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

export function SheetCommand({ title, command, description, example }: SheetCommandProps) {
  const [showExample, setShowExample] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const placeholders = parsePlaceholders(command);
  const hasPlaceholders = placeholders.length > 0;

  function handleCopyDirect() {
    if (!command) return;
    navigator.clipboard.writeText(command).then(() => {
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

  // Expose DOM node for navigation hook via data attribute
  return (
    <>
      <div
        ref={ref}
        className="sheet-command"
        tabIndex={0}
        data-sheet-command
        aria-label={title}
        onKeyDown={(e) => {
          // These keys are handled locally when focused; navigation keys are global
          if (e.key === "y") {
            e.preventDefault();
            handleCopyAction();
          }
          if (e.key === "i" && example) {
            e.preventDefault();
            setShowExample(true);
          }
        }}
      >
        <div className="sheet-command-header">
          <p className="sheet-command-title">{title}</p>
          <div className="sheet-command-actions">
            {example ? (
              <button
                type="button"
                className="sheet-command-action"
                aria-label={`Show example for ${title}`}
                title="Show example (i)"
                onClick={() => setShowExample(true)}
              >
                <IconInfo />
              </button>
            ) : null}
            <button
              type="button"
              className={`sheet-command-action${copied ? " sheet-command-action--copied" : ""}`}
              aria-label={`Copy command: ${title}`}
              title={hasPlaceholders ? "Fill and copy (y)" : "Copy (y)"}
              onClick={handleCopyAction}
            >
              {copied ? <IconCheck /> : <IconCopy />}
            </button>
          </div>
        </div>
        {command ? <p className="sheet-terminal">$ {command}</p> : null}
        {description ? <p className="sheet-command-description">{description}</p> : null}
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
