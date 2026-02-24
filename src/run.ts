import type { LanguageModel } from "ai";
import { generateText, streamText } from "ai";
import { ProviderError } from "./errors.ts";

export interface RunOptions {
  model: LanguageModel;
  query: string;
  systemPrompt: string;
  stream: boolean;
}

export interface RunResult {
  text: string;
}

export async function runQuery(options: RunOptions): Promise<RunResult> {
  const { model, query, systemPrompt, stream } = options;

  try {
    if (stream) {
      return await runStreamingQuery(model, query, systemPrompt);
    }
    return await runNonStreamingQuery(model, query, systemPrompt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ProviderError(`AI request failed: ${message}`);
  }
}

async function runNonStreamingQuery(
  model: LanguageModel,
  query: string,
  systemPrompt: string,
): Promise<RunResult> {
  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: query,
  });

  return { text: result.text };
}

async function runStreamingQuery(
  model: LanguageModel,
  query: string,
  systemPrompt: string,
): Promise<RunResult> {
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
}
