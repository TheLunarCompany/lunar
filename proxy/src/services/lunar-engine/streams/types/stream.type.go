package streamtypes

import (
	"encoding/json"
	"fmt"
	lunar_context "lunar/engine/streams/lunar-context"
	public_types "lunar/engine/streams/public-types"
	"lunar/engine/utils/environment"
	json_path "lunar/toolkit-core/json-path"
	"strconv"
	"time"

	"github.com/rs/zerolog/log"
)

const streamSharedStateKey = "api_stream"

type APIStream struct {
	name                       string
	streamType                 public_types.StreamType
	actionType                 public_types.StreamType
	Request                    public_types.TransactionI `json:"request,omitempty"`
	Response                   public_types.TransactionI `json:"response,omitempty"`
	context                    public_types.LunarContextI
	resources                  public_types.ResourceManagementI
	shareState                 public_types.SharedStateI[[]byte]
	gc                         *lunar_context.ExpireWatcher[[]byte]
	jsonWrapper                *json_path.JSONWrapper
	defaultStoredReqExpiration time.Duration
}

// NewAPIStream creates a new APIStream with the given name and StreamType
func NewAPIStream(
	name string,
	streamType public_types.StreamType,
	sharedState public_types.SharedStateI[[]byte],
) public_types.APIStreamI {
	expirationTime, err := environment.GetServerTimeout()
	if err != nil {
		log.Debug().Err(err).Msg("Error while getting SPOE processing timeout")
	}
	stream := &APIStream{
		name:                       name,
		streamType:                 streamType,
		actionType:                 streamType,
		shareState:                 sharedState,
		defaultStoredReqExpiration: expirationTime,
	}

	stream.gc = lunar_context.GetExpireWatcher(stream.shareState.Pop)
	return stream
}

func (s *APIStream) WithLunarContext(context public_types.LunarContextI) public_types.APIStreamI {
	s.context = context
	return s
}

func (s *APIStream) GetID() string {
	if s.streamType.IsResponseType() && s.Response != nil {
		return s.Response.GetID()
	}
	return s.Request.GetID()
}

func (s *APIStream) GetSequenceID() string {
	if s.streamType.IsResponseType() && s.Response != nil {
		return s.Response.GetSequenceID()
	}
	return s.Request.GetSequenceID()
}

func (s *APIStream) GetURL() string {
	if s.streamType.IsResponseType() && s.Response != nil {
		return s.Response.GetURL()
	}
	return s.Request.GetURL()
}

func (s *APIStream) GetHost() string {
	if s.streamType.IsResponseType() && s.Response != nil {
		return s.Response.GetHost()
	}
	return s.Request.GetHost()
}

func (s *APIStream) GetMethod() string {
	if s.streamType.IsResponseType() && s.Response != nil {
		return s.Response.GetMethod()
	}
	return s.Request.GetMethod()
}

func (s *APIStream) GetHeaders() map[string]string {
	if s.streamType.IsResponseType() && s.Response != nil {
		return s.Response.GetHeaders()
	}
	return s.Request.GetHeaders()
}

func (s *APIStream) GetStrStatus() string {
	if s.streamType.IsResponseType() && s.Response != nil {
		return strconv.Itoa(s.Response.GetStatus())
	}
	return ""
}

func (s *APIStream) GetSize() int {
	if s.streamType.IsResponseType() && s.Response != nil {
		return s.Response.GetSize()
	}
	return s.Request.GetSize()
}

func (s *APIStream) GetHeader(key string) (string, bool) {
	if s.streamType.IsResponseType() && s.Response != nil {
		return s.Response.GetHeader(key)
	}
	return s.Request.GetHeader(key)
}

func (s *APIStream) DoesHeaderValueMatch(headerName, headerValue string) bool {
	if s.streamType.IsResponseType() && s.Response != nil {
		return s.Response.DoesHeaderValueMatch(headerName, headerValue)
	}
	return s.Request.DoesHeaderValueMatch(headerName, headerValue)
}

func (s *APIStream) GetBody() string {
	if s.streamType.IsResponseType() && s.Response != nil {
		return s.Response.GetBody()
	}
	return s.Request.GetBody()
}

