package streamconfig

import (
	"fmt"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"net/http"
	"path/filepath"
	"sort"
	"strings"

	"github.com/rs/zerolog/log"
)

func (f *FlowRepresentation) GetFilter() publictypes.FilterI {
	return &f.Filters
}

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

func (f Filter) GetAllowedMethods() []string {
	return f.Method
}

func (f Filter) GetAllowedStatusCodes() []int {
	return f.StatusCode
}

func (f Filter) GetAllowedHeaders() []publictypes.KeyValue {
	return f.Headers
}

func (f Filter) GetAllowedQueryParams() []publictypes.KeyValue {
	return f.QueryParams
}

func (f Filter) GetName() string {
	return f.Name
}

func (f Filter) GetURL() string {
	return f.URL
}

func (f *Filter) ToComparable() publictypes.ComparableFilter {
	return publictypes.ComparableFilter{
		URL:         f.URL,
		QueryParams: keyValueSliceToString(f.QueryParams),
		Method:      stringSliceToString(f.Method),
		Headers:     keyValueSliceToString(f.Headers),
		StatusCode:  intSliceToString(f.StatusCode),
	}
}

func keyValueSliceToString(kvs []publictypes.KeyValue) string {
	var result []string
	for _, kv := range kvs {
		result = append(result, kv.Key+"="+kv.Value)
	}
	sort.Strings(result)
	return strings.Join(result, ",")
}

func stringSliceToString(ss []string) string {
	sort.Strings(ss)
	return strings.Join(ss, ",")
}

func intSliceToString(is []int) string {
	var result []string
	for _, i := range is {
		result = append(result, fmt.Sprintf("%d", i))
	}
	sort.Strings(result)
	return strings.Join(result, ",")
}

func (f *Flow) GetFlowConnections(streamType publictypes.StreamType) []*FlowConnection {
	switch streamType {
	case publictypes.StreamTypeRequest:
		return f.Request
	case publictypes.StreamTypeResponse:
		return f.Response
		// handle StreamTypeAny case
	case publictypes.StreamTypeAny:
		// handle StreamTypeMirror case
	case publictypes.StreamTypeMirror:
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

func (p *Processor) GetName() string {
	return p.Processor
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
