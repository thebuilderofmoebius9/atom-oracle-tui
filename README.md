# Atom TUI

Local terminal UI for Atom Oracle, built with `@earendil-works/pi-tui`.

## Run

This machine currently has Node 18, while `pi-tui` declares Node `>=22.19.0`.
Use Bun here:

```bash
git clone https://github.com/thebuilderofmoebius9/atom-oracle-tui
cd atom-oracle-tui
bun install
bun run start
```

Non-interactive smoke path:

```bash
bun run once /status
```

## Commands

- `/help` - show commands
- `/status` - git and `atom-cc-connect.service` status
- `/files [query]` - list repo files, optionally filtered
- `/grep <pattern>` - search source-like files with ripgrep
- `/read <relative-path> [lines]` - preview a non-secret repo file
- `/test` - run project tests (`cargo test --lib` in Atom repo, `bun test` in standalone clone)
- `/note <text>` - append a local note under `ψ/active/atom-tui/notes.jsonl`
- `/maw-ls` - list live Maw/tmux panes
- `/maw-peek <target>` - quick latest-output glance from a pane
- `/maw-capture <target> [lines]` - capture pane output
- `/maw-run <target> <text>` - send text to a pane and press Enter
- `/clear` - clear the visible transcript
- `/quit` - exit

This is a local operator tool. It does not change the live Discord service.
