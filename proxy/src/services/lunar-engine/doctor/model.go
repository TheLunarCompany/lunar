package doctor

import "time"

type ClusterReport struct {
	Peers []string `json:"peers"`
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

// A copy of the model from proxy/src/libs/toolkit-core/network/message.model.go,
// however with `Content` as a string instead of a byte array.
type ConfigurationPayload struct {
	Type     string `json:"type"`
	FileName string `json:"file_name"`
	Content  string `json:"content"`
	MD5      string `json:"md5"`
}

type LoadedStreamsConfig struct {
	Data []ConfigurationPayload `json:"data"`
}

type HubReport struct {
	LastSuccessfulCommunication             *time.Time `json:"last_successful_communication"`
	MinutesSinceLastSuccessfulCommunication *float64   `json:"minutes_since_last_successful_communication"` //nolint:lll
}

type Report struct {
	RunAt               time.Time            `json:"run_at"`
	Env                 map[string]*string   `json:"env"`
	Cluster             *ClusterReport       `json:"cluster"`
	Redis               RedisReport          `json:"redis"`
	IsStreamsEnabled    bool                 `json:"is_streams_enabled"`
	ActivePolicies      *ActivePolicies      `json:"active_policies,omitempty"`
	LoadedStreamsConfig *LoadedStreamsConfig `json:"loaded_streams_config,omitempty"`
	Hub                 HubReport            `json:"hub"`
}
