package transformapicall

import (
	"encoding/json"
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/streams/processors/utils"
	public_types "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils/obfuscation"
	"os"
	"strings"

	"github.com/ohler55/ojg/jp"
	"github.com/ohler55/ojg/oj"

	"github.com/rs/zerolog/log"
)

type transformer struct {
	setDefinitions       map[string]any
	deleteDefinitions    []string
	obfuscateDefinitions []string

	obfuscator obfuscation.Obfuscator
}

func newTransformer() *transformer {
	return &transformer{
		setDefinitions: make(map[string]any),
		obfuscator:     obfuscation.Obfuscator{Hasher: obfuscation.MD5Hasher{}},
	}
}

func (t *transformer) IsTransformationsDefined() bool {
	return len(t.setDefinitions) > 0 || len(t.deleteDefinitions) > 0 || len(t.obfuscateDefinitions) > 0
}

// OnRequest applies the defined transformations on the request object.
func (t *transformer) OnRequest(obj public_types.APIStreamI) (actions.ReqLunarAction, error) {
	data, err := utils.ConvertStreamToDataMap(obj)
	if err != nil {
		return nil, err
	}

	data, newHost := t.doTransform(data)
	if newHost == "" {
		newHost = obj.GetRequest().GetHost()
	}
	transformed, err := t.prepareRequest(newHost, obj.GetRequest(), data)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare request: %w", err)
	}
	obj.SetRequest(transformed)
	return &actions.ModifyRequestAction{
		HeadersToSet: obj.GetHeaders(),
		Host:         obj.GetRequest().GetHost(),
		Body:         obj.GetRequest().GetBody(),
		Path:         obj.GetRequest().GetParsedURL().Path,
		QueryParams:  obj.GetRequest().GetQuery(),
	}, nil
}

func (t *transformer) OnResponse(obj public_types.APIStreamI) (actions.RespLunarAction, error) {
	data, err := utils.ConvertStreamToDataMap(obj)
	if err != nil {
		return nil, err
	}

	data, _ = t.doTransform(data)

	transformed, err := t.prepareResponse(obj.GetResponse(), data)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare response: %w", err)
	}
	obj.SetResponse(transformed)

	return &actions.ModifyResponseAction{
		HeadersToSet: obj.GetHeaders(),
		Body:         obj.GetBody(),
		Status:       transformed.Status,
	}, nil
}

func (t *transformer) doTransform(data map[string]any) (map[string]any, string) {
	// Apply "delete" operations
	data, err := t.performDelete(data)
	if err != nil {
		log.Trace().Err(err).Msg("failed to perform delete operations")
	}

	// Apply "set" operations
	var newHost string
	data, newHost, err = t.performSet(data)
	if err != nil {
		log.Trace().Err(err).Msg("failed to perform set operations")
	}

	// Apply "obfuscate" operations
	data, err = t.performObfuscate(data)
	if err != nil {
		log.Trace().Err(err).Msg("failed to perform obfuscate operations")
	}
	return data, newHost
}

// prepareRequest prepares the request object with the new host and updated fields.
func (t *transformer) prepareRequest(
	newHost string,
	originalRequest public_types.TransactionI,
	data map[string]any,
) (*streamtypes.OnRequest, error) {
	jsonData := []byte(oj.JSON(data["request"]))
	if len(jsonData) == 0 {
		return nil, fmt.Errorf("failed to marshal request to JSON")
	}

	transformed, success := originalRequest.(*streamtypes.OnRequest)
	if !success {
		return nil, fmt.Errorf("failed to cast request to OnRequest")
	}

	// should make headers zero, otherwise json.Unmarshal will perform union and undo delete operation
	transformed.Headers = make(map[string]string)
	transformed.ParsedQuery = make(map[string][]string)
	if err := json.Unmarshal(jsonData, transformed); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON to OnRequest: %w", err)
	}

	newQueryString := transformed.ParsedQuery.Encode()
	transformed.Query = newQueryString
	transformed.UpdateURL(newHost, transformed.Scheme, transformed.Path, transformed.Query)
	transformed.UpdateBodyFromBodyMap()

	log.Trace().Msgf("transformed request: %+v", transformed)

	return transformed, nil
}

func (t *transformer) prepareResponse(
	originalResponse public_types.TransactionI,
	data map[string]any,
) (*streamtypes.OnResponse, error) {
	jsonData := []byte(oj.JSON(data["response"]))
	if len(jsonData) == 0 {
		return nil, fmt.Errorf("failed to marshal request to JSON")
	}

	transformed, success := originalResponse.(*streamtypes.OnResponse)
	if !success {
		return nil, fmt.Errorf("failed to cast request to OnResponse")
	}

	// should make headers zero, otherwise json.Unmarshal will perform union and undo delete operation
	transformed.Headers = make(map[string]string)
	if err := json.Unmarshal(jsonData, transformed); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON to OnResponse: %w", err)
	}

	transformed.UpdateBodyFromBodyMap()

	log.Trace().Msgf("transformed response: %+v", transformed)

	return transformed, nil
}

// performDelete performs delete from data based on definitions
func (t *transformer) performDelete(data map[string]any) (map[string]any, error) {
	for _, path := range t.deleteDefinitions {
		expr, err := jp.ParseString(path)
		if err != nil {
			log.Trace().Err(err).Msgf("failed to parse JSONPath: %s", path)
			continue
		}
		changedData, err := expr.Remove(data)
		if err != nil {
			log.Trace().Err(err).Msgf("failed to delete value at %s", path)
			continue
		}
		data = changedData.(map[string]any)
	}
	return data, nil
}

// performObfuscate applies the obfuscate definitions on the data map.
func (t *transformer) performObfuscate(data map[string]any) (map[string]any, error) {
	for _, path := range t.obfuscateDefinitions {
		expr, err := jp.ParseString(path)
		if err != nil {
			log.Trace().Err(err).Msgf("failed to parse JSONPath: %s", path)
			continue
		}
		values := expr.Get(data)
		if len(values) > 0 {
			val := fmt.Sprintf("%v", values[0])
			obfuscated := t.obfuscator.ObfuscateString(val)
			err = expr.Set(data, obfuscated)
			if err != nil {
				log.Trace().Err(err).Msgf("failed to obfuscate value at %s", path)
				continue
			}
		}
	}
	return data, nil
}

// performSet applies the set definitions on the data map.
func (t *transformer) performSet(data map[string]any) (map[string]any, string, error) {
	var newHost string
	for path, val := range t.setDefinitions {
		strVal := fmt.Sprintf("%v", val)
		if strings.HasSuffix(path, ".host") {
			newHost = strVal
			continue
		}

		if strings.HasPrefix(strVal, "$") && isUpperCase(strVal) {
			if envVal := os.Getenv(strings.TrimPrefix(strVal, "$")); envVal != "" {
				val = envVal
			}
		}

		path = strings.Replace(path, ".body.", ".body_map.", 1)
		path = strings.Replace(path, ".status_code", ".status", 1)

		expr, err := jp.ParseString(path)
		if err != nil {
			log.Trace().Err(err).Msgf("failed to ParseString: %s", path)
			continue
		}

		err = expr.Set(data, val)
		if err != nil {
			log.Trace().Err(err).Msgf("failed to set value at %s", path)
			continue
		}
	}
	return data, newHost, nil
}

func isUpperCase(s string) bool {
	return s != "" && s == strings.ToUpper(s)
}
