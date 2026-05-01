import type { ReactNode } from "react";
import { ArrowGlyph } from "./arrow-glyph";
import styles from "./keybinding-display.module.css";

type Props = {
  children: ReactNode;
};

/**
 * Renders a single keyboard key in the same visual style as the cheat sheet key caps.
 * Pass an arrow Unicode character (← ↑ ↓ →) and it will render as an SVG glyph.
 */
export function Keycap({ children }: Props) {
  const isArrow =
    children === "←" || children === "↑" || children === "↓" || children === "→";

  return (
    <span className={styles.keycap}>
      {isArrow && typeof children === "string" ? (
        <ArrowGlyph
          direction={
            children === "←" ? "left" : children === "→" ? "right" : children === "↑" ? "up" : "down"
          }
          className={styles.keycapArrow}
        />
      ) : (
        children
      )}
    </span>
  );
}
