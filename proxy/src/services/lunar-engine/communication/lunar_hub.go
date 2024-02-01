package communication

import (
	"context"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/network"
	"net/url"
	"os"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	defaultReportInterval int = 300
)

type HubCommunication struct {
	client           *network.WSClient
	workersStop      []context.CancelFunc
	periodicInterval time.Duration
}

func NewHubCommunication(APIKey string) *HubCommunication {
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
	client := HubCommunication{ //nolint: exhaustruct
		client:           network.NewWSClient(hubURL.String(), APIKey),
		periodicInterval: time.Duration(reportInterval) * time.Second,
	}

	if err := client.client.Connect(); err != nil {
		log.Error().Err(err).Msg("Failed to make connection with Lunar Hub")
		return nil
	}
	return &client
}

func (hub *HubCommunication) StartDiscoveryWorker() {
	ctx, cancel := context.WithCancel(context.Background())
	hub.workersStop = append(hub.workersStop, cancel)
	discoveryFileLocation := environment.GetDiscoveryStateLocation()
	if discoveryFileLocation == "" {
		log.Warn().Msg(
			`Could not get the location of the discovery state file,
			 Please validate that the ENV 'DISCOVERY_STATE_LOCATION' is set.`)
		return
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				log.Trace().Msg("HubCommunication::DiscoveryWorker task canceled")
				return
			default:
				time.Sleep(hub.periodicInterval)
				data, err := os.ReadFile(discoveryFileLocation)
				if err != nil {
					log.Error().Err(err).Msg(
						"HubCommunication::DiscoveryWorker Error reading file")
					continue
				}
				message := network.Message{
					Event: "discovery-event",
					Data:  string(data),
				}
				if err := hub.client.Send(&message); err != nil {
					log.Debug().Err(err).Msg(
						"HubCommunication::DiscoveryWorker Error sending data to Lunar Hub")
				}
			}
		}
	}()
}

func (hub *HubCommunication) Stop() {
	log.Trace().Msg("Stopping HubCommunication Worker...")
	for _, cancel := range hub.workersStop {
		cancel()
	}
	hub.client.Close()
}
