import {
  GetPromptResult,
  Prompt,
  Resource,
} from "@modelcontextprotocol/sdk/types.js";
import { Skill } from "@mcpx/shared-model";
import { Logger } from "winston";
import { stringify as stringifyYaml } from "yaml";
import {
  CapabilityRegistry,
  tagPrompts,
  tagResources,
} from "./capability-registry.js";
import {
  InternalCapabilitiesService,
  ResourceContent,
} from "./internal-capabilities-service.js";
import { SkillStoreI } from "./skill-store.js";

// Synthetic server name skills register under; becomes the authority segment in
// the advertised uri (`skill://mcpx-skills/<id>/SKILL.md`). Distinct from the
// internal-tools server ("mcpx") because registerServer replaces a server's
// whole capability set.
export const SKILLS_SERVICE_NAME = "mcpx-skills";

// Projects adopted skills into the capability registry as internal-origin
// resources, re-projecting on every skill-store change. The registry's
// notify -> resolver recompute -> broadcast chain serves them downstream.
// Re-projection rebuilds the full set, so updates and removals propagate.
export class SkillResourceProjector {
  private readonly logger: Logger;
  private unsubscribe?: () => void;

  constructor(
    logger: Logger,
    private readonly skillStore: SkillStoreI,
    private readonly capabilityRegistry: CapabilityRegistry,
    private readonly internalCapabilities: InternalCapabilitiesService,
    private readonly resourcesEnabled: boolean,
    private readonly promptsEnabled: boolean,
  ) {
    this.logger = logger.child({ component: "SkillResourceProjector" });
  }

  initialize(): void {
    if (this.resourcesEnabled) {
      this.internalCapabilities.register({
        kind: "resources",
        serverName: SKILLS_SERVICE_NAME,
        read: (uri) => this.readContent(uri),
      });
    }
    if (this.promptsEnabled) {
      this.internalCapabilities.register({
        kind: "prompts",
        serverName: SKILLS_SERVICE_NAME,
        getPrompt: (name) => this.getPromptResult(name),
      });
    }
    this.unsubscribe = this.skillStore.subscribe(() => this.project());
    this.project();
  }

  shutdown(): void {
    this.unsubscribe?.();
  }

  private project(): void {
    const skills = this.adoptedSkills();
    const resources = this.resourcesEnabled
      ? tagResources(skills.map(skillToResource), "internal")
      : [];
    const prompts = this.promptsEnabled
      ? tagPrompts(
          skills.filter((s) => s.exposeAsPrompt).map(skillToPrompt),
          "internal",
        )
      : [];
    this.capabilityRegistry.registerServer(SKILLS_SERVICE_NAME, {
      resources,
      prompts,
    });
    this.logger.debug("Projected skills", {
      resources: resources.length,
      prompts: prompts.length,
    });
  }

  // Consumes adoption to decide what to serve (skillStore ∩ adopted). Stubbed to
  // "all stored" until adoption (RND-826) lands; then this reads adoptedSkillIds
  // off the setup/config service (which owns setup data) and the projector
  // subscribes to setup changes too.
  private adoptedSkills(): Skill[] {
    return this.skillStore.getCatalog().mine;
  }

  // The mcpx-skills resource repository: turn a skill uri back into its SKILL.md.
  private readContent(uri: string): ResourceContent | undefined {
    const skillId = parseIdFromSkillUri(uri);
    const skill = skillId ? this.skillStore.getById(skillId) : undefined;
    if (!skill) return undefined;
    return { mimeType: "text/markdown", text: skillToSkillMd(skill) };
  }

  // A skill projected as /slash injects its SKILL.md as the prompt's message.
  // Looked up by name (the prompt's user-facing identity).
  private getPromptResult(name: string): GetPromptResult | undefined {
    const skill = this.adoptedSkills().find(
      (s) => s.name === name && s.exposeAsPrompt,
    );
    if (!skill) return undefined;
    return {
      description: skill.description,
      messages: [
        {
          role: "user",
          content: { type: "text", text: skillToSkillMd(skill) },
        },
      ],
    };
  }
}

function skillToResource(skill: Skill): Resource {
  return {
    uri: skillUri(skill),
    name: skill.name,
    description: skill.description,
    mimeType: "text/markdown",
  };
}

function skillToPrompt(skill: Skill): Prompt {
  return { name: skill.name, description: skill.description };
}

// id as the path segment: stable, unique, url-safe, so a read resolves back by
// id. The model selects on Resource.name/description, not the uri, so this
// doesn't hurt discovery. agentskills name-as-segment is reconciled at the
// read-time frontmatter projection, where uniqueness can be enforced.
export function skillUri(skill: Skill): string {
  return `skill://${skill.id}/SKILL.md`;
}

// Inverse of skillUri: pulls the skill id out of the real (un-injected) uri the
// resolver hands back via capabilityName. The id is a single path segment, so a
// server-injected uri (extra segment) won't match. undefined if not a skill uri.
export function parseIdFromSkillUri(uri: string): string | undefined {
  return /^skill:\/\/([^/]+)\/SKILL\.md$/.exec(uri)?.[1];
}

// Read-time content projection: the agentskills SKILL.md (frontmatter +
// instruction body). The tool-group activate/deactivate wrapper is interpolated
// here once those tools land.
export function skillToSkillMd(skill: Skill): string {
  const frontmatter = stringifyYaml({
    name: skill.name,
    description: skill.description,
  }).trimEnd();
  return `---\n${frontmatter}\n---\n\n${skill.body}\n`;
}
