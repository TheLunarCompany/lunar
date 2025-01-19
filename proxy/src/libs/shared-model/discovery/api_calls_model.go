package shareddiscovery

import (
	"fmt"
	"hash/fnv"
)

type APICallsMetric struct {
	StatusCode  int    `json:"status_code"`
	Method      string `json:"method"`
	Host        string `json:"host"`
	URL         string `json:"url"`
	ConsumerTag string `json:"consumer_tag"`
}

func (m APICallsMetric) Hash() string {
	hash := fnv.New64a()

	// Write each field to the hash, in a consistent order
	fmt.Fprintf(hash, "%d%s%s%s%s", m.StatusCode, m.Method, m.Host, m.URL, m.ConsumerTag)

	// hex representation of the hash
	return fmt.Sprintf("%x", hash.Sum64())
}
