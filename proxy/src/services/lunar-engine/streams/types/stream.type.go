package streamtypes

import (
	"encoding/json"
	"fmt"
	lunar_context "lunar/engine/streams/lunar-context"
	public_types "lunar/engine/streams/public-types"
	"lunar/engine/utils/environment"
	"strconv"
	"time"

	"github.com/rs/zerolog/log"
)

const streamSharedStateKey = "api_stream"

type APIStream struct {
	name                       string
	streamType                 public_types.StreamType
	actionType                 public_types.StreamType
	request                    public_types.TransactionI
	response                   public_types.TransactionI
	context                    public_types.LunarContextI
	resources                  public_types.ResourceManagementI
	shareState                 public_types.SharedStateI[[]byte]
	gc                         *lunar_context.ExpireWatcher[[]byte]
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
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetID()
	}
	return s.request.GetID()
}

func (s *APIStream) GetSequenceID() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetSequenceID()
	}
	return s.request.GetSequenceID()
}

func (s *APIStream) GetURL() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetURL()
	}
	return s.request.GetURL()
}

func (s *APIStream) GetHost() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetHost()
	}
	return s.request.GetHost()
}

func (s *APIStream) GetMethod() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetMethod()
	}
	return s.request.GetMethod()
}

func (s *APIStream) GetHeaders() map[string]string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetHeaders()
	}
	return s.request.GetHeaders()
}

func (s *APIStream) GetStrStatus() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return strconv.Itoa(s.response.GetStatus())
	}
	return ""
}

func (s *APIStream) GetSize() int {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetSize()
	}
	return s.request.GetSize()
}

func (s *APIStream) GetHeader(key string) (string, bool) {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetHeader(key)
	}
	return s.request.GetHeader(key)
}

func (s *APIStream) DoesHeaderValueMatch(headerName, headerValue string) bool {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.DoesHeaderValueMatch(headerName, headerValue)
	}
	return s.request.DoesHeaderValueMatch(headerName, headerValue)
}

func (s *APIStream) GetBody() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetBody()
	}
	return s.request.GetBody()
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
	return s.request
}

func (s *APIStream) GetResponse() public_types.TransactionI {
	return s.response
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
	s.request = request
}

func (s *APIStream) SetResponse(response public_types.TransactionI) {
	s.actionType = public_types.StreamTypeResponse
	s.streamType = public_types.StreamTypeResponse
	s.response = response
}

func (s *APIStream) SetType(streamType public_types.StreamType) {
	s.streamType = streamType
}

func (s *APIStream) SetActionsType(streamType public_types.StreamType) {
	s.actionType = streamType
}

func (s *APIStream) StoreRequest() {
	if s.streamType.IsResponseType() || s.request == nil {
		return
	}

	key := s.getSharedStateKey(s.GetSequenceID())

	marshaledRequest, err := s.request.ToJSON()
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
		log.Debug().Err(err).Msg("Error while deleting request data")
	}
}

func (s *APIStream) loadResponseIfAvailable() {
	if !s.streamType.IsResponseType() || s.request != nil {
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
	s.request = &request
}

func (s *APIStream) getSharedStateKey(SequenceID string) string {
	return fmt.Sprintf("%s::%s", streamSharedStateKey, SequenceID)
}
