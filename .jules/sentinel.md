# Sentinel's Journal

## 2025-02-17 - Unbounded Stdin Read
**Vulnerability:** The CLI read the entire standard input into memory before checking its length, allowing for Denial of Service (DoS) via resource exhaustion.
**Learning:** Even if length checks exist, they must happen *during* the read process, not after buffering everything.
**Prevention:** Use streaming processing and check limits incrementally.
