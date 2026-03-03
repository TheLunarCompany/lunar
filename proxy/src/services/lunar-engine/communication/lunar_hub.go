package communication

import (
	"context"
	"encoding/json"
	"lunar/engine/metrics"
	"lunar/engine/utils/environment"
	sharedActions "lunar/shared-model/actions"
	sharedDiscovery "lunar/shared-model/discovery"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/network"
	"net/http"
	"net/url"
	"os"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	connectionTimeout                   = 5 * time.Second
	defaultReportIntervalSec        int = 300
	defaultMetricsReportIntervalSec int = 3600
	authHeader                          = "authorization"
	proxyVersionHeader                  = "x-lunar-proxy-version"
	proxyIDHeader                       = "x-lunar-proxy-id"

	// Connection attempt defaults
	defaultInitialWaitTimeBetweenConnectionAttempts    = 5 * time.Second
	defaultMaxWaitTimeBetweenConnectionAttempts        = 5 * time.Minute
	defaultConnectionAttemptsPerWaitTime               = 5
	defaultConnectionAttemptsWaitTimeExponentialGrowth = 2
)

var epochTime = time.Unix(0, 0)

type hubConnConfig struct {
	initialWaitTimeBetweenConnectionAttempts    time.Duration
	maxWaitTimeBetweenConnectionAttempts        time.Duration
	connectionAttemptsPerWaitTime               int
	connectionAttemptsWaitTimeExponentialGrowth int
}

type hubConnStatus struct {
	isConnected                        bool
	isConnectedMutex                   sync.RWMutex
	lastSuccessfulCommunication        *time.Time
	lastSuccessfulCommunicationMutex   sync.RWMutex
	connectionEstablishedChannels      []chan struct{}
	connectionEstablishedChannelsMutex sync.RWMutex
}

type HubCommunication struct {
	client                  *network.WSClient
	workersStop             []context.CancelFunc
	periodicInterval        time.Duration
	periodicMetricsInterval time.Duration
	clock                   clock.Clock
	nextReportTime          time.Time

	connConfig hubConnConfig
	connStatus hubConnStatus
}

func NewHubCommunication(apiKey string, proxyID string, clock clock.Clock) *HubCommunication {
	reportInterval, err := environment.GetHubReportInterval()
	if err != nil {
		log.Debug().Msgf(
			"Could not find Report Interval Value from ENV, will use default of: %v",
			defaultReportIntervalSec)
		reportInterval = defaultReportIntervalSec
	}

	metricsInterval, err := environment.GetHubMetricsReportInterval()
	if err != nil {
		log.Debug().Msgf(
			"Could not find Metrics Report Interval Value from ENV, will use default of: %v",
			defaultReportIntervalSec)
		metricsInterval = defaultReportIntervalSec
	}

	hubURL := url.URL{ //nolint: exhaustruct
		Scheme: environment.GetHubScheme(),
		Host:   environment.GetHubURL(),
		Path:   "/ui/v1/control",
	}

	handshakeHeaders := http.Header{
		authHeader:         []string{"Bearer " + apiKey},
		proxyIDHeader:      []string{proxyID},
		proxyVersionHeader: []string{environment.GetProxyVersion()},
	}
	hub := HubCommunication{ //nolint: exhaustruct
		client:                  network.NewWSClient(hubURL, handshakeHeaders),
		workersStop:             []context.CancelFunc{},
		periodicInterval:        time.Duration(reportInterval) * time.Second,
		periodicMetricsInterval: time.Duration(metricsInterval) * time.Second,
		clock:                   clock,
		nextReportTime:          time.Time{},
		connStatus:              newHubConnStatus(),
		connConfig:              newHubConnConfig(),
	}

	hub.client.OnMessage(hub.onMessage)

	if err := hub.client.ConnectAndStart(); err != nil {
		log.Error().
			Err(err).
			Msg("Failed to make initial connection with Lunar Hub, will retry in the background")
		go hub.attemptToConnectInLoop()
	} else {
		hub.updateCommunicationStatus()
		hub.setIsConnected(true)
		log.Debug().Msg("Connected to Lunar Hub")
	}
	return &hub
}

func newHubConnStatus() hubConnStatus {
	return hubConnStatus{
		isConnected:                   false,
		connectionEstablishedChannels: []chan struct{}{},
		lastSuccessfulCommunication:   nil,
	}
}

