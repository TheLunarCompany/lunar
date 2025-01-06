package utils

import (
	"errors"
	"fmt"
	"net/url"
	"reflect"
	"strings"
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

// LastErrorWithUnwrappedDepth returns the last error with the specified depth
func LastErrorWithUnwrappedDepth(err error, depth int) error {
	var messages []string
	current := err
	for i := 0; i < depth && current != nil; i++ {
		messages = append(messages, current.Error())
		current = errors.Unwrap(current)
	}

	if len(messages) == 0 {
		return err
	}

	// Join the collected error messages into a single error message.
	formatted := messages[0]
	for _, msg := range messages[1:] {
		formatted = fmt.Sprintf("%s: %s", msg, formatted)
	}
	return errors.New(formatted)
}

func SliceToMap(slice []string) map[string]string {
	mapVal := make(map[string]string)
	for _, val := range slice {
		mapVal[val] = val
	}
	return mapVal
}

func ExtractHost(rawURL string) string {
	if !strings.Contains(rawURL, "://") {
		rawURL = "http://" + rawURL
	}

	parsedURL, err := url.Parse(rawURL)
	if err == nil {
		return parsedURL.Host
	}

	// As a fallback, split rawURL manually
	parts := strings.SplitN(rawURL, "/", 2)
	host := parts[0]
	host = strings.TrimPrefix(host, "www.")

	return host
}
