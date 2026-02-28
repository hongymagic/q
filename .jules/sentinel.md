# Sentinel's Journal

## 2025-02-17 - Unbounded Stdin Read
**Vulnerability:** The CLI read the entire standard input into memory before checking its length, allowing for Denial of Service (DoS) via resource exhaustion.
**Learning:** Even if length checks exist, they must happen *during* the read process, not after buffering everything.
**Prevention:** Use streaming processing and check limits incrementally.

## 2025-02-18 - Prompt Injection via Context Delimiter
**Vulnerability:** User-supplied context wrapped in markdown code blocks (` ``` `) could contain nested backticks, allowing a prompt injection attack by prematurely closing the context block.
**Learning:** Using common delimiters like markdown backticks for untrusted input is risky if the input can contain the delimiter itself.
**Prevention:** Use XML tags (e.g., `<context>`) which are less likely to collide with content and easier to sanitize (by escaping the closing tag).

## 2025-02-18 - Terminal Injection via ANSI Codes
**Vulnerability:** The AI model's output was written directly to stdout without sanitization, allowing malicious models or prompt injections to inject ANSI escape codes that could manipulate the user's terminal (e.g., hiding text, changing colors, or potentially executing commands in vulnerable terminals).
**Learning:** Output from LLMs is untrusted user input, even if it comes from a "trusted" provider. It must be sanitized before being displayed in a terminal.
**Prevention:** Strip ANSI escape codes from all AI-generated output before writing to stdout.
