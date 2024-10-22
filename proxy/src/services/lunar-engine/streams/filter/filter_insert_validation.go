package streamfilter

import (
	"fmt"
	internaltypes "lunar/engine/streams/internal-types"

	"github.com/rs/zerolog/log"
)

type validationType int

const (
	validationHeaders validationType = iota
	validationStatusCode
	validationMethod
	validationQueryParams
)

func (node *FilterNode) validateHeaders(flow internaltypes.FlowI) error {
	filter := flow.GetFilter()
	if len(node.filterRequirements.headers) == 0 && len(filter.GetAllowedHeaders()) == 0 {
		return nil
	} else if len(node.filterRequirements.headers) > 0 && len(filter.GetAllowedHeaders()) == 0 {
		return fmt.Errorf("headers are configured for URL: %s. Headers are required for the filter in flow: %s", filter.GetURL(), flow.GetName()) //nolint: lll
	} else if len(node.filterRequirements.headers) == 0 && len(filter.GetAllowedHeaders()) > 0 {
		return fmt.Errorf("a filter without headers is already configured for URL: %s. Headers are not allowed for the filter in flow: %s", filter.GetURL(), flow.GetName()) //nolint: lll
	}
	for _, incomingHeader := range filter.GetAllowedHeaders() {
		if headers, found := node.filterRequirements.headers[incomingHeader.Key]; found {
			log.Trace().Msgf("Header found: %s, Values: %v", incomingHeader.Key, headers)
			for _, header := range headers {
				if header == incomingHeader.GetParamValue().GetString() {
					return fmt.Errorf("header '%s: %s' already exists for filter on URL: %s. Please merge the flows or remove the duplicate header", incomingHeader.Key, header, filter.GetURL()) //nolint: lll
				}
				node.filterRequirements.headers[incomingHeader.Key] = append(headers,
					incomingHeader.GetParamValue().GetString())
			}
		}
	}
	return nil
}

func (node *FilterNode) validateStatusCode(flow internaltypes.FlowI) error {
	filter := flow.GetFilter()
	if len(node.filterRequirements.statusCodes) == 0 && len(filter.GetAllowedStatusCodes()) == 0 {
		return nil
	} else if len(node.filterRequirements.statusCodes) > 0 &&
		len(filter.GetAllowedStatusCodes()) == 0 {
		return fmt.Errorf("status code are configured for URL: %s. status code are required for the filter in flow: %s", filter.GetURL(), flow.GetName()) //nolint: lll
	} else if len(node.filterRequirements.statusCodes) == 0 &&
		len(filter.GetAllowedStatusCodes()) > 0 {
		return fmt.Errorf("a filter without status code is already configured for URL: %s. Status code are not allowed for the filter in flow: %s", filter.GetURL(), flow.GetName()) //nolint: lll
	}
	for _, incomingStatusCode := range filter.GetAllowedStatusCodes() {
		if _, found := node.filterRequirements.statusCodes[incomingStatusCode]; found &&
			!node.checkIfDuplicateConfigurationIsAllowed(validationStatusCode) {
			return fmt.Errorf("status code '%d' already exists for filter on URL: %s. Please merge the flows or remove the duplicate status code", incomingStatusCode, filter.GetURL()) //nolint: lll
		}
		node.filterRequirements.statusCodes[incomingStatusCode] = struct{}{}
	}
	return nil
}

func (node *FilterNode) validateMethod(flow internaltypes.FlowI) error {
	filter := flow.GetFilter()
	if len(node.filterRequirements.methods) == 0 && len(filter.GetAllowedMethods()) == 0 {
		return nil
	} else if len(node.filterRequirements.methods) > 0 && len(filter.GetAllowedMethods()) == 0 {
		return fmt.Errorf("method are configured for URL: %s. Method are required for the filter in flow: %s", filter.GetURL(), flow.GetName()) //nolint: lll
	} else if len(node.filterRequirements.methods) == 0 && len(filter.GetAllowedMethods()) > 0 {
		return fmt.Errorf("a filter without method is already configured for URL: %s. Method are not allowed for the filter in flow: %s", filter.GetURL(), flow.GetName()) //nolint: lll
	}
	for _, incomingMethod := range filter.GetAllowedMethods() {
		if _, found := node.filterRequirements.methods[incomingMethod]; found &&
			!node.checkIfDuplicateConfigurationIsAllowed(validationMethod) {
			return fmt.Errorf("method '%s' already exists for filter on URL: %s. Please merge the flows or remove the duplicate method", incomingMethod, filter.GetURL()) //nolint: lll
		}
		node.filterRequirements.methods[incomingMethod] = struct{}{}
	}
	return nil
}

