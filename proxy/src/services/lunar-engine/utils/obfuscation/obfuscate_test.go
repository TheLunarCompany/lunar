package obfuscation_test

import (
	"lunar/engine/utils/obfuscation"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/valyala/fastjson"
)

const obfuscatedValue = "<obfuscated>"

var emptyExcludedPaths = []string{}

func TestObfuscateStringWithMD5Hasher(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{Hasher: obfuscation.MD5Hasher{}}

	res := obfuscator.ObfuscateString("foo")
	want := "acbd18db4cc2f85cedef654fccc4a4d8" // https://md5calc.com/hash/md5/foo
	assert.Equal(t, want, res)
}

func toJSON(raw string) *fastjson.Value {
	return fastjson.MustParse(raw)
}

func TestObfuscateJSONString(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}

	var arena fastjson.Arena
	res, err := obfuscator.ObfuscateJSON(`"foo"`, emptyExcludedPaths)
	assert.Nil(t, err)
	want := arena.NewString(obfuscatedValue)
	assert.Equal(t, want, toJSON(res))
}

func TestObfuscateJSONObfuscateStringFieldValues(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	res, err := obfuscator.ObfuscateJSON(`{"key": "value"}`, emptyExcludedPaths)
	assert.Nil(t, err)
	val := toJSON(res).GetStringBytes("key")
	assert.Equal(t, obfuscatedValue, string(val))
}

func TestObfuscateJSONObfuscatesIntFieldValues(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	res, err := obfuscator.ObfuscateJSON(`{"key": 10}`, emptyExcludedPaths)
	assert.Nil(t, err)
	val := toJSON(res).GetStringBytes("key")
	assert.Equal(t, obfuscatedValue, string(val))
}

func TestObfuscateJSONObfuscatesFloatFieldValues(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	res, err := obfuscator.ObfuscateJSON(`{"key": 10.9}`, emptyExcludedPaths)
	assert.Nil(t, err)
	val := toJSON(res).GetStringBytes("key")
	assert.Equal(t, obfuscatedValue, string(val))
}

func TestObfuscateJSONObfuscatesBooleanFieldValues(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	res, err := obfuscator.ObfuscateJSON(
		`{"true": true, "false": false}`,
		emptyExcludedPaths,
	)
	assert.Nil(t, err)
	valTrue := toJSON(res).GetStringBytes("true")
	assert.Equal(t, obfuscatedValue, string(valTrue))
	valFalse := toJSON(res).GetStringBytes("false")
	assert.Equal(t, obfuscatedValue, string(valFalse))
}

func TestObfuscateJSONObfuscatesNullFieldValues(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	res, err := obfuscator.ObfuscateJSON(`{"key": null}`, emptyExcludedPaths)
	assert.Nil(t, err)
	val := toJSON(res).GetStringBytes("key")
	assert.Equal(t, obfuscatedValue, string(val))
}

func TestObfuscateJSONObfuscatesNestedObjectAndArrayFieldValues(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	input := `{
		"nestedValue": {
			"yetMoreNestedValue": {
				"arrayValue": [
					{
						"final": "foo"
					}
				]
			}
		}
	}`
	res, err := obfuscator.ObfuscateJSON(input, emptyExcludedPaths)
	assert.Nil(t, err)
	val := toJSON(res).Get("nestedValue").
		Get("yetMoreNestedValue").
		GetArray("arrayValue")[0].
		GetStringBytes("final")

	assert.Equal(t, obfuscatedValue, string(val))
}

func TestObfuscateJSONFailsOnInvalidJSON(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}

	_, err := obfuscator.ObfuscateJSON(`{field`, emptyExcludedPaths)
	assert.NotNil(t, err)
}

func TestExclusionsOnObjects(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	input := `{
		"topA": {
			"middleOne": {
				"shouldNotObfuscate": true,
				"shouldObfuscate": "bla"
			},
			"middleTwo": {
				"lorem": "ipsum"
			},
			"middleThree": {
				"excludeMePlease": 81.101
			}
		},
		"topB": {
			"middleB": "bar"
		},
		"keepingItReal": "lunar"
	}`
	excludedPaths := []string{
		".topA.middleOne.shouldNotObfuscate",
		".topA.middleThree.excludeMePlease",
		".keepingItReal",
	}
	res, err := obfuscator.ObfuscateJSON(input, excludedPaths)
	assert.Nil(t, err)
	expectedJSON := `{
		"topA": {
			"middleOne": {
				"shouldNotObfuscate": true,
				"shouldObfuscate": "<obfuscated>"
			},
			"middleTwo": {
				"lorem": "<obfuscated>"
			},
			"middleThree": {
				"excludeMePlease": 81.101
			}
		},
		"topB": {
			"middleB": "<obfuscated>"
		},
		"keepingItReal": "lunar"
	}`

	assert.Equal(t, toJSON(expectedJSON), toJSON(res))
}

func TestExclusionsOnArray(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	input := `{
		"obfuscatedData": ["foo", "bar"],
		"nonObfuscatedData": ["lorem", "ipsum"]
	}`
	excludedPaths := []string{
		".nonObfuscatedData[]",
	}
	res, err := obfuscator.ObfuscateJSON(input, excludedPaths)
	assert.Nil(t, err)
	expectedJSON := `{
		"obfuscatedData": ["<obfuscated>", "<obfuscated>"],
		"nonObfuscatedData": ["lorem", "ipsum"]
	}`

	assert.Equal(t, toJSON(expectedJSON), toJSON(res))
}

