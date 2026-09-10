package publictypes

import (
	"fmt"
	"slices"
	"sort"
	"strings"

	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"
)

// StatusCodeParam holds a list of StatusCodeRange.
type StatusCodeParam struct {
	Ranges []StatusCodeRange
}

func NewStatusCodeParam(ranges ...StatusCodeRange) StatusCodeParam {
	return StatusCodeParam{
		Ranges: ranges,
	}
}

func (scp *StatusCodeParam) AddRange(rng StatusCodeRange) {
	scp.Ranges = append(scp.Ranges, rng)
}

// Contains checks if a given status code is within any of the ranges.
func (scp *StatusCodeParam) Contains(code int) bool {
	for _, rng := range scp.Ranges {
		if rng.IsStatusCodeInRange(code) {
			return true
		}
	}
	return false
}

// String returns a string representation of the StatusCodeParam.
func (scp *StatusCodeParam) String() string {
	if scp.IsEmpty() {
		return "[]"
	}
	var result []string
	for _, rng := range scp.Ranges {
		result = append(result, rng.String())
	}
	sort.Strings(result)
	return "[" + strings.Join(result, ", ") + "]"
}

// IsEmpty checks if the StatusCodeParam has no ranges defined.
func (scp *StatusCodeParam) IsEmpty() bool {
	return len(scp.Ranges) == 0
}

// IsValid checks if the StatusCodeParam is valid.
func (scp *StatusCodeParam) IsValid() bool {
	if scp.IsEmpty() {
		return false
	}
	for _, rng := range scp.Ranges {
		if !rng.IsValid() {
			log.Error().Msgf("Invalid status code range: %v", rng)
			return false
		}
	}
	return true
}

// Extend merges another StatusCodeParam into the current one.
func (scp *StatusCodeParam) Extend(other StatusCodeParam) {
	for _, otherRng := range other.Ranges {
		if !slices.ContainsFunc(scp.Ranges, otherRng.IsStatusCodeParamInRange) {
			scp.Ranges = append(scp.Ranges, otherRng)
		}
	}
}

// UnmarshalYAML implements the yaml.Unmarshaler interface for StatusCodeParam.
func (scp *StatusCodeParam) UnmarshalYAML(unmarshal func(any) error) error {
	var raw []string
	if err := unmarshal(&raw); err != nil {
		return err
	}

	for _, item := range raw {
		statusCodeRange, err := NewStatusCodeRangeFromAny(item)
		if err != nil {
			return err
		}
		if !statusCodeRange.IsValid() {
			return fmt.Errorf("invalid status code range: %v", statusCodeRange)
		}
		scp.Ranges = append(scp.Ranges, *statusCodeRange)
	}
	return nil
}

func statusCodeParamUnmarshalHook(val any) (*ParamValue, error) {
	out, err := yaml.Marshal(val)
	if err != nil {
		log.Error().Msgf("Failed to marshal value for StatusCodeParam: %v", err)
		return nil, err
	}

	var scp StatusCodeParam
	err = yaml.Unmarshal(out, &scp)
	if err != nil {
		log.Error().Msgf("Failed to unmarshal StatusCodeParam: %v", err)
		return nil, err
	}
	return &ParamValue{
		valueStatusCodeParam: &scp,
	}, nil
}
