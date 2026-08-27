/**
 * Injects resolved env vars as -e KEY=VALUE flags into docker run args,
 * inserting them before the image name (which must be the last element).
 */
export function injectEnvIntoDockerArgs(
  args: string[],
  resolvedEnv: Record<string, string>,
): string[] {
  const envEntries = Object.entries(resolvedEnv);
  if (envEntries.length === 0) {
    return args;
  }
  const argsCopy = [...args];
  const image = argsCopy.pop();
  if (image === undefined) {
    return args;
  }
  const envFlags = envEntries.flatMap(([key, value]) => [
    "-e",
    `${key}=${value}`,
  ]);
  return [...argsCopy, ...envFlags, image];
}
