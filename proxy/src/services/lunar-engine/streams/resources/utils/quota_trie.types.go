package resourceutils

import (
	streamconfig "lunar/engine/streams/config"
)

type NodeConfig struct {
	ID       string
	ParentID string
	Filter   *streamconfig.Filter
}

type QuotaNode[T any] struct {
	config   *NodeConfig
	quota    T
	parent   *QuotaNode[T]
	children map[string]*QuotaNode[T]
}

type QuotaTrie[T any] struct {
	root *QuotaNode[T]
}
