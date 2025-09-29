import {
  ParamExtensionOverrideValue,
  ToolExtensionParamsRecord,
} from "@mcpx/shared-model";

const parseNumber = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : Number(v);
  return !Number.isNaN(Number(v)) && Number.isFinite(n) ? n : undefined;
};
const parseBoolean = (v: unknown): boolean | undefined => {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return undefined;
};
const parseValue = (type: ParamExtensionOverrideValue, raw: unknown) => {
  switch (type) {
    case "number":
      return parseNumber(raw);
    case "boolean":
      return parseBoolean(raw);
    case "string":
    case "array":
    case "object":
      return raw ?? undefined;
    default:
      return undefined;
  }
};

export const injectParamsListOverrides = (
  paramsList: { name: string; type: string; description: string }[],
  paramsValues: ToolExtensionParamsRecord,
) =>
  paramsList.map(({ name, type, description }) => ({
    name,
    type,
    description,
    value: parseValue(type, paramsValues[name]?.value),
  }));
