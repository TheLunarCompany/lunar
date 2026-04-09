package models

import (
	"encoding/json"
	"fmt"
	"strings"
)

// CombineMessages combines the content of multiple messages into a single string
func CombineMessages(messages []Message) string {
	var builder strings.Builder
	for _, message := range messages {
		builder.WriteString(message.Content)
		builder.WriteString("\n")
	}
	return builder.String()
}

// ExtractMessageRequest extracts a MessageRequest from a request body
func ExtractMessageRequest(body []byte) (*MessageRequest, error) {
	if len(body) == 0 {
		return nil, fmt.Errorf("request body is empty")
	}
	var request MessageRequest
	if err := json.Unmarshal(body, &request); err != nil {
		return nil, fmt.Errorf("failed to unmarshal request body: %w", err)
	}
	return &request, nil
}
