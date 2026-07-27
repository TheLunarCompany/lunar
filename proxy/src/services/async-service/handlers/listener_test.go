//go:build pro

package handlers

import (
	"errors"
	"lunar/async-service/utils"
	stream_types "lunar/engine/streams/types"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAsyncListener_StartAndStop(t *testing.T) {
	listener := NewListener()

	go func() {
		err := listener.Start()
		assert.NoError(t, err)
	}()

	stopped := false
	for {
		stopped = listener.Stop()
		if stopped {
			break
		}
	}
	assert.True(t, stopped, "Server should be stopped")
}

func TestAsyncListener_RetrieveHandler_MissingSeqID(t *testing.T) {
	listener := NewListener()
	req := httptest.NewRequest(http.MethodGet, "/retrieve", nil)
	rec := httptest.NewRecorder()

	listener.retrieveHandler(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "Missing seq-id parameter")
}

func TestAsyncListener_RetrieveHandler_ValidSeqID(t *testing.T) {
	listener := NewListener()
	listener.SetOnAsyncRetrieveFunc(func(_ *OnRetrieve) *OnResponse {
		return &OnResponse{
			State:    ResponseCompleted,
			Msg:      "Success",
			Response: &stream_types.OnResponse{Status: http.StatusOK, Body: "Response body"},
		}
	})

	req := httptest.NewRequest(http.MethodGet, "/retrieve?sequence_id=123", nil)
	rec := httptest.NewRecorder()

	listener.retrieveHandler(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "Response body")
}

func TestAsyncListener_RegisterHandler_NoRegisterFunc(t *testing.T) {
	listener := NewListener()
	req := httptest.NewRequest(http.MethodPost, "/register", nil)
	rec := httptest.NewRecorder()

	listener.registerHandler(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.Contains(t, rec.Body.String(), "No async register function set")
}

func TestAsyncListener_RegisterHandler_Success(t *testing.T) {
	listener := NewListener()
	listener.SetOnAsyncRegisterFunc(func(_ *OnRegister) error {
		return nil
	})

	req := httptest.NewRequest(http.MethodPost, "/register", nil)
	req.Header.Set(utils.HeaderLunarRequestID, "123")
	rec := httptest.NewRecorder()

	listener.registerHandler(rec, req)

	assert.Equal(t, http.StatusAccepted, rec.Code)
	assert.Contains(t, rec.Body.String(), "Request registered successfully")
}

func TestHandleSuccessResponse(t *testing.T) {
	rec := httptest.NewRecorder()
	response := &stream_types.OnResponse{
		Status:  http.StatusOK,
		Headers: map[string]string{"Content-Type": "application/json"},
		Body:    `{"key": "value"}`,
	}

	handleSuccessResponse(rec, "Success", response)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	assert.JSONEq(t, `{"key": "value"}`, rec.Body.String())
}

func TestHandleError(t *testing.T) {
	rec := httptest.NewRecorder()
	handleError(rec, "An error occurred", http.StatusInternalServerError, errors.New("test error"))

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.Contains(t, rec.Body.String(), "An error occurred")
	assert.Contains(t, rec.Body.String(), "test error")
}
