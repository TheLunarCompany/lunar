package publictypes

import (
	"fmt"
	"strconv"
	"strings"
)

// StatusCodeRange represents a range of status codes (e.g., 200-299).
// Single status codes will be represented as a range (e.g., 200-200).
type StatusCodeRange struct {
	StatusCode any
	start      int
	end        int
}

func NewStatusCodeRange(statusCode int) StatusCodeRange {
	return StatusCodeRange{
		StatusCode: statusCode,
		start:      statusCode,
		end:        statusCode,
	}
}

func NewStatusCodeRangeFromAny(statusCode any) (*StatusCodeRange, error) {
	scParam := &StatusCodeRange{
		StatusCode: statusCode,
	}

	if err := scParam.parseStatusCodeToRange(); err != nil {
		return nil, fmt.Errorf("failed to parse status code range: %w", err)
	}
	return scParam, nil
}

func (p *StatusCodeRange) IsValid() bool {
	if p.start == 0 && p.end == 0 {
		return false
	}
	if p.start > p.end {
		return false
	}
	return true
}

func (p *StatusCodeRange) IsStatusCodeInRange(statusCode int) bool {
	return statusCode >= p.start && statusCode <= p.end
}

func (p *StatusCodeRange) IsStatusCodeParamInRange(other StatusCodeRange) bool {
	return p.start >= other.start && p.end <= other.end
}

func (p *StatusCodeRange) String() string {
	if p.start == p.end {
		return fmt.Sprintf("%d", p.start)
	}
	return fmt.Sprintf("%d-%d", p.start, p.end)
}

func (p *StatusCodeRange) parseStatusCodeToRange() error {
	switch statusCodeVal := p.StatusCode.(type) {
	case int:
		p.start = statusCodeVal
		p.end = statusCodeVal
	case []int:
		if len(statusCodeVal) == 1 {
			p.start = statusCodeVal[0]
			p.end = statusCodeVal[0]
		} else if len(statusCodeVal) == 2 {
			p.start = statusCodeVal[0]
			p.end = statusCodeVal[1]
		} else {
			return fmt.Errorf("invalid status code range: %v", statusCodeVal)
		}
	case any, string:
		statusCodeA, statusCodeB, err := parseStatusCodeRangeStr(fmt.Sprintf("%v", p.StatusCode))
		if err != nil {
			return fmt.Errorf("failed to parse status code range: %w", err)
		}
		p.start = statusCodeA
		p.end = statusCodeB
	default:
		return fmt.Errorf("unsupported status code type: %T", p.StatusCode)
	}
	return nil
}

func parseStatusCodeRangeStr(rangeStr string) (int, int, error) {
	rangeValues := strings.Split(rangeStr, "-")
	if len(rangeValues) == 1 {
		val, err := strconv.Atoi(rangeValues[0])
		if err != nil {
			return 0, 0, fmt.Errorf("invalid value: %v", rangeValues[0])
		}
		return val, val, nil
	}

	if len(rangeValues) > 2 {
		return 0, 0, fmt.Errorf("invalid range: %v", rangeStr)
	}

	valFrom, err := strconv.Atoi(rangeValues[0])
	if err != nil {
		return 0, 0, fmt.Errorf("invalid value: %v", rangeValues[0])
	}
	valTo, err := strconv.Atoi(rangeValues[1])
	if err != nil {
		return 0, 0, fmt.Errorf("invalid value: %v", rangeValues[1])
	}

	return valFrom, valTo, nil
}
