import { describe, expect, test } from "bun:test";
import { executeCommand, parseCommand } from "./commands.ts";

describe("parseCommand", () => {
  test("parses grep aliases", () => {
    expect(parseCommand("/g Atom")).toEqual({ name: "grep", pattern: "Atom" });
  });

  test("caps read line count", () => {
    expect(parseCommand("/read SOUL.md 999")).toEqual({ name: "read", file: "SOUL.md", lines: 240 });
  });

  test("rejects missing command args as unknown", () => {
    expect(parseCommand("/grep")).toEqual({ name: "unknown", input: "/grep" });
  });

  test("parses maw capture with capped lines", () => {
    expect(parseCommand("/maw-capture atom 9999")).toEqual({ name: "maw-capture", target: "atom", lines: 500 });
  });

  test("parses maw run text", () => {
    expect(parseCommand("/maw-run atom echo hello world")).toEqual({
      name: "maw-run",
      target: "atom",
      text: "echo hello world"
    });
  });
});

describe("executeCommand", () => {
  test("reads a safe repo file", async () => {
    const result = await executeCommand({ name: "read", file: "Cargo.toml", lines: 8 });
    expect(result.ok).toBe(true);
    expect(result.body).toContain("[package]");
  });

  test("blocks secret-like paths", async () => {
    const result = await executeCommand({ name: "read", file: ".env", lines: 8 });
    expect(result.ok).toBe(false);
    expect(result.body).toContain("secret");
  });
});
