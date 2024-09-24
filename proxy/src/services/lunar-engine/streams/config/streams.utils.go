package streamconfig

import (
	"fmt"
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"lunar/toolkit-core/network"
	"net/http"
	"path/filepath"
	"sort"
	"strings"

	"github.com/rs/zerolog/log"
	"golang.org/x/exp/slices"
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

func (f *Filter) Extend(from *Filter) {
	for _, method := range from.Method {
		if !slices.Contains(f.Method, method) {
			f.Method = append(f.Method, method)
		}
	}
	for _, header := range from.Headers {
		if !ContainsKeyValue(f.Headers, header) {
			f.Headers = append(f.Headers, header)
		}
	}
	for _, queryParam := range from.QueryParams {
		if !ContainsKeyValue(f.QueryParams, queryParam) {
			f.QueryParams = append(f.QueryParams, queryParam)
		}
	}
	for _, statusCode := range from.StatusCode {
		if !slices.Contains(f.StatusCode, statusCode) {
			f.StatusCode = append(f.StatusCode, statusCode)
		}
	}
	if f.URL == "" {
		f.URL = from.URL
	}
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
	if len(kvs) == 0 {
		return ""
	}
	var result []string
	for _, kv := range kvs {
		result = append(result, kv.Key+"="+kv.GetParamValue().GetString())
	}
	sort.Strings(result)
	return strings.Join(result, ",")
}

func stringSliceToString(ss []string) string {
	if len(ss) == 0 {
		return ""
	}
	sort.Strings(ss)
	return strings.Join(ss, ",")
}

func intSliceToString(is []int) string {
	if len(is) == 0 {
		return ""
	}
	var result []string
	for _, i := range is {
		result = append(result, fmt.Sprintf("%d", i))
	}
	sort.Strings(result)
	return strings.Join(result, ",")
}

func (p *Processor) ParamMap() map[string]*publictypes.ParamValue {
	// return p.Parameters
	params := make(map[string]*publictypes.ParamValue)
	for _, param := range p.Parameters {
		params[param.Key] = param.GetParamValue()
	}
	return params
}

func (p *Processor) GetName() string {
	return p.Processor
}

func (p *Processor) GetKey() string {
	return p.Key
}

func GetFlows() (map[string]internaltypes.FlowRepI, error) {
	flows := make(map[string]internaltypes.FlowRepI)
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
		_, found := flows[flow.Name]
		if found {
			return nil, fmt.Errorf(
				"duplicate flow name: %s. Please note that flow name should be unique", flow.Name)
		}
		for key, proc := range flow.Processors {
			proc.Key = key
			flow.Processors[key] = proc
		}

		flows[flow.Name] = flow
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
	// Add YAML data to the flow representation
	config.UnmarshaledData.Data = network.ConfigurationPayload{
		Type:     "flow",
		FileName: path,
		Content:  config.Content,
	}
	return config.UnmarshaledData, nil
}

func ContainsKeyValue(slice []publictypes.KeyValue, kv publictypes.KeyValue) bool {
	for _, item := range slice {
		if item.Key == kv.Key && item.Value == kv.Value {
			return true
		}
	}
	return false
}
