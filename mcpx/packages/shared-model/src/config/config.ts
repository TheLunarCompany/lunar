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
