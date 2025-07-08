package streamconfig

import (
	"errors"
	"fmt"
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	"lunar/toolkit-core/configuration"
	"lunar/toolkit-core/network"
	"math/rand"
	"net/http"
	"path/filepath"
	"sort"
	"strings"

	"github.com/rs/zerolog/log"
	"golang.org/x/exp/slices"
	"gopkg.in/yaml.v3"
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

func (f Filter) ShouldAllowSample() bool {
	if f.SamplePercentage == 0 {
		return true
	}

	return rand.Float64()*100 <= f.SamplePercentage
}

func (f Filter) IsExpressionFilter() bool {
	return f.Expressions != nil
}

func (f Filter) GetExpressions() []string {
	return f.Expressions
}

func (f *Filter) Extend(from *Filter) {
	for _, method := range from.Method {
		if !slices.Contains(f.Method, method) {
			f.Method = append(f.Method, method)
		}
	}
	f.Headers.Extend(from.Headers)
	f.QueryParams.Extend(from.QueryParams)
	f.StatusCode.Extend(from.StatusCode)

	if f.URL == "" {
		f.URL = from.URL
	}

	if from.Expressions != nil {
		if f.Expressions == nil {
			f.Expressions = from.Expressions
		} else {
			f.Expressions = append(f.Expressions, from.Expressions...)
		}
	}
}

func (f Filter) GetAllowedMethods() []string {
	return f.Method
}

func (f Filter) GetAllowedStatusCodes() publictypes.StatusCodeParam {
	return f.StatusCode
}

func (f Filter) GetAllowedReqHeaders() publictypes.KVOpParam {
	return f.Headers
}

func (f Filter) GetAllowedResHeaders() publictypes.KVOpParam {
	return f.ResponseHeaders
}

func (f Filter) GetAllowedQueryParams() publictypes.KVOpParam {
	return f.QueryParams
}

func (f Filter) GetName() string {
	return f.Name
}

func (f Filter) GetURL() string {
	return f.URL
}

func (f Filter) GetReqExpressions() []string {
	if f.expression == nil {
		return nil
	}

	return f.expression.req
}

func (f Filter) GetResExpressions() []string {
	if f.expression == nil {
		return nil
	}

	return f.expression.res
}

func (f *Filter) ToComparable() publictypes.ComparableFilter {
	return publictypes.ComparableFilter{
		URL:         f.URL,
		QueryParams: f.QueryParams.String(),
		Method:      stringSliceToString(f.Method),
		Headers:     f.Headers.String(),
		StatusCode:  f.StatusCode.String(),
	}
}

func (f *Filter) UnmarshalYAML(value *yaml.Node) error {
	type Alias Filter
	temp := Alias{}

	if err := value.Decode(&temp); err != nil {
		return err
	}

	*f = Filter(temp)

	if f.Expressions == nil {
		return nil
	}

	for _, expression := range f.Expressions {
		if f.expression == nil {
			f.expression = &Expression{}
		}
		if strings.HasPrefix(expression, "$.request") {
			f.expression.req = append(f.expression.req, strings.ReplaceAll(expression, "$.request", "$"))
		} else {
			f.expression.res = append(f.expression.res, strings.ReplaceAll(expression, "$.response", "$"))
		}
	}

	return nil
}

func stringSliceToString(ss []string) string {
	if len(ss) == 0 {
		return ""
	}
	sort.Strings(ss)
	return strings.Join(ss, ",")
}

func (p *Processor) ParamMap() map[string]*publictypes.ParamValue {
	// return p.Parameters
	params := make(map[string]*publictypes.ParamValue)
	for _, param := range p.Parameters {
		params[param.Key] = param.GetParamValue()
	}
	return params
}

func (p *Processor) AddParam(value *publictypes.KeyValue) {
	p.Parameters = append(p.Parameters, value)
}

func (p *Processor) UpdateParam(index int, value *publictypes.KeyValue) error {
	if index >= len(p.Parameters) {
		return fmt.Errorf("index out of range")
	}
	p.Parameters[index] = value
	return nil
}

func (p *Processor) ParamList() []*publictypes.KeyValue {
	return p.Parameters
}

func (p *Processor) ProcessorMetrics() *publictypes.ProcessorMetrics {
	return p.Metrics
}

func (p *Processor) GetName() string {
	return p.Processor
}

func (p *Processor) GetKey() string {
	return p.Key
}

func GetFlows(flowsDir string) (map[string]internaltypes.FlowRepI, error) {
	flows := make(map[string]internaltypes.FlowRepI)

	if flowsDir == "" {
		log.Warn().Msg("Flows directory is not set")
		return flows, nil
	}

	log.Info().Msgf("loading flows from: %s", flowsDir)
	files, err := filepath.Glob(filepath.Join(flowsDir, "*.yaml"))
	if err != nil {
		log.Warn().Err(err).Msg("failed to get flow files")
	}
	log.Info().Msgf("found %d flow files", len(files))

	var flowLoadingErrs []error
	for _, file := range files {
		flow, readErr := ReadStreamFlowConfig(file)
		if readErr != nil {
			log.Warn().Err(readErr).Msg("failed to read flow")
			flowLoadingErrs = append(flowLoadingErrs, readErr)
			continue
		}
		if err := validateFlowRepresentation(flow); err != nil {
			log.Warn().Err(err).Msgf("failed to validate flow yaml: %s", file)
			flowLoadingErrs = append(flowLoadingErrs, err)
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
	return flows, errors.Join(flowLoadingErrs...)
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
