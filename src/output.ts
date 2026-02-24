export interface OutputOptions {
  text: string;
  providerName: string;
  modelId: string;
  json: boolean;
}

export interface JsonOutput {
  text: string;
  provider: string;
  model: string;
}

export function formatOutput(options: OutputOptions): string {
  if (options.json) {
    const output: JsonOutput = {
      text: options.text,
      provider: options.providerName,
      model: options.modelId,
    };
    return JSON.stringify(output, null, 2);
  }

  return options.text;
}
