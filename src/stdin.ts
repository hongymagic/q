/** Maximum length for query input (characters) */
export const MAX_QUERY_LENGTH = 5_000;

/** Maximum length for context input (characters) */
export const MAX_CONTEXT_LENGTH = 50_000;

export interface StdinInput {
  content: string | null;
  hasInput: boolean;
}

/**
 * Read input from stdin if piped (non-TTY).
 * Returns null content if stdin is a TTY (interactive terminal).
 */
export async function readStdin(): Promise<StdinInput> {
  // Return null if TTY (interactive terminal)
  if (process.stdin.isTTY) {
    return { content: null, hasInput: false };
  }

  // Read stdin
  const chunks: string[] = [];
  const decoder = new TextDecoder();

  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(decoder.decode(chunk));
  }

  const content = chunks.join("").trim();
  return {
    content: content || null,
    hasInput: content.length > 0,
  };
}

export type InputMode = "args" | "stdin" | "context";

export interface ResolvedInput {
  mode: InputMode;
  query: string;
  context: string | null;
}

/**
 * Resolve the input mode and extract query/context from args and stdin.
 */
export function resolveInput(
  stdinInput: StdinInput,
  argsQuery: string[],
): ResolvedInput {
  if (stdinInput.hasInput && argsQuery.length > 0) {
    // Context mode: stdin is context, args is question
    return {
      mode: "context",
      query: argsQuery.join(" "),
      context: stdinInput.content,
    };
  }

  if (stdinInput.hasInput && stdinInput.content) {
    // Query mode: stdin is the question
    return {
      mode: "stdin",
      query: stdinInput.content,
      context: null,
    };
  }

  // Normal mode: args is the question
  return {
    mode: "args",
    query: argsQuery.join(" "),
    context: null,
  };
}
