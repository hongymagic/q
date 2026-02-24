/**
 * Environment detection for context-aware terminal assistance
 * All functions handle errors gracefully and return fallback values
 */
import * as os from "node:os";

export interface EnvironmentInfo {
  /** Human-readable OS name: "macOS", "Linux", "Windows" */
  os: string;
  /** OS/kernel version */
  osVersion: string;
  /** CPU architecture: "arm64", "x64", etc. */
  arch: string;
  /** User's shell: "zsh", "bash", "fish", "powershell", "cmd" */
  shell: string;
  /** Terminal application: "iTerm.app", "Terminal.app", "Windows Terminal", etc. */
  terminal: string;
}

/**
 * Detects the current execution environment
 * Never throws - returns fallback values on error
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  return {
    os: safeGetOSName(),
    osVersion: safeGetOSVersion(),
    arch: safeGetArch(),
    shell: safeGetShell(),
    terminal: safeGetTerminal(),
  };
}

/**
 * Returns human-readable OS name
 */
function safeGetOSName(): string {
  try {
    switch (process.platform) {
      case "darwin":
        return "macOS";
      case "linux":
        return "Linux";
      case "win32":
        return "Windows";
      default:
        return process.platform;
    }
  } catch {
    return "unknown";
  }
}

/**
 * Returns OS/kernel version
 */
function safeGetOSVersion(): string {
  try {
    return os.release();
  } catch {
    return "unknown";
  }
}

/**
 * Returns CPU architecture
 */
function safeGetArch(): string {
  try {
    return process.arch;
  } catch {
    return "unknown";
  }
}

/**
 * Detects the user's shell from environment
 */
function safeGetShell(): string {
  try {
    // Windows: check COMSPEC or default PowerShell detection
    if (process.platform === "win32") {
      const comspec = process.env.COMSPEC?.toLowerCase() ?? "";
      if (comspec.includes("powershell")) return "powershell";
      if (comspec.includes("cmd")) return "cmd";
      // Check if running in PowerShell
      if (process.env.PSModulePath) return "powershell";
      return "cmd";
    }

    // Unix: extract shell name from $SHELL
    const shell = process.env.SHELL ?? "/bin/sh";
    const shellName = shell.split("/").pop() ?? "sh";
    return shellName;
  } catch {
    return "unknown";
  }
}

/**
 * Detects the terminal emulator
 */
function safeGetTerminal(): string {
  try {
    // macOS-specific terminal detection
    const termProgram = process.env.TERM_PROGRAM;
    if (termProgram) {
      return termProgram; // e.g., "iTerm.app", "Apple_Terminal", "vscode"
    }

    // Windows Terminal
    if (process.env.WT_SESSION) {
      return "Windows Terminal";
    }

    // Generic TERM fallback
    const term = process.env.TERM;
    if (term && term !== "dumb") {
      return term; // e.g., "xterm-256color"
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Formats environment info for inclusion in the system prompt
 */
export function formatEnvForPrompt(env: EnvironmentInfo): string {
  const lines = [
    `- OS: ${env.os} ${env.osVersion} (${env.arch})`,
    `- Shell: ${env.shell}`,
    `- Terminal: ${env.terminal}`,
  ];
  return lines.join("\n");
}

/**
 * Returns a formatted string of environment info for debug output
 */
export function formatEnvForDebug(env: EnvironmentInfo): string {
  return `Environment: OS=${env.os} ${env.osVersion} (${env.arch}), Shell=${env.shell}, Terminal=${env.terminal}`;
}