func (s *APIStream) GetName() string {
	return s.name
}

func (s *APIStream) GetType() public_types.StreamType {
	return s.streamType
}

func (s *APIStream) GetActionsType() public_types.StreamType {
	return s.actionType
}

func (s *APIStream) GetRequest() public_types.TransactionI {
	if s.streamType.IsResponseType() {
		s.loadResponseIfAvailable()
	}
	return s.Request
}

func (s *APIStream) GetResponse() public_types.TransactionI {
	return s.Response
}

func (s *APIStream) GetResources() public_types.ResourceManagementI {
	return s.resources
}

func (s *APIStream) GetContext() public_types.LunarContextI {
	return s.context
}

func (s *APIStream) SetContext(context public_types.LunarContextI) {
	s.context = context
}

func (s *APIStream) SetRequest(request public_types.TransactionI) {
	s.actionType = public_types.StreamTypeRequest
	s.streamType = public_types.StreamTypeRequest
	s.Request = request
	s.jsonWrapper = nil // Reset the JSON wrapper when setting a new request
}

func (s *APIStream) SetResponse(response public_types.TransactionI) {
	s.actionType = public_types.StreamTypeResponse
	s.streamType = public_types.StreamTypeResponse
	s.Response = response
	s.jsonWrapper = nil // Reset the JSON wrapper when setting a new response
}

func (s *APIStream) SetType(streamType public_types.StreamType) {
	s.streamType = streamType
}

func (s *APIStream) SetActionsType(streamType public_types.StreamType) {
	s.actionType = streamType
}

func (s *APIStream) StoreRequest() {
	if s.streamType.IsResponseType() || s.Request == nil {
		return
	}

	key := s.getSharedStateKey(s.GetSequenceID())

	marshaledRequest, err := s.Request.ToJSON()
	if err != nil {
		log.Error().Err(err).Msg("Error while marshalling request data")
	}
	if err := s.shareState.Set(key, marshaledRequest); err != nil {
		log.Error().Err(err).Msg("Error while storing request data")
	} else {
		s.gc.AddKey(key, s.defaultStoredReqExpiration)
	}
}

func (s *APIStream) DiscardRequest() {
	key := s.getSharedStateKey(s.GetSequenceID())
	if _, err := s.shareState.Pop(key); err != nil {
		log.Trace().Err(err).Msg("Error while deleting request data")
	}
}

func (s *APIStream) JSONPathQuery(path string) ([]any, error) {
	if s.jsonWrapper == nil {
		// Create a new JSONWrapper with the current stream as the data source.
		// This only executed when querying for the first time
		wrapper, err := json_path.NewJSONWrapper(s)
		if err != nil {
			return nil, err
		}

		s.jsonWrapper = wrapper
	}
	return s.jsonWrapper.QueryJSON(path)
}

// It is safer to create a custom operation for write.
// This is due to the fact that we cant validate the newValue type.
// For examples please refer to:
// proxy/src/libs/toolkit-core/json-path/operations.go
func (s *APIStream) JSONPathWrite(path string, newValue any) error {
	if s.jsonWrapper == nil {
		// Create a new JSONWrapper with the current stream as the data source.
		// This only executed when querying for the first time
		wrapper, err := json_path.NewJSONWrapper(s)
		if err != nil {
			return err
		}
		s.jsonWrapper = wrapper
	}

	_, err := s.jsonWrapper.WriteJSON(path, newValue)
	return err
}

func (s *APIStream) loadResponseIfAvailable() {
	if !s.streamType.IsResponseType() || s.Request != nil {
		return
	}

	rawRequest, err := s.shareState.Get(s.getSharedStateKey(s.GetSequenceID()))
	if err != nil {
		log.Debug().Err(err).Msg("Error while getting request data")
		return
	}

	var request OnRequest
	if err := json.Unmarshal(rawRequest, &request); err != nil {
		log.Error().Err(err).Msg("Error while unmarshalling request data")
		return
	}
	s.Request = &request
}

func (s *APIStream) getSharedStateKey(SequenceID string) string {
	return fmt.Sprintf("%s::%s", streamSharedStateKey, SequenceID)
}
