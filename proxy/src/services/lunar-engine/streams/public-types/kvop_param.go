package publictypes

import (
	"fmt"
	"sort"
	"strings"

	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"
)

type getValFunc func(string) (string, bool) // input key, return value and whether it exists

type KVOpParam struct {
	KVOps []KeyValueOperation
}

func NewKVOpParam(kvOps ...KeyValueOperation) *KVOpParam {
	return &KVOpParam{
		KVOps: kvOps,
	}
}

func (p *KVOpParam) EvaluateOpWithAndOperand(valFunc getValFunc, target, onName string) bool {
	for _, op := range p.KVOps {
		if op.EvaluateOp(valFunc(op.Key)) {
			log.Trace().Msgf("%s %s value matched on: %s", target, op.Key, onName)
			continue
		}
		log.Trace().Msgf("%s %s not qualified on: %s", target, op.Key, onName)
		return false
	}
	return true
}

func (p *KVOpParam) EvaluateOpWithOrOperand(valFunc getValFunc, target, onName string) bool {
	for _, op := range p.KVOps {
		if op.EvaluateOp(valFunc(op.Key)) {
			log.Trace().Msgf("%s %s value matched on: %s", target, op.Key, onName)
			return true
		}
		log.Trace().Msgf("%s %s not qualified on: %s", target, op.Key, onName)
	}
	log.Trace().Msgf("%ss not qualified for: %s", target, onName)
	return false
}

func (p *KVOpParam) AddKVOp(kvOp KeyValueOperation) {
	p.KVOps = append(p.KVOps, kvOp)
}

func (p *KVOpParam) String() string {
	if len(p.KVOps) == 0 {
		return "[]"
	}
	var result []string
	for _, kvOp := range p.KVOps {
		result = append(result, kvOp.String())
	}
	sort.Strings(result)
	return "[" + strings.Join(result, ", ") + "]"
}

func (p *KVOpParam) IsEmpty() bool {
	return len(p.KVOps) == 0
}

func (p *KVOpParam) Extend(other KVOpParam) {
	if other.IsEmpty() {
		return
	}
	for _, kvOp := range other.KVOps {
		if !p.ContainsKeyValue(kvOp) {
			p.KVOps = append(p.KVOps, kvOp)
		}
	}
}

func (p *KVOpParam) ContainsKeyValue(kv KeyValueOperation) bool {
	for _, item := range p.KVOps {
		if item.Key == kv.Key && item.Value == kv.Value {
			return true
		}
	}
	return false
}

func (p *KVOpParam) UnmarshalYAML(unmarshal func(any) error) error {
	type aux struct {
		Key       string
		Value     any
		Operation string
	}
	var raw []aux
	if err := unmarshal(&raw); err != nil {
		return err
	}

	for _, aux := range raw {
		kvo := KeyValueOperation{}
		kvo.Key = aux.Key
		kvo.Value = aux.Value
		kvo.Operation = OperationParamType(aux.Operation)
		if kvo.Operation == "" {
			kvo.Operation = OpParamEq // Sets the default operation to eq if not specified
		}

		if !kvo.Operation.IsValid() {
			return fmt.Errorf("invalid operation: %s", kvo.Operation)
		}

		kvo.valueAsString = fmt.Sprintf("%v", kvo.Value)
		kvo.operationEval = getOperationEval(kvo.Value, kvo.Operation.GetEvalFunc())
		if kvo.operationEval == nil {
			return fmt.Errorf("operation not initialized")
		}
		p.KVOps = append(p.KVOps, kvo)
	}
	return nil
}

func kvOpParamUnmarshalHook(val any) (*ParamValue, error) {
	out, err := yaml.Marshal(val)
	if err != nil {
		log.Error().Msgf("Failed to marshal value for StatusCodeParam: %v", err)
		return nil, err
	}

	var kvOpParam KVOpParam
	err = yaml.Unmarshal(out, &kvOpParam)
	if err != nil {
		log.Error().Msgf("Failed to unmarshal StatusCodeParam: %v", err)
		return nil, err
	}
	return &ParamValue{
		valueKVOpParam: &kvOpParam,
	}, nil
}
