import type { ReactNode } from "react";
import { ArrowGlyph } from "./arrow-glyph";

type Props = {
  children?: ReactNode;
};

export function SheetCode({ children }: Props) {
  const text = typeof children === "string" ? children : "";

  if (text.includes(" + ")) {
    const parts = text.split(" + ");
    return (
      <code className="sheet-code-combo">
        {parts.map((part, index) => (
          <span key={`${part}-${index}`} className="sheet-code-part-wrap">
            {renderPart(part)}
            {index < parts.length - 1 ? <span className="sheet-code-sep">+</span> : null}
          </span>
        ))}
      </code>
    );
  }

  if (containsArrow(text)) {
    return <code>{renderWithArrows(text)}</code>;
  }

  if (isSingleTouch(text)) {
    return <code className="sheet-code-single">{text}</code>;
  }

  return <code>{children}</code>;
}

function renderPart(part: string) {
  if (containsArrow(part)) {
    return <span className="sheet-code-part">{renderWithArrows(part)}</span>;
  }

  if (isSingleTouch(part)) {
    return <span className="sheet-code-part sheet-code-single">{part}</span>;
  }

  return <span className="sheet-code-part">{part}</span>;
}

function isSingleTouch(value: string): boolean {
  return ["^", "⌘", "⌥", "⇧", "↩", "⎋", "←", "↑", "↓", "→"].includes(value.trim());
}

function containsArrow(value: string): boolean {
  return /[←↑↓→]/.test(value);
}

function renderWithArrows(value: string) {
  return value.split("").map((char, index) => {
    if (char === " ") {
      return " ";
    }
    if (char === "←") {
      return <ArrowGlyph key={`left-${index}`} direction="left" className="sheet-inline-arrow" />;
    }
    if (char === "↑") {
      return <ArrowGlyph key={`up-${index}`} direction="up" className="sheet-inline-arrow" />;
    }
    if (char === "↓") {
      return <ArrowGlyph key={`down-${index}`} direction="down" className="sheet-inline-arrow" />;
    }
    if (char === "→") {
      return <ArrowGlyph key={`right-${index}`} direction="right" className="sheet-inline-arrow" />;
    }
    return <span key={`char-${index}`}>{char}</span>;
  });
}

