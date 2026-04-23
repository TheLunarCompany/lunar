import { type Node, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type AddButtonData = Node<{
  kind: "agent" | "server";
}>;

const AddButtonNode = ({ data }: NodeProps<AddButtonData>) => {
  return (
    <Button
      variant="node-card"
      size="icon"
      title={data.kind === "agent" ? "Add Agent" : "Add Server"}
    >
      <Plus />
    </Button>
  );
};

export default AddButtonNode;
