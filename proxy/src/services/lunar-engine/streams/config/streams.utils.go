package streamconfig

import (
	"fmt"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"net/http"
	"path/filepath"
	"strconv"

	"github.com/rs/zerolog/log"
)

func (c *Connection) IsValid() bool {
	return c.Stream != nil || c.Flow != nil || c.Processor != nil
}

func (f Filter) IsAnyURLAccepted() bool {
	return f.URL == "" || f.URL == "*" || f.URL == ".*"
}

func (f Filter) GetSupportedMethods() []string {
	if len(f.Method) == 0 {
		return []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
			http.MethodPatch,
		}
	}
	return f.Method
}

func (f *Flow) GetFlowConnections(streamType streamtypes.StreamType) []*FlowConnection {
	switch streamType {
	case streamtypes.StreamTypeRequest:
		return f.Request
	case streamtypes.StreamTypeResponse:
		return f.Response
		// handle StreamTypeAny case
	case streamtypes.StreamTypeAny:
		// handle StreamTypeMirror case
	case streamtypes.StreamTypeMirror:
	}
	return nil
}

func (p *Processor) ParamMap() map[string]string {
	params := make(map[string]string)
	for _, param := range p.Parameters {
		params[param.Key] = param.Value
	}
	return params
}

// UnmarshalYAML implements custom unmarshalling for KeyValue
func (kv *KeyValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var aux struct {
		Key   string      `yaml:"key"`
		Value interface{} `yaml:"value"`
	}

	if err := unmarshal(&aux); err != nil {
		return err
	}

	kv.Key = aux.Key
	switch val := aux.Value.(type) {
	case string:
		kv.Value = val
	case int:
		kv.Value = strconv.Itoa(val)
	case float64:
		kv.Value = fmt.Sprintf("%v", val)
	default:
		return fmt.Errorf("unexpected type %T for value", val)
	}

	return nil
}

func GetFlows() ([]*FlowRepresentation, error) {
	var flows []*FlowRepresentation
	flowsDir := environment.GetStreamsFlowsDirectory()
	log.Trace().Msgf("loading flows from: %s", flowsDir)
	files, err := filepath.Glob(filepath.Join(flowsDir, "*.yaml"))
	if err != nil {
		log.Warn().Err(err).Msg("failed to get flow files")
	}
	log.Trace().Msgf("found %d flow files", len(files))

	for _, file := range files {
		flow, readErr := ReadStreamFlowConfig(file)
		if readErr != nil {
			log.Warn().Err(readErr).Msg("failed to read flow")
			continue
		}
		if err := validateFlowRepresentation(flow); err != nil {
			log.Warn().Err(err).Msgf("failed to validate flow yaml: %s", file)
			continue
		}
		flows = append(flows, flow)
	}
	return flows, nil
}

func ReadStreamFlowConfig(path string) (*FlowRepresentation, error) {
	config, readErr := configuration.DecodeYAML[FlowRepresentation](
		path,
	)
	if readErr != nil {
		return nil, readErr
	}

	return config, nil
}
