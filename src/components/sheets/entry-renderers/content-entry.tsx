import { registerHandler } from "./entry-registry";
import styles from "../cheatsheet-rendering.module.css";

export function ContentEntry({ value }: { value: string }) {
  return (
    <pre className={styles.configBlock} data-copyable={value}>
      <code>{value}</code>
    </pre>
  );
}

registerHandler("content", (value) => <ContentEntry value={value} />);
