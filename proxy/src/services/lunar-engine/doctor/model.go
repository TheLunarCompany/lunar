package doctor

import "time"

type EnvReport struct {
	LogLevel                string
	IsEngineFailsafeEnabled bool
}
type RedisSetSample struct {
	Count                 int64
	TopPriorityMembers    []string
	BottomPriorityMembers []string
}

type RedisReport struct {
	PreservedInitialWrite bool
	RedisTime             *time.Time
	LastSuccessfulWrite   *time.Time
	Primitives            map[string]string
	SortedSets            map[string]RedisSetSample
	OtherKeys             map[string][]string // Other keys by type
}

type ActivePolicies struct {
	YAML string
	MD5  string
}

type Report struct {
	RunAt          time.Time
	Env            EnvReport
	Redis          RedisReport
	ActivePolicies ActivePolicies
}
