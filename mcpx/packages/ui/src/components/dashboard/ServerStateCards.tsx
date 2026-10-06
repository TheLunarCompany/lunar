import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Copyable } from "@/components/ui/copyable";
import { ListChecks, Lock, TriangleAlert } from "lucide-react";
import AuthenticationRequiredIcon from "./icons/authentication-required.svg?react";

type PendingInputCardProps = {
  testId?: string;
};

export function PendingInputCard({ testId }: PendingInputCardProps) {
  return (
    <Card
      className="mb-4 gap-4 rounded-lg border border-mcpx-warning-strong bg-mcpx-warning-bg px-4 py-6 shadow-none ring-0"
      data-testid={testId}
    >
      <CardHeader className="items-center justify-items-center gap-4 p-0 text-center">
        <ListChecks
          className="size-8 shrink-0 text-mcpx-warning-strong"
          aria-hidden
        />
        <CardTitle className="font-sans text-sm font-semibold leading-5 text-mcpx-text">
          Pending User Input
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export function ConnectionErrorCard() {
  return (
    <Card className="mb-4 gap-4 rounded-lg border border-mcpx-danger-text bg-mcpx-danger-bg px-4 py-6 shadow-none ring-0">
      <CardHeader className="items-center justify-items-center gap-4 p-0 text-center">
        <TriangleAlert
          className="size-8 text-mcpx-danger-text"
          strokeWidth={1.75}
          aria-hidden
        />
        <CardTitle className="font-sans text-sm font-semibold leading-5 text-mcpx-text">
          Connection Error
        </CardTitle>
        <CardDescription className="text-center text-sm font-normal leading-5 text-mcpx-text">
          Failed to initiate server:
          <br />
          inspect logs for more details
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

type AuthenticationRequiredCardProps = {
  authWindow: Window | null;
  isAuthenticating: boolean;
  onAuthenticate: () => void;
  setAuthWindow: (authWindow: Window | null) => void;
  setIsAuthenticating: (isAuthenticating: boolean) => void;
  setUserCode: (userCode: string | null) => void;
  userCode: string | null;
};

export function AuthenticationRequiredCard({
  authWindow,
  isAuthenticating,
  onAuthenticate,
  setAuthWindow,
  setIsAuthenticating,
  setUserCode,
  userCode,
}: AuthenticationRequiredCardProps) {
  const handleCancel = () => {
    setIsAuthenticating(false);
    if (authWindow && !authWindow.closed) {
      authWindow.close();
    }
    setAuthWindow(null);
    setUserCode(null);
  };

  return (
    <Card className="min-h-40 justify-center gap-4 rounded-lg border-0 bg-mcpx-selected-weak px-4 py-6 shadow-none ring-0">
      <CardHeader className="w-full items-center justify-items-center gap-4 p-0 text-center">
        <AuthenticationRequiredIcon className="size-8 text-mcpx-text" />
        <div className="flex flex-col items-center gap-1">
          <CardTitle className="font-sans text-sm font-semibold leading-5 text-mcpx-text">
            Authentication required
          </CardTitle>
          <CardDescription className="text-sm font-normal leading-5 text-mcpx-text-secondary">
            Authenticate to connect and load tools.
          </CardDescription>
        </div>
      </CardHeader>
      {userCode && (
        <CardContent className="p-0">
          <span className="rounded bg-mcpx-selected-weak px-2 py-1 text-xs text-mcpx-selected">
            Your code, click to copy: <Copyable value={userCode} />
          </span>
        </CardContent>
      )}
      <CardFooter className="w-full justify-center p-0">
        {isAuthenticating ? (
          <Button variant="default" size="default" onClick={handleCancel}>
            Cancel
          </Button>
        ) : (
          <Button variant="default" size="default" onClick={onAuthenticate}>
            <Lock data-icon="inline-start" />
            Authenticate
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
