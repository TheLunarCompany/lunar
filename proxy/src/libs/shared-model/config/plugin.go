package config

type PluginConfig interface {
	IsEnabled() bool
	GetName() string
	IsTypeUndefined() bool
}

func (plugin Remedy) IsEnabled() bool {
	return plugin.Enabled
}

func (plugin Diagnosis) IsEnabled() bool {
	return plugin.Enabled
}

func (plugin Remedy) GetType() RemedyType {
	return plugin.remedyType
}

func (plugin Diagnosis) GetType() DiagnosisType {
	return plugin.diagnosisType
}

func (plugin Remedy) IsTypeUndefined() bool {
	return plugin.Type() == RemedyUndefined
}

func (plugin Diagnosis) IsTypeUndefined() bool {
	return plugin.Type() == DiagnosisUndefined
}

func (plugin Remedy) GetName() string {
	return plugin.Name
}

func (plugin Diagnosis) GetName() string {
	return plugin.Name
}