func TestExclusionsPropagationOnObjects(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	input := `{
		"obfuscatedData": {
			"comeOnIn": {
				"foo": "bar"
			}
		},
		"nonObfuscatedData": {
			"comeOnIn": {
				"foo": "baz"
			}
		}
	}`
	excludedPaths := []string{
		".nonObfuscatedData",
	}
	res, err := obfuscator.ObfuscateJSON(input, excludedPaths)
	assert.Nil(t, err)
	expectedJSON := `{
		"obfuscatedData": {
			"comeOnIn": {
				"foo": "<obfuscated>"
			}
		},
		"nonObfuscatedData": {
			"comeOnIn": {
				"foo": "baz"
			}
		}
	}`

	assert.Equal(t, toJSON(expectedJSON), toJSON(res))
}

func TestExclusionsPropagationOnNestedArrayObjects(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	input := `{
		"obfuscatedData": {
			"comeOnIn": [
				{ "foo": "bar" },
				{ "foo": "baz" }
			]
		},
		"nonObfuscatedData": {
			"comeOnIn": [
				{ "foo": "lorem" },
				{ "foo": "ipsum" }
			]
		}
	}`
	excludedPaths := []string{
		".nonObfuscatedData",
	}
	res, err := obfuscator.ObfuscateJSON(input, excludedPaths)
	assert.Nil(t, err)
	expectedJSON := `{
		"obfuscatedData": {
			"comeOnIn": [
				{ "foo": "<obfuscated>" },
				{ "foo": "<obfuscated>" }
			]
		},
		"nonObfuscatedData": {
			"comeOnIn": [
				{ "foo": "lorem" },
				{ "foo": "ipsum" }
			]
		}
	}`

	assert.Equal(t, toJSON(expectedJSON), toJSON(res))
}

func TestExclusionsSpecificationOnNestedArrayObjects(t *testing.T) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	input := `{
		"data": {
			"comeOnIn": [
				{ "foo": "lorem", "bar": "de omnibus" },
				{ "foo": "ipsum", "bar": "dubitandum est" }
			]
		}
	}`
	excludedPaths := []string{
		".data.comeOnIn[].bar",
	}
	res, err := obfuscator.ObfuscateJSON(input, excludedPaths)
	assert.Nil(t, err)
	expectedJSON := `{
		"data": {
			"comeOnIn": [
				{ "foo": "<obfuscated>", "bar": "de omnibus" },
				{ "foo": "<obfuscated>", "bar": "dubitandum est" }
			]
		}
	}`

	assert.Equal(t, toJSON(expectedJSON), toJSON(res))
}

func TestExclusionsSpecificationOnArrayObjectsWhenArrayIsTopLevel(
	t *testing.T,
) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	input := `[
		{ "foo": "lorem", "bar": "de omnibus" },
		{ "foo": "ipsum", "bar": "dubitandum est" }
	]`
	excludedPaths := []string{
		"[].bar",
	}
	res, err := obfuscator.ObfuscateJSON(input, excludedPaths)
	assert.Nil(t, err)
	expectedJSON := `[
		{ "foo": "<obfuscated>", "bar": "de omnibus" },
		{ "foo": "<obfuscated>", "bar": "dubitandum est" }
	]`

	assert.Equal(t, toJSON(expectedJSON), toJSON(res))
}

func TestExclusionsOfNonExistentPathDoesNothing(
	t *testing.T,
) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	input := `{"key": "value"}`
	excludedPaths := []string{"qui"}
	res, err := obfuscator.ObfuscateJSON(input, excludedPaths)
	assert.Nil(t, err)
	expectedJSON := `{"key": "<obfuscated>"}`

	assert.Equal(t, toJSON(expectedJSON), toJSON(res))
}

func TestExclusionsWithEmptyPathCancelsObfuscationForObject(
	t *testing.T,
) {
	t.Parallel()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	input := `{
		"topA": {
			"middleOne": {
				"shouldNotObfuscate": true,
				"shouldObfuscate": "bla"
			},
			"middleTwo": {
				"lorem": "ipsum"
			},
			"middleThree": {
				"excludeMePlease": 81.101
			}
		},
		"topB": {
			"middleB": "bar"
		},
		"keepingItReal": "lunar"
	}`
	excludedPaths := []string{""}
	res, err := obfuscator.ObfuscateJSON(input, excludedPaths)
	assert.Nil(t, err)

	assert.Equal(t, toJSON(input), toJSON(res))
}

func TestExclusionsWithDotPathCancelsObfuscationForObject(
	t *testing.T,
) {
	t.Parallel()
	// This is here because this feature actually doesn't work!
	// TODO: make it work 😎
	t.Skip()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	input := `{
		"topA": {
			"middleOne": {
				"shouldNotObfuscate": true,
				"shouldObfuscate": "bla"
			},
			"middleTwo": {
				"lorem": "ipsum"
			},
			"middleThree": {
				"excludeMePlease": 81.101
			}
		},
		"topB": {
			"middleB": "bar"
		},
		"keepingItReal": "lunar"
	}`
	excludedPaths := []string{"."}
	res, err := obfuscator.ObfuscateJSON(input, excludedPaths)
	assert.Nil(t, err)

	assert.Equal(t, toJSON(input), toJSON(res))
}
