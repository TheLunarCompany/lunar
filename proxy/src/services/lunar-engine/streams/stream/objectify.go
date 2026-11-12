package stream

import (
	publictypes "lunar/engine/streams/public-types"
	"strings"

	"github.com/goccy/go-json"
	"github.com/rs/zerolog/log"
	"github.com/samber/lo"
)

type txnObj struct {
	body         interface{}
	headers      map[string]interface{}
	path         string
	queryParam   map[string]interface{}
	pathSegments []interface{}
}

func (t *txnObj) AsMap() map[string]interface{} {
	return map[string]interface{}{
		"body":          t.body,
		"headers":       t.headers,
		"path":          t.path,
		"query_param":   t.queryParam,
		"path_segments": t.pathSegments,
	}
}

func AsObject(stream publictypes.APIStreamI) map[string]interface{} {
	var currentObject txnObj
	var requestObject txnObj
	var responseObject txnObj
	request := stream.GetRequest()
	if stream.GetType() == publictypes.StreamTypeRequest {
		currentObject = extractSingleStream(request, "request")
		requestObject = currentObject
		responseObject = txnObj{}
	} else {
		currentObject = extractSingleStream(stream.GetResponse(), "response")
		requestObject = extractSingleStream(request, "request")
		responseObject = currentObject
	}

	object := map[string]interface{}{
		"body":     currentObject.body,
		"headers":  currentObject.headers,
		"request":  requestObject.AsMap(),
		"response": responseObject.AsMap(),
	}

	if request != nil {
		object["path"] = request.GetPath()
		object["path_segments"] = strings.Split(request.GetPath(), "/")
		if parsedURL := request.GetParsedURL(); parsedURL != nil {
			object["query_param"] = requestObject.AsMap()
		}
	}

	return object
}

func extractSingleStream(txn publictypes.TransactionI, kind string) txnObj {
	if txn == nil {
		log.Debug().Str("kind", kind).Msg("Transaction is nil, defaulting to empty object")
		return txnObj{}
	}

	obj := txnObj{
		path:    txn.GetPath(),
		headers: toMap(txn.GetHeaders()),
	}
	if parsedURL := txn.GetParsedURL(); parsedURL != nil {
		obj.pathSegments = lo.ToAnySlice(strings.Split(parsedURL.Path, "/"))
		obj.queryParam = make(map[string]interface{})
		for key, values := range parsedURL.Query() {
			obj.queryParam[key] = lo.ToAnySlice(values)
		}
	}

	rawBody := txn.GetBody()
	if rawBody == "" {
		log.Debug().Str("kind", kind).Msg("Body is empty, defaulting to empty object")
		obj.body = rawBody
		return obj
	}

	body, err := stringToMap(rawBody)
	if err != nil {
		log.Debug().
			Str("kind", kind).
			Msg("Body could not be parsed as map, defaulting to string value")
		obj.body = rawBody
		return obj
	}
	log.Debug().Str("kind", kind).Msg("Body parsed as map")
	obj.body = body
	return obj
}

func stringToMap(s string) (map[string]interface{}, error) {
	object := map[string]interface{}{}
	err := json.Unmarshal([]byte(s), &object)
	if err != nil {
		return map[string]interface{}{}, err
	}
	return object, nil
}

func toMap(object map[string]string) map[string]interface{} {
	newObject := make(map[string]interface{}, len(object))
	for k, v := range object {
		newObject[k] = interface{}(v)
	}
	return newObject
}
