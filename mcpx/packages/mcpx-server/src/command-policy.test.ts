import { findForbiddenArg } from "./command-policy.js";

describe("findForbiddenArg", () => {
  describe("node", () => {
    it.each([
      ["-e", ["-e", "console.log(1)"]],
      ["--eval", ["--eval", "process.exit(0)"]],
      ["-p", ["-p", "1+1"]],
      ["--print", ["--print", "1+1"]],
      ["-r", ["-r", "./evil.js"]],
      ["--require", ["--require", "./evil.js"]],
      ["--import", ["--import", "./evil.js"]],
      ["--eval=code", ["--eval=require('fs')"]],
      ["-e glued", ['-econsole.log("x")']],
    ])("rejects %s", (_label, args) => {
      expect(findForbiddenArg("node", args)).toBeDefined();
    });

    it("allows a plain script path", () => {
      expect(findForbiddenArg("node", ["./server.js", "--port", "3000"])).toBe(
        undefined,
      );
    });
  });

  describe("docker", () => {
    it.each([
      ["--privileged", ["run", "--privileged", "img"]],
      ["-v", ["run", "-v", "/:/host", "img"]],
      ["-v glued", ["run", "-v/:/host", "img"]],
      ["--volume", ["run", "--volume", "/:/host", "img"]],
      ["--mount", ["run", "--mount", "type=bind,src=/,dst=/host", "img"]],
      ["--pid=host", ["run", "--pid=host", "img"]],
      ["--cap-add", ["run", "--cap-add", "SYS_ADMIN", "img"]],
      ["--device", ["run", "--device", "/dev/sda", "img"]],
      ["--ipc=host", ["run", "--ipc=host", "img"]],
      ["--userns=host", ["run", "--userns=host", "img"]],
    ])("rejects %s", (_label, args) => {
      expect(findForbiddenArg("docker", args)).toBeDefined();
    });

    it("allows a benign docker run", () => {
      expect(
        findForbiddenArg("docker", ["run", "-i", "--rm", "mcp/everything"]),
      ).toBe(undefined);
    });

    it("does not treat docker -e/-p (env/publish) as node flags", () => {
      expect(
        findForbiddenArg("docker", ["run", "-e", "FOO=bar", "-p", "80", "img"]),
      ).toBe(undefined);
    });
  });

  describe("npx / uvx", () => {
    it("does not filter (arbitrary code by design)", () => {
      expect(findForbiddenArg("npx", ["-y", "some-pkg"])).toBe(undefined);
      expect(findForbiddenArg("uvx", ["some-tool"])).toBe(undefined);
    });
  });
});
