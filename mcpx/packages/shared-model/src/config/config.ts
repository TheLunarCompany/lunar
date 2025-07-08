import z from "zod/v4";

export const permissionsSchema = z.object({
  base: z.enum(["allow", "block"]),
  consumers: z
    .record(
      z.string(),
      z.object({
        consumerGroupKey: z.string().optional().default(""),
        base: z.enum(["allow", "block"]).optional(),
        profiles: z
          .object({
            allow: z.array(z.string()).optional(),
            block: z.array(z.string()).optional(),
          })
          .default({ allow: [], block: [] }),
      })
    )
    .default({}),
});

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

export const toolExtensionSchema = z
  .object({
    services: z.record(
      z.string(),
      z.record(
        z.string(),
        z.object({
          childTools: z.array(
            z.object({
              name: z.string(),
              description: z
                .object({
                  action: z.enum(["append", "rewrite"]),
                  text: z.string(),
                })
                .optional(),
              overrideParams: z
                .record(
                  z.string(),
                  z.union([z.string(), z.number(), z.boolean()])
                )
                .optional()
                .default({}),
            })
          ),
        })
      )
    ),
  })
  .optional()
  .default({ services: {} });

export const appConfigSchema = z.object({
  permissions: permissionsSchema,
  toolGroups: toolGroupSchema,
  auth: authSchema,
  toolExtensions: toolExtensionSchema,
});

export type AppConfig = z.infer<typeof appConfigSchema>;