func newHubConnConfig() hubConnConfig {
	initialWaitTimeBetweenConnectionAttempts := environment.GetHubInitialWaitTimeBetweenConnectionAttempts( //nolint: lll
		defaultInitialWaitTimeBetweenConnectionAttempts,
	)
	maxWaitTimeBetweenConnectionAttempts := environment.GetHubMaxWaitTimeBetweenConnectionAttempts(
		defaultMaxWaitTimeBetweenConnectionAttempts,
	)
	connectionAttemptsPerWaitTime := environment.GetHubConnectionAttemptsPerWaitTime(
		defaultConnectionAttemptsPerWaitTime,
	)
	connectionAttemptsWaitTimeExponentialGrowth := environment.GetHubConnectionAttemptsWaitTimeExponentialGrowth( //nolint: lll
		defaultConnectionAttemptsWaitTimeExponentialGrowth,
	)
	return hubConnConfig{
		initialWaitTimeBetweenConnectionAttempts:    initialWaitTimeBetweenConnectionAttempts,
		maxWaitTimeBetweenConnectionAttempts:        maxWaitTimeBetweenConnectionAttempts,
		connectionAttemptsPerWaitTime:               connectionAttemptsPerWaitTime,
		connectionAttemptsWaitTimeExponentialGrowth: connectionAttemptsWaitTimeExponentialGrowth,
	}
}

func (hub *HubCommunication) StartWorkers() {
	hub.startDiscoveryWorker()
	hub.startMetricsWorker()
}

func (hub *HubCommunication) SendDataToHub(message network.MessageI) bool {
	if !hub.IsConnected() {
		log.Debug().Msg("HubCommunication::SendDataToHub Not connected to Lunar Hub")
		return false
	}
	log.Trace().Msgf(
		"HubCommunication::SendDataToHub Sending data to Lunar Hub, event: %+v", message.GetEvent())
	if err := hub.client.Send(message); err != nil {
		log.Debug().
			Err(err).
			Bool("wsClientIsConnectionReady", hub.client.IsConnectionReadyAndAuthorized()).
			Msg("HubCommunication::SendDataToHub Error sending data to Lunar Hub")
		return false
	}
	hub.updateCommunicationStatus()
	return true
}

func (hub *HubCommunication) IsConnected() bool {
	hub.connStatus.isConnectedMutex.RLock()
	defer hub.connStatus.isConnectedMutex.RUnlock()
	return hub.connStatus.isConnected
}

func (hub *HubCommunication) ConnectionEstablishedChannel() <-chan struct{} {
	hub.connStatus.connectionEstablishedChannelsMutex.Lock()
	defer hub.connStatus.connectionEstablishedChannelsMutex.Unlock()

	ch := make(chan struct{})
	hub.connStatus.connectionEstablishedChannels = append(
		hub.connStatus.connectionEstablishedChannels,
		ch,
	)
	return ch
}

func (hub *HubCommunication) LastSuccessfulCommunication() *time.Time {
	hub.connStatus.lastSuccessfulCommunicationMutex.RLock()
	defer hub.connStatus.lastSuccessfulCommunicationMutex.RUnlock()
	return hub.connStatus.lastSuccessfulCommunication
}

func (hub *HubCommunication) Stop() {
	log.Trace().Msg("Stopping HubCommunication Worker...")
	hub.setIsConnected(false)
	hub.removeConnectionEstablishedListeners()
	for _, cancel := range hub.workersStop {
		cancel()
	}
	hub.client.Close()
}

func (hub *HubCommunication) startMetricsWorker() {
	ctx, cancel := context.WithCancel(context.Background())
	hub.workersStop = append(hub.workersStop, cancel)

	go func() {
		for {
			timeToWaitForNextReport := hub.calculateTimeToWaitForNextReport(hub.periodicMetricsInterval)
			log.Trace().Msgf("HubCommunication::MetricsWorker Next report in %v", timeToWaitForNextReport)
			select {
			case <-ctx.Done():
				log.Trace().Msg("HubCommunication::MetricsWorker task canceled")
				return
			case <-time.After(timeToWaitForNextReport):
				metricsReport, err := metrics.GatherLunarMetrics()
				if err != nil {
					log.Debug().Err(err).Msg("HubCommunication::MetricsWorker Error getting metrics," +
						" will be executed again in the next interval")
					continue
				}

				log.Trace().Msg("HubCommunication::MetricsWorker Sending lunar metrics to Lunar Hub")
				message := network.MetricsMessage{
					Event: network.WebSocketEventMetrics,
					Data:  metricsReport,
				}

				hub.SendDataToHub(&message)
			}
		}
	}()
}

