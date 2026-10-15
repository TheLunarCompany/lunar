package jsonpath

import (
	"fmt"
	"strings"

	"github.com/PaesslerAG/jsonpath"
)

func GetJSONPathValueAsType[T any](
	jsonData interface{},
	jsonPath string,
) (T, error) {
	res, err := GetJSONPathValue(jsonData, jsonPath)
	if err != nil {
		return *new(T), err
	}

	castedRes, ok := res.(T)
	if !ok {
		return *new(T), fmt.Errorf(
			"failed to cast JSON path result, expected %T, got %T",
			*new(T),
			res,
		)
	}

	return castedRes, nil
}

func GetJSONPathValue(jsonData any, jsonPath string) (any, error) {
	res, err := jsonpath.Get(jsonPath, jsonData)
	if err != nil {
		jsonPath = strings.ReplaceAll(jsonPath, "'", "\"") // library doesn't support single quotes
		if res, err = jsonpath.Get(jsonPath, jsonData); err != nil {
			return nil, fmt.Errorf("failed to get JSON path %v: %v", jsonPath, err)
		}
	}
	return res, nil
}
