package shareddiscovery

import "encoding/json"

var HaproxyInternalErrors = []int{
	400, //  Bad Request:  Malformed request, invalid headers, or URI issues.
	403, // Forbidden:  Request denied based on ACL rules.
	408, // Request Timeout: Request timed out.
	409, // Conflict: Request turpitude using a polite refusal status code.
	413, // Payload Too Large:  Request body exceeds configured limit.
	417, // Expectation Failed:  HAProxy doesn't support the 'Expect' header.
	500, // Internal Server Error:  Unexpected internal HAProxy problem.
	502, // Bad Gateway:  Invalid response from backend server.
	503, // Service Unavailable:  No available backend servers or explicitly denied.
	504, // Gateway Timeout:  Backend server didn't respond within the timeout.
}

type OnError struct {
	FailedTransactions map[string]struct{} `json:"failed_transactions"`
}

func (o *OnError) IsEmpty() bool {
	return len(o.FailedTransactions) == 0
}

func (o *OnError) RecordErrorTransactionIfNeeds(transactionID string, statusCode int) {
	for _, code := range HaproxyInternalErrors {
		if statusCode == code {
			o.FailedTransactions[transactionID] = struct{}{}
			break
		}
	}
}

func (o *OnError) JSONMarshal() ([]byte, error) {
	return json.Marshal(o)
}
