// Re-export shared types under the names the frontend uses, so existing imports
// keep working while the definitions live in one place (shared/types.ts).
export type { SourceType, ScrapeStatus, Job, TrackedUrl } from "../shared/types";
export type { ScrapeResult as ScrapeResponse } from "../shared/types";
