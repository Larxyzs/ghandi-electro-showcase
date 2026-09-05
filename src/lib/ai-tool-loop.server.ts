/**
 * Transport layer for Cindy's tool loop.
 *
 * Two compatible paths behind one interface:
 *  - OpenAI (gpt-5.6-luna & co) → POST /v1/responses. Function tools plus a
 *    reasoning configuration are only supported there; /v1/chat/completions
 *    rejects that combination with a 400.
 *  - Gemini / Lovable gateway → the OpenAI-compatible /chat/completions shape
 *    they already speak.
 *
 * The agent keeps its own history in the familiar chat-message shape; this
 * module converts it to whichever wire format the provider needs and parses
 * the streamed answer back into { text, calls }.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
    /** Gemini 3 requires its thought signature to be echoed back verbatim. */
    extra_content?: { google?: { thought_signature: string } };
  }[];
  tool_call_id?: string;
};

export type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type StreamToolCall = { id: string; name: string; args: string; signature?: string };

export type AgentTransport = "responses" | "chat";

/** OpenAI models use the Responses API; everything else stays on chat completions. */
export function transportFor(provider: string): AgentTransport {
  return provider === "openai" ? "responses" : "chat";
}

/** Reasoning effort for the Responses path (configurable, never hardcoded per model). */
export function reasoningEffort(): "minimal" | "low" | "medium" | "high" {
  const value = (process.env["OPENAI_REASONING_EFFORT"] ?? "medium").trim().toLowerCase();
  return value === "minimal" || value === "low" || value === "high" ? value : "medium";
}

/** Turns the /chat/completions base URL into the /responses one. */
export function responsesUrl(chatUrl: string) {
  return chatUrl.replace(/\/chat\/completions\/?$/, "/responses");
}

type ResponsesInputItem =
  | { role: "user" | "assistant"; content: { type: "input_text" | "output_text"; text: string }[] }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string };

/** Chat history → Responses `input` items (+ `instructions` from the system turn). */
export function toResponsesInput(history: ChatMessage[]): {
  instructions: string;
  input: ResponsesInputItem[];
} {
  let instructions = "";
  const input: ResponsesInputItem[] = [];
  for (const message of history) {
    if (message.role === "system") {
      instructions += (instructions ? "\n\n" : "") + (message.content ?? "");
      continue;
    }
    if (message.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: message.tool_call_id ?? "",
        output: message.content ?? "",
      });
      continue;
    }
    const text = (message.content ?? "").trim();
    if (text) {
      input.push({
        role: message.role,
        content: [
          {
            type: message.role === "assistant" ? "output_text" : "input_text",
            text,
          },
        ],
      });
    }
    for (const call of message.tool_calls ?? []) {
      input.push({
        type: "function_call",
        call_id: call.id,
        name: call.function.name,
        arguments: call.function.arguments || "{}",
      });
    }
  }
  return { instructions, input };
}

/** Builds the streaming request for the active provider. */
export function buildAgentRequest(options: {
  transport: AgentTransport;
  model: string;
  history: ChatMessage[];
  tools: ToolSchema[];
}): Record<string, unknown> {
  if (options.transport === "responses") {
    const { instructions, input } = toResponsesInput(options.history);
    return {
      model: options.model,
      stream: true,
      // Responses API reasoning configuration — never `reasoning_effort` on chat.
      reasoning: { effort: reasoningEffort() },
      tools: options.tools.map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: false,
      })),
      tool_choice: "auto",
      ...(instructions ? { instructions } : {}),
      input,
    };
  }
  return {
    model: options.model,
    stream: true,
    tools: options.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    })),
    messages: options.history,
  };
}

type StreamEvent = Record<string, unknown>;

/** Parses a streamed answer from either wire format into text + tool calls. */
export async function parseAgentStream(
  transport: AgentTransport,
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
  fallbackId: (index: number) => string,
): Promise<{ text: string; calls: StreamToolCall[] }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const pending = new Map<string | number, StreamToolCall>();

  const handle = (event: StreamEvent) => {
    if (transport === "responses") {
      const type = String(event["type"] ?? "");
      if (type === "response.output_text.delta") {
        const delta = String(event["delta"] ?? "");
        if (delta) {
          text += delta;
          onDelta(delta);
        }
        return;
      }
      if (type === "response.function_call_arguments.delta") {
        const key = String(event["item_id"] ?? event["output_index"] ?? 0);
        const current = pending.get(key) ?? { id: key, name: "", args: "" };
        current.args += String(event["delta"] ?? "");
        pending.set(key, current);
        return;
      }
      if (type === "response.output_item.added" || type === "response.output_item.done") {
        const item = event["item"] as
          | { type?: string; id?: string; call_id?: string; name?: string; arguments?: string }
          | undefined;
        if (!item || item.type !== "function_call") return;
        const key = String(item.id ?? item.call_id ?? pending.size);
        const current = pending.get(key) ?? { id: "", name: "", args: "" };
        current.id = item.call_id ?? current.id || key;
        if (item.name) current.name = item.name;
        if (item.arguments) current.args = item.arguments;
        pending.set(key, current);
      }
      return;
    }

    const delta = (
      event["choices"] as
        | {
            delta?: {
              content?: string | null;
              tool_calls?: {
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
                extra_content?: { google?: { thought_signature?: string } };
              }[];
            };
          }[]
        | undefined
    )?.[0]?.delta;
    if (delta?.content) {
      text += delta.content;
      onDelta(delta.content);
    }
    for (const call of delta?.tool_calls ?? []) {
      const index = call.index ?? 0;
      const current = pending.get(index) ?? { id: call.id ?? fallbackId(index), name: "", args: "" };
      if (call.id) current.id = call.id;
      if (call.function?.name) current.name = call.function.name;
      if (call.function?.arguments) current.args += call.function.arguments;
      const signature = call.extra_content?.google?.thought_signature;
      if (signature) current.signature = signature;
      pending.set(index, current);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          handle(JSON.parse(payload) as StreamEvent);
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
  }

  return { text, calls: [...pending.values()].filter((call) => call.name) };
}
