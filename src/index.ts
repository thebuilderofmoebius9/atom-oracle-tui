import {
  CombinedAutocompleteProvider,
  Editor,
  Loader,
  Markdown,
  ProcessTerminal,
  Text,
  TUI,
  matchesKey
} from "@earendil-works/pi-tui";
import { executeCommand, parseCommand, type CommandResult } from "./commands.ts";
import { chalk, editorTheme, markdownTheme } from "./themes.ts";

const commandList = [
  { name: "help", description: "Show commands" },
  { name: "status", description: "Git and service status" },
  { name: "files", description: "List repo files" },
  { name: "grep", description: "Search with ripgrep" },
  { name: "read", description: "Preview a file" },
  { name: "test", description: "Run cargo test --lib" },
  { name: "note", description: "Append local note" },
  { name: "maw-ls", description: "List Maw/tmux panes" },
  { name: "maw-peek", description: "Peek at a pane" },
  { name: "maw-capture", description: "Capture pane output" },
  { name: "maw-run", description: "Send text to a pane" },
  { name: "pwd", description: "Show repo root" },
  { name: "clear", description: "Clear transcript" },
  { name: "quit", description: "Exit" }
];

async function main(): Promise<void> {
  const onceIndex = process.argv.indexOf("--once");
  if (onceIndex >= 0) {
    const input = process.argv.slice(onceIndex + 1).join(" ") || "/help";
    const result = await executeCommand(parseCommand(input));
    console.log(`# ${result.title}\n\n${result.body}`);
    process.exit(result.ok ? 0 : 1);
  }

  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);
  const transcript: Markdown[] = [];

  const header = new Text(
    [
      chalk.bold.cyan("Atom Oracle TUI"),
      chalk.dim("local operator surface built with @earendil-works/pi-tui"),
      chalk.dim("type /help, /status, /files, /grep, /read, /test, /note, /quit")
    ].join("\n"),
    1,
    1
  );
  tui.addChild(header);

  const welcome = new Markdown(
    [
      "## Ready",
      "",
      "เครื่องมือนี้เป็น local TUI แยกจาก live Discord service.",
      "เริ่มด้วย `/status` หรือ `/help` ได้เลย."
    ].join("\n"),
    1,
    0,
    markdownTheme
  );
  tui.addChild(welcome);

  const editor = new Editor(tui, editorTheme);
  editor.setAutocompleteProvider(new CombinedAutocompleteProvider(commandList, process.cwd()));
  tui.addChild(editor);
  tui.setFocus(editor);

  function insertMessage(markdown: string): Markdown {
    const message = new Markdown(markdown, 1, 0, markdownTheme);
    transcript.push(message);
    const children = tui.children;
    children.splice(Math.max(0, children.length - 1), 0, message);
    tui.requestRender();
    return message;
  }

  function clearTranscript(): void {
    for (const message of transcript.splice(0)) {
      tui.removeChild(message);
    }
    tui.requestRender();
  }

  async function runInput(input: string): Promise<void> {
    const trimmed = input.trim();
    if (!trimmed) return;

    const parsed = parseCommand(trimmed);
    if (parsed.name === "quit") {
      tui.stop();
      process.exit(0);
    }
    if (parsed.name === "clear") {
      clearTranscript();
      return;
    }

    insertMessage(`**You**\n\n\`${trimmed.replace(/`/g, "\\`")}\``);
    editor.disableSubmit = true;
    const loader = new Loader(tui, (value) => chalk.cyan(value), (value) => chalk.dim(value), "Running...");
    tui.children.splice(Math.max(0, tui.children.length - 1), 0, loader);
    tui.requestRender();

    let result: CommandResult;
    try {
      result = await executeCommand(parsed);
    } catch (error) {
      result = {
        title: "Error",
        body: error instanceof Error ? error.stack || error.message : String(error),
        ok: false
      };
    } finally {
      tui.removeChild(loader);
      editor.disableSubmit = false;
    }

    const prefix = result.ok ? chalk.green("OK") : chalk.red("ERR");
    insertMessage(`## ${prefix} ${result.title}\n\n${result.body}`);
  }

  editor.onSubmit = (value: string) => {
    void runInput(value);
  };

  tui.addInputListener((data) => {
    if (matchesKey(data, "ctrl+c")) {
      tui.stop();
      process.exit(0);
    }
    return undefined;
  });

  tui.start();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
