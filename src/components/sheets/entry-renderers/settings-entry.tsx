import { registerHandler } from "./entry-registry";
import styles from "../cheatsheet-rendering.module.css";

export function SettingsEntry({ settings }: { settings: string[] }) {
  return (
    <div className={styles.appSettingsList}>
      {settings.map((setting, index) => (
        <div key={index} className={styles.appSettingsRow}>
          <span className={styles.appSettingsBullet} />
          <code className={styles.appSettingsRowCode}>{setting}</code>
        </div>
      ))}
    </div>
  );
}

registerHandler("settings", (value) => <SettingsEntry settings={value} />);
