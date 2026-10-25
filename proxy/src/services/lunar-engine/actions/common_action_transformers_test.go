package actions

import (
	"errors"
	"fmt"
	"testing"

	"github.com/negasus/haproxy-spoe-go/action"
	lo "github.com/samber/lo"
	"github.com/stretchr/testify/assert"
)

func TestNoOpActionTransformer(t *testing.T) {
	t.Parallel()
	currentAction := NoOpAction{}
	res := currentAction.ReqToSpoeActions()
	want := action.Actions{}

	assert.Equal(t, res, want)
}

func getSetVarActionByName(
	allActions action.Actions,
	name string,
) (action.Action, error) {
	var err error

	isRequestedHeader := func(action action.Action, _ int) bool {
		setVarAction := action
		return setVarAction.Name == name
	}

	relevantActions := lo.Filter(allActions, isRequestedHeader)

	if len(relevantActions) != 1 {
		errorMessage := fmt.Sprintf(
			"Failed! should have had exactly one matching action (%v)",
			relevantActions,
		)
		err = errors.New(errorMessage)
	}

	action := relevantActions[0]
	setVarAction := action

	return setVarAction, err
}
