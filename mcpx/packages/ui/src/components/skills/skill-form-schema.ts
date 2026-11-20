import type { SkillInput } from "@mcpx/shared-model";
import { z } from "zod";

const skillNameSlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SkillFormValues = {
  name: string;
  description: string;
  body: string;
  exposeAsPrompt: boolean;
};

export const skillFormSchema: z.ZodType<SkillFormValues> = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(64, "Name must be 64 characters or fewer.")
    .regex(
      skillNameSlugRegex,
      "Name must use lowercase letters, numbers, and hyphens only, and must not start or end with a hyphen or contain consecutive hyphens. Examples: pdf-processing, data-analysis, code-review.",
    ),
  description: z
    .string()
    .trim()
    .min(
      1,
      "Description is required. Describe what the skill does and when to use it.",
    )
    .max(1024, "Description must be 1024 characters or fewer."),
  body: z.string().trim(),
  exposeAsPrompt: z.boolean(),
});

export function draftToFormValues(draft?: SkillInput): SkillFormValues {
  return {
    name: draft?.name ?? "",
    description: draft?.description ?? "",
    body: draft?.body ?? "",
    exposeAsPrompt: draft?.exposeAsPrompt ?? true,
  };
}

export function formValuesToDraft(values: SkillFormValues): SkillInput {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    body: values.body.trim(),
    exposeAsPrompt: values.exposeAsPrompt,
  };
}
