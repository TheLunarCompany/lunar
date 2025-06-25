import { ScrollArea } from "@/components/ui/scroll-area";
import { useDashboardStore } from "@/store";
import { FC, PropsWithChildren, useEffect, useRef } from "react";
import { DASHBOARD_PANE_HEIGHT_TW_CLASS } from "./constants";

export const DashboardScrollArea: FC<PropsWithChildren> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { selectedId } = useDashboardStore((s) => ({
    selectedId: s.selectedId,
  }));

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = 0;
    }
  }, [selectedId]);

  return (
    <ScrollArea viewportRef={ref} className={DASHBOARD_PANE_HEIGHT_TW_CLASS}>
      {children}
    </ScrollArea>
  );
};
