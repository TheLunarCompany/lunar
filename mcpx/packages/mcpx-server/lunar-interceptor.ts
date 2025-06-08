// This file serves as a snippet that can be used to load the Lunar Interceptor
// for an arbitrary Node process.

require("lunar-interceptor");
const host = process.env["LUNAR_PROXY_HOST"];
if (!host) {
  console.log("[Lunar Interceptor] LUNAR_PROXY_HOST not set, skipping");
} else {
  console.log(`[Lunar Interceptor] loaded at ${host}`);
}
