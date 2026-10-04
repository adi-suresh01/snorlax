import { describe, expect, it } from "vitest";
import { isReasoningModel, pickModel } from "@/lib/llm";

describe("pickModel", () => {
  it("prefers the strongest general chat model on the list", () => {
    expect(pickModel(["openai/gpt-oss-20b", "llama-3.3-70b-versatile", "whisper-large-v3"])).toBe("llama-3.3-70b-versatile");
  });

  it("falls back to any chat model, skipping speech, guard and tts models", () => {
    expect(pickModel(["whisper-large-v3", "meta-llama/llama-guard-4-12b", "playai-tts", "some-new-chat-model"])).toBe("some-new-chat-model");
  });

  it("returns null when nothing usable is listed", () => {
    expect(pickModel(["whisper-large-v3-turbo"])).toBeNull();
  });
});

describe("isReasoningModel", () => {
  it("flags gpt-oss and qwen3 style models", () => {
    expect(isReasoningModel("openai/gpt-oss-120b")).toBe(true);
    expect(isReasoningModel("qwen/qwen3-32b")).toBe(true);
    expect(isReasoningModel("llama-3.3-70b-versatile")).toBe(false);
  });
});
