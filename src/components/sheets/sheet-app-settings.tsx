import cheatsheetStyles from "./cheatsheet-rendering.module.css";
import { renderInlineCode } from "./render-inline-code";

type AppSettingsElement = {
  where?: string;
  description?: string;
  settings?: string[];
};

type SheetAppSettingsProps = {
  title: string;
  entries: AppSettingsElement[];
};

export function SheetAppSettings({ title, entries }: SheetAppSettingsProps) {
  return (
    <div className={cheatsheetStyles.appSettingsItem}>
      <div className={cheatsheetStyles.configHeader}>
        <p className={cheatsheetStyles.configTitle}>{title}</p>
      </div>
      <div className={cheatsheetStyles.appSettingsList}>
        {entries.map((element, index) => (
          <div key={index} className={cheatsheetStyles.appSettingsEntry}>
            {element.where ? (
              <p className={cheatsheetStyles.appSettingsLocationLine}>
                <span className={cheatsheetStyles.appSettingsLocationLabel}>where:</span>
                <span className={cheatsheetStyles.appSettingsLocation}>{element.where}</span>
              </p>
            ) : null}
            {element.description ? (
              <p className={cheatsheetStyles.appSettingsEntryDescription}>{renderInlineCode(element.description)}</p>
            ) : null}
            {element.settings?.length ? (
              <div className={cheatsheetStyles.appSettingsBlock}>
                <p className={cheatsheetStyles.appSettingsBlockTitle}>
                  <span className={cheatsheetStyles.appSettingsLocationLabel}>Settings</span>
                </p>
                {element.settings.map((setting, settingIndex) => (
                  <div key={settingIndex} className={cheatsheetStyles.appSettingsRow}>
                    <span className={cheatsheetStyles.appSettingsBullet} aria-hidden="true" />
                    <span className={cheatsheetStyles.appSettingsRowCode}>{setting}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
