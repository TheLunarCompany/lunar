type ContextMenuPane = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ContextMenuPositionInput = {
  clientX: number;
  clientY: number;
  pane: ContextMenuPane;
};

export type ContextMenuPosition = {
  top: number | false;
  left: number | false;
  right: number | false;
  bottom: number | false;
};

const MENU_EDGE_OFFSET = 200;

export function calculateContextMenuPosition({
  clientX,
  clientY,
  pane,
}: ContextMenuPositionInput): ContextMenuPosition {
  const relativeX = clientX - pane.left;
  const relativeY = clientY - pane.top;
  const isNearRightEdge = relativeX >= pane.width - MENU_EDGE_OFFSET;
  const isNearBottomEdge = relativeY >= pane.height - MENU_EDGE_OFFSET;

  return {
    top: !isNearBottomEdge ? relativeY : false,
    left: !isNearRightEdge ? relativeX : false,
    right: isNearRightEdge ? pane.width - relativeX : false,
    bottom: isNearBottomEdge ? pane.height - relativeY : false,
  };
}
