import { ArrowGlyph } from "@/components/arrow-glyph";
import styles from "./sheet-rendering.module.css";

type Props = {
  keys: string[];
  description: string;
};

/**
 * Renders a shortcut row: one or more key combinations + a description.
 * Key syntax supported:
 *   - "Cmd + v"          → combo with + separator
 *   - "h|j|k|l"         → alternatives with | separator
 *   - "←", "→", "↑", "↓" → arrow SVG glyphs
 */
export function SheetShortcut({ keys, description }: Props) {
  return (
    <div className={styles.shortcut}>
      <div className={styles.shortcutKeys}>
        {keys.map((keyCombo, index) => (
          <KeyCombo key={`${keyCombo}-${index}`} combo={keyCombo} />
        ))}
      </div>
      <p className={styles.shortcutDescription}>{description}</p>
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
            <KeyPart part={part} />
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
            <KeyPart part={part.trim()} />
            {index < parts.length - 1 ? <span className={styles.codeSep}>|</span> : null}
          </span>
        ))}
      </code>
    );
  }

  return (
    <code className={styles.codeCombo}>
      <span className={styles.codePartWrap}>
        <KeyPart part={combo} />
      </span>
    </code>
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
