package lunarcontext

import (
	"fmt"
	publictypes "lunar/engine/streams/public-types"
	"sync"
)

var _ publictypes.ContextI = &contextMemory{}

type contextMemory struct {
	ctx sync.Map
}

// NewContext creates a new memory context
func NewContext() publictypes.ContextI {
	return &contextMemory{}
}

// Set stores a value in the context
func (c *contextMemory) Set(key string, value interface{}) error {
	if key == "" {
		return fmt.Errorf("key cannot be empty")
	}

	c.ctx.Store(key, value)
	return nil
}

// Get retrieves a value from the context.
func (c *contextMemory) Get(key string) (interface{}, error) {
	val, found := c.ctx.Load(key)
	if !found {
		return nil, fmt.Errorf("key %s not found", key)
	}
	return val, nil
}

// Exists checks if a key exists in the context
func (c *contextMemory) Exists(key string) bool {
	_, found := c.ctx.Load(key)
	return found
}

// Pop removes a value from the context and returns it
func (c *contextMemory) Pop(key string) (interface{}, error) {
	val, found := c.ctx.LoadAndDelete(key)
	if !found {
		return nil, fmt.Errorf("key %s not found", key)
	}

	return val, nil
}
