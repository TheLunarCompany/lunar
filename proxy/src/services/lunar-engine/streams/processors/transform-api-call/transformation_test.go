package transformapicall

import (
	"lunar/engine/actions"
	"os"
	"strconv"
	"testing"

	public_types "lunar/engine/streams/public-types"
	test_utils "lunar/engine/streams/test-utils"
	streamtypes "lunar/engine/streams/types"

	"github.com/stretchr/testify/require"
)

func TestTransformation(t *testing.T) {
	stream := test_utils.NewMockAPIStream(
		"https://example.com/org789/orders?resource_id=res456&limit=10",
		map[string]string{
			"x-api-key":     "key123",
			"Authorization": "Bearer token",
			"x-stainless-1": "value1",
			"x-stainless-2": "value2",
			"user-agent":    "Mozilla/5.0",
		},
		map[string]string{"Content-Type": "application/json"},
		`{"dummy":"request"}`,
		`{"dummy":"test response"}`,
	)

	os.Setenv("TRANSFORMATION_TEST_ENV_VAR", "request-transformed")
	// 1. "set" operations: map of JSONPath strings to be set with a new value.
	setOps := map[string]any{
		"$.request.path":                  "/v1/messages",
		"$.request.host":                  "api.anthropic.com",
		"$.request.body.dummy":            "$TRANSFORMATION_TEST_ENV_VAR",
		"$.request.headers['x-api-key']":  "123456",
		"$.request.parsed_query.limit[0]": "20",
	}

	// 2. "delete" operations: list of JSONPath strings to be deleted from the request object.
	deleteOps := []string{
		"$.request.headers.Authorization",
		"$.request.headers['x-stainless-1']",
		"$.request.parsed_query.resource_id",
	}

	// 3. "obfuscate" operations: list of JSONPath strings to be replaced with an obfuscated value.
	obfuscateOps := []string{
		"$.request.headers['user-agent']",
	}

	proc := createTransformationProcessor(t, deleteOps, obfuscateOps, setOps)
	procIO, err := proc.Execute("transform-test", stream)
	require.NoError(t, err)

	modReqAction := procIO.ReqAction.(*actions.ModifyRequestAction)
	require.NotNil(t, modReqAction)
	require.Equal(t, "{\"dummy\":\"request-transformed\"}", modReqAction.Body)
	require.Equal(
		t,
		strconv.Itoa(len("{\"dummy\":\"request-transformed\"}")),
		modReqAction.HeadersToSet["content-length"],
	)
	require.Equal(t, "api.anthropic.com", modReqAction.Host)
	require.Equal(t, "/v1/messages", modReqAction.Path)
	require.Equal(t, "limit=20", modReqAction.QueryParams)
	require.NotContains(t, "resource_id", modReqAction.QueryParams)

	require.Equal(t, "{\"dummy\":\"request-transformed\"}", stream.GetBody())
	require.Equal(t, strconv.Itoa(len("{\"dummy\":\"request-transformed\"}")), stream.GetHeaders()["content-length"])
	require.Equal(t, "api.anthropic.com", stream.GetHost())
	require.Equal(t, "/v1/messages", stream.GetRequest().GetPath())
	require.Equal(t, "https://api.anthropic.com/v1/messages?limit=20", stream.GetRequest().GetURL())
	require.Equal(t, "123456", stream.GetHeaders()["x-api-key"])
	require.Equal(t, "", stream.GetHeaders()["Authorization"])
	require.Equal(t, "", stream.GetHeaders()["x-stainless-1"])
	require.Equal(t, "value2", stream.GetHeaders()["x-stainless-2"])
	require.NotEqual(t, "Mozilla/5.0", stream.GetHeaders()["user-agent"])

	// transform response
	os.Setenv("TRANSFORMATION_TEST_ENV_VAR", "response-transformed")
	setOps = map[string]any{
		"$.response.body.dummy":           "$TRANSFORMATION_TEST_ENV_VAR",
		"$.response.headers['x-api-key']": "000",
	}
	stream.SetType(public_types.StreamTypeResponse)
	proc = createTransformationProcessor(t, nil, nil, setOps)
	procIO, err = proc.Execute("transform-test", stream)
	require.NoError(t, err)

	modRespAction := procIO.RespAction.(*actions.ModifyResponseAction)
	require.NotNil(t, modRespAction)
	require.Equal(t, "{\"dummy\":\"response-transformed\"}", modRespAction.Body)
	require.Equal(
		t,
		strconv.Itoa(len("{\"dummy\":\"response-transformed\"}")),
		modRespAction.HeadersToSet["content-length"],
	)
	require.Equal(t, "{\"dummy\":\"response-transformed\"}", stream.GetBody())
	require.Equal(t, strconv.Itoa(len("{\"dummy\":\"response-transformed\"}")), stream.GetHeaders()["content-length"])
	require.Equal(t, "000", stream.GetHeaders()["x-api-key"])
}

func createTransformationProcessor(
	t *testing.T,
	deleteOps, obfuscateOps []string,
	setOps map[string]any,
) streamtypes.ProcessorI {
	params := make(map[string]streamtypes.ProcessorParam)
	params["obfuscate"] = streamtypes.ProcessorParam{
		Name:  "obfuscate",
		Value: public_types.NewParamValue(obfuscateOps),
	}
	params["set"] = streamtypes.ProcessorParam{
		Name:  "set",
		Value: public_types.NewParamValue(setOps),
	}
	params["delete"] = streamtypes.ProcessorParam{
		Name:  "delete",
		Value: public_types.NewParamValue(deleteOps),
	}

	metaData := &streamtypes.ProcessorMetaData{
		Name:       "TransformAPICall",
		Parameters: params,
	}
	proc, err := NewProcessor(metaData)
	require.NoError(t, err)
	return proc
}
