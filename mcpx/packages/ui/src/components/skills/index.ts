import {
  SkillIdentityActions,
  SkillIdentityAvatar,
  SkillIdentityDescription,
  SkillIdentityHeader,
  SkillIdentityMaintainer,
  SkillIdentityMeta,
  SkillIdentityRoot,
  SkillIdentityTitle,
  SkillIdentityUpdatedAt,
} from "./SkillDetailSummary";

export { MarkdownEditor } from "./MarkdownEditor";
export { SkillAnchorNavigation } from "./SkillAnchorNavigation";
export { SkillBreadcrumbTrail } from "./SkillBreadcrumbTrail";
export { SkillCard } from "./SkillCard";
export { SkillCapabilityPicker } from "./SkillCapabilityPicker";
export { SkillCapabilityPickerField } from "./SkillCapabilityPickerField";
export { SkillForm } from "./SkillForm";
export { SkillLinkedCapabilities } from "./SkillLinkedCapabilities";
export * as SkillPage from "./SkillPage";
export { SkillSectionCard } from "./SkillSectionCard";
export { SkillsHeader } from "./SkillsHeader";
export { SkillsGrid } from "./SkillsGrid";

export const SkillIdentity = {
  Root: SkillIdentityRoot,
  Header: SkillIdentityHeader,
  Avatar: SkillIdentityAvatar,
  Title: SkillIdentityTitle,
  Actions: SkillIdentityActions,
  Description: SkillIdentityDescription,
  Meta: SkillIdentityMeta,
  Maintainer: SkillIdentityMaintainer,
  UpdatedAt: SkillIdentityUpdatedAt,
};
