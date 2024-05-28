package utils

import (
	"fmt"
	streamtypes "lunar/engine/streams/types"
	"strconv"
)

// Define a type constraint that includes all numeric types
type Numeric interface {
	~int | ~int8 | ~int16 | ~int32 | ~int64 |
		~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 |
		~float32 | ~float64
}

func ExtractStrParam(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *string,
) error {
	if metaData == nil {
		return fmt.Errorf("metadata is nil")
	}
	if result == nil {
		return fmt.Errorf("result is nil")
	}

	val, found := metaData[paramName]
	if !found {
		return fmt.Errorf("parameter %s not found", paramName)
	}

	*result = val.StringVal()
	return nil
}

func ExtractNumericParam[T Numeric](
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *T,
) error {
	if metaData == nil {
		return fmt.Errorf("metadata is nil")
	}
	if result == nil {
		return fmt.Errorf("result is nil")
	}

	val, found := metaData[paramName]
	if !found {
		return fmt.Errorf("parameter %s not found", paramName)
	}

	res, err := convertStringToNumeric[T](val.StringVal())
	if err != nil {
		return fmt.Errorf("failed to convert parameter %s to numeric: %w", paramName, err)
	}
	*result = res
	return nil
}

func ExtractMapParam[T any](
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *map[string]T,
) error {
	if metaData == nil {
		return fmt.Errorf("metadata is nil")
	}
	if result == nil {
		return fmt.Errorf("result is nil")
	}

	val, found := metaData[paramName]
	if !found {
		return fmt.Errorf("parameter %s not found", paramName)
	}

	res, success := val.Value.(map[string]T)
	if !success {
		return fmt.Errorf("failed to convert parameter %s to map", paramName)
	}
	*result = res
	return nil
}

// Function to convert string to numeric type T
func convertStringToNumeric[T Numeric](strVal string) (T, error) {
	var zero T
	switch any(zero).(type) {
	case int:
		v, err := strconv.Atoi(strVal)
		return any(v).(T), err
	case int8:
		v, err := strconv.ParseInt(strVal, 10, 8)
		return any(int8(v)).(T), err
	case int16:
		v, err := strconv.ParseInt(strVal, 10, 16)
		return any(int16(v)).(T), err
	case int32:
		v, err := strconv.ParseInt(strVal, 10, 32)
		return any(int32(v)).(T), err
	case int64:
		v, err := strconv.ParseInt(strVal, 10, 64)
		return any(int64(v)).(T), err
	case uint:
		v, err := strconv.ParseUint(strVal, 10, 0)
		return any(uint(v)).(T), err
	case uint8:
		v, err := strconv.ParseUint(strVal, 10, 8)
		return any(uint8(v)).(T), err
	case uint16:
		v, err := strconv.ParseUint(strVal, 10, 16)
		return any(uint16(v)).(T), err
	case uint32:
		v, err := strconv.ParseUint(strVal, 10, 32)
		return any(uint32(v)).(T), err
	case uint64:
		v, err := strconv.ParseUint(strVal, 10, 64)
		return any(uint64(v)).(T), err
	case float32:
		v, err := strconv.ParseFloat(strVal, 32)
		return any(float32(v)).(T), err
	case float64:
		v, err := strconv.ParseFloat(strVal, 64)
		return any(v).(T), err
	default:
		return zero, fmt.Errorf("unsupported type")
	}
}
