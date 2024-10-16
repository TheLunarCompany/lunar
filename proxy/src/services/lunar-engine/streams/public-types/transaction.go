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
	GetStatus() int
	GetHeader(key string) (string, bool)
	GetHeaders() map[string]string
	GetBody() string
	GetTime() time.Time
}

type APIStreamI interface {
	WithLunarContext(context LunarContextI) APIStreamI
	GetID() string
	GetType() StreamType
	GetName() string
	GetURL() string
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
}
