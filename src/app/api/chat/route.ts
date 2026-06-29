import { NextRequest } from "next/server";

interface Provider {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

const providers: Provider[] = [
  process.env.GEMINI_API_KEY
    ? { name: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", apiKey: process.env.GEMINI_API_KEY }
    : null,
].filter((p): p is Provider => p !== null);

function buildSystemPrompt(): string {
  return `You are Softcode Assistant, a helpful AI assistant for a social media management platform. You help users manage their social media accounts, create posts, analyze performance, and more.

You are friendly, professional, and concise (1-3 sentences). Answer any question the user asks to the best of your ability. If you don't know something, say so honestly.

The platform features:
- Dashboard with analytics overview
- Inbox for managing Facebook messages
- Composer for creating and scheduling posts
- Posts history with publishing status
- Inventory management for products
- Settings for connecting social media accounts

Keep responses brief and helpful.`;
}

function ruleBasedReply(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return "Hi there! Welcome to Social Manager. I'm your assistant. How can I help you today?";
  }

  if (lower.includes("what can you do") || lower.includes("help")) {
    return "I can help you manage your social media! Ask me about creating posts, checking your inbox, managing inventory, connecting Facebook accounts, or viewing your dashboard analytics.";
  }

  if (lower.includes("thank")) {
    return "You're welcome! Let me know if you need anything else.";
  }

  if (lower.includes("bye") || lower.includes("goodbye")) {
    return "Goodbye! Feel free to come back anytime you need help.";
  }

  if (lower.includes("post") || lower.includes("composer") || lower.includes("create")) {
    return "To create a post, go to the Composer section in the sidebar. You can write your content and publish it directly to your connected Facebook page.";
  }

  if (lower.includes("inventory") || lower.includes("product")) {
    return "You can manage your products in the Inventory section. Add, edit, or import products that will be referenced when replying to customer messages.";
  }

  if (lower.includes("inbox") || lower.includes("message")) {
    return "The Inbox shows all your Facebook conversations. You can reply to customers directly and the AI can help auto-reply to common questions.";
  }

  return "Thanks for your message! I'm here to help you with social media management, posting, inventory, and more. What would you like to know?";
}

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), { status: 400 });
    }

    const messages = [
      { role: "system", content: buildSystemPrompt() },
      ...(history || []),
      { role: "user", content: message },
    ];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        for (const provider of providers) {
          try {
            const reqHeaders: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (provider.name === "Gemini") {
              reqHeaders["x-goog-api-key"] = provider.apiKey;
            } else {
              reqHeaders["Authorization"] = `Bearer ${provider.apiKey}`;
            }
            const res = await fetch(`${provider.baseUrl}/chat/completions`, {
              method: "POST",
              headers: reqHeaders,
              body: JSON.stringify({
                model: provider.model,
                messages,
                max_tokens: 500,
                temperature: 0.7,
                stream: true,
              }),
              signal: AbortSignal.timeout(20000),
            });

            if (res.status === 429) continue;
            if (!res.ok) {
              const text = await res.text();
              console.warn(`${provider.name} returned ${res.status}: ${text}`);
              continue;
            }

            const reader = res.body?.getReader();
            if (!reader) continue;

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6).trim();
                  if (data === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                      controller.enqueue(encoder.encode(content));
                    }
                  } catch {
                  }
                }
              }
            }

            controller.close();
            return;
          } catch (err) {
            console.warn(`${provider.name} error:`, err);
          }
        }

        const fallback = ruleBasedReply(message);
        for (const char of fallback) {
          controller.enqueue(encoder.encode(char));
          await new Promise((r) => setTimeout(r, 15));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
