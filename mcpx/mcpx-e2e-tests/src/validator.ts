// src/validator.ts
import Ajv from 'ajv';

export type ValidationMode = 'exact' | 'contains' | 'regex' | 'json-schema';

export interface Expectation {
  mode?: ValidationMode;
  // string for exact/contains/regex, object for json-schema
  value: string | Record<string, unknown>;
}

const ajv = new Ajv();

/**
 * Validate the raw output string against the given expectation.
 * Returns { success: true } or { success: false, errors: [...] }.
 */
export function validateOutput(
  output: string,
  expected: Expectation
): { success: true } | { success: false; errors: string[] } {
  const mode = expected.mode ?? 'exact';
  const errors: string[] = [];

  switch (mode) {
    case 'exact': {
      if (output !== expected.value) {
        errors.push(`Exact mismatch. Expected: ${expected.value}, Got: ${output}`);
      }
      break;
    }

    case 'contains': {
      if (!output.includes(expected.value as string)) {
        errors.push(`Missing substring. Expected to contain: ${expected.value}`);
      }
      break;
    }

    case 'regex': {
      const re = new RegExp(expected.value as string);
      if (!re.test(output)) {
        errors.push(`Regex ${expected.value} did not match output. ${output}`);
      }
      break;
    }

    case 'json-schema': {
      let data: unknown;
      try {
        data = JSON.parse(output);
      } catch (err: any) {
        errors.push(`Invalid JSON: ${err.message}`);
        break;
      }
      {
        const validate = ajv.compile(expected.value as object);
        const valid = validate(data);
        if (!valid) {
          errors.push(`Schema errors: ${ajv.errorsText(validate.errors)}`);
        }
      }
      break;
    }

    default: {
      errors.push(`Unknown validation mode: ${mode}`);
      break;
    }
  }

  return errors.length === 0 ? { success: true } : { success: false, errors };
}
