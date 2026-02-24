/**
 * System prompt builder for the q CLI
 * Generates environment-aware prompts for terminal assistance
 */
import {
  type EnvironmentInfo,
  formatEnvForPrompt,
  getEnvironmentInfo,
} from "./env-info.ts";

/**
 * Returns current date and time formatted for the prompt
 */
function getFormattedDateTime(): string {
  try {
    const now = new Date();
    return now.toLocaleString("en-US", {
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

/**
 * Builds a dynamic system prompt with environment context
 * @param env - Optional environment info for testing; auto-detected if not provided
 * @param dateTime - Optional date/time string for testing; auto-generated if not provided
 */
export function buildSystemPrompt(
  env?: EnvironmentInfo,
  dateTime?: string,
): string {
  const envInfo = env ?? getEnvironmentInfo();
  const envContext = formatEnvForPrompt(envInfo);
  const timestamp = dateTime ?? getFormattedDateTime();

  return `You are a terminal command expert. The user is running:
${envContext}
- Date/Time: ${timestamp}

Response rules:
- Give a single, copy/paste-ready command (one-liner preferred)
- Use the correct syntax for the user's shell (${envInfo.shell}) and OS (${envInfo.os})
- Chain multiple commands with && or ; when appropriate
- Only add a brief explanation if the command is non-obvious or destructive
- For destructive operations, warn clearly with ⚠️
- If multiple distinct steps are truly required, number them

No preamble. No "Sure!" or "Here's how...". Just the answer.`;
}

// Re-export for convenience
export { getEnvironmentInfo, type EnvironmentInfo };
