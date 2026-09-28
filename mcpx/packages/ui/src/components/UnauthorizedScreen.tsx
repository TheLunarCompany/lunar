export function UnauthorizedScreen({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mcpx-page">
      <div className="w-full max-w-md rounded-lg border border-mcpx-border bg-mcpx-surface p-8 text-center shadow-[var(--mcpx-shadow-moderate)]">
        <div className="mb-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-mcpx-danger-bg">
            <svg
              className="h-6 w-6 text-mcpx-danger-text"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-mcpx-text">
            Access Denied
          </h2>
          <p className="mb-6 text-mcpx-text-secondary">
            {message || "You are not authorized to access this application."}
          </p>
          <div className="space-y-4">
            <p className="text-sm text-mcpx-text-tertiary">
              Please contact your administrator if you believe this is an error.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UnauthorizedScreen;
