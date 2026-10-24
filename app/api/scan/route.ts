import { NextResponse } from "next/server";
import { requireCurrent } from "@/lib/workspace";
import { readCard, visionConfigured } from "@/lib/vision";
import { parseCard, type CardFields } from "@/lib/card";

/**
 * 名刺の画像を受けて、読み取った文字を各欄に振り分けて返す（フェーズ4）。
 *
 * node:crypto で JWT に署名するので Node で動かす。Edge では動かない。
 */
export const runtime = "nodejs";

// 画像は 10MB まで。携帯のカメラそのままだと超えることがあるので、
// 画面側で縮めてから送っている。ここは最後の砦。
const MAX_BYTES = 10 * 1024 * 1024;

export type ScanResponse =
  | { ok: true; fields: CardFields; text: string }
  | { ok: false; kind: string; message: string };

export async function GET() {
  // 画面が「カメラを出してよいか」を判断するために使う
  await requireCurrent();
  return NextResponse.json({ configured: visionConfigured() });
}

export async function POST(request: Request) {
  // ログインしていない人に読み取りを使わせない（Vision は従量課金）
  await requireCurrent();

  let image: string;
  try {
    const body = (await request.json()) as { image?: string };
    image = String(body.image ?? "");
  } catch {
    return bad("image_missing", "画像を受け取れませんでした。");
  }

  // data:image/jpeg;base64,xxxx の形でも素の base64 でも受ける
  const base64 = image.replace(/^data:[^;]+;base64,/, "").trim();
  if (!base64) return bad("image_missing", "画像を受け取れませんでした。");

  // base64 は元の約4/3の長さになる
  if (base64.length * 0.75 > MAX_BYTES) {
    return bad("too_large", "画像が大きすぎます。もう一度撮ってください。");
  }

  const result = await readCard(base64);
  if (!result.ok) {
    return NextResponse.json<ScanResponse>(
      { ok: false, kind: result.failure.kind, message: result.failure.message },
      // 鍵が無いのは利用者の操作ミスではない。画面は手入力へ案内する。
      { status: result.failure.kind === "unconfigured" ? 503 : 502 }
    );
  }

  if (!result.text.trim()) {
    return bad("empty", "文字を読み取れませんでした。明るい場所で、枠いっぱいに写してください。");
  }

  return NextResponse.json<ScanResponse>({
    ok: true,
    fields: parseCard(result.text),
    text: result.text,
  });
}

function bad(kind: string, message: string) {
  return NextResponse.json<ScanResponse>({ ok: false, kind, message }, { status: 400 });
}
