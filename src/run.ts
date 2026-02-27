import type { LanguageModel } from "ai";
import { streamText } from "ai";
import { createAnsiStripper } from "./ansi.ts";
import { ProviderError } from "./errors.ts";
import { buildUserPrompt } from "./prompt.ts";

export interface RunOptions {
  model: LanguageModel;
  query: string;
  systemPrompt: string;
  context?: string | null;
}

export interface RunResult {
  text: string;
}

export async function runQuery(options: RunOptions): Promise<RunResult> {
  const { model, query, systemPrompt, context } = options;
  const userPrompt = buildUserPrompt(query, context);

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    });

    let fullText = "";
    const stripper = createAnsiStripper();

    for await (const textPart of result.textStream) {
      // Security: Strip ANSI codes to prevent terminal manipulation
      // We keep original text in fullText for the return value (e.g. for clipboard)
      // but sanitize stdout to protect the user's terminal
      const safeText = stripper(textPart);
      process.stdout.write(safeText);
      fullText += textPart;
    }

    // Check against safeText buffer equivalent would be ideal but complex.
    // Using simple check against stdout write logic:
    if (!fullText.endsWith("\n")) {
      process.stdout.write("\n");
    }

    return { text: fullText };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ProviderError(`AI request failed: ${message}`);
  }
}
