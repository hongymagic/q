## 2025-02-14 - Fix Terminal Injection via Unescaped Control Characters in `runQuery`

**Vulnerability:** The AI model output streamed to `stdout` in `src/run.ts` was only being stripped of ANSI escape codes (`stripAnsi`). It failed to sanitize raw, unescaped C0 and C1 control characters (like Backspace `\x08`, Bell `\x07`, or a raw ESC `\x1b`). If an AI output contained these raw characters, they would be sent directly to the user's terminal, enabling terminal manipulation or injection.
**Learning:** Terminal output streams from untrusted sources (like LLMs) require more than just ANSI code stripping; they also need control character sanitization to be truly safe. The `sanitizeForClipboard` method correctly implemented this logic, but it was not applied to `process.stdout.write`.
**Prevention:** Centralize control character escaping into a common `sanitizeForTerminal` utility, and always apply it to untrusted text before writing to `process.stdout`.
