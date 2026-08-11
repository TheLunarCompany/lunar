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
	for _, url := range f.URLs {
		if url == "" || url == "*" || url == ".*" {
			return true
		}
	}
	return false
}

func (f Filter) GetSupportedMethods() []string {
	if len(f.Methods) == 0 {
		return []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
			http.MethodPatch,
		}
	}
	return f.Methods
}

func (f Filter) ShouldAllowSample() bool {
	if f.SamplePercentage == 0 {
		return true
	}

	return rand.Float64()*100 <= f.SamplePercentage
}

func (f *Filter) Extend(from *Filter) {
	for _, method := range from.Methods {
		if !slices.Contains(f.Methods, method) {
			f.Methods = append(f.Methods, method)
		}
	}
	f.Headers.Extend(from.Headers)
	f.QueryParams.Extend(from.QueryParams)
	f.PathParams.Extend(from.PathParams)
	f.StatusCode.Extend(from.StatusCode)

	for _, url := range from.URLs {
		if !slices.Contains(f.URLs, url) {
			f.URLs = append(f.URLs, url)
		}
	}

	f.Expressions.Extend(from.Expressions)
}

func (f Filter) GetAllowedMethods() []string {
	return f.Methods
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

func (f Filter) GetAllowedPathParams() publictypes.KVOpParam {
	return f.PathParams
}

func (f Filter) GetName() string {
	return f.Name
}

func (f Filter) GetURLs() []string {
	return f.URLs
}

func (f Filter) GetAllowedExpressions() publictypes.KVOpExpressionsParam {
	return f.Expressions
}

func (f *Filter) ToComparable() publictypes.ComparableFilter {
	return publictypes.ComparableFilter{
		URL:         stringSliceToString(f.URLs),
		QueryParams: f.QueryParams.String(),
		Method:      stringSliceToString(f.Methods),
		Headers:     f.Headers.String(),
		StatusCode:  f.StatusCode.String(),
		Expressions: f.Expressions.String(),
	}
}

func (f *Filter) UnmarshalYAML(value *yaml.Node) error {
	type Alias Filter
	temp := Alias{}

	if err := value.Decode(&temp); err != nil {
		return err
	}

	*f = Filter(temp)

	f.mergeMethods()

	f.mergeURLs()

	f.SetBodyRequired(f.Expressions.IsBodyRequired())

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

func (f *Filter) mergeURLs() {
	if f.URLs == nil {
		f.URLs = make([]string, 0)
	}

	if !slices.Contains(f.URLs, f.URL) && f.URL != "" {
		f.URLs = append(f.URLs, f.URL)
	}
	f.URL = "" // Clear the old field to avoid confusion
}

func (f *Filter) mergeMethods() {
	if len(f.Method) == 0 {
		return
	}

	if f.Methods == nil {
		f.Methods = make([]string, 0)
	}

	for _, method := range f.Method {
		if !slices.Contains(f.Methods, method) {
			f.Methods = append(f.Methods, method)
		}
	}

	f.Method = nil // Clear the old field to avoid confusion
}
