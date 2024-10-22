package streamfilter

import (
	internaltypes "lunar/engine/streams/internal-types"
	"lunar/engine/utils"
)

/*
This Struct holds the filter data for easy access and validation
*/
type nodeFilterRequirements struct {
	headers     map[string][]string
	statusCodes map[int]struct{}
	methods     map[string]struct{}
	queryParams map[string][]string
}

func newFilterRequirements(flow internaltypes.FlowI) nodeFilterRequirements {
	validation := nodeFilterRequirements{
		headers:     make(map[string][]string),
		statusCodes: make(map[int]struct{}),
		methods:     make(map[string]struct{}),
		queryParams: make(map[string][]string),
	}
	if utils.IsInterfaceNil(flow) {
		return validation
	}
	validation.setHeaders(flow)
	validation.setStatusCode(flow)
	validation.setMethod(flow)
	validation.setQueryParams(flow)
	return validation
}

func (v *nodeFilterRequirements) setHeaders(flow internaltypes.FlowI) {
	for _, header := range flow.GetFilter().GetAllowedHeaders() {
		if _, ok := v.headers[header.Key]; !ok {
			v.headers[header.Key] = []string{}
		}
		v.headers[header.Key] = append(v.headers[header.Key],
			header.GetParamValue().GetString())
	}
}

func (v *nodeFilterRequirements) setStatusCode(flow internaltypes.FlowI) {
	for _, code := range flow.GetFilter().GetAllowedStatusCodes() {
		v.statusCodes[code] = struct{}{}
	}
}

func (v *nodeFilterRequirements) setMethod(flow internaltypes.FlowI) {
	for _, m := range flow.GetFilter().GetAllowedMethods() {
		v.methods[m] = struct{}{}
	}
}

func (v *nodeFilterRequirements) setQueryParams(flow internaltypes.FlowI) {
	for _, param := range flow.GetFilter().GetAllowedQueryParams() {
		if _, ok := v.queryParams[param.Key]; !ok {
			v.queryParams[param.Key] = []string{}
		}
		v.queryParams[param.Key] = append(v.queryParams[param.Key],
			param.GetParamValue().GetString())
	}
}
