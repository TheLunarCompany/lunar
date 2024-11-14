package environment

import (
	"sync"

	"github.com/google/uuid"
)

const gatewayIDPrefix string = "gateway-"

var (
	once              sync.Once
	gatewayIDInstance *GatewayID
)

type GatewayID struct {
	id string
}

// ID returns the gateway ID
func (g *GatewayID) ID() string {
	return g.id
}

// GetGatewayInstance returns the singleton instance of Gateway
func GetGatewayID() *GatewayID {
	once.Do(func() {
		gatewayIDInstance = &GatewayID{id: gatewayIDPrefix + uuid.NewString()}
	})
	return gatewayIDInstance
}
