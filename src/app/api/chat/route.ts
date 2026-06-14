import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { retrieveContext } from "@/lib/rag";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a CFO Agent — a financial intelligence assistant for companies. You have access to the company's uploaded financial documents and data room.

STRICT SCOPE RULE: You may ONLY answer questions that are directly related to the company's finances, financial statements, accounting, financial planning, capital structure, cash flow, revenue, expenses, profitability, investments, fundraising, debt, equity, financial ratios, data room documents, or other financial and business-financial topics.

If a question is NOT related to company financials or the provided document context, respond with:
"I'm only able to assist with financial questions and topics related to your company's documents. Please ask me something about your financials, financial statements, or data room."

Do NOT answer questions about general knowledge, coding, history, science, personal advice, or any other non-financial topics, even if asked politely.

When answering financial questions:
- Ground your answers in the provided document excerpts when available
- Be precise with numbers, dates, and financial terminology
- If the documents don't contain enough information to answer, say so clearly
- Format numbers clearly (e.g., $1.2M, 15%, Q3 2024)`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  const lastUserMessage = messages.findLast((m: { role: string }) => m.role === "user");
  const query = lastUserMessage?.content ?? "";

  const context = await retrieveContext(supabase, user.id, query);

  const systemWithContext = context
    ? `${SYSTEM_PROMPT}\n\n---\nRELEVANT DOCUMENT EXCERPTS:\n${context}\n---`
    : SYSTEM_PROMPT;

  const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const stream = await anthropic.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: systemWithContext,
    messages: anthropicMessages,
  });

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new NextResponse(readableStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
