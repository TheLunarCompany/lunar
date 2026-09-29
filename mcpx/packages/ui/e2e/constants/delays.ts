/**
 * Test delay constants in milliseconds
 * Use these constants instead of magic numbers for better readability and maintainability
 */

// Standard delays
export const DELAY_1_SEC = 1000;
export const DELAY_2_SEC = 2000;
export const DELAY_5_SEC = 5000;
export const DELAY_10_SEC = 10000;

// Timeout constants for Playwright
export const TIMEOUT_5_SEC = 5000;
export const TIMEOUT_10_SEC = 10000;

// Date calculation helpers (in milliseconds)
export const DELAY_30_SEC = 1000 * 30;
export const DELAY_5_MIN = 1000 * 60 * 5;

// Legacy aliases for backward compatibility during migration
export const WAIT_DELAY = DELAY_2_SEC;
export const TIMEOUT = TIMEOUT_5_SEC;
export const LONG_TIMEOUT = TIMEOUT_10_SEC;
