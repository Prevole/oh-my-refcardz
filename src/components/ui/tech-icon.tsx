"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Props = {
  icon: string;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

const DEFAULT_ICON = "/icons/default.svg";

const svgCache = new Map<string, string>();
const pendingFetches = new Map<string, Promise<string | null>>();

function getIconPath(icon: string): string {
  return icon.startsWith("/") ? icon : `/icons/${icon}.svg`;
}

function getCachedSvg(iconPath: string): string | null {
  return svgCache.get(iconPath) ?? null;
}

async function fetchSvg(path: string): Promise<string | null> {
  if (svgCache.has(path)) {
    return svgCache.get(path)!;
  }

  if (pendingFetches.has(path)) {
    return pendingFetches.get(path)!;
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        return null;
      }
      const svg = await response.text();
      const cleaned = svg.replace(/<\?xml[^>]*\?>/g, "").trim();
      svgCache.set(path, cleaned);
      return cleaned;
    } catch {
      return null;
    } finally {
      pendingFetches.delete(path);
    }
  })();

  pendingFetches.set(path, fetchPromise);
  return fetchPromise;
}

export function TechIcon({ icon, color, className = "", style }: Props) {
  const iconPath = getIconPath(icon);
  const [svgContent, setSvgContent] = useState<string | null>(() => getCachedSvg(iconPath));

  useEffect(() => {
    const currentIconPath = getIconPath(icon);

    const cached = getCachedSvg(currentIconPath);
    if (cached && svgContent === cached) {
      return;
    }

    let cancelled = false;

    const loadIcon = async () => {
      const svg = await fetchSvg(currentIconPath);
      if (cancelled) return;

      if (svg) {
        setSvgContent(svg);
      } else if (currentIconPath !== DEFAULT_ICON) {
        const fallbackSvg = await fetchSvg(DEFAULT_ICON);
        if (!cancelled && fallbackSvg) {
          setSvgContent(fallbackSvg);
        }
      }
    };

    loadIcon();

    return () => {
      cancelled = true;
    };
  }, [icon, svgContent]);

  if (!svgContent) {
    return null;
  }

  return (
    <div
      className={`tech-icon ${className}`}
      style={color ? { color, ...style } : style}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is loaded from trusted local files
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
