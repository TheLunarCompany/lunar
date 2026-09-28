import { LogIn } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/useAuth";
import { useFeatureFlag } from "@/contexts/feature-flags";
import { McpxBrandLogo } from "@/components/branding/McpxBrandLogo";

export default function EnterpriseLoginScreen() {
  const { login, loading, error } = useAuth();
  const [searchParams] = useSearchParams();
  const isAccessDenied = searchParams.get("error") === "access_denied";
  const isBoomi = useFeatureFlag("VITE_IS_BOOMI");

  return (
    <div className="flex min-h-screen flex-col justify-center bg-mcpx-page px-6 py-12">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <McpxBrandLogo placement="login" isBoomi={isBoomi} />
        </div>
        <h1 className="mt-8 text-center font-heading text-4xl font-semibold tracking-tight text-mcpx-action">
          MCPX Control Panel
        </h1>
      </div>

      <div className="mt-10 w-full sm:mx-auto sm:max-w-md">
        <div className="rounded-[var(--border-radius-lg)] border border-mcpx-border bg-mcpx-surface px-6 py-10 shadow-[var(--mcpx-shadow-strong)] sm:px-10">
          <div className="text-center">
            <h2 className="mb-2 text-2xl font-semibold text-mcpx-text">
              Welcome!
            </h2>
            <p className="mb-8 text-sm text-mcpx-text-secondary">
              Sign in to access your MCPX control plane dashboard
            </p>

            {isAccessDenied && (
              <p className="mb-6 rounded-lg border border-mcpx-danger-text bg-mcpx-danger-bg px-3 py-2 text-sm text-mcpx-danger-text">
                Access denied
              </p>
            )}

            <Button
              onClick={() => login()}
              disabled={loading}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <LogIn />
              )}
              {loading ? "Connecting..." : "Sign in"}
            </Button>

            {error && (
              <p className="mt-4 rounded-lg border border-mcpx-danger-text bg-mcpx-danger-bg px-3 py-2 text-sm text-mcpx-danger-text">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
