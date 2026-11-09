import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { SYSTEM_PROMPT, draftPrompt, revisePrompt, type DraftInput, type MailContext } from "./mail-compose";

/**
 * AIメールの下書き（SCREENS 9・SPEC 6章）。
 *
 * 使う AI は環境変数で決まる（サーバー専用。NEXT_PUBLIC_ を付けないこと）
 *   GEMINI_API_KEY      Google の Gemini を使う（こちらを優先）
 *     GEMINI_MODEL      任意。無ければ gemini-3.5-flash-lite
 *   ANTHROPIC_API_KEY   Gemini のキーが無ければ Claude を使う
 *     ANTHROPIC_MODEL   任意。無ければ SPEC 1章のとおり claude-sonnet-4-6
 *
 * Gemini の無料枠は、送った内容と答えを Google が製品の改善に使い、人が読むこともある（Gemini API の規約）。
 * お客さまのメール本文を送るので、課金を有効にした Google Cloud プロジェクトのキーを使うこと
 * （その場合は使われない。下書き1通あたり1円にも届かない）。
 *
 * 下書きを返すだけで、送らない。送るのは人が押したとき（lib/gmail-send.ts）。
 */

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

const Draft = z.object({
  subject: z.string().describe("件名"),
  body: z.string().describe("本文。宛名から結びまで。署名は書かない"),
});

export type DraftResult = { subject: string; body: string } | { error: string };

const geminiKey = () => process.env.GEMINI_API_KEY?.trim() || null;

export function aiConfigured(): boolean {
  return Boolean(geminiKey() || process.env.ANTHROPIC_API_KEY?.trim());
}

/** どちらの AI を使っているか（画面の小さな表示用） */
export function aiName(): string {
  return geminiKey() ? "Gemini" : "Claude";
}

async function ask(prompt: string): Promise<DraftResult> {
  if (!aiConfigured()) return { error: "AIの設定（GEMINI_API_KEY）がまだです。下書きは手で書けます。" };
  return geminiKey() ? askGemini(prompt, geminiKey() as string) : askClaude(prompt);
}

/* ── Gemini ───────────────────────────────────────────────── */

const DRAFT_JSON_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string", description: "件名" },
    body: { type: "string", description: "本文。宛名から結びまで。署名は書かない" },
  },
  required: ["subject", "body"],
  additionalProperties: false,
};

async function askGemini(prompt: string, apiKey: string): Promise<DraftResult> {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: DRAFT_JSON_SCHEMA,
        maxOutputTokens: 4000,
      },
    });

    const reason = response.candidates?.[0]?.finishReason;
    if (reason === "SAFETY" || reason === "RECITATION" || reason === "OTHER" || response.promptFeedback?.blockReason) {
      return { error: "この内容では下書きを作れませんでした。盛り込みたいことを変えてお試しください。" };
    }
    if (reason === "MAX_TOKENS") {
      return { error: "下書きが長くなりすぎました。盛り込みたいことを減らしてお試しください。" };
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(response.text ?? "");
    } catch {
      parsed = null;
    }
    const draft = Draft.safeParse(parsed);
    if (!draft.success || !draft.data.subject || !draft.data.body) {
      return { error: "下書きを読み取れませんでした。もう一度お試しください。" };
    }
    return { subject: draft.data.subject.trim().slice(0, 200), body: draft.data.body.trim() };
  } catch (e) {
    if (e instanceof ApiError) {
      console.error(`[ai-mail] gemini status=${e.status} ${e.message.slice(0, 300)}`);
      if (e.status === 400 && /api key/i.test(e.message)) return { error: "Gemini の API キーが正しくありません（GEMINI_API_KEY）。" };
      if (e.status === 401 || e.status === 403) return { error: "Gemini の API キーが使えません（GEMINI_API_KEY）。" };
      if (e.status === 404) return { error: "Gemini のモデル名が違います（GEMINI_MODEL）。" };
      if (e.status === 429) return { error: "AIへの問い合わせが多すぎます（無料枠の上限かもしれません）。少し待ってからお試しください。" };
      return { error: `AIに断られました（${e.status}）。少し待ってからお試しください。` };
    }
    throw e;
  }
}

/* ── Claude ───────────────────────────────────────────────── */

async function askClaude(prompt: string): Promise<DraftResult> {

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
