import { DEFAULT_SCRAPE_DELAY_MS, MAX_SCRAPE_DELAY_MS, MIN_SCRAPE_DELAY_MS } from "../config/constants";

export const delay = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

export const normalizeDelay = (milliseconds: number): number => {
  if (!Number.isFinite(milliseconds)) {
    return DEFAULT_SCRAPE_DELAY_MS;
  }
  return Math.max(MIN_SCRAPE_DELAY_MS, Math.min(milliseconds, MAX_SCRAPE_DELAY_MS));
};
