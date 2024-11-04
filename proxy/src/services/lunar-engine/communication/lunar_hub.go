package communication

import (
	"context"
	"encoding/json"
	"lunar/engine/utils/environment"
	sharedDiscovery "lunar/shared-model/discovery"
	"lunar/toolkit-core/clock"
	contextmanager "lunar/toolkit-core/context-manager"
	"lunar/toolkit-core/network"
	"net/http"
	"net/url"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	connectionTimeout         = 5 * time.Second
	defaultReportInterval int = 300
	authHeader                = "authorization"
	proxyVersionHeader        = "x-lunar-proxy-version"
	proxyIDHeader             = "x-lunar-proxy-id"
)

// var epochTime = time.Unix(0, 0)

type HubCommunication struct {
	client           *network.WSClient
	workersStop      []context.CancelFunc
	periodicInterval time.Duration
	clock            clock.Clock
	nextReportTime   time.Time
}

func NewHubCommunication(apiKey string, proxyID string, clock clock.Clock) *HubCommunication {
	reportInterval, err := environment.GetHubReportInterval()
	if err != nil {
		log.Debug().Msgf(
			"Could not find Report Interval Value from ENV, will use default of: %v",
			defaultReportInterval)
		reportInterval = defaultReportInterval
	}

	hubURL := url.URL{ //nolint: exhaustruct
		Scheme: "ws",
		Host:   environment.GetHubURL(),
		Path:   "/ui/v1/control",
	}

	handshakeHeaders := http.Header{
		authHeader:         []string{"Bearer " + apiKey},
		proxyIDHeader:      []string{proxyID},
		proxyVersionHeader: []string{environment.GetProxyVersion()},
	}

	hub := HubCommunication{ //nolint: exhaustruct
		client:           network.NewWSClient(hubURL.String(), handshakeHeaders),
		workersStop:      []context.CancelFunc{},
		periodicInterval: time.Duration(reportInterval) * time.Second,
		clock:            clock,
		nextReportTime:   time.Time{},
	}

	hub.client.OnMessage(hub.onMessage)
	if err := hub.client.ConnectAndStart(); err != nil {
		log.Error().Err(err).Msg("Failed to make connection with Lunar Hub")
		return nil
	}
	log.Debug().Msg("Connected to Lunar Hub")
	return &hub
}

func (hub *HubCommunication) StartDiscoveryWorker() {
	ctxMng := contextmanager.Get()
	localClient := ctxMng.GetLocalClient()
	if localClient != nil {
		localClient.RegisterHandler(network.WebSocketEventDiscovery, hub.onDiscoverEvent)
	}
}

func (hub *HubCommunication) SendDataToHub(message network.MessageI) {
	log.Trace().Msgf(
		"HubCommunication::SendDataToHub Sending data to Lunar Hub, event: %+v", message.GetEvent())
	if err := hub.client.Send(message); err != nil {
		log.Debug().Err(err).Msg(
			"HubCommunication::SendDataToHub Error sending data to Lunar Hub")
	}
}

func (hub *HubCommunication) onDiscoverEvent(msg []byte) {
	output := sharedDiscovery.Output{}
	log.Trace().Msgf("HubCommunication::DiscoveryWorker Received data from Local Client: %v", msg)
	log.Trace().Msgf("HubCommunication::DiscoveryWorker Unmarshalling data: %v", output)
	err := json.Unmarshal(msg, &output)
	if err != nil {
		// TODO: Once we understand and fix the error, we can log it as an error
		log.Debug().Err(err).Msg(
			"HubCommunication::DiscoveryWorker Error unmarshalling data")
	}
	message := network.DiscoveryMessage{
		Event: network.WebSocketEventDiscovery,
		Data:  output,
	}
	log.Trace().Msgf("HubCommunication::DiscoveryWorker Sending data to Lunar Hub: %v, %+v",
		hub.nextReportTime, message)
	hub.SendDataToHub(&message)
}

func (hub *HubCommunication) Stop() {
	log.Trace().Msg("Stopping HubCommunication Worker...")
	for _, cancel := range hub.workersStop {
		cancel()
	}
	hub.client.Close()
}

func (hub *HubCommunication) onMessage(message []byte) {
	log.Trace().Msg("HubCommunication::OnMessage")
	var wsMessage WebSocketMessage
	if err := json.Unmarshal(message, &wsMessage); err != nil {
		log.Error().Err(err).Msg("HubCommunication::OnMessage Error unmarshalling message")
		return
	}

	switch wsMessage.Event {
	// Here we can add more cases for different events
	default:
		log.Debug().Msgf("HubCommunication::OnMessage Unknown event: %v", wsMessage.Event)
	}
}
