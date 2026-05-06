"use client";

import { useState } from "react";
import { registerHandler } from "./entry-registry";
import { useShowCopyModal } from "../sheet-commands-shell";
import { hasPlaceholders, formatDisplayValue } from "@/lib/placeholder-parser";
import styles from "../sheet-commands.module.css";

type CommandLikeProps = {
  type: "command" | "example";
  value: string;
  showLabel?: boolean;
};

type AliasesProps = {
  aliases: string[];
};

type TerminalProps = {
  value: string;
  displayOverride?: string;
  variant?: "default" | "alias" | "example";
};

function IconCopy() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
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
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Terminal({ value, displayOverride, variant = "default" }: TerminalProps) {
  const [copied, setCopied] = useState(false);
  const showCopyModal = useShowCopyModal();
  const withPlaceholders = hasPlaceholders(value);
  const displayValue = displayOverride ?? `$ ${formatDisplayValue(value)}`;

  function handleSelect(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-copy-button]")) return;

    document.querySelectorAll<HTMLElement>("[data-copyable]").forEach((el) => {
      el.dataset.navFocused = "false";
    });
    (e.currentTarget as HTMLElement).dataset.navFocused = "true";
  }

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    
    if (withPlaceholders) {
      showCopyModal({ command: value });
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const variantClass = variant === "alias"
    ? styles.commandAliasTerminal
    : variant === "example"
      ? styles.commandExampleTerminal
      : "";

  const className = variantClass
    ? `${styles.commandTerminal} ${variantClass}`
    : styles.commandTerminal;

  return (
    <div
      className={className}
      data-copyable={value}
      data-copied={copied ? "true" : undefined}
      onClick={handleSelect}
    >
      <span className={styles.terminalText}>{displayValue}</span>
      <button
        type="button"
        className={`${styles.terminalCopyButton} ${copied ? styles.terminalCopyButtonCopied : ""}`}
        aria-label="Copy"
        title="Copy (y)"
        onClick={handleCopy}
        data-copy-button
      >
        {copied ? <IconCheck /> : <IconCopy />}
      </button>
    </div>
  );
}

export function CommandLike({ type, value, showLabel }: CommandLikeProps) {
  const label = type === "command" ? "Command" : "Example";
  const variant = type === "example" ? "example" : "default";

  return (
    <>
      {showLabel && <p className={styles.commandBlockLabel}>{label}</p>}
      <Terminal value={value} variant={variant} />
    </>
  );
}

export function AliasesEntry({ aliases }: AliasesProps) {
  const aliasDisplay = aliases.length === 1
    ? aliases[0]
    : `(${aliases.join("|")})`;

  const copyValue = `git ${aliases[0]}`;

  return (
    <>
      <p className={styles.commandBlockLabel}>Alias</p>
      <Terminal
        value={copyValue}
        displayOverride={`$ git ${aliasDisplay}`}
        variant="alias"
      />
    </>
  );
}

registerHandler("command", (value, { hasAliases }) => (
  <CommandLike type="command" value={value} showLabel={hasAliases} />
));

registerHandler("alias", (value) => <AliasesEntry aliases={[value]} />);

registerHandler("aliases", (value) => <AliasesEntry aliases={value} />);

registerHandler("example", (value) => (
  <CommandLike type="example" value={value} showLabel={true} />
));

registerHandler("examples", (values) => (
  <>
    {values.map((value, index) => (
      <CommandLike key={index} type="example" value={value} showLabel={index === 0} />
    ))}
  </>
));
