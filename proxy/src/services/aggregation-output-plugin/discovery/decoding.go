package discovery

import (
	"C"
	"fmt"
	"lunar/aggregation-plugin/common"
	"unsafe"

	"github.com/fluent/fluent-bit-go/output"
	"github.com/goccy/go-json"
	"github.com/rs/zerolog/log"
)

const messageKey = "message"

func DecodeRecords(data unsafe.Pointer, length int) []common.AccessLog {
	decoder := output.NewDecoder(data, length)
	accessLogs := []common.AccessLog{}

	for {
		ret, _, record := output.GetRecord(decoder)
		// only ret == 0 means there are more records to process
		if ret != 0 {
			break
		}
		accessLog, err := decodeRecord(record)
		if err != nil {
			log.Trace().Err(err).Msg("Could not decode record")
			continue
		}
		accessLogs = append(accessLogs, *accessLog)
	}

	return accessLogs
}

func decodeRecord(record map[any]any) (*common.AccessLog, error) {
	recordValue, found := record[messageKey]

	if !found || recordValue == nil {
		return nil, fmt.Errorf("Key `%v` not found", messageKey)
	}

	accessLog, err := decodeMessage(recordValue)
	if err != nil {
		return nil, err
	}
	return accessLog, nil
}

func decodeMessage(recordValue any) (*common.AccessLog, error) {
	var raw []byte
	raw, validBytes := recordValue.([]byte)
	if !validBytes {
		return nil, fmt.Errorf("Not byte array. Will not handle")
	}

	var accessLog common.AccessLog
	err := json.Unmarshal(raw, &accessLog)
	if err != nil {
		return nil, fmt.Errorf("Incompatible JSON - %v", string(raw))
	}
	if accessLog.URL == "-" {
		return nil, fmt.Errorf("Missing URL - %+v", accessLog)
	}
	return &accessLog, nil
}
