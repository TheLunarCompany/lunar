package publictypes

type ProcessorDataI interface {
	ParamMap() map[string]string
	GetName() string
}