func (hub *HubCommunication) startDiscoveryWorker() {
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
			timeToWaitForNextReport := hub.calculateTimeToWaitForNextReport(hub.periodicInterval)
			select {
			case <-ctx.Done():
				log.Trace().Msg("HubCommunication::DiscoveryWorker task canceled")
				return
			case <-time.After(timeToWaitForNextReport):
				data, err := os.ReadFile(discoveryFileLocation)
				if err != nil {
					log.Error().Err(err).Msg(
						"HubCommunication::DiscoveryWorker Error reading file")
					continue
				}
				// Unmarshal the object data to Aggregation object and send it to the hub
				output := sharedDiscovery.Output{}
				err = json.Unmarshal(data, &output)
				if err != nil {
					// TODO: Once we understand and fix the error, we can log it as an error
					log.Debug().Err(err).Msg(
						"HubCommunication::DiscoveryWorker Error unmarshalling data")
					continue
				}
				output.CreatedAt = sharedActions.TimestampToStringFromTime(hub.nextReportTime)
				message := network.DiscoveryMessage{
					Event: network.WebSocketEventDiscovery,
					Data:  output,
				}
				log.Trace().
					Msgf("HubCommunication::DiscoveryWorker Sending data to Lunar Hub: %v, %+v",
						hub.nextReportTime, message)
				hub.SendDataToHub(&message)
			}
		}
	}()
}

func (hub *HubCommunication) setIsConnected(value bool) {
	hub.connStatus.isConnectedMutex.Lock()
	defer hub.connStatus.isConnectedMutex.Unlock()
	hub.connStatus.isConnected = value
}

func (hub *HubCommunication) removeConnectionEstablishedListeners() {
	hub.connStatus.connectionEstablishedChannelsMutex.Lock()
	defer hub.connStatus.connectionEstablishedChannelsMutex.Unlock()
	hub.connStatus.connectionEstablishedChannels = []chan struct{}{}
}

func (hub *HubCommunication) fanOutConnectionEstablished() {
	hub.connStatus.connectionEstablishedChannelsMutex.Lock()
	defer hub.connStatus.connectionEstablishedChannelsMutex.Unlock()
	log.Debug().Msg("Fanning out connection established signal asynchronously")
	for _, ch := range hub.connStatus.connectionEstablishedChannels {
		go func(ch chan struct{}) { ch <- struct{}{} }(ch)
	}
}

func (hub *HubCommunication) setLastSuccessfulCommunication(value *time.Time) {
	hub.connStatus.lastSuccessfulCommunicationMutex.Lock()
	defer hub.connStatus.lastSuccessfulCommunicationMutex.Unlock()
	hub.connStatus.lastSuccessfulCommunication = value
}

// This function will try to connect to the Hub in the background. It will keep trying to connect
// until it is successful, with an exponential backoff.
// This function is blocking and is meant to be run in a goroutine.
func (hub *HubCommunication) attemptToConnectInLoop() {
	retries := 0
	waitTime := hub.connConfig.initialWaitTimeBetweenConnectionAttempts
	for {
		if err := hub.client.ConnectAndStart(); err != nil {
			log.Debug().Err(err).Int("retry", retries).Msgf(
				"Failed to make connection with Lunar Hub, will retry in %v", waitTime)
			<-hub.clock.After(waitTime)
			retries++
			if retries%hub.connConfig.connectionAttemptsPerWaitTime == 0 {
				waitTime = waitTime * time.Duration(
					hub.connConfig.connectionAttemptsWaitTimeExponentialGrowth,
				)
				if waitTime > hub.connConfig.maxWaitTimeBetweenConnectionAttempts {
					waitTime = hub.connConfig.maxWaitTimeBetweenConnectionAttempts
				}
			}
		} else {
			hub.updateCommunicationStatus()
			hub.setIsConnected(true)
			hub.fanOutConnectionEstablished()
			log.Debug().Int("retries", retries).Msg("Connected to Lunar Hub")
			break
		}
	}
}

func (hub *HubCommunication) updateCommunicationStatus() {
	t := hub.clock.Now()
	hub.setLastSuccessfulCommunication(&t)
}

func (hub *HubCommunication) calculateTimeToWaitForNextReport(
	periodicInterval time.Duration,
) time.Duration {
	currentTime := hub.clock.Now()
	elapsedTime := currentTime.Sub(epochTime)
	previousReportTime := epochTime.Add(
		(elapsedTime / periodicInterval) * periodicInterval,
	)
	hub.nextReportTime = previousReportTime.Add(periodicInterval)
	return hub.nextReportTime.Sub(currentTime)
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
