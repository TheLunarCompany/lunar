package typing_test

import (
	"lunar/toolkit-core/typing"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPtrIfDefinedReturnsPointerWhenInputIsNotNil(t *testing.T) {
	t.Parallel()
	input := "foobar"
	inputPtr := &input

	res, valid := typing.PtrIfDefined(inputPtr)
	assert.True(t, valid)
	assert.Equal(t, res, inputPtr)
}

func TestPtrIfDefinedReturnsNilWhenInputIsNil(t *testing.T) {
	t.Parallel()
	var inputPtr *string // zero value will be nil

	res, valid := typing.PtrIfDefined(inputPtr)
	assert.False(t, valid)
	assert.Equal(t, res, inputPtr)
}

// Below are some utility constructs for testing `typing.EnsureTag`.
//
// Some enum type:
type myTagType int

// Enum members:
const (
	unassignedType myTagType = iota
	blueType
	greenType
)

// A struct that holds the possible union type members.
// Our tagging should be based on which field has a non-nil pointer,
// which should be only one (this is not checked, just good will).
type myUnionStruct struct {
	blue  *struct{ a int }
	green *struct{ b int }
}

// the top-level struct that holds the tag and the union struct:
type myContainer struct {
	myTag         myTagType
	myUnionStruct myUnionStruct
}

// An implementation of the `typing.Mappable` interface for myContainer.
// This is required by `typing.EnsureTag`.
//
//nolint:lll
func (myContainer *myContainer) GetMapping() []typing.UnionMemberPresence[myTagType] {
	return []typing.UnionMemberPresence[myTagType]{
		{Defined: myContainer.myUnionStruct.blue != nil, Value: blueType},
		{Defined: myContainer.myUnionStruct.green != nil, Value: greenType},
	}
}

func TestEnsureTagMutatesTagFieldWhenUnassignedAndPossible(t *testing.T) {
	t.Parallel()
	greenInstance := struct{ b int }{b: 1}

	// Note that at the beginning the `myTag` is unassigned.
	// This will naturally happen in situations when data is decoded from YAML/JSON
	// and the field is not supplied.
	myContainerInstance := myContainer{
		myTag:         unassignedType,
		myUnionStruct: myUnionStruct{blue: nil, green: &greenInstance},
	}

	// before `typing.EnsureTag` is run
	assert.Equal(t, myContainerInstance.myTag, unassignedType)
	// run `typing.EnsureTag` on the container instance
	err := typing.EnsureTag(
		&myContainerInstance.myTag,
		unassignedType,
		myContainerInstance.GetMapping,
	)

	assert.Nil(t, err)
	// after we run `typing.EnsureTag`, the container instance is tagged correctly
	assert.Equal(t, myContainerInstance.myTag, greenType)
}

func TestEnsureTagDoesNotMutateTagFieldWhenNoUnionMembersAreDefined(
	t *testing.T,
) {
	t.Parallel()
	// Here again `myTag` starts off unassigned.
	// However, both members of the union struct are nil,
	// hence it is impossible to tag the container,
	// so the tag is expected to remain `unassignedType`
	myContainerInstance := myContainer{
		myTag:         unassignedType,
		myUnionStruct: myUnionStruct{blue: nil, green: nil},
	}

	// before `typing.EnsureTag` is run
	assert.Equal(t, myContainerInstance.myTag, unassignedType)
	// run `typing.EnsureTag` on the container instance
	err := typing.EnsureTag(
		&myContainerInstance.myTag,
		unassignedType,
		myContainerInstance.GetMapping,
	)

	assert.NotNil(t, err)
	// after we run `typing.EnsureTag`,
	// the container instance is tagged as `unassignedType`
	assert.Equal(t, myContainerInstance.myTag, unassignedType)
}

func TestEnsureTagDoesNotMutateTagFieldWhenAssigned(t *testing.T) {
	t.Parallel()
	greenInstance := struct{ b int }{b: 1}

	// Note that the tag is in fact *wrong* - should have been blue.
	// This test is done like this to prove that once tagged,
	// a call to `typing.EnsureTag` will not fix a wrong tag,
	// due to performance concerns
	myContainerInstance := myContainer{
		myTag:         blueType,
		myUnionStruct: myUnionStruct{blue: nil, green: &greenInstance},
	}

	// before `typing.EnsureTag` is run
	assert.Equal(t, myContainerInstance.myTag, blueType)
	// run `typing.EnsureTag` on the container instance
	err := typing.EnsureTag(
		&myContainerInstance.myTag,
		unassignedType,
		myContainerInstance.GetMapping,
	)
	assert.Nil(t, err)

	// after we run `typing.EnsureTag`, the container instance's tag remains intact
	assert.Equal(t, myContainerInstance.myTag, blueType)
}

func TestEnsureTagDoesNotMutateTagFieldMultipleUnionMembersAreDefined(
	t *testing.T,
) {
	t.Parallel()
	blueInstance := struct{ a int }{a: 1}
	greenInstance := struct{ b int }{b: 2}

	// Here again `myTag` starts off unassigned.
	// However, both members of the union struct are *not* nil,
	// hence it is impossible to tag the container,
	// so the tag is expected to remain `unassignedType`
	myContainerInstance := myContainer{
		myTag: unassignedType,
		myUnionStruct: myUnionStruct{
			blue:  &blueInstance,
			green: &greenInstance,
		},
	}

	// before `typing.EnsureTag` is run
	assert.Equal(t, myContainerInstance.myTag, unassignedType)
	// run `typing.EnsureTag` on the container instance
	err := typing.EnsureTag(
		&myContainerInstance.myTag,
		unassignedType,
		myContainerInstance.GetMapping,
	)
	assert.NotNil(t, err)
	// after we run `typing.EnsureTag`, the container instance's tag remains intact
	assert.Equal(t, myContainerInstance.myTag, unassignedType)
}
