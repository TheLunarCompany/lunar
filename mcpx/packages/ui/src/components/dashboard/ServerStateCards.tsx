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
      className="mb-4 gap-4 rounded-lg border border-(--colors-warning-400) bg-(--colors-warning-50) px-4 py-6 shadow-none ring-0"
      data-testid={testId}
    >
      <CardHeader className="items-center justify-items-center gap-4 p-0 text-center">
        <ListChecks
          className="size-8 shrink-0 text-(--colors-warning-500)"
          aria-hidden
        />
        <CardTitle className="font-sans text-sm font-semibold leading-5 text-(--colors-gray-950)">
          Pending User Input
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export function ConnectionErrorCard() {
  return (
    <Card className="mb-4 gap-4 rounded-lg border border-(--colors-error-200) bg-(--colors-error-50) px-4 py-6 shadow-none ring-0">
      <CardHeader className="items-center justify-items-center gap-4 p-0 text-center">
        <TriangleAlert
          className="size-8 text-(--colors-error-700)"
          strokeWidth={1.75}
          aria-hidden
        />
        <CardTitle className="font-sans text-sm font-semibold leading-5 text-(--colors-gray-950)">
          Connection Error
        </CardTitle>
        <CardDescription className="text-center text-sm font-normal leading-5 text-(--colors-gray-950)">
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
    <Card className="min-h-40 justify-center gap-4 rounded-lg border border-(--colors-info-200) bg-(--colors-info-50) px-4 py-6 shadow-none ring-0">
      <CardHeader className="w-full items-center justify-items-center gap-4 p-0 text-center">
        <AuthenticationRequiredIcon className="size-8 text-(--colors-info-500)" />
        <div className="flex flex-col items-center gap-1">
          <CardTitle className="font-sans text-sm font-semibold leading-5 text-(--colors-gray-900)">
            Authentication required
          </CardTitle>
          <CardDescription className="text-sm font-normal leading-5 text-(--colors-gray-600)">
            Authenticate to connect and load tools.
          </CardDescription>
        </div>
      </CardHeader>
      {userCode && (
        <CardContent className="p-0">
          <span className="rounded bg-(--colors-primary-100) px-2 py-1 text-xs text-(--colors-primary-700)">
            Your code, click to copy: <Copyable value={userCode} />
          </span>
        </CardContent>
      )}
      <CardFooter className="w-full justify-center p-0">
        {isAuthenticating ? (
          <Button
            variant="default"
            size="default"
            className="h-9 gap-1.5 rounded-lg bg-(--colors-primary-500) px-3 text-sm font-semibold leading-5 text-white hover:bg-(--colors-primary-500)/90"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="default"
            size="default"
            className="h-9 gap-1.5 rounded-lg bg-(--colors-primary-500) px-3 text-sm font-semibold leading-5 text-white hover:bg-(--colors-primary-500)/90"
            onClick={onAuthenticate}
          >
            <Lock data-icon="inline-start" />
            Authenticate
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
