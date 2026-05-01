import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/routes";

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-12">
      <Card className="w-full max-w-xl rounded-2xl border-border bg-white shadow-xs hover:shadow-xs">
        <CardHeader className="p-8 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            404
          </p>
          <CardTitle>Page not found</CardTitle>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The route <code className="font-mono">{location.pathname}</code> is
            invalid.
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 p-8 pt-0 sm:flex-row">
          <Button asChild>
            <Link to={routes.dashboard}>Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
