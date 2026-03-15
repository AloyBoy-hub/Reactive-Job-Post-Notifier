export const delay = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

export const normalizeDelay = (milliseconds: number): number => {
  if (!Number.isFinite(milliseconds)) {
    return 2500;
  }
  return Math.max(2000, Math.min(milliseconds, 7000));
};
