export function isMswMockEnabled() {
  return import.meta.env.DEV && window.__MSW_ENABLED__ === true;
}
