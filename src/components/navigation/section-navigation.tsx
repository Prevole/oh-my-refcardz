"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./section-navigation.module.css";

type SectionNavigationItem = {
  id: string;
  label: string;
  color: string;
};

type Props = {
  items: SectionNavigationItem[];
  ariaLabel: string;
};

export function SectionNavigation({ items, ariaLabel }: Props) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (items.length === 0) return;

    const sectionElements = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null);

    if (sectionElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visibleEntries.length > 0) {
          setActiveId(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-35% 0px -55% 0px",
        threshold: 0.01,
      }
    );

    sectionElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav className={styles.nav} aria-label={ariaLabel}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item} style={{ "--section-color": item.color } as CSSProperties}>
            <a
              href={`#${item.id}`}
              className={styles.link}
              data-active={activeId === item.id}
              aria-label={`Go to ${item.label}`}
              title={item.label}
            />
            <span className={styles.label}>{item.label}</span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
