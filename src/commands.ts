import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export type ParsedCommand =
  | { name: "help" }
  | { name: "status" }
  | { name: "files"; query: string }
  | { name: "grep"; pattern: string }
  | { name: "read"; file: string; lines: number }
  | { name: "test" }
  | { name: "note"; text: string }
  | { name: "maw-ls" }
  | { name: "maw-peek"; target: string }
  | { name: "maw-capture"; target: string; lines: number }
  | { name: "maw-run"; target: string; text: string }
  | { name: "pwd" }
  | { name: "clear" }
  | { name: "quit" }
  | { name: "unknown"; input: string };

export interface CommandResult {
  title: string;
  body: string;
  ok: boolean;
}

export const REPO_ROOT = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));

function findRepoRoot(start: string): string {
  if (process.env.ATOM_TUI_REPO_ROOT) {
    return path.resolve(process.env.ATOM_TUI_REPO_ROOT);
  }

  let current = start;
  while (true) {
    if (existsSync(path.join(current, ".git"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(start, "..");
    }
    current = parent;
  }
}

const HELP = [
  "## Atom TUI commands",
  "",
  "- `/status` - git and Atom service status",
  "- `/files [query]` - list repo files",
  "- `/grep <pattern>` - ripgrep search",
  "- `/read <relative-path> [lines]` - preview a repo file",
  "- `/test` - run project tests",
  "- `/note <text>` - append a local note",
  "- `/maw-ls` - list live Maw/tmux panes",
  "- `/maw-peek <target>` - quick latest-output glance",
  "- `/maw-capture <target> [lines]` - capture pane output",
  "- `/maw-run <target> <text>` - send text to a pane and press Enter",
  "- `/clear` - clear visible transcript",
  "- `/quit` - exit"
].join("\n");

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) return { name: "help" };
  if (!trimmed.startsWith("/")) return { name: "unknown", input: trimmed };

  const [rawName = "", ...rest] = trimmed.slice(1).split(/\s+/);
  const name = rawName.toLowerCase();
  const tail = rest.join(" ").trim();

  switch (name) {
    case "help":
    case "h":
      return { name: "help" };
    case "status":
    case "s":
      return { name: "status" };
    case "files":
    case "f":
      return { name: "files", query: tail };
    case "grep":
    case "g":
      return tail ? { name: "grep", pattern: tail } : { name: "unknown", input: trimmed };
    case "read":
    case "r": {
      const file = rest[0] ?? "";
      const lineCandidate = Number.parseInt(rest[1] ?? "", 10);
      const lines = Number.isFinite(lineCandidate) && lineCandidate > 0 ? Math.min(lineCandidate, 240) : 120;
      return file ? { name: "read", file, lines } : { name: "unknown", input: trimmed };
    }
    case "test":
    case "t":
      return { name: "test" };
    case "note":
    case "n":
      return tail ? { name: "note", text: tail } : { name: "unknown", input: trimmed };
    case "maw-ls":
    case "panes":
      return { name: "maw-ls" };
    case "maw-peek":
    case "peek":
      return rest[0] ? { name: "maw-peek", target: rest[0] } : { name: "unknown", input: trimmed };
    case "maw-capture":
    case "capture": {
      const target = rest[0] ?? "";
      const lineCandidate = Number.parseInt(rest[1] ?? "", 10);
      const lines = Number.isFinite(lineCandidate) && lineCandidate > 0 ? Math.min(lineCandidate, 500) : 120;
      return target ? { name: "maw-capture", target, lines } : { name: "unknown", input: trimmed };
    }
    case "maw-run":
    case "send": {
      const target = rest[0] ?? "";
      const text = rest.slice(1).join(" ").trim();
      return target && text ? { name: "maw-run", target, text } : { name: "unknown", input: trimmed };
    }
    case "pwd":
      return { name: "pwd" };
    case "clear":
      return { name: "clear" };
    case "quit":
    case "q":
    case "exit":
      return { name: "quit" };
    default:
      return { name: "unknown", input: trimmed };
  }
}

