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
};

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""} ${tab.disabled ? styles.tabDisabled : ""}`}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
