import { describe, expect, it } from "vitest";
import { formatOutput } from "../src/output.ts";

describe("output formatting", () => {
  describe("formatOutput", () => {
    it("should return plain text when json is false", () => {
      const result = formatOutput({
        text: "This is the answer",
        providerName: "anthropic",
        modelId: "claude-sonnet-4-20250514",
        json: false,
      });
      expect(result).toBe("This is the answer");
    });

    it("should return JSON when json is true", () => {
      const result = formatOutput({
        text: "This is the answer",
        providerName: "anthropic",
        modelId: "claude-sonnet-4-20250514",
        json: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.text).toBe("This is the answer");
      expect(parsed.provider).toBe("anthropic");
      expect(parsed.model).toBe("claude-sonnet-4-20250514");
    });

    it("should handle multiline text in JSON", () => {
      const result = formatOutput({
        text: "Line 1\nLine 2\nLine 3",
        providerName: "openai",
        modelId: "gpt-4o",
        json: true,
      });

      const parsed = JSON.parse(result);
      expect(parsed.text).toBe("Line 1\nLine 2\nLine 3");
    });

    it("should handle special characters in text", () => {
      const result = formatOutput({
        text: 'Text with "quotes" and \\backslashes\\',
        providerName: "openai",
        modelId: "gpt-4o",
        json: true,
      });

      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.text).toBe('Text with "quotes" and \\backslashes\\');
    });
  });
});
