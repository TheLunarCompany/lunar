import z from "zod/v4";

export const isValidJson = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    return false;
  }
};

export const serverNameSchema = z
  .string()
  .min(1, "Server name is required")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Server name can only contain letters, numbers, dashes (-), and underscores (_)"
  );

export const localServerSchema = z.strictObject({
  type: z.literal("stdio").default("stdio").optional(),
  command: z.string().min(1, "Command is required"),
  args: z.array(z.string()).default([]).optional(),
  env: z.record(z.string().min(1), z.string()).default({}).optional(),
  icon: z.string().optional(),
});

export const remoteServerSchema = z.strictObject({
  type: z.enum(["sse", "streamable-http"]).default("sse").optional(),
  url: z.url().and(
    z
      .string()
      .min(1, "URL is required")
      // Very simplified URL validation regex
      .regex(
        /^https?:\/\/[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_\-]+)*(\:[0-9]+)?(\/[a-zA-Z0-9_\-]*)*$/,
      ),
  ),
  headers: z.record(z.string(), z.string()).optional(),
  icon: z.string().optional(),
});

export const mcpServerSchema = z.union([localServerSchema, remoteServerSchema]);

export const mcpJsonSchema = z.record(
  serverNameSchema,
  mcpServerSchema,
);

// The payload schemas are not strict, so they are used mainly to strip irrelevant properties,
// and do transforms that are not possible with the JSON Schemas, but not for validation.
export const localServerPayloadSchema = z
  .object({
    icon: z.string().optional(),
    name: z.string(),
    type: z.literal("stdio").optional(),
    command: z.string(),
    args: z
      .union([z.array(z.string()), z.string()])
      .default([])
      .optional(),
    env: z
      .union([z.record(z.string(), z.string()), z.string()])
      .default({})
      .optional(),
  })
  .transform((server) => ({
    ...server,
    type: server.type || "stdio",
    args: Array.isArray(server.args)
      ? server.args.join(" ")
      : server.args || "",
    env:
      typeof server.env === "string"
        ? server.env
        : JSON.stringify(server.env || {}),
  }));
export const remoteServerPayloadSchema = z.object({
  icon: z.string().optional(),
  name: z.string(),
  type: z.enum(["sse", "streamable-http"]).default("sse").optional(),
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
});

export const parseServerPayload = (server: z.input<typeof mcpServerSchema>) => {
  if (server.type === "stdio") {
    return localServerPayloadSchema.safeParse(server);
  }
  // Only set type if 'url' exists
  if ("url" in server && typeof server.url === "string") {
    const inferredType = inferServerTypeFromUrl(server.url);
    // Ensure type is always set and matches expected union
    if (inferredType === "sse") {
      return remoteServerPayloadSchema.safeParse({ ...server, type: "sse" });
    } else {
      return remoteServerPayloadSchema.safeParse({
        ...server,
        type: "streamable-http",
      });
    }
  }
  return remoteServerPayloadSchema.safeParse(server);
};

export const inferServerTypeFromUrl = (
  url: string,
): "sse" | "streamable-http" | undefined => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.replace(/\/$/, "");
    if (pathname.endsWith("/sse")) {
      return "sse";
    } else if (pathname.endsWith("/mcp")) {
      return "streamable-http";
    }
    return undefined;
  } catch {
    return undefined;
  }
};

/**
 * Updates JSON content to include the inferred server type and icon
 * This ensures the saved configuration file includes the type field
 */
export const updateJsonWithServerType = (
  jsonContent: string,
  serverName: string,
  icon: string
): string => {
  try {
    const parsed = JSON.parse(jsonContent);
    const serverData = parsed[serverName];
    
    if (!serverData) {
      return jsonContent;
    }

    // Determine server type
    let serverType: string;
    if (serverData.type) {
      serverType = serverData.type;
    } else if ("url" in serverData) {
      serverType = inferServerTypeFromUrl(serverData.url) || "sse";
    } else {
      serverType = "stdio";
    }

    // Update the JSON with type and icon
    const updatedJson = {
      [serverName]: {
        ...serverData,
        type: serverType,
        icon: icon,
      }
    };

    return JSON.stringify(updatedJson, null, 2);
  } catch (error) {
    console.warn("Failed to update JSON with server type:", error);
    return jsonContent;
  }
};
