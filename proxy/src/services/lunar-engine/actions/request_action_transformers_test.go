package actions

import (
	"lunar/toolkit-core/testutils"
	"sort"
	"strings"
	"testing"

	spoe "github.com/TheLunarCompany/haproxy-spoe-go"
	lo "github.com/samber/lo"
	"github.com/stretchr/testify/assert"
)

func TestEarlyResponseActionTransformerOnlySetsTransactionVars(t *testing.T) {
	t.Parallel()
	action := EarlyResponseAction{
		Status:  429,
		Body:    "hello",
		Headers: map[string]string{"Auth": "ABC123"},
	}
	allActions := action.ReqToSpoeActions()

	getScope := func(action spoe.Action, _ int) byte {
		setVarAction, _ := action.(spoe.ActionSetVar)
		return byte(setVarAction.Scope)
	}

	assert.Condition(
		t,
		testutils.SliceAllEquals(
			lo.Map(allActions, getScope),
			byte(spoe.VarScopeTransaction),
		),
	)
}

func TestEarlyResponseActionTransformerSetsBodyAsBytes(t *testing.T) {
	t.Parallel()
	action := EarlyResponseAction{
		Status:  429,
		Body:    "hello",
		Headers: map[string]string{"Auth": "ABC123"},
	}
	allActions := action.ReqToSpoeActions()
	bodySetVarAction, err := getSetVarActionByName(
		allActions,
		ResponseBodyActionName,
	)

	assert.Nil(t, err)

	res := bodySetVarAction.Value.([]byte)
	want := []byte("hello")

	assert.Equal(t, res, want)
}

func TestEarlyResponseActionTransformerSetsHeadersAsString(t *testing.T) {
	t.Parallel()
	action := EarlyResponseAction{
		Status:  429,
		Body:    "hello",
		Headers: map[string]string{"Auth": "ABC123", "Foo": "Bar"},
	}
	allActions := action.ReqToSpoeActions()
	headersSetVarAction, err := getSetVarActionByName(
		allActions,
		ResponseHeadersActionName,
	)

	assert.Nil(t, err)

	res := headersSetVarAction.Value.(string)
	slicedRes := strings.Split(strings.Trim(res, "\n"), "\n")
	wantParts := []string{"Auth:ABC123", "Foo:Bar"}
	sort.Strings(slicedRes)
	sort.Strings(wantParts)
	assert.Equal(t, slicedRes, wantParts)
	assert.Condition(t, testutils.EndsWith(res, "\n"))
}

func TestEarlyResponseActionTransformerSetsStatus(t *testing.T) {
	t.Parallel()
	action := EarlyResponseAction{
		Status:  429,
		Body:    "hello",
		Headers: map[string]string{"Auth": "ABC123"},
	}
	allActions := action.ReqToSpoeActions()
	statusSetVarAction, err := getSetVarActionByName(
		allActions,
		StatusCodeActionName,
	)

	assert.Nil(t, err)

	res := statusSetVarAction.Value.(int)
	want := 429

	assert.Equal(t, res, want)
}