export async function executeCommand(command: ParsedCommand): Promise<CommandResult> {
  switch (command.name) {
    case "help":
      return { title: "Help", body: HELP, ok: true };
    case "status":
      return status();
    case "files":
      return files(command.query);
    case "grep":
      return grep(command.pattern);
    case "read":
      return readPreview(command.file, command.lines);
    case "test":
      return runProjectTest();
    case "note":
      return note(command.text);
    case "maw-ls":
      return mawLs();
    case "maw-peek":
      return mawPeek(command.target);
    case "maw-capture":
      return mawCapture(command.target, command.lines);
    case "maw-run":
      return mawRun(command.target, command.text);
    case "pwd":
      return { title: "Working Directory", body: `\`${REPO_ROOT}\``, ok: true };
    case "clear":
      return { title: "Clear", body: "UI handled clear.", ok: true };
    case "quit":
      return { title: "Quit", body: "UI handled quit.", ok: true };
    case "unknown":
      return {
        title: "Unknown",
        body: `ไม่รู้จักคำสั่ง \`${command.input}\`\n\nใช้ \`/help\` เพื่อดูคำสั่งที่มี ตอนนี้ยังไม่ได้ต่อ LLM agent loop เข้ามาใน TUI นี้.`,
        ok: false
      };
  }
}

async function status(): Promise<CommandResult> {
  const [gitStatus, gitBranch, serviceActive, serviceEnabled] = await Promise.all([
    run("git", ["status", "--short"], { timeoutMs: 8_000 }),
    run("git", ["branch", "--show-current"], { timeoutMs: 8_000 }),
    run("systemctl", ["--user", "is-active", "atom-cc-connect.service"], { timeoutMs: 5_000 }),
    run("systemctl", ["--user", "is-enabled", "atom-cc-connect.service"], { timeoutMs: 5_000 })
  ]);

  const body = [
    `branch: \`${gitBranch.stdout.trim() || "unknown"}\``,
    `service active: \`${serviceActive.stdout.trim() || serviceActive.stderr.trim() || "unknown"}\``,
    `service enabled: \`${serviceEnabled.stdout.trim() || serviceEnabled.stderr.trim() || "unknown"}\``,
    "",
    "```text",
    gitStatus.stdout.trim() || "(clean)",
    "```"
  ].join("\n");

  return { title: "Status", body, ok: gitStatus.code === 0 };
}

async function files(query: string): Promise<CommandResult> {
  const result = await run("rg", ["--files"], { timeoutMs: 8_000 });
  if (result.code !== 0) {
    return { title: "Files", body: result.stderr || result.stdout || "rg failed", ok: false };
  }
  const needle = query.toLowerCase();
  const rows = result.stdout
    .split("\n")
    .filter(Boolean)
    .filter((file) => !needle || file.toLowerCase().includes(needle))
    .filter((file) => !file.startsWith("ψ/memory/discord/"))
    .filter((file) => !file.includes("/node_modules/"))
    .slice(0, 80);

  return {
    title: "Files",
    body: rows.length ? ["```text", rows.join("\n"), "```"].join("\n") : "ไม่พบไฟล์ที่ตรงเงื่อนไข",
    ok: true
  };
}

async function grep(pattern: string): Promise<CommandResult> {
  const result = await run(
    "rg",
    [
      "-n",
      "--hidden",
      "--glob",
      "!target/**",
      "--glob",
      "!node_modules/**",
      "--glob",
      "!ψ/memory/discord/**",
      "--",
      pattern,
      "."
    ],
    { timeoutMs: 12_000 }
  );
  const output = (result.stdout || result.stderr || "ไม่พบผลลัพธ์").split("\n").slice(0, 120).join("\n");
  return { title: "Grep", body: ["```text", output, "```"].join("\n"), ok: result.code === 0 || result.code === 1 };
}

