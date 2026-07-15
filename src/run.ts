import type { LanguageModel } from "ai";
import { streamText } from "ai";
import { createAnsiStripper, sanitizeForTerminal } from "./ansi.ts";
import { ProviderError } from "./errors.ts";
import { buildUserPrompt } from "./prompt.ts";

export interface RunOptions {
  model: LanguageModel;
  query: string;
  systemPrompt: string;
  context?: string | null;
  onFirstChunk?: () => void;
}

export interface RunResult {
  text: string;
}

export async function runQuery(options: RunOptions): Promise<RunResult> {
  const { model, query, systemPrompt, context, onFirstChunk } = options;
  const userPrompt = buildUserPrompt(query, context);

  try {
    let streamError: unknown;

    const result = streamText({
      model,
      instructions: systemPrompt,
      prompt: userPrompt,
      onError: ({ error }) => {
        streamError ??= error;
      },
    });

    let fullText = "";
    let sawTextChunk = false;
    let lastWriteEndsWithNewline = false;
    const stripper = createAnsiStripper();

    for await (const textPart of result.textStream) {
      if (!sawTextChunk) {
        sawTextChunk = true;
        onFirstChunk?.();
      }

      // Security: strip ANSI codes AND escape raw control characters to prevent
      // terminal hijacking. fullText keeps the raw text for clipboard/return value.
      const safeText = sanitizeForTerminal(stripper(textPart));
      if (safeText.length > 0) {
        process.stdout.write(safeText);
        lastWriteEndsWithNewline = safeText.endsWith("\n");
      }
      fullText += textPart;
    }

    if (streamError !== undefined) {
      if (sawTextChunk && !lastWriteEndsWithNewline) {
        process.stdout.write("\n");
      }
      throw streamError;
    }

    if (sawTextChunk && !lastWriteEndsWithNewline) {
      process.stdout.write("\n");
    }

    return { text: fullText };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ProviderError(`AI request failed: ${message}`, err);
  }
}
