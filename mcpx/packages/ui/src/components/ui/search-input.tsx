import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "./input";

type SearchInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  wrapperClassName?: string;
};

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, wrapperClassName, ...props }, ref) => {
    return (
      <div className={cn("relative", wrapperClassName)}>
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={ref}
          type="text"
          placeholder="Search..."
          {...props}
          className={cn(
            "pl-4 pr-10 placeholder:text-muted-foreground",
            className,
          )}
        />
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
