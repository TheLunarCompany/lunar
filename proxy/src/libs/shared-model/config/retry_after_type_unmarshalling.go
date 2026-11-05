package config

import (
	"fmt"

	"gopkg.in/yaml.v3"
)

func (retryAfterType *RetryAfterType) UnmarshalYAML(value *yaml.Node) error {
	switch raw := value.Value; raw {
	case RetryAfterAbsoluteEpoch.String():
		*retryAfterType = RetryAfterAbsoluteEpoch
	case RetryAfterRelativeSeconds.String():
		*retryAfterType = RetryAfterRelativeSeconds
	default:
		return fmt.Errorf("retryAfterType %v is not recognized", raw)
	}
	return nil
}

var retryAfterTypeMapping = map[RetryAfterType]string{
	RetryAfterAbsoluteEpoch:   "absolute_epoch",
	RetryAfterRelativeSeconds: "relative_seconds",
}

func (retryAfterType RetryAfterType) String() string {
	return retryAfterTypeMapping[retryAfterType]
}
