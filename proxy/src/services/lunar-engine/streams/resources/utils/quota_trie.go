package resourceutils

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
)

func NewQuotaTrie[T any](rootNodeConfig *NodeConfig, rootNode T) *QuotaTrie[T] {
	return &QuotaTrie[T]{
		root: &QuotaNode[T]{
			quota:    rootNode,
			config:   rootNodeConfig,
			children: make(map[string]*QuotaNode[T]),
		},
	}
}

func (t *QuotaTrie[T]) GetRoot() *QuotaNode[T] {
	return t.root
}

func (t *QuotaTrie[T]) GetNode(ID string) *QuotaNode[T] {
	node, _ := t.root.GetNode(ID)
	return node
}

func (t *QuotaNode[T]) GetQuota() T {
	return t.quota
}

func (t *QuotaNode[T]) GetFilter() *streamconfig.Filter {
	return t.config.Filter
}

func (t *QuotaNode[T]) AddNode(config *NodeConfig, node T) (*QuotaNode[T], error) {
	parent, exists := t.children[config.ID]
	if exists {
		return nil, fmt.Errorf("internal limit with ID %s already exists", config.ParentID)
	}

	newNode := &QuotaNode[T]{
		config:   config,
		parent:   parent,
		quota:    node,
		children: make(map[string]*QuotaNode[T]),
	}

	t.children[config.ID] = newNode
	return newNode, nil
}

func (t *QuotaNode[T]) GetNode(nodeID string) (*QuotaNode[T], error) {
	if t.config.ID == nodeID {
		return t, nil
	}
	for _, child := range t.children {
		foundNode, err := child.GetNode(nodeID)
		if err == nil {
			return foundNode, nil
		}
	}
	return nil, fmt.Errorf("node ID %s not found", nodeID)
}
