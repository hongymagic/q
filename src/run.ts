import type { LanguageModel } from "ai";
import { streamText } from "ai";
import { ProviderError } from "./errors.ts";

export interface RunOptions {
  model: LanguageModel;
  query: string;
  systemPrompt: string;
}

export interface RunResult {
  text: string;
}

export async function runQuery(options: RunOptions): Promise<RunResult> {
  const { model, query, systemPrompt } = options;

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      prompt: query,
    });

    let fullText = "";

    for await (const textPart of result.textStream) {
      process.stdout.write(textPart);
      fullText += textPart;
    }

    if (!fullText.endsWith("\n")) {
      process.stdout.write("\n");
    }

    return { text: fullText };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ProviderError(`AI request failed: ${message}`);
  }
}
