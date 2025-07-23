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
