# Atom TUI Public Review Packet

Status: public-safe draft for team review
Date: 2026-06-17
Project: Atom Oracle local operator TUI

## What Changed

Built a local terminal UI for Atom under `tools/atom-tui/`, using `@earendil-works/pi-tui`.

The first version is intentionally small:

- Pi TUI based interactive surface.
- Local operator commands for repo status, file search, grep, read preview, test, and note capture.
- Maw/tmux bridge commands for pane inspection and message sending.
- Non-interactive `--once` mode for smoke tests and automation.
- Bun-first runtime because this machine has Node 18, while `pi-tui` declares Node `>=22.19.0`.

## Commands

```text
/help
/status
/files [query]
/grep <pattern>
/read <relative-path> [lines]
/test
/note <text>
/maw-ls
/maw-peek <target>
/maw-capture <target> [lines]
/maw-run <target> <text>
/clear
/quit
```

## How To Run

```bash
cd tools/atom-tui
bun install
bun run start
```

Smoke mode:

```bash
bun run once /status
bun run once /maw-ls
```

## Validation Evidence

Latest checks passed:

```text
bun test
  7 pass, 0 fail

bun run typecheck
  tsc --noEmit passed

cargo test --lib
  16 pass, 0 fail
```

Maw/tmux bridge was tested with a temporary tmux session named `atom_tui_probe`:

```text
/maw-capture atom_tui_probe 20
  captured pane output successfully

/maw-peek atom_tui_probe
  returned latest pane output successfully

/maw-run atom_tui_probe 'printf "atom-tui-run-ok\n"'
  sent text to pane and capture confirmed output
```

The temporary tmux session was killed after verification.

## Safety Notes

- This does not modify or restart `atom-cc-connect.service`.
- `/read` blocks obvious secret-like paths such as `.env`, `secret`, `credential`, and private-key paths.
- Shell execution in repo commands uses `spawn(command, args)`, not shell string interpolation.
- `/maw-run` is the command that sends input to another pane. It only runs when the operator explicitly types it in the TUI.
- `node_modules/` is ignored inside `tools/atom-tui/`.

## Review Checklist

Please inspect:

- Whether `/maw-run` should require an extra confirmation prompt inside the TUI.
- Whether the TUI should default to read-only mode and hide `/maw-run` behind a flag.
- Whether secret-path filtering is strict enough for Atom's repo.
- Whether command names should align with Maw naming exactly or stay friendlier for operators.
- Whether this should become a repo-level `just`/`make` command later.

## Known Constraints

- Current machine Node is `18.19.1`; use Bun unless Node is upgraded to `>=22.19.0`.
- This is not yet wired to `pi-agent-core` or a full LLM loop.
- No Discord posting is performed by this artifact.

## Files To Review

```text
tools/atom-tui/package.json
tools/atom-tui/README.md
tools/atom-tui/src/index.ts
tools/atom-tui/src/commands.ts
tools/atom-tui/src/commands.test.ts
tools/atom-tui/src/themes.ts
tools/atom-tui/tsconfig.json
tools/atom-tui/bun.lock
tools/atom-tui/.gitignore
```

Atom Oracle - Atomic Cosmos - AI Oracle, not a human.
