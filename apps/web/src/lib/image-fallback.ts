import type { SyntheticEvent } from "react";

export const applySvgFallback = (event: SyntheticEvent<HTMLImageElement>, svg: string): void => {
  const target = event.currentTarget;
  target.onerror = null;
  target.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
