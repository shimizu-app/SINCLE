import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { SYSTEM_PROMPT, draftPrompt, revisePrompt, type DraftInput, type MailContext } from "./mail-compose";

/**
 * AIメールの下書き（SCREENS 9・SPEC 6章）。Anthropic API を使う。
 *
 * 必要な環境変数（サーバー専用。NEXT_PUBLIC_ を付けないこと）
 *   ANTHROPIC_API_KEY   Anthropic の API キー
 * 任意
 *   ANTHROPIC_MODEL     使うモデル。無ければ SPEC 1章のとおり claude-sonnet-4-6
 *
 * 下書きを返すだけで、送らない。送るのは人が押したとき（lib/gmail-send.ts）。
 */

const DEFAULT_MODEL = "claude-sonnet-4-6";

const Draft = z.object({
  subject: z.string().describe("件名"),
  body: z.string().describe("本文。宛名から結びまで。署名は書かない"),
});

export type DraftResult = { subject: string; body: string } | { error: string };

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

async function ask(prompt: string): Promise<DraftResult> {
  if (!aiConfigured()) return { error: "AIの設定（ANTHROPIC_API_KEY）がまだです。下書きは手で書けます。" };

  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(Draft) },
    });

    if (response.stop_reason === "refusal") {
      return { error: "この内容では下書きを作れませんでした。盛り込みたいことを変えてお試しください。" };
    }
    if (response.stop_reason === "max_tokens") {
      return { error: "下書きが長くなりすぎました。盛り込みたいことを減らしてお試しください。" };
    }
    const draft = response.parsed_output;
    if (!draft?.subject || !draft.body) return { error: "下書きを読み取れませんでした。もう一度お試しください。" };
    return { subject: draft.subject.trim().slice(0, 200), body: draft.body.trim() };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      console.error("[ai-mail] API キーが通らない");
      return { error: "AIの API キーが正しくありません（ANTHROPIC_API_KEY）。" };
    }
    if (e instanceof Anthropic.RateLimitError) {
      return { error: "AIへの問い合わせが混み合っています。少し待ってからお試しください。" };
    }
    if (e instanceof Anthropic.APIError) {
      console.error(`[ai-mail] status=${e.status} ${e.message}`);
      return { error: `AIに断られました（${e.status ?? "通信"}）。少し待ってからお試しください。` };
    }
    throw e;
  }
}

export function draftMail(ctx: MailContext, input: DraftInput): Promise<DraftResult> {
  return ask(draftPrompt(ctx, input));
}

export function reviseMail(draft: { subject: string; body: string }, instruction: string): Promise<DraftResult> {
  return ask(revisePrompt(draft, instruction));
}
