export interface LoadingIndicatorStream {
  isTTY?: boolean;
  write(chunk: string): boolean;
}

export interface LoadingIndicator {
  stop(): void;
}

export interface LoadingIndicatorOptions {
  enabled?: boolean;
  intervalMs?: number;
  stream?: LoadingIndicatorStream;
  text?: string;
}

const DEFAULT_FRAMES = ["-", "\\", "|", "/"];
const DEFAULT_INTERVAL_MS = 80;
const DEFAULT_TEXT = "Thinking...";

export function startLoadingIndicator(
  options: LoadingIndicatorOptions = {},
): LoadingIndicator {
  const {
    enabled = true,
    intervalMs = DEFAULT_INTERVAL_MS,
    stream = process.stderr,
    text = DEFAULT_TEXT,
  } = options;

  if (!enabled || stream.isTTY !== true) {
    return { stop() {} };
  }

  let frameIndex = 0;
  let active = true;
  let lastFrameLength = 0;

  const render = () => {
    const frame = `${DEFAULT_FRAMES[frameIndex]} ${text}`;
    lastFrameLength = frame.length;
    stream.write(`\r${frame}`);
    frameIndex = (frameIndex + 1) % DEFAULT_FRAMES.length;
  };

  render();

  const timer = setInterval(render, intervalMs);
  timer.unref?.();

  return {
    stop() {
      if (!active) {
        return;
      }

      active = false;
      clearInterval(timer);
      stream.write(`\r${" ".repeat(lastFrameLength)}\r`);
    },
  };
}
