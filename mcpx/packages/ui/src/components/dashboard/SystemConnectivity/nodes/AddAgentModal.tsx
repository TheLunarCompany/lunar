import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CustomTabs,
  CustomTabsContent,
  CustomTabsList,
  CustomTabsTrigger,
} from "@/components/ui/custom-tabs";
import { CheckCircle, Copy } from "lucide-react";
import { useState } from "react";
import { CustomMonacoEditor } from "@/components/ui/custom-monaco-editor";
import { cn } from "@/lib/utils";
import { AgentInstructions } from "./AgentInstructions/AgentInstructions";
import { getAgentConfigs } from "./AgentInstructions/agentConfigs";
import { agentsData } from "@/components/dashboard/constants";

interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getAgentIcon = (value: string): string => {
  const iconMap: Record<string, keyof typeof agentsData> = {
    cursor: "CURSOR",
    claude: "CLAUDE",
    windsurf: "WIND_SURF",
    inspector: "INSPECTOR",
    vscode: "VSCODE",
    copilot: "COPILOT",
    "openai-mcp": "openai-mcp",
    n8n: "N8N",
    custom: "DEFAULT",
  };
  const agentKey = iconMap[value.toLowerCase()];
  return agentKey ? agentsData[agentKey].icon : agentsData.DEFAULT.icon;
};
const instructionsOnlyClients: Set<string> = new Set([
  "custom",
  "openai-mcp",
  "n8n",
]);

export const AddAgentModal = ({ isOpen, onClose }: AddAgentModalProps) => {
  const [selectedAgentType, setSelectedAgentType] = useState<string>("cursor");
  const [activeTab, setActiveTab] = useState<string>("json");
  const [copied, setCopied] = useState(false);
  const AGENT_TYPES = getAgentConfigs();
  const selectedConfig = AGENT_TYPES.find(
    (type) => type.value === selectedAgentType,
  );

  const handleCopyConfig = async () => {
    if (!selectedConfig) return;
    const config = selectedConfig.getConfig();
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setSelectedAgentType("cursor");
    setActiveTab("json");
    setCopied(false);
    onClose();
  };

  const handleAgentTypeChange = (agentType: string) => {
    setSelectedAgentType(agentType);
    setActiveTab(
      instructionsOnlyClients.has(agentType) ? "instructions" : "json",
    );
  };

  const jsonConfigString =
    selectedConfig && selectedConfig.value !== "custom"
      ? JSON.stringify(selectedConfig.getConfig(), null, 2)
      : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-6xl h-[650px] flex flex-col bg-white border border-gray-200 rounded-lg p-0 [&>button]:top-6">
        <DialogHeader className="border-b border-gray-200 px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold  text-gray-900">
                Add AI Agent
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>
        <div className="px-6  text-sm text-[#1E1B4B]">
          Select your agent type and copy the configuration JSON to get started.
        </div>

        <div className="flex m-6 mt-0 flex-1 border border-[#D8DCED] rounded-[8px] overflow-hidden">
          <div className="w-64 border-r bg-white border-gray-200 bg-gray-50 p-4 overflow-y-auto">
            <div className="space-y-2">
              {AGENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleAgentTypeChange(type.value)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3  rounded-lg text-left",
                    selectedAgentType === type.value && "bg-[#F3F5FA]",
                  )}
                >
                  <img
                    src={getAgentIcon(type.value)}
                    alt={type.label}
                    className="w-8 h-8 rounded-md object-contain"
                  />
                  <span className={cn("text-sm font-medium")}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden ">
            {selectedConfig && (
              <div className="flex-1 flex flex-col p-6 overflow-hidden">
                <div className="mb-4">
                  <h3
                    className="font-semibold"
                    style={{ fontSize: "16px", color: "#1E1B4B" }}
                  >
                    {selectedConfig.label}
                  </h3>
                </div>
                <CustomTabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="flex-1 flex flex-col"
                >
                  <CustomTabsList>
                    <CustomTabsTrigger
                      value="json"
                      disabled={instructionsOnlyClients.has(
                        selectedConfig.value,
                      )}
                    >
                      JSON Config
                    </CustomTabsTrigger>
                    <CustomTabsTrigger value="instructions">
                      Instructions
                    </CustomTabsTrigger>
                  </CustomTabsList>
                  <CustomTabsContent
                    value="json"
                    className="flex-1 flex flex-col mt-0 pt-4 pb-0 px-0 overflow-hidden"
                  >
                    <div className="relative  flex-col">
                      <div className="absolute top-3 right-3 z-10">
                        <button
                          onClick={() => void handleCopyConfig()}
                          className="flex items-center justify-center p-1 hover:opacity-70 transition-opacity"
                          title={copied ? "Copied!" : "Copy"}
                        >
                          {copied ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <CustomMonacoEditor
                        value={jsonConfigString}
                        height="365px"
                        language="json"
                        className=""
                        readOnly={true}
                      />
                    </div>
                  </CustomTabsContent>

                  <CustomTabsContent
                    value="instructions"
                    className="pt-4 pb-0 px-0 pr-2 overflow-y-auto h-[393px]"
                  >
                    <AgentInstructions agentType={selectedConfig.value} />
                  </CustomTabsContent>
                </CustomTabs>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
