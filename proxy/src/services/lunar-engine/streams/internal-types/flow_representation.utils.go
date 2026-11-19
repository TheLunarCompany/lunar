package internaltypes

func (f FlowType) String() string {
	switch f {
	case UserFlow:
		return "USER_FLOW"
	case SystemFlowStart:
		return "SYSTEM_FLOW_START"
	case SystemFlowEnd:
		return "SYSTEM_FLOW_END"
	default:
		return "UNKNOWN_FLOW_TYPE"
	}
}
