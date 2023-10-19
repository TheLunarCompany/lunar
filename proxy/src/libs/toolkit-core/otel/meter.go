package otel

import (
	"go.opentelemetry.io/otel/metric"
	sdkMetric "go.opentelemetry.io/otel/sdk/metric"
)

// In order to make the use of `metric.Meter` easy, we expose  the global
// `GetMeter()` function. By default it will return the `NoOpMeter`,
// in order to avoid the need for nil-checking at calling sites.
// However, during system-boot, we take care to set the meter
// to a real one (using `setRealMeter`), so `GetMeter()` should
// actually return something workable.

func GetMeter() metric.Meter {
	if realMeter != nil {
		return realMeter
	}
	return noOpMeter
}

func setRealMeter(meter metric.Meter) {
	realMeter = meter
}

var noOpMeter metric.Meter = sdkMetric.NewMeterProvider().Meter("")

var realMeter metric.Meter
