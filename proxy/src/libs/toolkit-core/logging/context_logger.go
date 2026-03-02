package logging

import "github.com/rs/zerolog"

type ContextLogger struct {
	Logger zerolog.Logger
	path   string
}

func (contextLogger *ContextLogger) WithComponent(
	component string,
) ContextLogger {
	path := contextLogger.path
	if path == "" {
		path = component
	} else {
		path += "/" + component
	}
	logger := contextLogger.Logger.With().Str("component", path).Logger()
	return ContextLogger{Logger: logger, path: path}
}