func (node *FilterNode) validateQueryParams(flow internaltypes.FlowI) error {
	filter := flow.GetFilter()
	if len(node.filterRequirements.queryParams) == 0 && len(filter.GetAllowedQueryParams()) == 0 {
		return nil
	} else if len(node.filterRequirements.queryParams) > 0 &&
		len(filter.GetAllowedQueryParams()) == 0 {
		return fmt.Errorf("query params are configured for URL: %s. Query params are required for the filter in flow: %s", filter.GetURL(), flow.GetName()) //nolint: lll
	} else if len(node.filterRequirements.queryParams) == 0 &&
		len(filter.GetAllowedQueryParams()) > 0 {
		return fmt.Errorf("a filter without query params is already configured for URL: %s. Query params are not allowed for the filter in flow: %s", filter.GetURL(), flow.GetName()) //nolint: lll
	}
	for _, incomingQueryParam := range filter.GetAllowedQueryParams() {
		if queryParams, found := node.filterRequirements.queryParams[incomingQueryParam.Key]; found {
			for _, queryParam := range queryParams {
				if queryParam == incomingQueryParam.GetParamValue().GetString() {
					return fmt.Errorf("query param '%s' already exists for filter on URL: %s. Please merge the flows or remove the duplicate query param", incomingQueryParam.Key, filter.GetURL()) //nolint: lll
				}
				node.filterRequirements.queryParams[incomingQueryParam.Key] = append(queryParams,
					incomingQueryParam.GetParamValue().GetString())
			}
		}
	}
	return nil
}

/*
This function checks if we can allow duplicate configuration for the filter.
For example, if we have a filter with headers, we can't allow another filter with headers.
But if we have a filter with headers we can allow filters with the same status codes or method.
*/
func (node *FilterNode) checkIfDuplicateConfigurationIsAllowed(validation validationType) bool {
	switch validation {
	case validationHeaders:
		return len(node.filterRequirements.statusCodes) > 0 || len(node.filterRequirements.methods) > 0 ||
			len(node.filterRequirements.queryParams) > 0
	case validationStatusCode:
		return len(node.filterRequirements.headers) > 0 || len(node.filterRequirements.methods) > 0 ||
			len(node.filterRequirements.queryParams) > 0
	case validationMethod:
		return len(node.filterRequirements.headers) > 0 || len(node.filterRequirements.statusCodes) > 0 ||
			len(node.filterRequirements.queryParams) > 0
	case validationQueryParams:
		return len(node.filterRequirements.headers) > 0 || len(node.filterRequirements.statusCodes) > 0 ||
			len(node.filterRequirements.methods) > 0
	}
	return false
}

//nolint:lll
const filterConfigurationGuide = `

Filter Configuration Guide

1. Headers:
	- If no headers are configured for a URL, headers are not permitted in the corresponding filter at that level.
	- If headers are configured for a URL, headers are required for the filter at the same level.
	- Duplicate headers are not allowed. Merge the flows or remove the duplicate headers.
2. Status Codes:
	- If no status codes are configured for a URL, status codes are not permitted in the corresponding filter at that level.
	- If status codes are configured for a URL, status codes are required for the filter at the same level.
	- Duplicate status codes are not allowed. Merge the flows or remove the duplicate status codes.
3. Methods:
	- If no methods are configured for a URL, methods are not permitted in the corresponding filter at that level.
	- If methods are configured for a URL, methods are required for the filter at the same level.
	- Duplicate methods are not allowed. Merge the flows or remove the duplicate methods.
4. Query Parameters:
	- If no query parameters are configured for a URL, query parameters are not permitted in the corresponding filter at that level.
	- If query parameters are configured for a URL, query parameters are required for the filter at the same level.
	- Duplicate query parameters are not allowed. Merge the flows or remove the duplicate query parameters.

Note: These rules are based on the specification for determining the appropriate flow to execute.

`
