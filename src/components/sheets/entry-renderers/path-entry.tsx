import { registerHandler } from "./entry-registry";
import styles from "../cheatsheet-rendering.module.css";

type PathLikeProps = {
  type: "file" | "where";
  value: string;
};

export function PathLike({ type, value }: PathLikeProps) {
  const label = type === "file" ? "File" : "Where";
  const lineClass = type === "file" ? styles.configFileLine : styles.appSettingsLocationLine;
  const labelClass = type === "file" ? styles.configFileLabel : styles.appSettingsLocationLabel;
  const valueClass = type === "file" ? styles.configFile : styles.appSettingsLocation;

  return (
    <p className={lineClass}>
      <span className={labelClass}>{label}</span>
      <span className={valueClass}>{value}</span>
    </p>
  );
}

registerHandler("file", (value) => <PathLike type="file" value={value} />);

registerHandler("where", (value) => <PathLike type="where" value={value} />);
