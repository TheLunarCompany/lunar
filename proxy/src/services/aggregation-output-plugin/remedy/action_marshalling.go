package remedy

import (
	"fmt"
	"strings"

	"github.com/goccy/go-json"
)

func (action Action) MarshalJSON() ([]byte, error) {
	return json.Marshal(action.String())
}

func (action Action) MarshalText() (text []byte, err error) {
	return []byte(action.String()), nil
}

func (action *Action) UnmarshalJSON(data []byte) error {
	var raw string
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	parsed, err := ParseAction(raw)
	if err != nil {
		return err
	}

	*action = parsed

	return nil
}

func (action Action) String() string {
	var res string
	switch action {
	case ActionNoOp:
		res = "no_op"
	case ActionGenerated:
		res = "generated"
	case ActionModified:
		res = "modified"
	}
	return res
}

func ParseAction(raw string) (Action, error) {
	var res Action
	raw = strings.TrimSpace(strings.ToLower(raw))
	switch raw {
	case ActionNoOp.String():
		res = ActionNoOp
	case ActionGenerated.String():
		res = ActionGenerated
	case ActionModified.String():
		res = ActionModified
	default:
		return ActionNoOp, fmt.Errorf("Action %v is not recognized", raw)
	}

	return res, nil
}
