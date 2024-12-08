package doctor

import "time"

type EnvReport struct {
	LogLevel                string `json:"log_level"`
	IsEngineFailsafeEnabled bool   `json:"is_engine_failsafe_enabled"`
}
type RedisSetSample struct {
	Count                 int64    `json:"count"`
	TopPriorityMembers    []string `json:"top_priority_members"`
	BottomPriorityMembers []string `json:"bottom_priority_members"`
}

type RedisReport struct {
	PreservedInitialWrite bool                      `json:"preserved_initial_write"`
	RedisTime             *time.Time                `json:"redis_time"`
	LastSuccessfulWrite   *time.Time                `json:"last_successful_write"`
	Primitives            map[string]string         `json:"primitives"`
	SortedSets            map[string]RedisSetSample `json:"sorted_sets"`
	OtherKeys             map[string][]string       `json:"other_keys"` // Other keys by type
}

type ActivePolicies struct {
	YAML string `json:"yaml"`
	MD5  string `json:"md5"`
}

type HubReport struct {
	LastSuccessfulCommunication *time.Time `json:"last_successful_communication"`
}

type Report struct {
	RunAt          time.Time      `json:"run_at"`
	Env            EnvReport      `json:"env"`
	Redis          RedisReport    `json:"redis"`
	ActivePolicies ActivePolicies `json:"active_policies"`
	Hub            HubReport      `json:"hub"`
}
