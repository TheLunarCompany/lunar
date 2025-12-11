import z from "zod/v4";

export const singleToolGroupSchema = z.object({
  name: z
    .string()
    .regex(
      /^[a-zA-Z0-9_\s-]{1,64}$/,
      "Tool group name must match pattern: ^[a-zA-Z0-9_\\s-]{1,64}$",
    ),
  description: z.string().optional(),
  services: z.record(
    z.string(),
    z.union([z.array(z.string()), z.literal("*")]),
  ),
});

export type ToolGroup = z.infer<typeof singleToolGroupSchema>;

export const toolGroupSchema = z.array(singleToolGroupSchema).default([]);

export const authSchema = z
  .object({
    enabled: z.boolean().or(z.stringbool()).default(false),
    header: z.string().optional(),
  })
  .default({ enabled: false });

export type ParamExtensionOverrideValue =
  | null
  | string
  | number
  | boolean
  | { [key: string]: ParamExtensionOverrideValue }
  | Array<ParamExtensionOverrideValue>;
export type ExtensionDescription = {
  action: "append" | "rewrite";
  text: string;
};
export type ToolExtensionParamsRecord = {
  [paramName: string]: {
    value?: ParamExtensionOverrideValue;
    description?: ExtensionDescription;
  };
};
