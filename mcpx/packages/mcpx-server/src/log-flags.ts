import { AllowedLogHideTagsEnum, env } from "./env.js";

/*
 * Log flags to control various logging features based on environment configuration.
 * Exported as positive flags for easier readability in conditional statements.
 */
const tags = new Set<string>(env.LOG_HIDE_TAGS);
export const LOG_FLAGS = {
  LOG_CLIENT_ACCESS_LOG: !tags.has(AllowedLogHideTagsEnum.CLIENT_ACCESS_LOG),
  LOG_AUDIT_LOG_PERSISTENCE: !tags.has(
    AllowedLogHideTagsEnum.AUDIT_LOG_PERSISTENCE,
  ),
  LOG_DETAILED_TOOL_LISTINGS: !tags.has(
    AllowedLogHideTagsEnum.DETAILED_TOOL_LISTINGS,
  ),
};
