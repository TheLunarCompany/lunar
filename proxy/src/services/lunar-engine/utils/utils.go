package utils

import (
	"errors"
	"reflect"
)

// IsInterfaceNil checks if an interface is nil
// This function required since interface in Go is considered nil
// only if both its type and value are nil. So, it's quite possible that
// an interface is not nil but the value it holds is nil.
func IsInterfaceNil(i interface{}) bool {
	if i == nil {
		return true
	}
	val := reflect.ValueOf(i)
	switch val.Kind() {
	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map, reflect.Ptr, reflect.Slice:
		return val.IsNil()
	case reflect.Invalid:
		return true
	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr,
		reflect.Float32, reflect.Float64, reflect.Complex64, reflect.Complex128, reflect.Array,
		reflect.String, reflect.Struct, reflect.UnsafePointer:
		return val.IsZero()
	default:
		return false
	}
}

// UnwrapError unwraps the error to the original error
func UnwrapError(err error) error {
	for {
		// Unwrap returns the next error in the chain or nil
		unwrapped := errors.Unwrap(err)
		if unwrapped == nil {
			return err // original error if nothing to unwrap
		}
		err = unwrapped
	}
}
