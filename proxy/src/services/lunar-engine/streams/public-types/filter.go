package publictypes

type FilterI interface {
	ShouldAllowSample() bool
	GetName() string
	GetURL() string
	GetSupportedMethods() []string // Returns the supported methods for the filter.
	GetAllowedMethods() []string   // Returns the configured methods for the filter (can be empty).
	GetAllowedHeaders() []KeyValue
	GetAllowedStatusCodes() []int
	GetAllowedQueryParams() []KeyValue
	GetReqExpressions() []string
	GetResExpressions() []string
	IsAnyURLAccepted() bool
	IsExpressionFilter() bool
	ToComparable() ComparableFilter
}

type ComparableFilter struct {
	URL         string
	QueryParams string
	Method      string
	Headers     string
	StatusCode  string
}