async function readPreview(relativeFile: string, lineLimit: number): Promise<CommandResult> {
  const resolved = resolveRepoFile(relativeFile);
  if (!resolved.ok) return { title: "Read", body: resolved.reason, ok: false };

  try {
    const content = await readFile(resolved.path, "utf8");
    const lines = content.split("\n").slice(0, lineLimit);
    return {
      title: `Read ${relativeFile}`,
      body: ["```text", lines.join("\n"), "```"].join("\n"),
      ok: true
    };
  } catch (error) {
    return { title: "Read", body: error instanceof Error ? error.message : String(error), ok: false };
  }
}

async function runProjectTest(): Promise<CommandResult> {
  const hasCargo = existsSync(path.join(REPO_ROOT, "Cargo.toml"));
  const result = hasCargo
    ? await run("cargo", ["test", "--lib"], { timeoutMs: 120_000 })
    : await run("bun", ["test"], { timeoutMs: 120_000 });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").split("\n").slice(-160).join("\n");
  return { title: hasCargo ? "Cargo Test" : "Bun Test", body: ["```text", output, "```"].join("\n"), ok: result.code === 0 };
}

async function note(text: string): Promise<CommandResult> {
  const dir = path.join(REPO_ROOT, "ψ", "active", "atom-tui");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "notes.jsonl");
  const record = { ts: new Date().toISOString(), text };
  await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
  return { title: "Note", body: `บันทึกแล้วที่ \`${path.relative(REPO_ROOT, file)}\``, ok: true };
}

async function mawLs(): Promise<CommandResult> {
  const result = await run("maw", ["ls"], { timeoutMs: 8_000 });
  const output = (result.stdout || result.stderr || "No output").trim();
  return { title: "Maw Panes", body: ["```text", output, "```"].join("\n"), ok: result.code === 0 };
}

async function mawPeek(target: string): Promise<CommandResult> {
  const result = await run("maw", ["peek", target], { timeoutMs: 8_000 });
  const output = (result.stdout || result.stderr || "No output").split("\n").slice(-160).join("\n");
  return { title: `Maw Peek ${target}`, body: ["```text", output, "```"].join("\n"), ok: result.code === 0 };
}

async function mawCapture(target: string, lines: number): Promise<CommandResult> {
  const result = await run("maw", ["capture", target, "--lines", String(lines)], { timeoutMs: 8_000 });
  const output = (result.stdout || result.stderr || "No output").split("\n").slice(-Math.max(20, lines)).join("\n");
  return { title: `Maw Capture ${target}`, body: ["```text", output, "```"].join("\n"), ok: result.code === 0 };
}

async function mawRun(target: string, text: string): Promise<CommandResult> {
  const result = await run("maw", ["run", target, text], { timeoutMs: 10_000 });
  const output = (result.stdout || result.stderr || "Sent").trim();
  return { title: `Maw Run ${target}`, body: ["```text", output, "```"].join("\n"), ok: result.code === 0 };
}

function resolveRepoFile(relativeFile: string): { ok: true; path: string } | { ok: false; reason: string } {
  if (relativeFile.includes("\0")) return { ok: false, reason: "path ไม่ถูกต้อง" };
  const normalized = path.normalize(relativeFile);
  if (path.isAbsolute(normalized) || normalized.startsWith("..")) {
    return { ok: false, reason: "อ่านได้เฉพาะ relative path ภายใน repo" };
  }

  const denied = [
    /^\.env($|\.)/,
    /(^|\/)\.env($|\.)/,
    /(^|\/)secrets?($|\/)/i,
    /(^|\/)credentials?($|\/)/i,
    /(^|\/)private[-_]?key/i
  ];
  if (denied.some((pattern) => pattern.test(normalized))) {
    return { ok: false, reason: "ปฏิเสธการอ่าน path ที่อาจมี secret" };
  }

  const resolved = path.resolve(REPO_ROOT, normalized);
  if (!resolved.startsWith(`${REPO_ROOT}${path.sep}`) && resolved !== REPO_ROOT) {
    return { ok: false, reason: "path หลุดออกนอก repo" };
  }
  return { ok: true, path: resolved };
}

interface RunOptions {
  timeoutMs: number;
}

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function run(command: string, args: string[], options: RunOptions): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" }
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      stderr += `\nTimed out after ${options.timeoutMs}ms`;
    }, options.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: stderr || error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}
