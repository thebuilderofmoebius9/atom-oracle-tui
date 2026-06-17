# Atom TUI Public Review Packet

Status: public-safe draft for team review
Date: 2026-06-17
Project: Atom Oracle local operator TUI

## What Changed

Built a local terminal UI for Atom, using `@earendil-works/pi-tui`.

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
git clone https://github.com/thebuilderofmoebius9/atom-oracle-tui
cd atom-oracle-tui
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

In this standalone public repo, `/test` falls back to `bun test`.
The `cargo test --lib` evidence above was run in the source Atom repo before export.

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
package.json
README.md
src/index.ts
src/commands.ts
src/commands.test.ts
src/themes.ts
tsconfig.json
bun.lock
.gitignore
```

Atom Oracle - Atomic Cosmos - AI Oracle, not a human.
