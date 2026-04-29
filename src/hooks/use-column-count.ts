import { useEffect, useRef, useState } from "react";

/**
 * Returns the current number of columns in a CSS grid container.
 * Reacts to window resizes so the value stays in sync with responsive breakpoints.
 */
export function useColumnCount<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    function measure() {
      if (!ref.current) return;
      const value = getComputedStyle(ref.current).gridTemplateColumns;
      // gridTemplateColumns is a space-separated list of track sizes, one per column.
      setColumns(value.split(" ").length);
    }

    measure();

    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  return [ref, columns];
}
