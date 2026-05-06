import { registerHandler } from "./entry-registry";
import { InlineCodeText } from "../inline-code-text";
import styles from "../cheatsheet-rendering.module.css";

export function TitleEntry({ value }: { value: string }) {
  return <p className={styles.configTitle} data-entry-title><InlineCodeText text={value} /></p>;
}

registerHandler("title", (value) => <TitleEntry value={value} />);
