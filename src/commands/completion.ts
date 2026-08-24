import { completionHelp, hasHelpFlag } from "../help.js";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const COMMANDS = ["setup", "doctor", "skills", "version", "help", "completion"];
const SETUP_OPTIONS = ["--reset", "--name", "--email", "--agents", "--help", "-h"];
const HELP_OPTIONS = ["--help", "-h"];
const SKILLS_COMMANDS = ["list", "publish", "install", "installed", "--help", "-h"];
const SKILLS_PUBLISH_OPTIONS = ["--help", "-h"];
const COMPLETION_OPTIONS = ["--install", "--help", "-h"];
const SHELLS = ["bash", "zsh"];
const MARKER_START = "# >>> fintech-brain initialize >>>";
const MARKER_END = "# <<< fintech-brain initialize <<<";

type Shell = "bash" | "zsh";

export function completion(args: string[]): void {
  if (hasHelpFlag(args)) {
    completionHelp();
    return;
  }

  const [shell, ...options] = args;
  const install = options.includes("--install");

  if (shell === "bash") {
    handleCompletion("bash", install);
    return;
  }

  if (shell === "zsh") {
    handleCompletion("zsh", install);
    return;
  }

  completionHelp();
  process.exitCode = 1;
}

function handleCompletion(shell: Shell, install: boolean): void {
  const script = shell === "bash" ? bashCompletion() : zshCompletion();

  if (!install) {
    console.log(script);
    return;
  }

  installCompletion(shell, script);
}

function installCompletion(shell: Shell, script: string): void {
  const home = homedir();
  const localBinDir = join(home, ".local", "bin");
  const completionDir = join(home, ".config", "fintech-brain", "completions");
  const completionFile = shell === "zsh" ? join(completionDir, "_fintech") : join(completionDir, "fintech.bash");
  const shellConfig = shell === "zsh" ? join(home, ".zshrc") : join(home, ".bashrc");
  const initBlock = shell === "zsh"
    ? [
      `export PATH="${localBinDir}:$PATH"`,
      `fpath=("${completionDir}" $fpath)`,
      "autoload -Uz compinit",
      "compinit",
    ].join("\n")
    : [
      `export PATH="${localBinDir}:$PATH"`,
      `[ -f "${completionFile}" ] && source "${completionFile}"`,
    ].join("\n");

  mkdirSync(completionDir, { recursive: true });
  writeFileSync(completionFile, `${script}\n`);
  appendOnce(shellConfig, initBlock);

  if (shell === "zsh") {
    clearZshCompletionCache(home);
  }

  console.log(`Installed ${shell} completion: ${completionFile}`);
  console.log(`Updated shell config: ${shellConfig}`);
  console.log("To activate completion in this shell now, run:");
  console.log(`  source <(fintech completion ${shell})`);
}

function clearZshCompletionCache(home: string): void {
  for (const entry of readdirSync(home)) {
    if (entry === ".zcompdump" || entry.startsWith(".zcompdump-")) {
      rmSync(join(home, entry), { force: true });
    }
  }
}

function appendOnce(file: string, content: string): void {
  const replacement = `\n${MARKER_START}\n${content}\n${MARKER_END}\n`;
  const existing = existsSync(file) ? readFileSync(file, "utf8") : "";

  if (existing.includes(MARKER_START)) {
    const pattern = new RegExp(`${escapeRegExp(MARKER_START)}[\\s\\S]*?${escapeRegExp(MARKER_END)}\\n?`);
    writeFileSync(file, existing.replace(pattern, replacement.trimStart()));
    return;
  }

  writeFileSync(file, `${existing}${replacement}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bashCompletion(): string {
  const commands = COMMANDS.join(" ");
  const setupOptions = SETUP_OPTIONS.join(" ");
  const helpOptions = HELP_OPTIONS.join(" ");
  const skillsCommands = SKILLS_COMMANDS.join(" ");
  const skillsPublishOptions = SKILLS_PUBLISH_OPTIONS.join(" ");
  const shells = SHELLS.join(" ");
  const completionOptions = COMPLETION_OPTIONS.join(" ");

  return `# fintech completion for bash
_fintech_completion() {
  local cur prev command
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD - 1]}"
  command="\${COMP_WORDS[1]}"

  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${commands}" -- "$cur") )
    return 0
  fi

  case "$command" in
    setup)
      COMPREPLY=( $(compgen -W "${setupOptions}" -- "$cur") )
      ;;
    doctor|version|help)
      COMPREPLY=( $(compgen -W "${helpOptions}" -- "$cur") )
      ;;
    skills)
      if [[ $COMP_CWORD -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "${skillsCommands}" -- "$cur") )
      elif [[ "\${COMP_WORDS[2]}" == "publish" || "\${COMP_WORDS[2]}" == "install" || "\${COMP_WORDS[2]}" == "installed" ]]; then
        COMPREPLY=( $(compgen -W "${skillsPublishOptions}" -- "$cur") )
      else
        COMPREPLY=( $(compgen -W "${helpOptions}" -- "$cur") )
      fi
      ;;
    completion)
      if [[ $COMP_CWORD -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "${shells}" -- "$cur") )
      else
        COMPREPLY=( $(compgen -W "${completionOptions}" -- "$cur") )
      fi
      ;;
  esac
}

complete -F _fintech_completion fintech`;
}

function zshCompletion(): string {
  const commands = COMMANDS.join(" ");
  const setupOptions = SETUP_OPTIONS.join(" ");
  const helpOptions = HELP_OPTIONS.join(" ");
  const skillsCommands = SKILLS_COMMANDS.join(" ");
  const skillsPublishOptions = SKILLS_PUBLISH_OPTIONS.join(" ");
  const shells = SHELLS.join(" ");
  const completionOptions = COMPLETION_OPTIONS.join(" ");

  return `#compdef fintech
# fintech completion for zsh
_fintech() {
  local -a commands setup_options help_options skills_commands skills_publish_options shells completion_options
  commands=(${commands})
  setup_options=(${setupOptions})
  help_options=(${helpOptions})
  skills_commands=(${skillsCommands})
  skills_publish_options=(${skillsPublishOptions})
  shells=(${shells})
  completion_options=(${completionOptions})

  _arguments -C \
    '1:command:->command' \
    '*::arg:->arg'

  case "$state" in
    command)
      compadd -a commands
      ;;
    arg)
      case "$words[2]" in
        setup)
          compadd -a setup_options
          ;;
        doctor|version|help)
          compadd -a help_options
          ;;
        skills)
          if (( CURRENT == 3 )); then
            compadd -a skills_commands
          elif [[ "$words[3]" == "publish" || "$words[3]" == "install" || "$words[3]" == "installed" ]]; then
            compadd -a skills_publish_options
          else
            compadd -a help_options
          fi
          ;;
        completion)
          if (( CURRENT == 3 )); then
            compadd -a shells
          else
            compadd -a completion_options
          fi
          ;;
      esac
      ;;
  esac
}

if ! (( $+functions[compdef] )); then
  autoload -Uz compinit
  compinit
fi

compdef _fintech fintech`;
}
