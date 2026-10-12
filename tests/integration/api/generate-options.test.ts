import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/generate-options/route";
import { questionOptionsSchema } from "@/app/schemas/questionOptions";

vi.mock("ai", () => ({
  streamObject: vi.fn(() => ({
    toTextStreamResponse: vi.fn(() => new Response("Mocked stream response")),
  })),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mocked-anthropic-model"),
}));

describe("Generate Options API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Request Validation", () => {
    it("should return 400 when questionText is missing", async () => {
      // Arrange
      const req = new Request("http://localhost/api/generate-options", {
        method: "POST",
        body: JSON.stringify({ conversationSummary: "Context" }),
      });

      // Act
      const response = await POST(req);

      // Assert
      expect(response.status).toBe(400);
      expect(await response.text()).toBe("questionText is required");
    });

    it("should return 400 when questionText is not a string", async () => {
      // Arrange
      const req = new Request("http://localhost/api/generate-options", {
        method: "POST",
        body: JSON.stringify({ questionText: 123 }),
      });

      // Act
      const response = await POST(req);

      // Assert
      expect(response.status).toBe(400);
      expect(await response.text()).toBe("questionText is required");
    });
  });

  describe("Model Selection", () => {
    it("should use ANTHROPIC_MODEL when set", async () => {
      // Arrange
      const { anthropic } = await import("@ai-sdk/anthropic");
      const originalModel = process.env.ANTHROPIC_MODEL;
      process.env.ANTHROPIC_MODEL = "claude-3-opus";

      const req = new Request("http://localhost/api/generate-options", {
        method: "POST",
        body: JSON.stringify({ questionText: "What is the target audience?" }),
      });

      // Act
      await POST(req);

      // Assert
      expect(anthropic).toHaveBeenCalledWith("claude-3-opus");

      // Cleanup
      if (originalModel) process.env.ANTHROPIC_MODEL = originalModel;
      else delete process.env.ANTHROPIC_MODEL;
    });

    it("should default to claude-opus-5-5 when no environment variables are set", async () => {
      // Arrange
      const { anthropic } = await import("@ai-sdk/anthropic");
      const originalModel = process.env.ANTHROPIC_MODEL;
      delete process.env.ANTHROPIC_MODEL;

      const req = new Request("http://localhost/api/generate-options", {
        method: "POST",
        body: JSON.stringify({ questionText: "What is the target audience?" }),
      });

      // Act
      await POST(req);

      // Assert
      expect(anthropic).toHaveBeenCalledWith("claude-opus-5-5");

      // Cleanup
      if (originalModel) process.env.ANTHROPIC_MODEL = originalModel;
    });
  });

  describe("streamObject usage", () => {
    it("should call streamObject with schema and forbid generic options in system prompt", async () => {
      // Arrange
      const { streamObject } = await import("ai");
      const req = new Request("http://localhost/api/generate-options", {
        method: "POST",
        body: JSON.stringify({
          questionText: "Who is the primary user?",
          conversationSummary: "The product is a scheduling assistant for teams.",
        }),
      });

      // Act
      const response = await POST(req);

      // Assert
      expect(response.status).toBe(200);
      expect(streamObject).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: questionOptionsSchema,
        })
      );

      const system = vi.mocked(streamObject).mock.calls[0]?.[0]?.system;
      expect(system).toContain("Do not include generic options");
      expect(system).toContain("Never include");
      expect(system).toContain("Other");
      expect(system).toContain("None of the above");
    });
  });
});

