"use client";

import styles from "./tabs.module.css";

type Tab = {
  id: string;
  label: string;
  disabled?: boolean;
};

type TabsProps = {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  testIdPrefix?: string;
};

export function Tabs({ tabs, activeTab, onChange, testIdPrefix }: TabsProps) {
  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""} ${tab.disabled ? styles.tabDisabled : ""}`}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
          data-testid={testIdPrefix ? `${testIdPrefix}-${tab.id}` : undefined}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
