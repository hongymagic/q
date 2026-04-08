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

## 2025-02-18 - Pastejacking via Clipboard Injection
**Vulnerability:** The AI model's output was copied to the clipboard without full sanitization. While ANSI codes are visible in standard text editors, dangerous C0 control characters (like Null `\x00`, Backspace `\x08`, or Escape `\x1B` without sequences) and the DEL character (`\x7F`) might be silently executed or interpreted when pasted into a terminal or text editor, leading to unintended command execution.
**Learning:** Output destined for the clipboard needs stricter sanitization than output destined for stdout, as the context of pasting is unknown and potentially dangerous.
**Prevention:** Implement a dedicated clipboard sanitizer that not only strips ANSI escape codes but also replaces dangerous, non-printable control characters with their hex representation, while preserving safe whitespace.

## 2025-02-18 - Secret Leakage in Debug Logs via Nested Config Properties
**Vulnerability:** The `filterSensitiveFields` function properly filtered top-level sensitive keys but failed to recursively redact fields, meaning nested objects (like `headers` which may contain `Authorization` or `x-api-key`) were logged in plaintext in debug mode.
**Learning:** Log sanitization functions must recursively inspect properties, especially in complex objects like request headers where standard sensitive tokens are frequently sent.
**Prevention:** Implement a recursive key checker in log redaction/filtering functions that handles nested structures properly.

## 2026-03-06 - Secret Leakage in Portkey Provider Debug Logs
**Vulnerability:** In `src/providers/portkey.ts`, the logging code meant to mask sensitive headers (like `Authorization` or `x-portkey-api-key`) was flawed. If a sensitive value was 12 characters or less, it was completely exposed in plain text in the debug logs instead of being masked.
**Learning:** Conditional masking logic often fails to account for shorter strings or edge cases in lengths. When using a ternary that checks for length, ensure the alternate case for a shorter length securely masks the string rather than falling through to the unmasked original value.
**Prevention:** Fully mask short strings (e.g., using `"********"`) and verify boundary conditions for all sensitive data redaction functions.

## 2026-03-09 - Secret Leakage in Debug Logs via JSON.stringify
**Vulnerability:** The \`formatValue\` function in \`src/logging.ts\` serialized objects using \`JSON.stringify(value, null, 2)\` without any redaction logic. Any nested objects containing sensitive fields (like \`Authorization\`, \`password\`, \`token\`, or keys ending in \`_key\`) would be exposed in plaintext in debug and failure logs.
**Learning:** Default object serialization functions (like \`JSON.stringify\`) do not inherently know about sensitive data. When logging arbitrary or user-provided objects, a custom replacer must be used to scrub sensitive fields before they hit the disk or console.
**Prevention:** Always use a custom replacer function with \`JSON.stringify\` when logging objects that might contain sensitive data, ensuring that known sensitive keys are masked.

## 2026-03-11 - Secret Leakage in Debug Logs via Unfiltered Arrays
**Vulnerability:** The `filterSensitiveFields` function in `src/providers/index.ts` used a manual recursive loop to drop sensitive keys, but it failed to recurse into arrays. If a configuration object contained an array with sensitive nested objects, those secrets would be leaked in debug logs.
**Learning:** Manual object traversal for redaction is prone to edge cases (like arrays or circular references).
**Prevention:** Use a custom replacer function with `JSON.stringify` to safely and completely redact sensitive fields across all nested structures.

## 2026-04-08 - SSRF and Credential Leak via cwd Config
**Vulnerability:** Project-specific local configuration files (`./config.toml`) were merged directly into the top-level application config, including service provider details. An attacker checking a malicious `config.toml` file into a repository could intercept API keys using a rogue server via `base_url` or exfiltrate local environment variables via `.api_key_env` when a user ran the CLI in that directory.
**Learning:** Configurations that merge global user settings with untrusted local user settings must draw clear boundaries. Global secrets and provider configurations should never be overridable by localized project files, particularly in CLI tools run across arbitrary directories.
**Prevention:** Isolate provider configuration loading exclusively to trusted paths (like XDG config locations). Ignore `providers` objects from local `cwdConfig`.