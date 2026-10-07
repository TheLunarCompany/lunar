import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { getAgentIcon } from "@/lib/agent-icons";
import { AgentInstructions } from "./AgentInstructions/AgentInstructions";
import { getAgentConfigs } from "./AgentInstructions/agentConfigs";

interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const instructionsOnlyClients: Set<string> = new Set([
  "custom",
  "openai-mcp",
  "n8n",
  "ClaudeCode",
  "gemini-cli",
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
    if (!config) return;
    const text =
      "toml" in config ? config.toml : JSON.stringify(config, null, 2);
    await navigator.clipboard.writeText(text);
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

  // getting the config that will be shown in the monaco editor
  const config = selectedConfig?.getConfig();
  const isToml = !!config && "toml" in config;
  const editorLanguage = isToml ? "toml" : "json";
  const editorValue =
    selectedConfig && selectedConfig.value !== "custom" && config
      ? isToml
        ? config.toml
        : JSON.stringify(config, null, 2)
      : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="flex h-[760px] max-h-[calc(100dvh-2rem)] min-h-0 flex-col overflow-hidden rounded-lg border border-mcpx-border-subtle bg-mcpx-surface p-0 sm:max-w-5xl [&>button]:top-6">
        <DialogHeader className="shrink-0 border-b border-mcpx-border-subtle px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold  text-mcpx-text">
                Add AI Agent
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>
        <DialogDescription className="shrink-0 px-6 text-sm text-mcpx-text">
          Select your agent type and copy the configuration{" "}
          {isToml ? "TOML" : "JSON"} to get started.
        </DialogDescription>

        <div className="m-6 mt-0 flex min-h-0 flex-1 overflow-hidden rounded-[8px] border border-mcpx-border">
          <div className="min-h-0 w-64 overflow-y-auto border-r border-mcpx-border-subtle bg-mcpx-surface-subtle p-4">
            <div className="space-y-2">
              {AGENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleAgentTypeChange(type.value)}
                  aria-pressed={selectedAgentType === type.value}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border border-transparent p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mcpx-focus",
                    selectedAgentType === type.value
                      ? "border-mcpx-selected bg-mcpx-selected-weak text-mcpx-selected hover:bg-mcpx-selected-weak"
                      : "hover:bg-mcpx-surface-hover",
                  )}
                >
                  <img
                    src={getAgentIcon(type.value)}
                    alt={type.label}
                    className="w-8 h-8 shrink-0 object-contain"
                  />
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {selectedConfig && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
                <div className="mb-4">
                  <h3
                    className="font-semibold"
                    style={{ fontSize: "16px", color: "var(--mcpx-text)" }}
                  >
                    {selectedConfig.label}
                  </h3>
                </div>
                <CustomTabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <CustomTabsList>
                    <CustomTabsTrigger
                      value="json"
                      disabled={instructionsOnlyClients.has(
                        selectedConfig.value,
                      )}
                    >
                      {isToml ? "TOML Config" : "JSON Config"}
                    </CustomTabsTrigger>
                    <CustomTabsTrigger value="instructions">
                      Instructions
                    </CustomTabsTrigger>
                  </CustomTabsList>
                  <CustomTabsContent
                    value="json"
                    className="mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto px-0 pt-4 pb-0"
                  >
                    <div className="relative  flex-col">
                      <div className="absolute top-3 right-3 z-10">
                        <button
                          onClick={() => void handleCopyConfig()}
                          className="flex items-center justify-center p-1 hover:opacity-70 transition-opacity"
                          title={copied ? "Copied!" : "Copy"}
                        >
                          {copied ? (
                            <CheckCircle className="w-4 h-4 text-mcpx-success-text" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <CustomMonacoEditor
                        value={editorValue}
                        height="365px"
                        language={editorLanguage}
                        className=""
                        readOnly={true}
                      />
                    </div>
                  </CustomTabsContent>

                  <CustomTabsContent
                    value="instructions"
                    className="min-h-0 flex-1 overflow-y-auto px-0 pt-4 pr-2 pb-0"
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
