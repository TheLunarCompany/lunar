package ai

import (
	"encoding/json"
	"lunar/toolkit-core/ai/models"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTokenizerWithChatGPT(t *testing.T) {
	t.Run("CountTokensOfLLMMessage valid request", func(t *testing.T) {
		// Prepare a valid OpenAIRequest JSON body
		requestBody := map[string]interface{}{
			"messages": []map[string]string{
				{"role": "system", "content": "You are a helpful assistant."},
				{"role": "user", "content": "Explain how airplanes fly."},
			},
		}
		body, err := json.Marshal(requestBody)
		require.NoError(t, err)

		// Create a ChatGPT tokenizer
		tokenizer, err := NewTokenizerFromModelType(models.ChatGPT)
		require.NoError(t, err)
		require.NotNil(t, tokenizer)

		// Count tokens
		tokenCount, err := tokenizer.CountTokensOfLLMMessage(body)
		require.NoError(t, err)
		require.Greater(t, tokenCount, 0)

		tokenizer, err = NewTokenizerFromModel("gpt-4o-*")
		require.NoError(t, err)
		require.NotNil(t, tokenizer)

		requestBody = map[string]interface{}{
			"messages": []map[string]string{
				{"content": "hallo world!"},
			},
		}
		body, err = json.Marshal(requestBody)
		require.NoError(t, err)
		tokenCount, err = tokenizer.CountTokensOfLLMMessage(body)
		require.NoError(t, err)
		// value from https://github.com/pkoukk/tiktoken-go/blob/main/doc/test_result.md#encoding-test-result
		require.Equal(t, tokenCount, 4)
	})

	t.Run("Invalid JSON request body", func(t *testing.T) {
		invalidBody := []byte("{invalid-json}")

		tokenizer, err := NewTokenizerFromModelType(models.ChatGPT)
		require.NoError(t, err)
		require.NotNil(t, tokenizer)

		_, err = tokenizer.CountTokensOfLLMMessage(invalidBody)
		require.Error(t, err)
	})

	t.Run("CountTokensOfText", func(t *testing.T) {
		tokenizer, err := NewTokenizerFromModelType(models.ChatGPT)
		require.NoError(t, err)
		require.NotNil(t, tokenizer)

		tokenCount, err := tokenizer.CountTokensOfText("hallo world!")
		require.NoError(t, err)
		// value from https://github.com/pkoukk/tiktoken-go/blob/main/doc/test_result.md#encoding-test-result
		require.Equal(t, tokenCount, 4)
	})

	t.Run("Empty messages", func(t *testing.T) {
		emptyMessagesBody := map[string]interface{}{
			"messages": []map[string]string{},
		}
		body, err := json.Marshal(emptyMessagesBody)
		require.NoError(t, err)

		tokenizer, err := NewTokenizerFromModelType(models.ChatGPT)
		require.NoError(t, err)
		require.NotNil(t, tokenizer)

		tokenCount, err := tokenizer.CountTokensOfLLMMessage(body)
		require.NoError(t, err)
		require.Equal(t, 0, tokenCount)
	})
}

func TestTokenizerWithClaude(t *testing.T) {
	t.Run("CountTokensOfLLMMessage valid request", func(t *testing.T) {
		// Prepare a valid AnthropicAIRequest JSON body
		requestBody := map[string]interface{}{
			"model": "claude-3",
			"messages": []map[string]string{
				{"role": "system", "content": "You are a helpful assistant."},
				{"role": "user", "content": "Describe the impact of climate change."},
			},
		}
		body, err := json.Marshal(requestBody)
		require.NoError(t, err)

		// Create a Claude tokenizer
		tokenizer, err := NewTokenizerFromModelType(models.Claude)
		require.NoError(t, err)
		require.NotNil(t, tokenizer)

		// Count tokens
		tokenCount, err := tokenizer.CountTokensOfLLMMessage(body)
		require.NoError(t, err)
		require.Greater(t, tokenCount, 0)

		requestBody = map[string]interface{}{
			"messages": []map[string]string{
				{"content": "hallo world!"},
			},
		}
		body, err = json.Marshal(requestBody)
		require.NoError(t, err)
		tokenCount, err = tokenizer.CountTokensOfLLMMessage(body)
		require.NoError(t, err)
		// value from https://github.com/pkoukk/tiktoken-go/blob/main/doc/test_result.md#encoding-test-result
		require.Equal(t, tokenCount, 4)
	})

	t.Run("Invalid JSON request body", func(t *testing.T) {
		invalidBody := []byte("{invalid-json}")

		tokenizer, err := NewTokenizerFromModelType(models.Claude)
		require.NoError(t, err)
		require.NotNil(t, tokenizer)

		_, err = tokenizer.CountTokensOfLLMMessage(invalidBody)
		require.Error(t, err)
	})

	t.Run("Empty messages", func(t *testing.T) {
		emptyMessagesBody := map[string]interface{}{
			"model":    "claude-3",
			"messages": []map[string]string{},
		}
		body, err := json.Marshal(emptyMessagesBody)
		require.NoError(t, err)

		tokenizer, err := NewTokenizerFromModelType(models.Claude)
		require.NoError(t, err)
		require.NotNil(t, tokenizer)

		// Count tokens should return zero
		tokenCount, err := tokenizer.CountTokensOfLLMMessage(body)
		require.NoError(t, err)
		require.Equal(t, 0, tokenCount)
	})
}

func TestTokenizerWithGemini(t *testing.T) {
	t.Run("CountTokensOfLLMMessage valid request", func(t *testing.T) {
		requestBody := map[string]interface{}{
			"model": "gemini-3",
			"messages": []map[string]string{
				{"role": "system", "content": "You are a helpful assistant."},
				{"role": "user", "content": "Describe the impact of climate change."},
			},
		}
		body, err := json.Marshal(requestBody)
		require.NoError(t, err)

		// Create a Gemini tokenizer
		tokenizer, err := NewTokenizerFromModelType(models.Gemini)
		require.NoError(t, err)
		require.NotNil(t, tokenizer)

		// Count tokens
		tokenCount, err := tokenizer.CountTokensOfLLMMessage(body)
		require.NoError(t, err)
		require.Greater(t, tokenCount, 0)

		requestBody = map[string]interface{}{
			"messages": []map[string]string{
				{"content": "hallo world!"},
			},
		}
		body, err = json.Marshal(requestBody)
		require.NoError(t, err)
		tokenCount, err = tokenizer.CountTokensOfLLMMessage(body)
		require.NoError(t, err)

		// value from https://github.com/pkoukk/tiktoken-go/blob/main/doc/test_result.md#encoding-test-result
		require.Equal(t, tokenCount, 4)
	})

	t.Run("Invalid JSON request body", func(t *testing.T) {
		invalidBody := []byte("{invalid-json}")

		tokenizer, err := NewTokenizerFromModelType(models.Gemini)
		require.NoError(t, err)
		require.NotNil(t, tokenizer)

		_, err = tokenizer.CountTokensOfLLMMessage(invalidBody)
		require.Error(t, err)
	})

	t.Run("Empty messages", func(t *testing.T) {
		emptyMessagesBody := map[string]interface{}{
			"model":    "gemini-3",
			"messages": []map[string]string{},
		}
		body, err := json.Marshal(emptyMessagesBody)
		require.NoError(t, err)

		tokenizer, err := NewTokenizerFromModelType(models.Gemini)
		require.NoError(t, err)
		require.NotNil(t, tokenizer)

		// Count tokens should return zero
		tokenCount, err := tokenizer.CountTokensOfLLMMessage(body)
		require.NoError(t, err)
		require.Equal(t, 0, tokenCount)
	})
}

func BenchmarkTokenizerCountTokensOfLLMMessage(b *testing.B) {
	// Prepare a valid JSON body
	requestBody := map[string]interface{}{
		"messages": []map[string]string{
			{"role": "system", "content": "You are a helpful assistant."},
			{"role": "user", "content": "Explain how airplanes fly."},
		},
	}
	body, err := json.Marshal(requestBody)
	if err != nil {
		b.Fatalf("Failed to marshal JSON: %v", err)
	}

	// Create a tokenizer for ChatGPT model
	tokenizer, _ := NewTokenizerFromModel("gpt-4-*")
	if tokenizer == nil {
		b.Fatalf("Failed to create tokenizer")
	}

	// Benchmark the token counting function
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := tokenizer.CountTokensOfLLMMessage(body)
		if err != nil {
			b.Fatalf("Error during token count: %v", err)
		}
	}
}

func BenchmarkTokenizerCountTokensOfText(b *testing.B) {
	text := "Hello world! This is a benchmark test."

	tokenizer, _ := NewTokenizerFromModel("gpt-4o-*")
	if tokenizer == nil {
		b.Fatalf("Failed to create tokenizer")
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := tokenizer.CountTokensOfText(text)
		if err != nil {
			b.Fatalf("Error during token count: %v", err)
		}
	}
}
