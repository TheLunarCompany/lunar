import { z } from "zod/v4";

export const SETUP_DESCRIPTION_CONFIG = {
  maxLength: 200,
  // Character allowlist: a-z, A-Z, 0-9, space, -_(),.!?&:'"
  allowedCharPattern: /^[a-zA-Z0-9 \-_(),.!?&:'"]*$/,
  allowedCharDescription: `letters, numbers, spaces, and -_(),.!?&':" allowed`,
} as const;

export const setupDescriptionSchema = z
  .string()
  .trim()
  .min(1, "Description cannot be empty")
  .max(
    SETUP_DESCRIPTION_CONFIG.maxLength,
    `Description cannot exceed ${SETUP_DESCRIPTION_CONFIG.maxLength} characters`,
  )
  .refine(
    (s) => SETUP_DESCRIPTION_CONFIG.allowedCharPattern.test(s),
    `Invalid characters: only ${SETUP_DESCRIPTION_CONFIG.allowedCharDescription}`,
  );
