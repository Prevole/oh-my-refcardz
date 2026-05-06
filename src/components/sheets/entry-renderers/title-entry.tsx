import { registerHandler } from "./entry-registry";
import { InlineRichText } from "../inline-rich-text";
import styles from "../cheatsheet-rendering.module.css";

export function TitleEntry({ value }: { value: string }) {
  return <p className={styles.configTitle} data-entry-title><InlineRichText text={value} /></p>;
}

registerHandler("title", (value) => <TitleEntry value={value} />);
