package shareddiscovery

const (
	EndpointDelimiter = ":::"
)

type (
	InterceptorOutput struct {
		Type                string `json:"type"`
		Version             string `json:"version"`
		LastTransactionDate string `json:"last_transaction_date"`
	}

	Output struct {
		CreatedAt    string                               `json:"created_at"`
		Interceptors []InterceptorOutput                  `json:"interceptors"`
		Endpoints    map[string]EndpointOutput            `json:"endpoints"`
		Consumers    map[string]map[string]EndpointOutput `json:"consumers"`
	}

	EndpointOutput struct {
		MinTime string `json:"min_time"`
		MaxTime string `json:"max_time"`

		Count                int         `json:"count"`
		StatusCodes          map[int]int `json:"status_codes"`
		AverageDuration      float32     `json:"average_duration"`
		AverageTotalDuration float32     `json:"average_total_duration"` //(spoe time + provider time)
	}
)
