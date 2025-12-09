import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const CustomTabs = TabsPrimitive.Root;

interface CustomTabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  className?: string;
  children?: React.ReactNode;
}

const CustomTabsList = React.forwardRef<HTMLDivElement, CustomTabsListProps>(
  ({ className, children, ...props }, ref) => {
    const listRef = React.useRef<HTMLDivElement>(null);
    const [activeBarStyle, setActiveBarStyle] =
      React.useState<React.CSSProperties>({
        width: 0,
        left: 0,
      });

    const updateActiveBar = React.useCallback(() => {
      if (!listRef.current) return;

      const activeTab = listRef.current.querySelector(
        `[data-state="active"]`,
      ) as HTMLElement;

      if (activeTab) {
        const listRect = listRef.current.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();

        setActiveBarStyle({
          width: tabRect.width,
          left: tabRect.left - listRect.left,
        });
      }
    }, []);

    React.useEffect(() => {
      // Initial positioning
      updateActiveBar();

      // Use MutationObserver to watch for data-state changes
      if (!listRef.current) return;

      const observer = new MutationObserver(() => {
        updateActiveBar();
      });

      observer.observe(listRef.current, {
        attributes: true,
        attributeFilter: ["data-state"],
        subtree: true,
      });

      // Also listen for resize events
      const handleResize = () => {
        updateActiveBar();
      };
      window.addEventListener("resize", handleResize);

      return () => {
        observer.disconnect();
        window.removeEventListener("resize", handleResize);
      };
    }, [updateActiveBar]);

    return (
      <TabsPrimitive.List
        ref={(node) => {
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLDivElement | null>).current =
              node;
          }
          (listRef as React.MutableRefObject<HTMLDivElement | null>).current =
            node;
        }}
        className={cn("relative flex flex-col", "jf-tab-list", className)}
        {...props}
      >
        <div className="relative" data-pc-section="content">
          <div
            role="tablist"
            aria-orientation="horizontal"
            className="flex relative border-b border-[#D8DCED]"
          >
            {children}
            <span
              role="presentation"
              aria-hidden="true"
              className="absolute bottom-0 h-[2px] transition-all duration-300 ease-in-out"
              style={{
                width: `${activeBarStyle.width}px`,
                left: `${activeBarStyle.left}px`,
                backgroundColor: "#5147E4",
              }}
              data-pc-section="activebar"
            />
          </div>
        </div>
      </TabsPrimitive.List>
    );
  },
);
CustomTabsList.displayName = "CustomTabsList";

const CustomTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "jf-tab",
      "inline-flex items-center justify-center whitespace-nowrap",
      "px-4 py-2 text-sm font-medium",
      "transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:text-foreground",
      "data-[state=inactive]:text-muted-foreground",
      className,
    )}
    {...props}
  />
));
CustomTabsTrigger.displayName = "CustomTabsTrigger";

const CustomTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "jf-tab-panel",
      "py-4 outline-none",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
CustomTabsContent.displayName = "CustomTabsContent";

export { CustomTabs, CustomTabsList, CustomTabsTrigger, CustomTabsContent };
