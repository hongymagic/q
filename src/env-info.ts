import * as os from "node:os";

export interface EnvironmentInfo {
  os: string;
  osVersion: string;
  arch: string;
  shell: string;
  terminal: string;
}

export function getEnvironmentInfo(): EnvironmentInfo {
  return {
    os: safeGetOSName(),
    osVersion: safeGetOSVersion(),
    arch: safeGetArch(),
    shell: safeGetShell(),
    terminal: safeGetTerminal(),
  };
}

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

function safeGetOSVersion(): string {
  try {
    return os.release();
  } catch {
    return "unknown";
  }
}

function safeGetArch(): string {
  try {
    return process.arch;
  } catch {
    return "unknown";
  }
}

function safeGetShell(): string {
  try {
    if (process.platform === "win32") {
      const comspec = process.env.COMSPEC?.toLowerCase() ?? "";
      if (comspec.includes("powershell")) return "powershell";
      if (comspec.includes("cmd")) return "cmd";
      if (process.env.PSModulePath) return "powershell";
      return "cmd";
    }

    const shell = process.env.SHELL ?? "/bin/sh";
    const shellName = shell.split("/").pop() ?? "sh";
    return shellName;
  } catch {
    return "unknown";
  }
}

function safeGetTerminal(): string {
  try {
    const termProgram = process.env.TERM_PROGRAM;
    if (termProgram) {
      return termProgram;
    }

    if (process.env.WT_SESSION) {
      return "Windows Terminal";
    }

    const term = process.env.TERM;
    if (term && term !== "dumb") {
      return term;
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

export function formatEnvForPrompt(env: EnvironmentInfo): string {
  const lines = [
    `- OS: ${env.os} ${env.osVersion} (${env.arch})`,
    `- Shell: ${env.shell}`,
    `- Terminal: ${env.terminal}`,
  ];
  return lines.join("\n");
}

export function formatEnvForDebug(env: EnvironmentInfo): string {
  return `Environment: OS=${env.os} ${env.osVersion} (${env.arch}), Shell=${env.shell}, Terminal=${env.terminal}`;
}
