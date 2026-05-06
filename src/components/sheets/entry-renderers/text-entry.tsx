import { registerHandler } from "./entry-registry";
import { renderInlineCode } from "../render-inline-code";
import styles from "../cheatsheet-rendering.module.css";

export function TextEntry({ value }: { value: string }) {
  return <p className={styles.configDescription}>{renderInlineCode(value)}</p>;
}

registerHandler("text", (value) => <TextEntry value={value} />);
