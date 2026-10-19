package jsonpath

import (
	"fmt"

	"github.com/ohler55/ojg/jp"
)

type JSONWrapper struct {
	data              any
	operationRegistry map[string]OperationI
}

func NewJSONWrapper[T any](parseFrom *T) (*JSONWrapper, error) {
	jPath := &JSONWrapper{
		operationRegistry: make(map[string]OperationI),
	}

	data, err := ParseData(parseFrom)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	jPath.data = data
	return jPath, nil
}

func (j *JSONWrapper) QueryJSON(jsonPathExpr string) ([]any, error) {
	expr, err := jp.ParseString(jsonPathExpr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JSONPath expression: %w", err)
	}

	result := expr.Get(j.data)

	return result, nil
}

// WriteJSON updates the JSON data at the specified JSONPath expression with the new value.
// It returns the path of the modified JSON data.
func (j *JSONWrapper) WriteJSON(jsonPathExpr string, newValue any) ([]string, error) {
	expr, err := jp.ParseString(jsonPathExpr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JSONPath expression: %w", err)
	}

	var modifiedPath []string
	for _, value := range expr.Locate(j.data, 100) {
		modifiedPath = append(modifiedPath, value.String())
	}

	err = expr.Set(j.data, newValue)
	if err != nil {
		return nil, fmt.Errorf("failed to set value at JSONPath: %w", err)
	}

	return modifiedPath, nil
}

func (j *JSONWrapper) RegisterOperation(name string, op OperationI) {
	j.operationRegistry[name] = op
}

func (j *JSONWrapper) ExecuteOperation(name string, jsonPathExpr string, args ...any) (any, error) {
	op, ok := j.operationRegistry[name]
	if !ok {
		return nil, fmt.Errorf("custom operation '%s' not found", name)
	}
	return op.Execute(j.data, jsonPathExpr, args...)
}

func (j *JSONWrapper) GetObject() any {
	return j.data
}
