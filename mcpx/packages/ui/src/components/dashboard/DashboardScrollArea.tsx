import { ScrollArea } from "@/components/ui/scroll-area";
import { useDashboardStore } from "@/store";
import { FC, PropsWithChildren } from "react";
import {
  DASHBOARD_PANE_HEIGHT_COLLAPSED_DIAGRAM_TW_CLASS,
  DASHBOARD_PANE_HEIGHT_TW_CLASS,
} from "./constants";

export const DashboardScrollArea: FC<PropsWithChildren> = ({ children }) => {
  const { currentTab, isDiagramExpanded } = useDashboardStore((s) => ({
    currentTab: s.currentTab,
    isDiagramExpanded: s.isDiagramExpanded,
  }));

  return (
    <ScrollArea
      key={currentTab}
      className={
        isDiagramExpanded
          ? DASHBOARD_PANE_HEIGHT_TW_CLASS
          : DASHBOARD_PANE_HEIGHT_COLLAPSED_DIAGRAM_TW_CLASS
      }
    >
      {children}
    </ScrollArea>
  );
};
