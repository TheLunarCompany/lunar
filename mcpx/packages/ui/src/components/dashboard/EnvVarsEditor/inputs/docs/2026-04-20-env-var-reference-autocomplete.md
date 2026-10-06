# Env Var Reference Autocomplete

This note records the current behavior and implementation decisions for the
environment-variable reference input in the dashboard server details flow.

## Current Behavior

- The editor keeps the existing `EnvValue` union unchanged:
  - literal value: `string`
  - intentionally empty: `null`
  - environment reference: `{ fromEnv: string }`
  - saved secret reference: `{ fromSecret: string }`
- The row-level mode selector remains narrow:
  - `Value`
  - `Load from env`
- `Load from env` renders a shared reference input.
- The shared reference input supports:
  - selecting an existing secret, saved as `{ fromSecret: secretName }`
  - typing a new env var name as a draft
  - explicitly applying the draft through `+ Use env var "<name>"`
  - clearing an existing saved reference
- Typed free text is not saved automatically. It is considered an unapplied
  draft until the user clicks the explicit `+ Use env var` action.
- While a draft is unapplied, the input shows a shadcn `FieldDescription` warning
  in amber.
- The draft warning is guidance, not an invalid field state:
  - do not set `data-invalid` on `Field`
  - do not set `aria-invalid` on the input
  - do not force red border or destructive text styling
- If the server also reports the env var as missing, hide the amber
  `Missing configuration. Try another value or contact your admin.` message
  while the draft warning is visible. This avoids showing two warnings for the
  same field at the same time.
- Expanding and collapsing an env var row is controlled only by the chevron
  button, not by clicking the whole row header.

## Important Files

- `src/components/dashboard/EnvVarsEditor/EnvVarRow.tsx`
  - owns row expansion state
  - switches between literal and reference inputs
  - hides the server missing warning while the reference draft warning is shown
- `src/components/dashboard/EnvVarsEditor/inputs/EnvReferenceInput.tsx`
  - owns the typed query draft
  - renders secret options and the explicit `+ Use env var` action
  - reports whether the local draft warning is active
- `src/components/dashboard/EnvVarsEditor/inputs/EnvReferenceInput.test.tsx`
  - covers secret selection, env var creation, focus restoration, clear behavior,
    and draft warning reporting
- `src/components/dashboard/EnvVarsEditor/utils/referenceOptions.ts`
  - builds secret options and resolves selected values
- `src/components/ui/field.tsx`
  - shadcn field primitives used for `FieldDescription`

## Design Decisions

- Do not create a new generic autocomplete primitive for this flow. The current
  implementation uses the existing local `CreatableCombobox`.
- Do not add a `Use secret "<name>"` free-text action. Existing secrets are
  selectable; new free-text values become env var references only.
- Do not auto-convert typed text to a secret just because it matches a secret
  name. Secret references are created by selecting the secret option.
- Do not disable `Save & Connect` for unapplied draft text. The row-level warning
  communicates that the typed text has not been applied, but save-button behavior
  remains unchanged.
- Do not move the reference draft state into `EnvVarsEditor` unless a future flow
  needs parent-level validation. Keep it local to the row/input for now.

## Manual QA Checklist

- Type a new value in the reference input and confirm the amber draft warning
  appears.
- Confirm the missing-configuration warning is hidden while the draft warning is
  visible.
- Click `+ Use env var "<name>"` and confirm the draft warning disappears.
- Select an existing secret and confirm it is saved as a secret reference.
- Clear an existing reference and confirm the field can be saved empty according
  to the existing requirement validation rules.
- Confirm clicking the row header does not expand/collapse the row.
- Confirm clicking the chevron expands/collapses the row.
