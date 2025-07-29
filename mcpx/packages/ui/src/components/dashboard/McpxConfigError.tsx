import { CloudAlert } from "lucide-react";

export const McpxConfigError = () => (
  <div className="items-center justify-center flex p-10">
    <div className="flex flex-col bg-[var(--color-bg-container-overlay)] rounded-lg p-6">
      <h1 className="text-2xl font-bold mb-4 text-[var(--color-fg-warning)]">
        <CloudAlert className="inline-block mr-2" />
        Configuration Error
      </h1>
      <p className="text-lg text-[var(--color-fg-danger)]">
        The configuration received from the MCPX server is invalid or missing.
      </p>
      <p className="mt-2 text-sm text-[var(--color-fg-primary-accent)]">
        Please check your MCPX server configuration and ensure it is set up
        correctly.
      </p>
    </div>
  </div>
);
