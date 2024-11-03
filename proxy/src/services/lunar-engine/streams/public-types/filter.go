package publictypes

type FilterI interface {
	GetName() string
	GetURL() string
	GetSupportedMethods() []string // Returns the supported methods for the filter.
	GetAllowedMethods() []string   // Returns the configured methods for the filter (can be empty).
	GetAllowedHeaders() []KeyValue
	GetAllowedStatusCodes() []int
	GetAllowedQueryParams() []KeyValue
	IsAnyURLAccepted() bool
	ToComparable() ComparableFilter
}

type ComparableFilter struct {
	URL         string
	QueryParams string
	Method      string
	Headers     string
	StatusCode  string
}
