package obfuscation

import (
	"fmt"
	"strconv"

	"github.com/rs/zerolog/log"
	"github.com/valyala/fastjson"
	"golang.org/x/exp/slices"
)

type Obfuscator struct {
	Hasher Hasher
}

func (obfuscator Obfuscator) ObfuscateString(raw string) string {
	return obfuscator.Hasher.HashBytes([]byte(raw))
}

var (
	parserPool fastjson.ParserPool
	arenaPool  fastjson.ArenaPool
)

func (obfuscator Obfuscator) ObfuscateJSON(
	raw string,
	excludedPaths []string,
) (string, error) {
	parser := parserPool.Get()
	defer parserPool.Put(parser)
	json, err := parser.Parse(raw)
	if err != nil {
		return "", err
	}

	arena := arenaPool.Get()
	defer arenaPool.Put(arena)
	obfuscatedJSON, err := obfuscator.obfuscateJSON(
		*json,
		arena,
		"",
		excludedPaths,
		false,
	)
	if err != nil {
		return "", err
	}

	bytes := obfuscatedJSON.MarshalTo([]byte{})
	return string(bytes), nil
}

func (obfuscator Obfuscator) obfuscateJSON(
	raw fastjson.Value,
	arena *fastjson.Arena,
	cursor string,
	excludedPaths []string,
	onExcludedPath bool,
) (*fastjson.Value, error) {
	var obfuscatedJSON *fastjson.Value

	onExcludedPath = onExcludedPath || slices.Contains(excludedPaths, cursor)
	log.Debug().
		Msgf("cursor: %v, onExcludedPath: %v", cursor, onExcludedPath)

	if onExcludedPath {
		return &raw, nil
	}
	switch raw.Type() {
	// Handle complex JSON types which require recursive handling
	case fastjson.TypeArray:
		array, err := raw.Array()
		if err != nil {
			return nil, err
		}
		obfuscatedArray := arena.NewArray()
		for i, item := range array { //nolint:varnamelen
			obfuscatedItem, err := obfuscator.obfuscateJSON(
				*item,
				arena,
				fmt.Sprintf("%s[]", cursor),
				excludedPaths,
				onExcludedPath,
			)
			if err != nil {
				return nil, err
			}
			obfuscatedArray.SetArrayItem(i, obfuscatedItem)
		}
		obfuscatedJSON = obfuscatedArray
	case fastjson.TypeObject:
		object, err := raw.Object()
		if err != nil {
			return nil, err
		}
		keys := getKeys(object)
		obfuscatedObject := arena.NewObject()
		for _, key := range keys {
			value := object.Get(key)
			obfuscatedValue, err := obfuscator.obfuscateJSON(
				*value,
				arena,
				fmt.Sprintf("%s.%s", cursor, key),
				excludedPaths,
				onExcludedPath,
			)
			if err != nil {
				return nil, err
			}
			obfuscatedObject.Set(key, obfuscatedValue)
		}
		obfuscatedJSON = obfuscatedObject
	// Handle primitive JSON types
	case fastjson.TypeNumber:
		number, err := raw.Float64()
		if err != nil {
			return nil, err
		}
		// we are keeping two decimal points for all numbers before obfuscation -
		// 10 will become 10.00, 10.999 will become 10.99
		str := strconv.FormatFloat(number, 'f', 2, 64)
		obfuscatedString := arena.NewString(
			obfuscator.Hasher.HashBytes([]byte(str)),
		)
		obfuscatedJSON = obfuscatedString
	case fastjson.TypeString:
		stringBytes, err := raw.StringBytes()
		if err != nil {
			return nil, err
		}
		obfuscatedString := arena.NewString(
			obfuscator.Hasher.HashBytes(stringBytes),
		)
		obfuscatedJSON = obfuscatedString
	// Handle constant JSON types
	case fastjson.TypeTrue:
		obfuscatedString := arena.NewString(
			obfuscator.Hasher.HashBytes([]byte("true")),
		)
		obfuscatedJSON = obfuscatedString
	case fastjson.TypeFalse:
		obfuscatedString := arena.NewString(
			obfuscator.Hasher.HashBytes([]byte("false")),
		)
		obfuscatedJSON = obfuscatedString
	case fastjson.TypeNull:
		obfuscatedString := arena.NewString(
			obfuscator.Hasher.HashBytes([]byte("null")),
		)
		obfuscatedJSON = obfuscatedString
	}

	return obfuscatedJSON, nil
}

func getKeys(object *fastjson.Object) []string {
	keys := []string{}
	collectKeys := func(key []byte, v *fastjson.Value) {
		keys = append(keys, string(key))
	}
	object.Visit(collectKeys)

	return keys
}
