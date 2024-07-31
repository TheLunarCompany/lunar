package actions

import (
	"errors"
	"fmt"
	"testing"

	spoe "github.com/TheLunarCompany/haproxy-spoe-go"
	lo "github.com/samber/lo"
	"github.com/stretchr/testify/assert"
)

func TestNoOpActionTransformer(t *testing.T) {
	t.Parallel()
	action := NoOpAction{}
	res := action.ReqToSpoeActions()
	want := []spoe.Action{}

	assert.Equal(t, res, want)
}

func getSetVarActionByName(
	allActions []spoe.Action,
	name string,
) (spoe.ActionSetVar, error) {
	var err error

	isRequestedHeader := func(action spoe.Action, _ int) bool {
		setVarAction, _ := action.(spoe.ActionSetVar)
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
	setVarAction, _ := action.(spoe.ActionSetVar)

	return setVarAction, err
}
