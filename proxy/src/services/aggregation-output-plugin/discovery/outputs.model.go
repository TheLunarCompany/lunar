package discovery

type (
	InterceptorOutput struct {
		Type                string `json:"type"`
		Version             string `json:"version"`
		LastTransactionDate string `json:"last_transaction_date"`
	}

	Output struct {
		CreatedAt    string                    `json:"created_at"`
		Interceptors []InterceptorOutput       `json:"interceptors"`
		Endpoints    map[string]EndpointOutput `json:"endpoints"`
	}

	EndpointOutput struct {
		MinTime string `json:"min_time"`
		MaxTime string `json:"max_time"`

		Count           Count         `json:"count"`
		StatusCodes     map[int]Count `json:"status_codes"`
		AverageDuration float32       `json:"average_duration"`
	}
)
