import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { routes } from "@/routes";
import ServerIconSvg from "@/icons/server_icon.svg?react";

const ICON_WIDTH = 126;
const ICON_HEIGHT = 200;

export default function NotFound() {
  return (
    <div className="min-h-full flex flex-col bg-background">
      <div className="px-6 py-4">
        <h1 className="text-[20px] font-semibold text-(--color-text-primary)">
          Oops...Lost in Space
        </h1>
      </div>

      <div className=" items-center justify-center px-6 ">
        <div className="w-full rounded-lg border border-border bg-card p-12">
          <div className="flex flex-col items-center text-center gap-4">
            <ServerIconSvg width={ICON_WIDTH} height={ICON_HEIGHT} />
            <h2 className="text-xl font-semibold text-foreground">
              404 Page not found
            </h2>
            <Button asChild>
              <Link to={routes.dashboard}>Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
