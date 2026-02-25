import type { LanguageModel, ToolSet } from "ai";
import { generateText, stepCountIs, streamText } from "ai";
import { ProviderError } from "./errors.ts";
import { MAX_TOOL_STEPS } from "./mcp/index.ts";
import { buildUserPrompt } from "./prompt.ts";

const MAX_DEBUG_OUTPUT_LENGTH = 500;

function safeStringify(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    // Handle circular references or objects with throwing toJSON()
    return String(value);
  }
}

export interface RunOptions {
  model: LanguageModel;
  query: string;
  systemPrompt: string;
  context?: string | null;
  tools?: ToolSet;
  debug?: boolean;
}

export interface RunResult {
  text: string;
}

export async function runQuery(options: RunOptions): Promise<RunResult> {
  const { tools } = options;

  // No tools or empty tools - use streamText (original behaviour)
  if (!tools || Object.keys(tools).length === 0) {
    return runWithStreaming(options);
  }

  // Has tools - use generateText with multi-step tool calling
  return runWithTools(options);
}

async function runWithStreaming(options: RunOptions): Promise<RunResult> {
  const { model, query, systemPrompt, context } = options;
  const userPrompt = buildUserPrompt(query, context);

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
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

async function runWithTools(options: RunOptions): Promise<RunResult> {
  const { model, query, systemPrompt, context, tools, debug } = options;
  const userPrompt = buildUserPrompt(query, context);

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      tools,
      stopWhen: stepCountIs(MAX_TOOL_STEPS),

      experimental_onToolCallStart: ({ toolCall }) => {
        const { toolName, input } = toolCall;
        process.stderr.write(`⏳ ${toolName}...`);

        if (debug) {
          process.stderr.write("\n");
          process.stderr.write(`[mcp] Input: ${safeStringify(input)}\n`);
        }
      },

      experimental_onToolCallFinish: (event) => {
        const { toolCall, durationMs, success } = event;
        const { toolName } = toolCall;
        const duration = (durationMs / 1000).toFixed(1);

        if (!success) {
          process.stderr.write(` ✗ Failed (${duration}s)\n`);
          if (debug && "error" in event) {
            process.stderr.write(`[mcp] Error: ${event.error}\n`);
          }
        } else {
          process.stderr.write(`\r✓ ${toolName} (${duration}s)\n`);
          if (debug && "output" in event) {
            const outputStr = safeStringify(event.output);
            const truncated =
              outputStr.length > MAX_DEBUG_OUTPUT_LENGTH
                ? `${outputStr.slice(0, MAX_DEBUG_OUTPUT_LENGTH)}... (truncated)`
                : outputStr;
            process.stderr.write(`[mcp] Output: ${truncated}\n`);
          }
        }
      },

      onStepFinish: ({ text }) => {
        if (text) {
          process.stdout.write(text);
        }
      },
    });

    const fullText = result.text;

    if (fullText && !fullText.endsWith("\n")) {
      process.stdout.write("\n");
    }

    return { text: fullText };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ProviderError(`AI request failed: ${message}`);
  }
}
