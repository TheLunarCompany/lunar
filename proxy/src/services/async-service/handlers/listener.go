//go:build pro

package handlers

import (
	"fmt"
	"lunar/async-service/config"
	"lunar/async-service/utils"
	stream_types "lunar/engine/streams/types"
	"net/http"

	"github.com/rs/zerolog/log"
)

type AsyncListener struct {
	server              *http.Server
	onAsyncRegisterFunc OnAsyncRegisterFunc
	onAsyncRetrieveFunc OnAsyncRetrieveFunc
}

func NewListener() *AsyncListener {
	return &AsyncListener{}
}

func (l *AsyncListener) SetOnAsyncRetrieveFunc(retrieveFunc OnAsyncRetrieveFunc) {
	l.onAsyncRetrieveFunc = retrieveFunc
}

func (l *AsyncListener) SetOnAsyncRegisterFunc(registerFunc OnAsyncRegisterFunc) {
	l.onAsyncRegisterFunc = registerFunc
}

func (l *AsyncListener) Start() error {
	mux := http.NewServeMux()
	mux.HandleFunc(RetrievePath, l.retrieveHandler)
	mux.HandleFunc(RegisterPath, l.registerHandler)
	bindPort := config.GetAsyncServiceBindPort()
	l.server = &http.Server{Addr: fmt.Sprintf(":%s", bindPort), Handler: mux}

	if err := l.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("failed to start server: %w", err)
	}

	return nil
}

func (l *AsyncListener) Stop() bool {
	log.Debug().Msgf("Stopping server")
	if l.server == nil {
		log.Debug().Msg("Server is nil, nothing to stop")
		return false
	}

	if err := l.server.Close(); err != nil {
		log.Debug().Msgf("Error stopping server: %s", err)
		return false
	}
	return true
}

func (l *AsyncListener) retrieveHandler(writer http.ResponseWriter, req *http.Request) {
	seqID := req.URL.Query().Get(QueryParamSeqID)

	isRetrieve := req.Header.Get(utils.HeaderAsyncRetrieve)
	if seqID == "" && isRetrieve == "" {
		handleError(writer, "Missing seq-id parameter", http.StatusBadRequest, nil)
		return
	}

	onResponse := l.onAsyncRetrieveFunc(&OnRetrieve{Request: req, SeqID: seqID})

	switch onResponse.State {
	case ResponseNotFound:
		handleSuccessNoResponse(writer, onResponse.Msg, seqID)
	case ResponsePending:
		handleSuccessNoResponse(writer, onResponse.Msg, seqID)
	case ResponseProcessing:
		handleSuccessNoResponse(writer, onResponse.Msg, seqID)
	case ResponseCompleted:
		handleSuccessResponse(writer, onResponse.Msg, onResponse.Response)
	case ResponseError:
		handleError(writer, onResponse.Msg, http.StatusInternalServerError, nil)
	}
}

func (l *AsyncListener) registerHandler(writer http.ResponseWriter, req *http.Request) {
	if l.onAsyncRegisterFunc == nil {
		handleError(writer, "No async register function set", http.StatusInternalServerError, nil)
		return
	}

	onRegister := &OnRegister{Request: req}
	if err := l.onAsyncRegisterFunc(onRegister); err != nil {
		handleError(writer,
			fmt.Sprintf("Error in async register function: %s", err), http.StatusInternalServerError, nil)
		return
	}
	seqID := req.Header.Get(utils.HeaderLunarRequestID)
	if len(seqID) == 0 {
		handleError(writer, "Missing request ID", http.StatusBadRequest, nil)
		return
	}
	handleSuccessNoResponse(writer, "Request registered successfully", seqID)
}

func handleSuccessResponse(
	writer http.ResponseWriter,
	message string,
	response *stream_types.OnResponse,
) {
	log.Trace().Msg(message)
	for key, value := range response.Headers {
		writer.Header().Add(key, value)
	}

	writer.WriteHeader(response.Status)

	if _, err := writer.Write([]byte(response.Body)); err != nil {
		handleError(writer, "Error writing response", http.StatusInternalServerError, err)
	}
}

func handleSuccessNoResponse(writer http.ResponseWriter, message, seqID string) {
	currentLocation := fmt.Sprintf("/retrieve?sequence_id=%s", seqID)
	writer.Header().Set(HeaderAsyncLocation, currentLocation)
	writer.Header().Set(AsyncServiceEnqueuedHeaderName, "true")
	writer.WriteHeader(http.StatusAccepted)
	_, err := fmt.Fprintf(writer, `{"msg": "%s"}`, message)
	if err != nil {
		handleError(writer, "Error writing response", http.StatusInternalServerError, err)
	}
}

func handleError(writer http.ResponseWriter, message string, status int,
	err error,
) {
	http.Error(writer, fmt.Sprintf(`{"msg": "%s", "error": "%v"}`, message, err), status)
}
