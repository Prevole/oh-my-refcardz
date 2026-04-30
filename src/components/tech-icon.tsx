"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Props = {
  icon: string;
  color: string;
  className?: string;
  style?: CSSProperties;
};

const DEFAULT_ICON = "/icons/default.svg";

export function TechIcon({ icon, color, className = "", style }: Props) {
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    const iconPath = icon.startsWith("/") ? icon : `/icons/${icon}.svg`;

    const loadIcon = async (path: string, fallback = true): Promise<void> => {
      try {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Failed to load icon: ${path}`);
        }
        const svg = await response.text();
        const cleaned = svg.replace(/<\?xml[^>]*\?>/g, "").trim();
        setSvgContent(cleaned);
      } catch {
        if (fallback && path !== DEFAULT_ICON) {
          await loadIcon(DEFAULT_ICON, false);
        } else {
          setSvgContent(null);
        }
      }
    };

    loadIcon(iconPath);
  }, [icon]);

  if (!svgContent) {
    return null;
  }

  return (
    <div
      className={`tech-icon ${className}`}
      style={{ color, ...style }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is loaded from trusted local files
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
