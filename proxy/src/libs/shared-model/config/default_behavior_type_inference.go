package config

func defaultBehaviorLiteralToEnum(
	defaultBehaviorLiteral defaultQuotaGroupBehaviorLiteral,
) DefaultQuotaGroupBehavior {
	switch defaultBehaviorLiteral {
	case "allow":
		return DefaultQuotaGroupBehaviorAllow
	case "block":
		return DefaultQuotaGroupBehaviorBlock
	case "use_default_allocation":
		return DefaultQuotaGroupBehaviorUseDefaultAllocation
	default:
		return DefaultQuotaGroupBehaviorUndefined
	}
}

func (groupQuotaAllocation *GroupQuotaAllocation) DefaultBehavior() DefaultQuotaGroupBehavior {
	return defaultBehaviorLiteralToEnum(groupQuotaAllocation.Default)
}
