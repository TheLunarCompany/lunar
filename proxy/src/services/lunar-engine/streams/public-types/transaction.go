package publictypes

import "time"

type TransactionI interface {
	IsNewSequence() bool
	DoesHeaderExist(string) bool
	DoesHeaderValueMatch(string, string) bool
	DoesQueryParamExist(string) bool
	DoesQueryParamValueMatch(string, string) bool
	GetSize() int
	GetID() string
	GetSequenceID() string
	GetMethod() string
	GetURL() string
	GetHost() string
	GetStatus() int
	GetHeader(string) (string, bool)
	GetHeaders() map[string]string
	GetBody() string
	GetTime() time.Time
	ToJSON() ([]byte, error)
}

type APIStreamI interface {
	WithLunarContext(LunarContextI) APIStreamI
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
	GetHeader(string) (string, bool)
	GetHeaders() map[string]string
	DoesHeaderValueMatch(string, string) bool
	GetRequest() TransactionI
	GetResponse() TransactionI
	GetContext() LunarContextI
	SetRequest(TransactionI)
	SetResponse(TransactionI)
	SetContext(LunarContextI)
	SetType(StreamType)
	SetActionsType(StreamType)
	StoreRequest()
	DiscardRequest()
}
