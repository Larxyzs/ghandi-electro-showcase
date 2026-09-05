import { describe, expect, it } from "vitest";
import {
  buildAgentRequest,
  parseAgentStream,
  responsesUrl,
  toResponsesInput,
  transportFor,
  type ChatMessage,
  type ToolSchema,
} from "../src/lib/ai-tool-loop.server";

const TOOL: ToolSchema = {
  name: "get_site_overview",
  description: "Lit tout le site.",
  parameters: { type: "object", properties: {}, required: [] },
};

function sse(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

describe("gpt-5.6-luna + function tools + reasoning", () => {
  it("routes OpenAI tool calling to /v1/responses", () => {
    expect(transportFor("openai")).toBe("responses");
    expect(responsesUrl("https://api.openai.com/v1/chat/completions")).toBe(
      "https://api.openai.com/v1/responses",
    );
    expect(transportFor("gemini")).toBe("chat");
  });

  it("sends flat function tools + reasoning, never reasoning_effort", () => {
    const body = buildAgentRequest({
      transport: "responses",
      model: "gpt-5.6-luna",
      history: [
        { role: "system", content: "Tu es Cindy." },
        { role: "user", content: "Combien d'articles sur le site ?" },
      ],
      tools: [TOOL],
    });
    const json = JSON.stringify(body);
    expect(body["model"]).toBe("gpt-5.6-luna");
    expect(body["reasoning"]).toEqual({ effort: "medium" });
    expect(json).not.toContain("reasoning_effort");
    expect(json).not.toContain('"messages"');
    expect(body["tools"]).toEqual([
      {
        type: "function",
        name: "get_site_overview",
        description: "Lit tout le site.",
        parameters: { type: "object", properties: {}, required: [] },
        strict: false,
      },
    ]);
    expect(body["instructions"]).toBe("Tu es Cindy.");
    expect(body["input"]).toEqual([
      { role: "user", content: [{ type: "input_text", text: "Combien d'articles sur le site ?" }] },
    ]);
  });

  it("keeps the chat-completions shape for Gemini/gateway providers", () => {
    const body = buildAgentRequest({
      transport: "chat",
      model: "gemini-3.7-flash",
      history: [{ role: "user", content: "Salut" }],
      tools: [TOOL],
    });
    expect(body["reasoning"]).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("reasoning_effort");
    expect(Array.isArray(body["messages"])).toBe(true);
  });

  it("completes the full Responses tool loop: call → result → final answer", async () => {
    const first = await parseAgentStream(
      "responses",
      sse([
        {
          type: "response.output_item.added",
          item: { type: "function_call", id: "fc_1", call_id: "call_abc", name: "get_site_overview" },
        },
        { type: "response.function_call_arguments.delta", item_id: "fc_1", delta: "{}" },
        {
          type: "response.output_item.done",
          item: {
            type: "function_call",
            id: "fc_1",
            call_id: "call_abc",
            name: "get_site_overview",
            arguments: "{}",
          },
        },
      ]),
      () => {},
      (index) => `call-0-${index}`,
    );
    expect(first.calls).toHaveLength(1);
    expect(first.calls[0]).toMatchObject({ id: "call_abc", name: "get_site_overview", args: "{}" });

    // Cindy executes the real tool, then sends the result back.
    const history: ChatMessage[] = [
      { role: "system", content: "Tu es Cindy." },
      { role: "user", content: "Combien d'articles ?" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_abc",
            type: "function",
            function: { name: "get_site_overview", arguments: "{}" },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_abc", content: '{"products":36}' },
    ];
    const { input } = toResponsesInput(history);
    expect(input).toEqual([
      { role: "user", content: [{ type: "input_text", text: "Combien d'articles ?" }] },
      { type: "function_call", call_id: "call_abc", name: "get_site_overview", arguments: "{}" },
      { type: "function_call_output", call_id: "call_abc", output: '{"products":36}' },
    ]);

    const deltas: string[] = [];
    const second = await parseAgentStream(
      "responses",
      sse([
        { type: "response.output_text.delta", delta: "Il y a " },
        { type: "response.output_text.delta", delta: "36 articles." },
        { type: "response.completed" },
      ]),
      (delta) => deltas.push(delta),
      (index) => `call-1-${index}`,
    );
    expect(second.calls).toHaveLength(0);
    expect(second.text).toBe("Il y a 36 articles.");
    expect(deltas.join("")).toBe("Il y a 36 articles.");
  });
});
