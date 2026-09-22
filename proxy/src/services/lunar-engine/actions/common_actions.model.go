package actions

// This file contains the possible actions a remedy plugin can apply.
// Returning an action might change the course of handling
// the API call in various way, whether before calling the actual provider
// or after receiving an actual response from it.

// The default, no-operation action - will do nothing.
type NoOpAction struct{}
