import { useCallback, useState } from "react";
import { MCP_ICON_COLORS } from "./SystemConnectivity/nodes";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import McpIcon from "./SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { debounce } from "@/utils";

export const McpColorInput = ({
  icon,
  setIcon,
}: {
  icon: string;
  setIcon: (icon: string) => void;
}) => {
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconColors, setIconColors] = useState<string[]>([
    ...MCP_ICON_COLORS.slice(0, 5),
    icon,
  ]);

  function handleColorsChange(color: string) {
    setIconColors((prev) => [...prev, color]);
    setIcon(color);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced function, deps handled by debounce
  const debouncedHandleColorsChange = useCallback(
    debounce(handleColorsChange, 1000),
    [],
  );

  return (
    <Popover open={isIconPickerOpen} onOpenChange={setIconPickerOpen}>
      <PopoverTrigger>
        <McpIcon
          onClick={() => setIconPickerOpen(true)}
          style={{ color: icon }}
          className="min-w-12 w-12 min-h-12 h-12 rounded-md bg-white p-1 cursor-pointer"
        />
      </PopoverTrigger>

      <PopoverContent className=" p-0" align="start" sideOffset={70}>
        <div className="flex flex-col gap-2 p-2">
          <div className="text-[16px] font-semibold text-foreground">
            Choose symbol
          </div>
          <div className="flex flex-row flex-wrap max-w-[380px] gap-2">
            {iconColors.map((color) => (
              <div
                key={color}
                className={`cursor-pointer border-2 rounded-md border-transparent ${color === icon ? `border-2 border-[#019894]` : ""}`}
                onClick={() => setIcon(color)}
              >
                <McpIcon
                  style={{ color }}
                  className="min-w-10 w-10 min-h-10 h-10  rounded-md bg-white p-1"
                />
              </div>
            ))}
            <label htmlFor="color-picker" className="cursor-pointer">
              <div className="font-[200] border-[#019894] text-[#019894] border-dashed border-[2px] pb-1 text-[36px] min-w-10 w-10 min-h-10 h-10  rounded-md bg-white cursor-pointer flex items-center justify-center">
                +
              </div>
            </label>
            <input
              type="color"
              className="hidden"
              id="color-picker"
              value={icon}
              onChange={(e) => debouncedHandleColorsChange(e.target.value)}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
