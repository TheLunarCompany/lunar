package stream

import (
	publictypes "lunar/engine/streams/public-types"

	"github.com/goccy/go-json"
	"github.com/rs/zerolog/log"
)

type txnObj struct {
	body    interface{}
	headers map[string]interface{}
}

func (t *txnObj) AsMap() map[string]interface{} {
	return map[string]interface{}{
		"body":    t.body,
		"headers": t.headers,
	}
}

func AsObject(stream publictypes.APIStreamI) map[string]interface{} {
	var currentObject txnObj
	var requestObject txnObj
	var responseObject txnObj
	if stream.GetType() == publictypes.StreamTypeRequest {
		currentObject = extractSingleStream(stream.GetRequest(), "request")
		requestObject = currentObject
		responseObject = txnObj{}
	} else {
		currentObject = extractSingleStream(stream.GetResponse(), "response")
		requestObject = txnObj{}
		responseObject = currentObject
	}

	object := map[string]interface{}{
		"body":     currentObject.body,
		"headers":  currentObject.headers,
		"request":  requestObject.AsMap(),
		"response": responseObject.AsMap(),
	}

	return object
}

func extractSingleStream(txn publictypes.TransactionI, kind string) txnObj {
	if txn == nil {
		log.Debug().Str("kind", kind).Msg("Transaction is nil, defaulting to empty object")
		return txnObj{}
	}
	headers := toMap(txn.GetHeaders())
	rawBody := txn.GetBody()
	if rawBody == "" {
		log.Debug().Str("kind", kind).Msg("Body is empty, defaulting to empty object")
		return txnObj{body: rawBody, headers: headers}
	}

	body, err := stringToMap(rawBody)
	if err != nil {
		log.Debug().
			Err(err).
			Str("kind", kind).
			Msg("Body could not be parsed as map, defaulting to string value")
		return txnObj{body: rawBody, headers: headers}
	}
	log.Debug().Str("kind", kind).Msg("Body parsed as map")
	return txnObj{body: body, headers: headers}
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
