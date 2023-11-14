package discovery

import (
	"lunar/aggregation-plugin/common"
	"testing"

	sharedActions "lunar/shared-model/actions"
	sharedConfig "lunar/shared-model/config"

	"github.com/stretchr/testify/assert"
)

// These tests are currently testing the private function `decodeRecord`.
// If we can find a way to make up the input to the public `DecodeRecords`,
// It would be preferable to test all these through that function.

func TestDecodeRecordSucceedsWhenKeysAreStringAndValuesAreCompatibleBytes(
	t *testing.T,
) {
	record := map[any]any{
		"time":    []byte("Feb  6 15:25:20"),
		"service": []byte("haproxy[229]"),
		"message": []byte(
			`{` +
				`"timestamp":1675697113071,"duration":190,"method":"GET",` +
				`"host":"httpbin.org","url":"httpbin.org/status/{code}",` +
				`"status_code":402,` +
				`"request_active_remedies":{"fixed_response":["no_op"]},` +
				`"response_active_remedies":{}` +
				`}`,
		),
	}

	res, err := decodeRecord(record)
	assert.Nil(t, err)
	want := common.AccessLog{
		Timestamp:  1675697113071,
		Duration:   190,
		Method:     "GET",
		Host:       "httpbin.org",
		URL:        "httpbin.org/status/{code}",
		StatusCode: 402,
		RequestActiveRemedies: common.RequestActiveRemedies{
			sharedConfig.RemedyFixedResponse: []sharedActions.RemedyReqRunResult{
				sharedActions.ReqNoOp,
			},
		},
		ResponseActiveRemedies: common.ResponseActiveRemedies{},
	}

	assert.True(t, res.decoded)
	assert.Equal(t, *res.accessLog, want)
}

func TestDecodeRecordFailsWhenKeysAreNotString(
	t *testing.T,
) {
	record := map[any]any{
		1: []byte("Feb  6 15:25:20"),
		2: []byte("haproxy[229]"),
		3: []byte(
			`{"timestamp":1675697113071,"duration":190,"method":"GET",` +
				`"url":"httpbin.org/status/{code}","status_code":402` +
				`"host":"httpbin.org"` +
				`"request_active_remedies":{},` +
				`"response_active_remedies":{}` +
				`}`,
		),
	}

	_, err := decodeRecord(record)
	assert.NotNil(t, err)
}

func TestDecodeRecordFailsWhenMessageKeyIsNotFound(
	t *testing.T,
) {
	record := map[any]any{
		"time":    []byte("Feb  6 15:25:20"),
		"service": []byte("haproxy[229]"),
	}

	_, err := decodeRecord(record)
	assert.NotNil(t, err)
}

func TestDecodeRecordFailsWhenMessageValueIsNotBytes(
	t *testing.T,
) {
	record := map[any]any{
		"time":    []byte("Feb  6 15:25:20"),
		"service": []byte("haproxy[229]"),
		"message": `{"timestamp":1675697113071,"duration":190,"method":"GET",` +
			`"url":"httpbin.org/status/{code}","status_code":402` +
			`"host":"httpbin.org"` +
			`"request_active_remedies":{},` +
			`"response_active_remedies":{}` +
			`}`,
	}

	_, err := decodeRecord(record)
	assert.NotNil(t, err)
}

func TestDecodeRecordReturnsZeroWhenMessageValueBytesAreIncompatible(
	t *testing.T,
) {
	record := map[any]any{
		"time":    []byte("Feb  6 15:25:20"),
		"service": []byte("haproxy[229]"),
		"message": []byte("not-a-json"),
	}

	accessLogResponse, err := decodeRecord(record)
	assert.Nil(t, err)
	assert.False(t, accessLogResponse.decoded)
}

func TestDecodeRecordFailsWhenURLIsADash(
	t *testing.T,
) {
	record := map[any]any{
		"time":    []byte("Feb  6 15:25:20"),
		"service": []byte("haproxy[229]"),
		"message": []byte(
			`{"timestamp":1675697113071,"duration":190,"method":"GET",` +
				`"url":"-","status_code":402` +
				`"host":"httpbin.org"` +
				`"request_active_remedies":{},` +
				`"response_active_remedies":{}` +
				`}`,
		),
	}

	_, err := decodeRecord(record)
	assert.NotNil(t, err)
}

func TestDecodeRecordReturnsZeroValueForMissingMessageFields(
	t *testing.T,
) {
	record := map[any]any{
		"time":    []byte("Feb  6 15:25:20"),
		"service": []byte("haproxy[229]"),
		"message": []byte(`{}`),
	}

	res, err := decodeRecord(record)
	var want common.AccessLog
	assert.Nil(t, err)
	assert.True(t, res.decoded)
	assert.Equal(t, *res.accessLog, want)
}
