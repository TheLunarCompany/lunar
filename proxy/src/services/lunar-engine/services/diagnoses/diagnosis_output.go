package diagnoses

type DiagnosisOutput struct {
	RawData *[]byte
	Metrics *MetricsCollectorRecord
}
