package streamtypes

import (
	publictypes "lunar/engine/streams/public-types"
)

type Processor interface {
	GetName() string
	Execute(publictypes.APIStreamI) (ProcessorIO, error)
}

type ProcessorParam struct {
	Name  string
	Value *publictypes.ParamValue
}

type ProcessorMetaData struct {
	Name                string
	ProcessorDefinition ProcessorDefinition
	Parameters          map[string]ProcessorParam
	Resources           publictypes.ResourceManagementI
}
