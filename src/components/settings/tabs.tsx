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
  variant?: "primary" | "secondary" | "tertiary";
  focusedTabId?: string | null;
};

export function Tabs({
  tabs,
  activeTab,
  onChange,
  testIdPrefix,
  variant = "primary",
  focusedTabId = null,
}: TabsProps) {
  const stripClass =
    variant === "tertiary"
      ? `${styles.tabs} ${styles.tabsTertiary}`
      : variant === "secondary"
        ? `${styles.tabs} ${styles.tabsSecondary}`
        : styles.tabs;
  const tabBaseClass =
    variant === "tertiary"
      ? `${styles.tab} ${styles.tabTertiary}`
      : variant === "secondary"
        ? `${styles.tab} ${styles.tabSecondary}`
        : styles.tab;

  return (
    <div className={stripClass} data-variant={variant}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${tabBaseClass} ${activeTab === tab.id ? styles.tabActive : ""} ${tab.disabled ? styles.tabDisabled : ""}`}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
          data-testid={testIdPrefix ? `${testIdPrefix}-${tab.id}` : undefined}
          data-focused={focusedTabId === tab.id || undefined}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
