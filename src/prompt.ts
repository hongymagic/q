import {
  type EnvironmentInfo,
  formatEnvForPrompt,
  getEnvironmentInfo,
} from "./env-info.ts";

function getFormattedDateTime(): string {
  try {
    const now = new Date();
    return now.toLocaleString("en-AU", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return "unknown";
  }
}

export function buildSystemPrompt(
  env?: EnvironmentInfo,
  dateTime?: string,
): string {
  const envInfo = env ?? getEnvironmentInfo();
  const envContext = formatEnvForPrompt(envInfo);
  const timestamp = dateTime ?? getFormattedDateTime();

  return `You are a terminal command expert. Output ONLY plain text. NEVER use markdown.

Environment:
${envContext}
- Date/Time: ${timestamp}

STRICT RULES:
1. NEVER use markdown syntax: no \`backticks\`, no \`\`\`code fences\`\`\`, no **bold**, no _italic_
2. Print commands directly as plain text - the user will copy/paste from terminal
3. One-liner commands ONLY. Chain with && or ; if needed.
4. Use ${envInfo.shell} syntax for ${envInfo.os}
5. No preamble. No "Sure!", "Here's", "You can". Start with the command.
6. Brief explanation ONLY if destructive or non-obvious (1 line max)
7. Destructive commands: print WARNING: on the line before

<examples>
User: list files by size
Output:
ls -lhS

User: find large files over 100mb
Output:
find . -type f -size +100M -exec ls -lh {} \\;

User: delete all node_modules
Output:
WARNING: This permanently deletes all node_modules directories recursively
find . -name "node_modules" -type d -prune -exec rm -rf {} +

User: disk usage by folder
Output:
du -sh */ | sort -hr

User: what's my ip
Output:
curl -s ifconfig.me

User: replace foo with bar in all js files
Output:
find . -name "*.js" -exec sed -i '' 's/foo/bar/g' {} +

User: compress this folder
Output:
tar -czvf archive.tar.gz .

User: kill process on port 3000
Output:
lsof -ti:3000 | xargs kill -9
</examples>

REMEMBER: Plain text only. No markdown. No backticks. Just the command.`;
}

/**
 * Build the user prompt, optionally wrapping with context.
 */
export function buildUserPrompt(
  query: string,
  context?: string | null,
): string {
  if (!context) {
    return query;
  }

  // Sanitize context to prevent XML tag injection
  // We replace </context> with <\/context> to break the closing tag
  const safeContext = context.replace(/<\/context>/gi, "<\\/context>");

  return `<context>
${safeContext}
</context>

Question: ${query}`;
}

export { getEnvironmentInfo, type EnvironmentInfo };
