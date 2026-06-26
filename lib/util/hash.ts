import { createHash } from "node:crypto";

export const createContentHash = (input: string): string => {
  return createHash("sha256").update(input).digest("hex");
};
