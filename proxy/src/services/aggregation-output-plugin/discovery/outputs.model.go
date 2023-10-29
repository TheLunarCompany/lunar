package discovery

type (
	InterceptorOutput struct {
		Type                string `json:"type"`
		Version             string `json:"version"`
		LastTransactionDate string `json:"last_transaction_date"`
	}

	Output struct {
		Interceptors []InterceptorOutput       `json:"interceptors"`
		Endpoints    map[string]EndpointOutput `json:"endpoints"`
	}

	EndpointOutput struct {
		MinDate string `json:"min_date"`
		MaxDate string `json:"max_date"`

		Count           Count         `json:"count"`
		StatusCodes     map[int]Count `json:"status_codes"`
		AverageDuration float32       `json:"average_duration"`
	}
)
