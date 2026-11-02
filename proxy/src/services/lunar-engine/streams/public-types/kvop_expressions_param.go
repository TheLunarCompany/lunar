package publictypes

import (
	"fmt"
	"sort"
	"strings"

	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"
)

type KVOpExpressionsParam struct {
	KVOp              KVOpParam
	LegacyExpressions []string

	isBodyRequired        bool
	isLoadRequestRequired bool
	req                   []string
	res                   []string
}

func (p *KVOpExpressionsParam) Validate(apiStream APIStreamI) bool {
	if p.isLoadRequestRequired {
		_ = apiStream.GetRequest() // load request if required.
	}

	if p.KVOp.IsEmpty() {
		return p.validateLegacyExpressions(apiStream)
	}

	getValue := func(key string) (string, bool) {
		val, err := apiStream.JSONPathQuery(key)
		if err != nil {
			log.Trace().Err(err).Msgf("failed to get value for key %s in %s", key, apiStream.GetName())
			return "", false
		}
		if len(val) == 0 {
			log.Trace().Msgf("value for key %s in %s is nil", key, apiStream.GetName())
			return "", false
		}
		return fmt.Sprintf("%v", val[0]), true
	}

	return p.KVOp.WithGetValFunc(getValue).EvaluateOpWithOrOperand()
}

func (p *KVOpExpressionsParam) IsBodyRequired() bool {
	return p.isBodyRequired
}

func (p *KVOpExpressionsParam) IsLoadRequestRequired() bool {
	return p.isLoadRequestRequired
}

func (p *KVOpExpressionsParam) IsEmpty() bool {
	if p.KVOp.IsEmpty() && len(p.LegacyExpressions) == 0 {
		return true
	}
	return false
}

func (p *KVOpExpressionsParam) Extend(from KVOpExpressionsParam) {
	if !from.KVOp.IsEmpty() {
		p.KVOp.Extend(from.KVOp)
		return
	}
	p.LegacyExpressions = append(p.LegacyExpressions, from.LegacyExpressions...)
}

func (p *KVOpExpressionsParam) String() string {
	if p.IsEmpty() {
		return "[]"
	}

	if !p.KVOp.IsEmpty() {
		return p.KVOp.String()
	}

	sort.Strings(p.LegacyExpressions)
	return "[" + strings.Join(p.LegacyExpressions, ", ") + "]"
}

func (p *KVOpExpressionsParam) UnmarshalYAML(unmarshal func(any) error) error {
	// 1) Try to decode legacy []string
	if err := unmarshal(&p.LegacyExpressions); err == nil {
		log.Trace().Msgf("Legacy expressions successfully decoded: %v", p.LegacyExpressions)

		for _, expression := range p.LegacyExpressions {
			p.isBodyRequired = p.isBodyRequired || strings.Contains(expression, "body")
			expression = strings.Replace(expression, ".body.", ".body_map.", 1)
			if strings.HasPrefix(expression, "$.request") {
				p.req = append(p.req, strings.ReplaceAll(expression, "$.request", "$"))
			} else {
				p.res = append(p.res, strings.ReplaceAll(expression, "$.response", "$"))
			}
		}
		p.isLoadRequestRequired = len(p.req) > 0
		return nil
	}

	// 2) Fallback: decode the new mapping form
	log.Trace().Msg("KVOpExpressionsParam: decoding KVOpParam")
	err := p.KVOp.UnmarshalYAML(unmarshal)
	if err != nil {
		return err
	}

	for i, expression := range p.KVOp.KVOps {
		p.isLoadRequestRequired = p.isLoadRequestRequired ||
			strings.HasPrefix(expression.Key, "$.request")
		p.isBodyRequired = p.isBodyRequired || strings.Contains(expression.Key, "body")
		p.KVOp.KVOps[i].Key = strings.Replace(expression.Key, ".body.", ".body_map.", 1)
	}
	return nil
}

func (p *KVOpExpressionsParam) validateLegacyExpressions(apiStream APIStreamI) bool {
	if len(p.LegacyExpressions) == 0 {
		return true
	}

	expr := p.res
	if apiStream.GetType().IsRequestType() {
		expr = p.req
	}

	log.Trace().Msgf("Validating legacy expressions: %v", expr)
	for _, expression := range expr {
		result, err := apiStream.JSONPathQuery(expression)
		if err != nil {
			log.Error().Msgf("Failed to query JSON: %s", err)
		} else if len(result) > 0 {
			log.Trace().Msgf("Legacy expression '%s' returned match", expression)
			return true
		}
	}
	return false
}

func kvOpExpressionsParamUnmarshalHook(val any) (*ParamValue, error) {
	out, err := yaml.Marshal(val)
	if err != nil {
		log.Error().Msgf("Failed to marshal value for StatusCodeParam: %v", err)
		return nil, err
	}

	var kvOpExpressionParam KVOpExpressionsParam
	err = yaml.Unmarshal(out, &kvOpExpressionParam)
	if err != nil {
		log.Error().Msgf("Failed to unmarshal StatusCodeParam: %v", err)
		return nil, err
	}
	return &ParamValue{
		valueKVOpExpressionsParam: &kvOpExpressionParam,
	}, nil
}
