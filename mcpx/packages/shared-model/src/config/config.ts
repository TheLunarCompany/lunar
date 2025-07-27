import z from "zod/v4";

export const toolGroupSchema = z
  .array(
    z.object({
      name: z.string(),
      services: z.record(
        z.string(),
        z.union([z.array(z.string()), z.literal("*")])
      ),
    })
  )
  .default([]);

export const authSchema = z
  .object({
    enabled: z
      .boolean()
      .default(false)
      .or(
        z
          .enum(["true", "false"])
          .default("false")
          .transform((value) => value === "true")
      ),
    header: z.string().optional(),
  })
  .default({ enabled: false });

export const toolExtensionsParamsSchema: z.ZodType<any> = z.lazy(() =>
  z
    .record(
      z.string(),
      z.union([
        z.null(),
        z.undefined(),
        z.string(),
        z.number(),
        z.boolean(),
        z.record(
          z.string(),
          z.union([
            z.string(),
            z.number(),
            z.boolean(),
            toolExtensionsParamsSchema,
          ])
        ),
        z.array(
          z.union([
            z.string(),
            z.number(),
            z.boolean(),
            toolExtensionsParamsSchema,
          ])
        ),
      ])
    )
    .optional()
    .default({})
);

export const toolExtensionSchema = z.object({
  name: z.string(),
  description: z
    .object({
      action: z.enum(["append", "rewrite"]),
      text: z.string(),
    })
    .optional(),
  overrideParams: toolExtensionsParamsSchema,
});

export const toolExtensionsServiceSchema = z.record(
  z.string(),
  z.object({
    childTools: z.array(toolExtensionSchema),
  })
);

export const toolExtensionsSchema = z
  .object({
    services: z.record(z.string(), toolExtensionsServiceSchema),
  })
  .optional()
  .default({ services: {} });

export type ToolExtension = z.infer<typeof toolExtensionSchema>;
export type ToolExtensionsService = z.infer<typeof toolExtensionsServiceSchema>;
export type ToolExtensions = z.infer<typeof toolExtensionsSchema>;
