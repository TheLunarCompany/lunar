package models

import (
	"fmt"
	"strings"

	"github.com/pkoukk/tiktoken-go"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const (
	ChatGPT string = "chatgpt"
	Claude  string = "claude"
	Gemini  string = "gemini"

	// all Claude models (including Claude 3 family - Haiku, Sonnet, and Opus)
	// use the same "cl100k_base" encoding for tokenization
	ClaudeDefaultEncoding  = "cl100k_base"
	GeminiDefaultEncoding  = "cl100k_base"
	ChatGPTDefaultEncoding = "cl100k_base"
)

type ModelI interface {
	GetID() string
	CountTokensOfText(string) (int, error)
	CountTokensOfLLMMessage([]byte) (int, error)
}

// Message represents a single message in the conversation
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// MessageRequest represents the request body for creating a message
type MessageRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

type Model struct {
	modelName string // model name (can consist wildcard to specify range): gpt-4o-*, gpt-3.5-turbo
	modelType string
	encoding  string
	encoder   *tiktoken.Tiktoken // Cache the encoder for performance
	logger    zerolog.Logger
}

// NewModel creates a new Model
func NewModel() *Model {
	return &Model{
		logger: log.With().Str("component", "ai-model").Logger(),
	}
}

func (m *Model) Init() error {
	var err error
	if m.encoding != "" {
		m.encoder, err = tiktoken.GetEncoding(m.encoding)
	} else if m.modelName != "" {
		m.encoder, err = tiktoken.EncodingForModel(m.modelName)
		if err != nil {
			log.Warn().Err(err).Msgf("Failed to get encoder for model %s, using model type", m.modelName)
			m.modelType = m.modelName
			m.encoder, err = tiktoken.GetEncoding(m.modelTypeToEncoding())
		}
	} else if m.modelType != "" {
		m.encoder, err = tiktoken.GetEncoding(m.modelTypeToEncoding())
	} else {
		err = fmt.Errorf("no model name or type specified")
	}

	return err
}

func (m *Model) WithName(name string) *Model {
	m.modelName = name
	return m
}

func (m *Model) WithType(modelType string) *Model {
	m.modelType = modelType
	return m
}

func (m *Model) WithEncoding(encoding string) *Model {
	m.encoding = encoding
	return m
}

func (m *Model) GetID() string {
	if m.modelName != "" {
		return m.modelName
	}
	if m.modelType != "" {
		return string(m.modelType)
	}
	return m.encoding
}

func (m *Model) CountTokensOfLLMMessage(body []byte) (int, error) {
	request, err := ExtractMessageRequest(body)
	if err != nil {
		return 0, err
	}

	// Combine all message contents to form the full prompt
	prompt := CombineMessages(request.Messages)

	return m.CountTokensOfText(prompt)
}

func (m *Model) CountTokensOfText(text string) (int, error) {
	if m.encoder == nil {
		return 0, fmt.Errorf("encoder not initialized")
	}

	tokens := m.encoder.Encode(text, nil, nil)
	tokenCount := len(tokens)
	return tokenCount, nil
}

func (m *Model) modelTypeToEncoding() string {
	if m.modelType == "" {
		m.logger.Warn().Msg("Model type not set, using default encoding")
		return ChatGPTDefaultEncoding
	}
	switch strings.ToLower(m.modelType) {
	case ChatGPT:
		return ChatGPTDefaultEncoding
	case Claude:
		return ClaudeDefaultEncoding
	case Gemini:
		return GeminiDefaultEncoding
	default:
		m.logger.Error().Msgf("Model type %v not supported, using default encoding", m.modelType)
		return ChatGPTDefaultEncoding
	}
}
