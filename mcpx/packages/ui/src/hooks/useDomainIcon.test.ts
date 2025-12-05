import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDomainIcon, getIconKey } from "./useDomainIcon";


describe("useDomainIcon Logic", () => {
  // Testing the search function
  describe("getIconKey", () => {
    it("exact name is given", () => {
      // "slack" is in the Set as "slack"
      expect(getIconKey("discord")).toBe("discord");
      // "gitHub" is in the Set as "gitHub"
      expect(getIconKey("gitHub")).toBe("gitHub");
    });

    it("name with un-expacted capital and lower cases is given", () => {
      expect(getIconKey("DISCORD")).toBe("discord");
      expect(getIconKey("discOrd")).toBe("discord");

      expect(getIconKey("github")).toBe("gitHub");
      expect(getIconKey("GITHUB")).toBe("gitHub");
      expect(getIconKey("GIThuB")).toBe("gitHub");
    });

    it("unknown name given, should return null", () => {
      expect(getIconKey("discard")).toBeNull();
      expect(getIconKey("randomServer")).toBeNull();
    });

    it("empty should also return null", () => {
      expect(getIconKey("")).toBeNull();
    });
  });

  // Testing the hook itself
  describe("useDomainIcon Hook", () => {
    it("exact name is given", () => {
      const { result } = renderHook(() => useDomainIcon("slack"));
      expect(result.current).toBe("/icons/slack.png");
    });

    it("name with un-expacted capital and lower cases is given, the right key is still found", () => {
      const { result: resultSlack } = renderHook(() => useDomainIcon("SLACK"));
      expect(resultSlack.current).toBe("/icons/slack.png");
      const { result: resultTeamsMixed } = renderHook(() =>
        useDomainIcon("MicrosofttEAms"),
      );
      expect(resultTeamsMixed.current).toBe("/icons/microsoftTeams.png");
      const { result: resultTeamsLower } = renderHook(() =>
        useDomainIcon("microsoftteams"),
      );
      expect(resultTeamsLower.current).toBe("/icons/microsoftTeams.png");
    });

    it("unknown server - returns empty string", () => {
      const { result } = renderHook(() => useDomainIcon("serverunknown"));
      expect(result.current).toBe("");
    });

    it("empty input -> empty string as a result", () => {
      const { result } = renderHook(() => useDomainIcon(""));
      expect(result.current).toBe("");
    });
  });
});
