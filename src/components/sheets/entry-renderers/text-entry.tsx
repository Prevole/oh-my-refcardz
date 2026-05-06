import { registerHandler } from "./entry-registry";
import { InlineRichText } from "../inline-rich-text";
import styles from "../cheatsheet-rendering.module.css";

export function TextEntry({ value }: { value: string }) {
  return <p className={styles.configDescription}><InlineRichText text={value} /></p>;
}

registerHandler("text", (value) => <TextEntry value={value} />);
