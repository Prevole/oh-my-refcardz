import { registerHandler } from "./entry-registry";
import styles from "../cheatsheet-rendering.module.css";

export function TitleEntry({ value }: { value: string }) {
  return <p className={styles.configTitle}>{value}</p>;
}

registerHandler("title", (value) => <TitleEntry value={value} />);
