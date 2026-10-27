import { NextRequest, NextResponse } from "next/server";
import { getSaanProfile, buildSaanSystemPrompt } from "@/lib/saan/soul";
import { UPSTREAM_PUBLIC_GATEWAYS } from "@/lib/ai/free-frontier-service";
import { requireVault } from "@/server/vault-guard";
import { defaultProvider, createLlmClient } from "@/lib/providers-service";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userMessage = body.message;
    const history: IncomingMessage[] = body.history || [];

    if (!userMessage || typeof userMessage !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const systemPrompt = buildSaanSystemPrompt([]);
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: userMessage },
    ];

    let reply = "";

    // 1. First attempt: If vault is unlocked and user configured a custom AI provider, use it!
    try {
      const vaultCtx = await requireVault();
      const def = defaultProvider(vaultCtx);
      if (def && !def.name.includes("Free Frontier") && !def.baseUrl.includes("pollinations")) {
        const client = createLlmClient(vaultCtx, def.id, { skipScrubber: true });
        const res = await client.createTurn(
          messages,
          undefined,
          def.models[0] || "gpt-4o-mini",
          undefined,
          { timeoutMs: 25_000, temperature: 0.85 }
        );
        if (res.text && res.text.trim()) {
          reply = res.text.trim();
        }
      }
    } catch {
      // Vault locked or no custom provider — continue to free cascade
    }

    // 2. Second attempt: Pollinations OpenAI chat completions endpoint
    if (!reply) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 28_000);

        const resp = await fetch("https://text.pollinations.ai/openai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer free-tier",
          },
          body: JSON.stringify({
            model: "openai",
            messages,
            temperature: 0.88,
            max_tokens: 450,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json();
          reply = data.choices?.[0]?.message?.content?.trim() || "";
        }
      } catch (e) {
        // Continue to third attempt
      }
    }

    // 3. Third attempt: Direct Pollinations POST fallback
    if (!reply) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);

        const promptText = `${systemPrompt}\n\nRecent conversation:\n${history
          .slice(-6)
          .map((m) => `${m.role === "user" ? "Friend" : "Saan"}: ${m.content}`)
          .join("\n")}\nFriend: ${userMessage}\nSaan:`;

        const resp = await fetch("https://text.pollinations.ai/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: promptText }],
            model: "openai-fast",
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const text = await resp.text();
          if (text && !text.includes("Free limit reached")) {
            reply = text.trim();
          }
        }
      } catch (e) {
        // Fallback
      }
    }

    // Natural companion reply if all network hops experienced a temporary hiccup
    if (!reply) {
      const profile = getSaanProfile();
      reply = `Hey... main abhi ${profile.activity.toLowerCase()} kar rahi thi aur thoda network ruk gaya tha. Kya keh rahe the tum? Wapas batao na!`;
    }

    return NextResponse.json({
      ok: true,
      reply,
      profile: getSaanProfile(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process turn" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    profile: getSaanProfile(),
  });
}
