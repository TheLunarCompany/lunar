package publictypes

import "time"

type TransactionI interface {
	IsNewSequence() bool
	DoesHeaderExist(string) bool
	DoesHeaderValueMatch(string, string) bool
	DoesQueryParamExist(string) bool
	DoesQueryParamValueMatch(string, string) bool
	Size() int
	GetID() string
	GetSequenceID() string
	GetMethod() string
	GetURL() string
	GetHost() string
	GetStatus() int
	GetHeader(key string) (string, bool)
	GetHeaders() map[string]string
	GetBody() string
	GetTime() time.Time
}

type APIStreamI interface {
	WithLunarContext(context LunarContextI) APIStreamI
	GetID() string
	GetSequenceID() string
	GetType() StreamType
	GetActionsType() StreamType
	GetName() string
	GetURL() string
	GetHost() string
	GetBody() string
	GetStrStatus() string
	GetMethod() string
	GetSize() int
	GetHeader(key string) (string, bool)
	GetHeaders() map[string]string
	DoesHeaderValueMatch(headerName, headerValue string) bool
	GetRequest() TransactionI
	GetResponse() TransactionI
	GetContext() LunarContextI
	SetRequest(request TransactionI)
	SetResponse(response TransactionI)
	SetContext(context LunarContextI)
	SetType(streamType StreamType)
	SetActionsType(streamType StreamType)
}
