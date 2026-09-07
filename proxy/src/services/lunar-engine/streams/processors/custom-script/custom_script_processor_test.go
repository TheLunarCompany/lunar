package customscript

import (
	"encoding/base64"
	"fmt"
	"testing"

	public_types "lunar/engine/streams/public-types"
	test_utils "lunar/engine/streams/test-utils"
	streamtypes "lunar/engine/streams/types"

	"github.com/stretchr/testify/require"
)

func TestCustomScript(t *testing.T) {
	stream := createMockStream()

	script := `
	delete request.headers['Authorization'];
  request.body.dummy = btoa(request.body.some_other_key); //convert to base64
  request.body.system_prompt += ", answer in spanish";

	const resp = "test response changed";
	response.body.dummy = resp;
	response.headers['new-header'] = "new value";
	`

	expectedBase64 := base64.StdEncoding.EncodeToString([]byte("test value"))

	proc := createCustomScriptProcessor(t, script, false)
	procIO, err := proc.Execute("custom-script-test", stream)
	require.NoError(t, err)
	require.Equal(t, successConditionName, procIO.Name)

	// test second call
	procIO, err = proc.Execute("custom-script-test", stream)
	require.NoError(t, err)
	require.Equal(t, successConditionName, procIO.Name)

	require.Equal(t, "key123", stream.GetRequest().GetHeaders()["x-api-key"])
	require.Equal(t, "", stream.GetHeaders()["Authorization"])
	require.Equal(
		t,
		fmt.Sprintf(
			"{\"dummy\":\"%v\",\"some_other_key\":\"test value\",\"system_prompt\":\"hello, answer in spanish, answer in spanish\"}",
			expectedBase64,
		),
		stream.GetBody(),
	)
	require.Equal(t, "{\"dummy\":\"test response changed\"}", stream.GetResponse().GetBody())
	require.Equal(t, "new value", stream.GetResponse().GetHeaders()["new-header"])
}

func TestCustomScriptWithError(t *testing.T) {
	script := `
	delet request.headers['Authorization']
  request.body.system_prompt += ", answer in spanish"
	`

	createCustomScriptProcessor(t, script, true)
}

func createMockStream() public_types.APIStreamI {
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
		`{"dummy":"request", "some_other_key": "test value", "system_prompt": "hello"}`,
		`{"dummy":"test response"}`,
	)
	return stream
}

func createCustomScriptProcessor(t *testing.T, script string, expectError bool) streamtypes.ProcessorI {
	params := make(map[string]streamtypes.ProcessorParam)
	params["script_text"] = streamtypes.ProcessorParam{
		Name:  "script_text",
		Value: public_types.NewParamValue(script),
	}

	metaData := &streamtypes.ProcessorMetaData{
		Name:       "CustomScript",
		Parameters: params,
	}
	proc, err := NewProcessor(metaData)

	if expectError {
		require.Error(t, err)
		return nil
	}
	// Check if the processor was created successfully
	// and if the script text is set correctly
	require.NoError(t, err)
	return proc
}
