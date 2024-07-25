package publictypes

type FilterI interface {
	GetName() string
	GetURL() string
	GetSupportedMethods() []string
	GetAllowedMethods() []string
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
