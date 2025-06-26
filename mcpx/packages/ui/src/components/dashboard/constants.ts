export const DEFAULT_SERVER_ICON = "⚙️";

// The dashboard consists of 2 panes, which share a container and have a gap/margin.
// To get each pane's height, start from 50vh and subtract:
//  - half of top/bottom padding (1.5rem)
//  - half of margin/gap (8px)
//  - half of border width (2px)
//  - half of header (53px)
export const DASHBOARD_PANE_HEIGHT_TW_CLASS =
  "h-[calc(50vh_-_1.5rem_-_8px_-_2px_-_53px)]";
export const DASHBOARD_PANE_HEIGHT_COLLAPSED_DIAGRAM_TW_CLASS =
  "h-[calc(100vh_-_1.5rem_-_145px)]";
