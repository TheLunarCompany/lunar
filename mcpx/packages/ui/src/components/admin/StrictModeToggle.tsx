import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { HelpCircle } from "lucide-react";
import { FC } from "react";

export const StrictModeToggle: FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-strictness"],
    queryFn: () => apiClient.getStrictness(),
  });

  const { mutate: setOverride, isPending } = useMutation({
    mutationFn: (override: boolean) =>
      apiClient.setStrictnessOverride(override),
    onSuccess: (result) => {
      queryClient.setQueryData(["admin-strictness"], result);
      toast({
        title: "Strictness Updated",
        description: result.adminOverride
          ? "Strict mode bypassed"
          : "Strict mode enabled",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update strictness. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isStrictModeOn = data ? !data.adminOverride : true;

  if (isLoading) {
    return (
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm text-gray-700">Strict mode</span>
        <Spinner className="w-4 h-4" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-1">
        <span className="text-sm text-gray-700">Strict mode</span>
        <StrictModeHelp />
      </div>
      <Switch
        checked={isStrictModeOn}
        onCheckedChange={(checked) => setOverride(!checked)}
        disabled={isPending}
      />
    </div>
  );
};

const StrictModeHelp: FC = () => (
  <Popover>
    <PopoverTrigger asChild>
      <button className="text-gray-400 hover:text-gray-600 transition-colors">
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverContent side="top" className="w-56 text-sm text-gray-600">
      When off, unlisted MCP servers and restricted tools become available.
    </PopoverContent>
  </Popover>
);
