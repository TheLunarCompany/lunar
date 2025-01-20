package ai

import (
	"lunar/toolkit-core/ai/models"

	"github.com/rs/zerolog/log"
)

type Tokenizer struct {
	model models.ModelI
}

func NewTokenizer(modelName, modelType, encoding string) (*Tokenizer, error) {
	log.Trace().
		Msgf("Creating tokenizer: model %v, type %v, encoding %v", modelName, modelType, encoding)
	model := models.NewModel().WithName(modelName).WithType(modelType).WithEncoding(encoding)
	err := model.Init()
	if err != nil {
		log.Error().Err(err).Msgf("Error initializing model %v", modelName)
		return nil, err
	}
	return &Tokenizer{model: model}, nil
}

func NewTokenizerFromModel(modelName string) (*Tokenizer, error) {
	log.Trace().Msgf("Creating tokenizer for model %v", modelName)
	model := models.NewModel().WithName(modelName)
	err := model.Init()
	if err != nil {
		log.Error().Err(err).Msgf("Error initializing model %v", modelName)
		return nil, err
	}
	return &Tokenizer{model: model}, nil
}

func NewTokenizerFromModelType(modelType string) (*Tokenizer, error) {
	log.Trace().Msgf("Creating tokenizer for model %v", modelType)
	model := models.NewModel().WithType(modelType)
	err := model.Init()
	if err != nil {
		log.Error().Err(err).Msgf("Error initializing model %v", modelType)
		return nil, err
	}
	return &Tokenizer{model: model}, nil
}

func NewTokenizerFromEncoding(encoding string) (*Tokenizer, error) {
	log.Trace().Msgf("Creating tokenizer for encoding %v", encoding)
	model := models.NewModel().WithEncoding(encoding)
	err := model.Init()
	if err != nil {
		log.Error().Err(err).Msgf("Error initializing model %v", encoding)
		return nil, err
	}
	return &Tokenizer{model: model}, nil
}

// CountTokensOfLLMMessage counts the number of tokens in the given body
// LLM message is structured as a JSON object like this:
//
//	{
//	  "messages": [
//	    {
//	      "role": "system",
//	      "content": "You are a helpful assistant."
//	    },
//	    {
//	      "role": "user",
//	      "content": "Explain how airplanes fly."
//	    }
//	  ]
//	}
//
// The content of each message is tokenized and counted.
// role field is optional and can be omitted.
func (t *Tokenizer) CountTokensOfLLMMessage(body []byte) (int, error) {
	tokens, err := t.model.CountTokensOfLLMMessage(body)
	if err != nil {
		log.Error().Err(err).Msgf("Error counting LLM tokens for model %v", t.model.GetID())
		return 0, err
	}
	return tokens, err
}

// CountTokensOfText counts the number of tokens in the given text
func (t *Tokenizer) CountTokensOfText(text string) (int, error) {
	tokens, err := t.model.CountTokensOfText(text)
	if err != nil {
		log.Error().Err(err).Msgf("Error counting LLM tokens of message for model %v", t.model.GetID())
		return 0, err
	}
	return tokens, err
}
