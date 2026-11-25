import {
  CONSENT_PROMPT,
  ExtraAuthorizationParams,
  OAUTH_PROMPT_PARAM,
  Prompt,
} from "./model.js";

export function applyAuthorizationParams(
  authorizationUrl: URL,
  { access_type, prompt, consentSupported }: ExtraAuthorizationParams,
): void {
  if (access_type) {
    authorizationUrl.searchParams.set("access_type", access_type);
  }

  // The SDK adds consent for offline_access. Keep it only if the server
  // advertises support, since some servers reject unsupported prompt values.
  const sdkConsent =
    consentSupported &&
    authorizationUrl.searchParams
      .getAll(OAUTH_PROMPT_PARAM)
      .includes(CONSENT_PROMPT);
  // Combine SDK consent with our selected prompts into one deduplicated value.
  // Replacing the parameter also removes any unsupported SDK prompt values.
  const prompts = new Set<Prompt>();
  if (sdkConsent) prompts.add(CONSENT_PROMPT);
  for (const value of prompt ?? []) prompts.add(value);
  if (prompts.size > 0) {
    authorizationUrl.searchParams.set(
      OAUTH_PROMPT_PARAM,
      [...prompts].join(" "),
    );
  } else {
    authorizationUrl.searchParams.delete(OAUTH_PROMPT_PARAM);
  }
}
