package publictypes

import (
	"fmt"
	"regexp"
	"strconv"

	"github.com/rs/zerolog/log"
)

type KeyValueOperation struct {
	Key           string `yaml:"key"`
	Value         any    `yaml:"value"`
	valueAsString string
	// TODO: need to add validation for the operation type
	Operation     OperationParamType `yaml:"operation"`
	operationEval OpEvalCallbackFunc
}

type OpEvalCallbackFunc func(string, bool) bool

func getOperationEval(value any, opEvalFunctions *OpEvalFunctions) OpEvalCallbackFunc {
	if opEvalFunctions == nil {
		log.Debug().Msg("No operation evaluation function provided")
		return nil
	}

	if opEvalFunctions.OpEvalRegexFunc != nil {
		return func(headerVal string, exists bool) bool {
			regex, err := regexp.Compile(value.(string))
			if err != nil {
				log.Debug().Msgf("Error compiling regex: %s", err)
				return false
			}
			return opEvalFunctions.OpEvalRegexFunc(headerVal, regex, exists)
		}
	}

	if opEvalFunctions.OpEvalStringFunc != nil {
		valueAsString := fmt.Sprintf("%v", value)
		return func(headerVal string, exists bool) bool {
			log.Debug().Msgf("Evaluating string: %s", headerVal)
			return opEvalFunctions.OpEvalStringFunc(headerVal, valueAsString, exists)
		}
	}
	if opEvalFunctions.OpEvalFloat64Func != nil {
		valueAsFloat64, err := toFloat64(value)
		if err != nil {
			log.Debug().Msgf("Error converting value to float64: %s", err)
			return nil
		}

		return func(headerVal string, exists bool) bool {
			asFloat64, err := strconv.ParseFloat(headerVal, 64)
			if err != nil {
				log.Debug().Msgf("Error parsing string to float64: %s", err)
				return false
			}
			return opEvalFunctions.OpEvalFloat64Func(asFloat64, valueAsFloat64, exists)
		}
	}

	if opEvalFunctions.OpEvalBoolFunc != nil {
		valueAsBool, err := strconv.ParseBool(fmt.Sprintf("%v", value))
		if err != nil {
			log.Debug().Msgf("Error converting value to bool: %s", err)
			return nil
		}
		return func(headerVal string, exists bool) bool {
			asBool, err := strconv.ParseBool(headerVal)
			if err != nil {
				log.Debug().Msgf("Error parsing string to bool: %s", err)
				return false
			}
			return opEvalFunctions.OpEvalBoolFunc(asBool, valueAsBool, exists)
		}
	}
	return nil
}

func NewKeyValueOperation(
	key string, value any,
	operationType OperationParamType,
) *KeyValueOperation {
	keyValueOperation := &KeyValueOperation{
		Key:           key,
		Value:         value,
		Operation:     operationType,
		operationEval: getOperationEval(value, operationType.GetEvalFunc()),
	}

	return keyValueOperation
}

func (kvo *KeyValueOperation) ValueAsString() string {
	return kvo.valueAsString
}

func (kvo *KeyValueOperation) EvaluateOp(against string, found bool) bool {
	if kvo.operationEval == nil {
		log.Debug().Msg("Operation callback function not initialized")
		return false
	}
	return kvo.operationEval(against, found)
}

func (kvo *KeyValueOperation) UnmarshalYAML(unmarshal func(any) error) error {
	var aux struct {
		Key       string
		Value     any
		Operation string
	}

	if err := unmarshal(&aux); err != nil {
		return err
	}

	kvo.Key = aux.Key
	kvo.Value = aux.Value
	kvo.Operation = OperationParamType(aux.Operation)
	if kvo.Operation == "" {
		// Sets the default operation to eq if not specified
		kvo.Operation = OpParamEq
	}

	if !kvo.Operation.IsValid() {
		return fmt.Errorf("invalid operation: %s", kvo.Operation)
	}

	kvo.valueAsString = fmt.Sprintf("%v", kvo.Value)
	kvo.operationEval = getOperationEval(kvo.Value, kvo.Operation.GetEvalFunc())
	if kvo.operationEval == nil {
		return fmt.Errorf("operation not initialized")
	}

	return nil
}

func toFloat64(value any) (float64, error) {
	var floatValue float64
	switch parsedValue := value.(type) {
	case float64:
		floatValue = parsedValue
	case float32:
		floatValue = float64(parsedValue)
	case int:
		floatValue = float64(parsedValue)
	case int32:
		floatValue = float64(parsedValue)
	case int64:
		floatValue = float64(parsedValue)
	case string:
		var err error
		floatValue, err = strconv.ParseFloat(parsedValue, 64)
		if err != nil {
			log.Debug().Msgf("Error parsing string to float64: %s", err)
			return 0, err
		}
	default:
		log.Debug().Msgf("Unsupported type for conversion to float64: %T", value)
		return 0, fmt.Errorf("unsupported type: %T", value)
	}
	return floatValue, nil
}
