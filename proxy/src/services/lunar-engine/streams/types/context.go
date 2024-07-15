package streamtypes

import (
	"fmt"
	"sync"
)

var _ ContextI = &context{}

type context struct {
	ctx sync.Map
}

func NewContext() ContextI {
	return &context{}
}

// Set stores a value in the context
func (c *context) Set(key string, value interface{}) error {
	c.ctx.Store(key, value)
	return nil
}

// Get retrieves a value from the context
func (c *context) Get(key string) (interface{}, error) {
	val, found := c.ctx.Load(key)
	if !found {
		return nil, fmt.Errorf("key %s not found", key)
	}
	return val, nil
}

// Pop removes a value from the context and returns it
func (c *context) Pop(key string) (interface{}, error) {
	val, found := c.ctx.LoadAndDelete(key)
	if !found {
		return nil, fmt.Errorf("key %s not found", key)
	}
	return val, nil
}
