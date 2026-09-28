package failsafe

import (
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"
)

// Define your struct with the required fields
type Stat struct {
	ProxyName   string
	ServiceName string
	SessionRate *int
	LastSession *time.Duration
}

const (
	proxyNameColName   = "# pxname"
	serviceNameColName = "svname"
	sessionRateColName = "rate"
	lastSessionColName = "lastsess"

	noSessionEstablishedValue = -1
)

func ParseHAProxyStatsCSV(csvText string) ([]Stat, error) {
	reader := csv.NewReader(strings.NewReader(csvText))

	headers, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read headers: %w", err)
	}

	// Map header names to column indices
	headerIndex := make(map[string]int)
	for i, header := range headers {
		headerIndex[header] = i
	}

	// Check if the required columns are present
	requiredHeaders := []string{
		proxyNameColName,
		serviceNameColName,
		sessionRateColName,
		lastSessionColName,
	}
	for _, h := range requiredHeaders {
		if _, ok := headerIndex[h]; !ok {
			return nil, fmt.Errorf("missing required column: %s", h)
		}
	}

	var stats []Stat
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read record: %w", err)
		}

		proxyName := record[headerIndex[proxyNameColName]]
		serviceName := record[headerIndex[serviceNameColName]]
		rawSessionRate := record[headerIndex[sessionRateColName]]
		var sessionRate *int
		if rawSessionRate != "" {
			i, err := strconv.Atoi(rawSessionRate)
			if err != nil {
				return nil, fmt.Errorf("invalid value in column %s: %w", sessionRateColName, err)
			}
			sessionRate = &i
		}

		var lastSession *time.Duration
		rawLastSession := record[headerIndex[lastSessionColName]]
		if rawLastSession != "" {
			i, err := strconv.Atoi(rawLastSession) //nolint: varnamelen
			if err != nil {
				return nil, fmt.Errorf("invalid value in column %s: %w", lastSessionColName, err)
			}
			if i == noSessionEstablishedValue {
				lastSession = nil
			} else {
				d := time.Duration(i) * time.Second
				lastSession = &d
			}
		}

		stat := Stat{
			ProxyName:   proxyName,
			ServiceName: serviceName,
			SessionRate: sessionRate,
			LastSession: lastSession,
		}

		stats = append(stats, stat)
	}

	return stats, nil
}
