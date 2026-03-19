"use client";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type Theme = "light" | "dark" | "system";

const Toaster = ({ ...props }: React.ComponentProps<typeof Sonner>) => {
  const { theme = "system" } = useTheme();
  const sonnerTheme = theme as Theme;
  return (
    <Sonner
      theme={sonnerTheme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
