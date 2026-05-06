import { registerHandler } from "./entry-registry";
import { ArrowGlyph } from "@/components/ui/arrow-glyph";
import styles from "../cheatsheet-rendering.module.css";

export function KeysEntry({ keys }: { keys: string[] }) {
  return (
    <div className={styles.shortcut}>
      <div className={styles.shortcutKeys}>
        {keys.map((keyCombo, index) => (
          <KeyCombo key={`${keyCombo}-${index}`} combo={keyCombo} />
        ))}
      </div>
    </div>
  );
}

function KeyCombo({ combo }: { combo: string }) {
  if (combo.includes(" + ")) {
    const parts = combo.split(" + ");
    return (
      <code className={styles.codeCombo}>
        {parts.map((part, index) => (
          <span key={`${part}-${index}`} className={styles.codePartWrap}>
            <KeySequence value={part} />
            {index < parts.length - 1 ? <span className={styles.codeSep}>+</span> : null}
          </span>
        ))}
      </code>
    );
  }

  if (combo.includes("|")) {
    const parts = combo.split("|");
    return (
      <code className={styles.codeCombo}>
        {parts.map((part, index) => (
          <span key={`${part}-${index}`} className={styles.codePartWrap}>
            <KeySequence value={part.trim()} />
            {index < parts.length - 1 ? <span className={styles.codeSep}>|</span> : null}
          </span>
        ))}
      </code>
    );
  }

  return (
    <code className={styles.codeCombo}>
      <span className={styles.codePartWrap}>
        <KeySequence value={combo} />
      </span>
    </code>
  );
}

function KeySequence({ value }: { value: string }) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return <KeyPart part={value.trim()} />;
  }

  return (
    <span className={styles.codeSequence}>
      {parts.map((part, index) => (
        <KeyPart key={`${part}-${index}`} part={part} />
      ))}
    </span>
  );
}

function KeyPart({ part }: { part: string }) {
  const isSingle = isSingleKey(part);
  const hasArrow = /[←↑↓→]/.test(part);

  if (hasArrow) {
    return (
      <span className={`${styles.codePart} ${isSingle ? styles.codeSingle : ""}`}>
        {renderWithArrows(part)}
      </span>
    );
  }

  return (
    <span className={`${styles.codePart} ${isSingle ? styles.codeSingle : ""}`}>{part}</span>
  );
}

function isSingleKey(value: string): boolean {
  return ["^", "⌘", "⌥", "⇧", "↩", "⎋", "←", "↑", "↓", "→"].includes(value.trim());
}

function renderWithArrows(value: string) {
  return value.split("").map((char, index) => {
    if (char === " ") return " ";
    if (char === "←") return <ArrowGlyph key={`left-${index}`} direction="left" className={styles.inlineArrow} />;
    if (char === "↑") return <ArrowGlyph key={`up-${index}`} direction="up" className={styles.inlineArrow} />;
    if (char === "↓") return <ArrowGlyph key={`down-${index}`} direction="down" className={styles.inlineArrow} />;
    if (char === "→") return <ArrowGlyph key={`right-${index}`} direction="right" className={styles.inlineArrow} />;
    return <span key={`char-${index}`}>{char}</span>;
  });
}

registerHandler("keys", (value) => <KeysEntry keys={value} />);
