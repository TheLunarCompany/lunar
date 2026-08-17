# shadcn Migration: new-york → vega (Tailwind v3 → v4)

## Command

```bash
npx shadcn@latest init --preset vega --force
```

Say **yes** to re-installing existing components when prompted.

---

## Manual fixes required after init

### 1. TooltipProvider

New vega tooltip requires an explicit `TooltipProvider` wrapper. Add to `src/App.tsx`:

```tsx
import { TooltipProvider } from "@/components/ui/tooltip";

// Wrap app:
<TooltipProvider>{children}</TooltipProvider>;
```

---

### 2. VisuallyHidden — not exported from sheet anymore

The new vega `sheet.tsx` no longer exports `VisuallyHidden`. Any file importing it from sheet will crash with:

```
Uncaught SyntaxError: The requested module '/src/components/ui/sheet.tsx'
does not provide an export named 'VisuallyHidden'
```

**Fix:** Import from `radix-ui` instead.

**Before:**

```tsx
import { Sheet, SheetContent, VisuallyHidden } from "@/components/ui/sheet";
// or
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
```

**After:**

```tsx
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { VisuallyHidden as VisuallyHiddenPrimitive } from "radix-ui";
const VisuallyHidden = VisuallyHiddenPrimitive.Root;
```

**Files affected:**

- `src/components/dashboard/ServerDetailsModal.tsx`
- `src/components/dashboard/McpxDetailsModal.tsx`
- `src/components/dashboard/AgentDetailsModal.tsx`
- `src/components/dashboard/AddServerModal.tsx`
- `src/components/saved-setups/SavedSetupSheet.tsx`
- `src/components/tools/ToolGroupSheet.tsx`
- `src/components/access-controls/ToolGroupModal.tsx`

---

### 3. Dialog width — resolved

Consumers now use `sm:max-w-*` to match the vega default `sm:max-w-md`, so tailwind-merge overrides correctly.

---

### 5. Custom button variants — resolved

Old custom variants mapped to standard shadcn variants:

- `"primary"` → `"default"`
- `"danger"` → `"destructive"`
- `"vanilla"` → `"ghost"`

### 6. Spinner — replaced with shadcn component

The old custom `Spinner` had `show` and `size` CVA variants. Replaced with the new shadcn `spinner.tsx` which accepts standard SVG props only. Control size via `className` (default is `size-4`).

**Before:**

```tsx
<Spinner size="small" className="text-white" />
<Spinner size="large" />
```

**After:**

```tsx
<Spinner className="text-white" />
<Spinner className="size-8" />
```

---

### 7. Old CSS variables — resolved (89% reduction)

Replaced 297 of 334 old design token references (`--color-fg-interactive` → `primary`, `--color-text-primary` → `foreground`, etc.) across 36 files. 37 remaining are semantic colors (success, warning, attention) with no shadcn equivalent — they still resolve via the old token definitions.

### 8. `--color-primary` theme mapping — resolved

The `@theme` block had `--color-primary: var(--text-primary)` instead of `var(--primary)`. Fixed so `bg-primary`/`text-primary` resolve to the violet color.

### 9. `.dark` block disabled

The `.dark` CSS block was overriding `--foreground` to near-white even in light mode (something in the DOM was adding `.dark` class). Commented out since the app is light-mode only.

### 10. Card `gap-6 py-6` default

The new Card component has `gap-6 py-6` by default. Fixed on MetricsPanel with `gap-0 py-0`. Other cards with fixed heights may need the same treatment.

---

## Known issues not fixed here

- ~~Font hosting~~ — resolved. `vite.config.ts` now uses `searchForWorkspaceRoot` so Vite's dev server can access `@fontsource-variable/inter` regardless of where npm hoists it.
- React 18 ref warnings: new shadcn vega components use React 19 function-component style (ref as prop). React 18 logs "Function components cannot be given refs" warnings. Harmless — goes away on React 19 upgrade.
- ~37 remaining old CSS variable references (semantic colors: success, warning, danger, attention) that have no direct shadcn equivalent.
