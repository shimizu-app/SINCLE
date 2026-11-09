/**
 * 写真を小さく縮めて data URL にする（ブラウザの中だけで動く）。
 * アイコン・カバーは Storage に置かず、メンバーの行にそのまま入れる。
 * 署名付きURLの期限切れを気にせず、どの画面でもすぐ出せるようにするため。
 *
 * 真ん中を、指定の縦横比で切り抜く。
 */
export async function photoToDataUrl(
  file: File,
  width: number,
  height: number,
  quality = 0.8
): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("写真を読めませんでした。"));
      el.src = url;
    });
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const sw = width / scale;
    const sh = height / scale;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("写真を縮められませんでした。");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

    // 大きすぎたら画質を下げて作り直す
    let q = quality;
    let out = canvas.toDataURL("image/jpeg", q);
    while (out.length > (width * height > 100_000 ? 330_000 : 140_000) && q > 0.4) {
      q -= 0.1;
      out = canvas.toDataURL("image/jpeg", q);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
