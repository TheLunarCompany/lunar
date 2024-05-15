package utils

import "reflect"

// IsInterfaceNil checks if an interface is nil
// This function required since interface in Go is considered nil
// only if both its type and value are nil. So, it's quite possible that
// an interface is not nil but the value it holds is nil.
func IsInterfaceNil(i interface{}) bool {
	if i == nil {
		return true
	}
	return reflect.ValueOf(i).IsNil()
}
