package datasanitation

import (
	public_types "lunar/engine/streams/public-types"
	test_utils "lunar/engine/streams/test-utils"
	streamtypes "lunar/engine/streams/types"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDataSanitationProcessor(t *testing.T) {
	t.Run("DefaultScrubber_AllDetected", func(t *testing.T) {
		params := map[string]streamtypes.ProcessorParam{
			"blocklisted_entities": {
				Name:  "blocklisted_entities",
				Value: public_types.NewParamValue([]string{"CreditCard", "email", "phone", "IPAddress"}),
			},
		}
		metaData := &streamtypes.ProcessorMetaData{
			Name:       "sanitizer",
			Parameters: params,
		}
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)

		stream := test_utils.NewMockAPIStream(
			"https://example.com/api",
			map[string]string{},
			map[string]string{"Content-Type": "application/json"},
			`Email: john@example.com, Phone: 123-456-790, IP: 192.168.1.1`,
			"",
		)

		out, err := proc.Execute("default-flow", stream)
		require.NoError(t, err)
		require.NotNil(t, out.ReqAction)

		body := stream.GetBody()
		require.Contains(t, body, "***EMAIL***")
		require.Contains(t, body, "***PHONE***")
		require.Contains(t, body, "***IP***")
	})

	t.Run("OnlyEmailScrubbed", func(t *testing.T) {
		params := map[string]streamtypes.ProcessorParam{
			"blocklisted_entities": {
				Name:  "blocklisted_entities",
				Value: public_types.NewParamValue([]string{"email"}),
			},
		}
		metaData := &streamtypes.ProcessorMetaData{
			Name:       "sanitizer",
			Parameters: params,
		}
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)

		stream := test_utils.NewMockAPIStream(
			"https://example.com/api",
			map[string]string{},
			map[string]string{"Content-Type": "application/json"},
			`Contact: john@example.com and 123-456-7890`,
			"",
		)

		_, err = proc.Execute("flow-email", stream)
		require.NoError(t, err)

		body := stream.GetBody()
		require.Contains(t, body, "***EMAIL***")
		require.Contains(t, body, "123-456-7890")
	})

	t.Run("EmailIgnored_PhoneScrubbed", func(t *testing.T) {
		params := map[string]streamtypes.ProcessorParam{
			"blocklisted_entities": {
				Name:  "blocklisted_entities",
				Value: public_types.NewParamValue([]string{"email", "phone"}),
			},
			"ignored_entities": {
				Name:  "ignored_entities",
				Value: public_types.NewParamValue([]string{"email"}),
			},
		}
		metaData := &streamtypes.ProcessorMetaData{
			Name:       "sanitizer",
			Parameters: params,
		}
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)

		stream := test_utils.NewMockAPIStream(
			"https://example.com/api",
			map[string]string{},
			map[string]string{"Content-Type": "application/json"},
			`john@example.com or call 123-456-7890`,
			"",
		)

		_, err = proc.Execute("ignore-email", stream)
		require.NoError(t, err)

		body := stream.GetBody()
		require.Contains(t, body, "john@example.com")
		require.Contains(t, body, "***PHONE***")
	})

	t.Run("UnknownEntityInList", func(t *testing.T) {
		params := map[string]streamtypes.ProcessorParam{
			"blocklisted_entities": {
				Name:  "blocklisted_entities",
				Value: public_types.NewParamValue([]string{"notarealentity", "email"}),
			},
		}
		metaData := &streamtypes.ProcessorMetaData{
			Name:       "sanitizer",
			Parameters: params,
		}
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)

		stream := test_utils.NewMockAPIStream(
			"https://example.com/api",
			map[string]string{},
			map[string]string{"Content-Type": "application/json"},
			`Email: jane@example.com`,
			"",
		)

		_, err = proc.Execute("unknown-entity", stream)
		require.NoError(t, err)

		body := stream.GetBody()
		require.Contains(t, body, "***EMAIL***")
	})

	t.Run("EmptyBody", func(t *testing.T) {
		metaData := &streamtypes.ProcessorMetaData{
			Name: "sanitizer",
		}
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)

		stream := test_utils.NewMockAPIStream(
			"https://example.com/api",
			map[string]string{},
			map[string]string{"Content-Type": "application/json"},
			"",
			"",
		)

		out, err := proc.Execute("empty-body", stream)
		require.NoError(t, err)
		require.NotNil(t, out.ReqAction)
	})

	t.Run("CaseInsensitiveEntityNames", func(t *testing.T) {
		params := map[string]streamtypes.ProcessorParam{
			"blocklisted_entities": {
				Name:  "blocklisted_entities",
				Value: public_types.NewParamValue([]string{"Email", "PHONE", "CreditCard"}),
			},
		}
		metaData := &streamtypes.ProcessorMetaData{
			Name:       "sanitizer",
			Parameters: params,
		}
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)

		stream := test_utils.NewMockAPIStream(
			"https://example.com/api",
			map[string]string{},
			map[string]string{"Content-Type": "application/json"},
			`Email: user@abc.com, Phone: 999-888-7777, CC: 4111-1111-1111-1111`,
			"",
		)

		_, err = proc.Execute("case-insensitive", stream)
		require.NoError(t, err)

		body := stream.GetBody()
		require.Contains(t, body, "***EMAIL***")
		require.Contains(t, body, "***PHONE***")
		require.Contains(t, body, "***CREDIT_CARD***")
	})
}
