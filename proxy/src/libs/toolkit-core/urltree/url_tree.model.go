package urltree

//nolint:revive
type URLTreeI[T any] interface {
	Insert(url string, value *T) error
	InsertDeclaredURL(url string, value *T) error
	InsertWithConvergenceIndication(url string, value *T) (bool, error)
	Lookup(url string) LookupResult[T]
}

type URLTree[T any] struct {
	Root                     *Node[T]
	maxSplitThreshold        int
	assumedPathParamsEnabled bool
}

type Node[T any] struct {
	ConstantChildren map[string]*Node[T]
	ParametricChild  ParametricChild[T]
	WildcardChild    *Node[T]
	Value            *T
	IsPartOfHost     bool
}

type ParametricChild[T any] struct {
	Name  string
	Child *Node[T]
}

type LookupResult[T any] struct {
	Match         bool
	Value         *T
	PathParams    map[string]string
	NormalizedURL string
}

type lookupNodeResult[T any] struct {
	match           bool
	node            *Node[T]
	pathParams      map[string]string
	existingURLPath string
}
