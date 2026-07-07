import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SkillToolGroupFieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function SkillToolGroupField({
  value,
  onChange,
  error,
}: SkillToolGroupFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="skill-tool-group-json">Tool group JSON</Label>
      <Textarea
        id="skill-tool-group-json"
        aria-invalid={Boolean(error)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-28 resize-y font-mono text-sm"
        placeholder='{"name":"Repository","items":[{"catalogItemId":"github","tools":["pull_request_read"]}]}'
      />
      {error ? (
        <p className="text-sm text-[var(--component-colours-color-fg-danger-primary)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
