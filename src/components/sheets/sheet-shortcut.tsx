import { ArrowGlyph } from "@/components/ui/arrow-glyph";
import cheatsheetStyles from "./cheatsheet-rendering.module.css";

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
    <div className={cheatsheetStyles.shortcut}>
      <div className={cheatsheetStyles.shortcutKeys}>
        {keys.map((keyCombo, index) => (
          <KeyCombo key={`${keyCombo}-${index}`} combo={keyCombo} />
        ))}
      </div>
      <p className={cheatsheetStyles.shortcutDescription}>{description}</p>
    </div>
  );
}

function KeyCombo({ combo }: { combo: string }) {
  if (combo.includes(" + ")) {
    const parts = combo.split(" + ");
    return (
      <code className={cheatsheetStyles.codeCombo}>
        {parts.map((part, index) => (
          <span key={`${part}-${index}`} className={cheatsheetStyles.codePartWrap}>
            <KeyPart part={part} />
            {index < parts.length - 1 ? <span className={cheatsheetStyles.codeSep}>+</span> : null}
          </span>
        ))}
      </code>
    );
  }

  if (combo.includes("|")) {
    const parts = combo.split("|");
    return (
      <code className={cheatsheetStyles.codeCombo}>
        {parts.map((part, index) => (
          <span key={`${part}-${index}`} className={cheatsheetStyles.codePartWrap}>
            <KeyPart part={part.trim()} />
            {index < parts.length - 1 ? <span className={cheatsheetStyles.codeSep}>|</span> : null}
          </span>
        ))}
      </code>
    );
  }

  return (
    <code className={cheatsheetStyles.codeCombo}>
      <span className={cheatsheetStyles.codePartWrap}>
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
      <span className={`${cheatsheetStyles.codePart} ${isSingle ? cheatsheetStyles.codeSingle : ""}`}>
        {renderWithArrows(part)}
      </span>
    );
  }

  return (
    <span className={`${cheatsheetStyles.codePart} ${isSingle ? cheatsheetStyles.codeSingle : ""}`}>{part}</span>
  );
}

function isSingleKey(value: string): boolean {
  return ["^", "⌘", "⌥", "⇧", "↩", "⎋", "←", "↑", "↓", "→"].includes(value.trim());
}

function renderWithArrows(value: string) {
  return value.split("").map((char, index) => {
    if (char === " ") return " ";
    if (char === "←") return <ArrowGlyph key={`left-${index}`} direction="left" className={cheatsheetStyles.inlineArrow} />;
    if (char === "↑") return <ArrowGlyph key={`up-${index}`} direction="up" className={cheatsheetStyles.inlineArrow} />;
    if (char === "↓") return <ArrowGlyph key={`down-${index}`} direction="down" className={cheatsheetStyles.inlineArrow} />;
    if (char === "→") return <ArrowGlyph key={`right-${index}`} direction="right" className={cheatsheetStyles.inlineArrow} />;
    return <span key={`char-${index}`}>{char}</span>;
  });
}
