//go:build !pro

package runner

import "fmt"

type FreeRunner struct{}

func newRunner() (AsyncServiceI, error) {
	return &FreeRunner{}, nil
}

func (r *FreeRunner) Run() error {
	return fmt.Errorf("this module is not available in the community edition")
}

func (r *FreeRunner) Stop() {
	// No-op for FreeRunner
}
