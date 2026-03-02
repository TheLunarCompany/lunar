import * as React from "react";

export function Copyable({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op, you could log if you want
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 font-mono bg-[var(--color-bg-container)] px-2 py-1 rounded select-all cursor-pointer hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
      title="Click to copy"
    >
      <span>{value}</span>
      <span className="text-xs opacity-70">
        {copied ? "Copied" : "Click to copy"}
      </span>
    </button>
  );
}
