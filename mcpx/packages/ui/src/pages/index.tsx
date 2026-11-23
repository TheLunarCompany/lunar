import { useMemo } from "react";
import { RouterProvider } from "react-router-dom";
import { createAppRouter } from "@/pages/app-routes";

export default function Pages() {
  const router = useMemo(() => createAppRouter(), []);

  return <RouterProvider router={router} />;
}
