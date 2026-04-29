import { ArrowGlyph } from "@/components/arrow-glyph";

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
    <div className="sheet-shortcut">
      <div className="sheet-shortcut-keys">
        {keys.map((keyCombo, index) => (
          <KeyCombo key={`${keyCombo}-${index}`} combo={keyCombo} />
        ))}
      </div>
      <p className="sheet-shortcut-description">{description}</p>
    </div>
  );
}

function KeyCombo({ combo }: { combo: string }) {
  if (combo.includes(" + ")) {
    const parts = combo.split(" + ");
    return (
      <code className="sheet-code-combo">
        {parts.map((part, index) => (
          <span key={`${part}-${index}`} className="sheet-code-part-wrap">
            <KeyPart part={part} />
            {index < parts.length - 1 ? <span className="sheet-code-sep">+</span> : null}
          </span>
        ))}
      </code>
    );
  }

  if (combo.includes("|")) {
    const parts = combo.split("|");
    return (
      <code className="sheet-code-combo">
        {parts.map((part, index) => (
          <span key={`${part}-${index}`} className="sheet-code-part-wrap">
            <KeyPart part={part.trim()} />
            {index < parts.length - 1 ? <span className="sheet-code-sep">|</span> : null}
          </span>
        ))}
      </code>
    );
  }

  return (
    <code className="sheet-code-combo">
      <span className="sheet-code-part-wrap">
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
      <span className={`sheet-code-part${isSingle ? " sheet-code-single" : ""}`}>
        {renderWithArrows(part)}
      </span>
    );
  }

  return (
    <span className={`sheet-code-part${isSingle ? " sheet-code-single" : ""}`}>{part}</span>
  );
}

function isSingleKey(value: string): boolean {
  return ["^", "⌘", "⌥", "⇧", "↩", "⎋", "←", "↑", "↓", "→"].includes(value.trim());
}

function renderWithArrows(value: string) {
  return value.split("").map((char, index) => {
    if (char === " ") return " ";
    if (char === "←") return <ArrowGlyph key={`left-${index}`} direction="left" className="sheet-inline-arrow" />;
    if (char === "↑") return <ArrowGlyph key={`up-${index}`} direction="up" className="sheet-inline-arrow" />;
    if (char === "↓") return <ArrowGlyph key={`down-${index}`} direction="down" className="sheet-inline-arrow" />;
    if (char === "→") return <ArrowGlyph key={`right-${index}`} direction="right" className="sheet-inline-arrow" />;
    return <span key={`char-${index}`}>{char}</span>;
  });
}
