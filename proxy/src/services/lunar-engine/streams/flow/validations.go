package streamflow

import (
	"fmt"

	"github.com/rs/zerolog/log"
)

// validateFlow validates the flow graph for logical inconsistencies.
// It ensures that graph has a valid root,
// all processor connections within the graph are valid.
// It also checks if the edges correctly point to existing nodes,
// detects unconnected processors, and detects circular connections.
// If any validation error is found, an error is returned.
func validateFlow(flowGraph *Flow) error {
	if err := validateDirection(flowGraph.request); err != nil {
		return fmt.Errorf("request direction: %w", err)
	}
	if err := validateDirection(flowGraph.response); err != nil {
		return fmt.Errorf("response direction: %w", err)
	}

	if !flowGraph.request.IsDefined() && !flowGraph.response.IsDefined() {
		return fmt.Errorf("flow graph has no flow direction defined")
	}
	return nil
}

// validateDirection validates the flow direction for logical inconsistencies.
func validateDirection(flow *FlowDirection) error {
	if !flow.IsDefined() {
		log.Trace().Msgf("flow direction '%s' of type '%s' is not defined", flow.flowName, flow.flowType)
		return nil
	}

	// response flow can be without root - it can be a flow that only works with early response
	if flow.GetFlowType().IsRequestType() && !flow.HasValidRoot() {
		return fmt.Errorf("flow graph has no valid root node")
	}

	if err := validateEdges(flow.nodes); err != nil {
		return err
	}

	if err := validateUnconnectedProcessors(flow); err != nil {
		return err
	}

	return detectCircularConnections(flow)
}

// validateEdges validates the edges of the flow graph node.
func validateEdges(nodes map[string]*FlowGraphNode) error {
	for _, node := range nodes {
		for _, edge := range node.GetEdges() {
			if !edge.IsValid() {
				return fmt.Errorf("edge from processor '%s' is invalid", node.processorKey)
			}
		}
	}
	return nil
}

// validateUnconnectedProcessors checks if any processors in the flow graph are unconnected.
func validateUnconnectedProcessors(flow *FlowDirection) error {
	connectedProcessors := make(map[string]bool)

	// Mark processors as connected if they have outgoing connections.
	for processorName, node := range flow.nodes {
		if len(node.edges) > 0 {
			connectedProcessors[processorName] = true
		}

		// Mark target processors of outgoing edges as connected
		for _, edge := range node.edges {
			if edge.node != nil {
				connectedProcessors[edge.node.processorKey] = true
			}
		}
	}

	// Mark root node as connected
	if flow.root != nil && flow.root.IsValid() && len(flow.root.node.GetEdges()) > 0 {
		connectedProcessors[flow.root.node.processorKey] = true
	}

	// Identify any processors not marked as connected
	for processorName := range flow.nodes {
		if _, exists := connectedProcessors[processorName]; !exists {
			return fmt.Errorf("processor '%s' is unconnected", processorName)
		}
	}

	return nil
}

// detectCircularConnections detects circular connections in the flow graph.
func detectCircularConnections(flowDir *FlowDirection) error {
	if flowDir.GetFlowType().IsResponseType() && !flowDir.HasValidRoot() {
		return nil
	}

	rootEdges := flowDir.root.node.edges
	for _, connection := range rootEdges {
		if connection.node == nil {
			continue
		}
		visitedByCondition := make(map[string]map[string]bool) // key - condition, value - processorKey
		proc := connection.node.processorKey
		if !dfsDetectCycles(connection.node, visitedByCondition, proc, connection.condition) {
			return fmt.Errorf("circular connection detected - processor '%s'", proc)
		}
	}

	return nil
}

// dfsDetectCycles performs a DFS from the given node to detect cycles.
// Returns true if a cycle is detected.
func dfsDetectCycles(
	node *FlowGraphNode,
	visitedByCondition map[string]map[string]bool,
	current, condition string,
) bool {
	if condition == "" {
		condition = "*"
	}

	log.Debug().Msgf("dfsDetectCycles: visiting processor %s on condition %s", current, condition)
	if visited, found := visitedByCondition[condition]; found {
		if _, foundCurrent := visited[current]; foundCurrent {
			log.Debug().Msgf("Cycle detected: on condition %s -> processor %s", condition, current)
			return false
		}
	}
	if visitedByCondition[condition] == nil {
		visitedByCondition[condition] = make(map[string]bool)
	}
	visitedByCondition[condition][current] = true

	for _, edge := range node.edges {
		if edge.node == nil {
			continue
		}
		if !dfsDetectCycles(edge.node, visitedByCondition, edge.node.processorKey, edge.condition) {
			return false
		}
	}
	return true
}
