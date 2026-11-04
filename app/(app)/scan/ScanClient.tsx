"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Images, Layers, RotateCcw } from "lucide-react";
import { C, SOFT, type ColorKey, type ShapeKey } from "@/lib/design";
import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { OrganicButton, ShapeIcon, SyncleMark } from "@/components/ui";
import { NewContactForm, type InitialFields } from "../customers/new/NewContactForm";
import type { CardFields } from "@/lib/card";
import type { ScanResponse } from "@/app/api/scan/route";

/** 読み取り中に外へ広がる6色（SCREENS 6） */
const SPREAD: { shape: ShapeKey; color: ColorKey }[] = [
  { shape: "flower", color: "red" },
  { shape: "clover", color: "yellow" },
  { shape: "sun", color: "green" },
  { shape: "hex", color: "blue" },
  { shape: "blob", color: "purple" },
  { shape: "drop", color: "pink" },
];

/** まとめ読みの残りを置く場所。登録で画面を離れても続けられるように。 */
const QUEUE_KEY = "syncle.scan.queue";

/** Vision に送る前に縮める。携帯の写真そのままでは大きすぎる。 */
const MAX_EDGE = 1600;

type Phase = "ready" | "reading" | "confirm" | "failed";

export function ScanClient({ workspaceId }: { workspaceId: string }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [fields, setFields] = useState<CardFields | null>(null);
  const [problem, setProblem] = useState<{ kind: string; message: string } | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<CardFields[]>([]);

  const album = useRef<HTMLInputElement>(null);
  const batch = useRef<HTMLInputElement>(null);
  // 撮影は OS のカメラに任せる。capture を付けると、選ぶ画面を出さずに
  // カメラがそのまま立ち上がる。
  //
  // 以前は画面の中にファインダーを出していたが（getUserMedia）、
  // iPhone の Safari はカメラの許可を覚えないので、開くたびに確認が出た。
  // OS のカメラならこの確認は出ない。ピントもフラッシュも効く。
  const nativeCam = useRef<HTMLInputElement>(null);

  /* ── 鍵が入っているか ── */
  useEffect(() => {
    let alive = true;
    fetch("/api/scan", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => alive && setConfigured(Boolean(d.configured)))
      .catch(() => alive && setConfigured(false));
    return () => {
      alive = false;
    };
  }, []);

  /* ── まとめ読みの残り ── */
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(QUEUE_KEY);
      if (saved) setQueue(JSON.parse(saved) as CardFields[]);
    } catch {
      // 読めなければ無かったことにする
    }
  }, []);

  const saveQueue = useCallback((rows: CardFields[]) => {
    setQueue(rows);
    try {
      if (rows.length) sessionStorage.setItem(QUEUE_KEY, JSON.stringify(rows));
      else sessionStorage.removeItem(QUEUE_KEY);
    } catch {
      // 保存できなくても、いま読んだ1枚は登録できる
    }
  }, []);

  /* ── 読み取り ── */
  const send = useCallback(async (dataUrl: string): Promise<CardFields | null> => {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: dataUrl }),
    });
    const body = (await res.json()) as ScanResponse;
    if (!body.ok) {
      setProblem({ kind: body.kind, message: body.message });
      return null;
    }
    return body.fields;
  }, []);

  const readOne = useCallback(
    async (dataUrl: string) => {
      setPhase("reading");
      setProblem(null);
      const got = await send(dataUrl);
      if (!got) {
        setPhase("failed");
        return;
      }
      setFields(got);
      setPhase("confirm");
    },
    [send]
  );

  /** 撮る。OS のカメラを開く。撮った写真は fromFiles に渡る。 */
  const shoot = useCallback(() => {
    nativeCam.current?.click();
  }, []);

  const fromFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const list = [...files];

      if (list.length === 1) {
        const dataUrl = await shrinkFile(list[0]);
        if (!dataUrl) {
          // 黙って何も起きないのがいちばん困る。理由を出す。
          setProblem({
            kind: "decode",
            message: "この写真を読み込めませんでした。別の写真か、撮り直しでお試しください。",
          });
          return;
        }
        void readOne(dataUrl);
        return;
      }

      // ── まとめ読み ──
      setPhase("reading");
      setProblem(null);

      const read: CardFields[] = [];
      for (const file of list) {
        const dataUrl = await shrinkFile(file);
        if (!dataUrl) continue;
        const got = await send(dataUrl);
        if (got) read.push(got);
      }

      if (!read.length) {
        setPhase("failed");
        return;
      }
      const [first, ...rest] = read;
      setFields(first);
      saveQueue(rest);
      setPhase("confirm");
    },
    [readOne, saveQueue, send]
  );

  /* ── 残りの1枚に進む ── */
  const nextFromQueue = useCallback(() => {
    const [head, ...rest] = queue;
    if (!head) return;
    setFields(head);
    saveQueue(rest);
    setProblem(null);
    setPhase("confirm");
  }, [queue, saveQueue]);

  /* ── 確認画面（登録フォーム） ── */
  if (phase === "confirm" && fields) {
    return (
      <>
        {queue.length > 0 && (
          <div
            className="mx-4 mt-3 px-3.5 py-2.5 text-xs font-bold"
            style={{ background: SOFT.yellow, color: "#9A6B00", borderRadius: "14px 7px 14px 7px" }}
          >
            まとめて読んだ名刺が、このあと {queue.length} 枚あります。
            1枚登録したら、スキャンに戻ると続きが出ます。
          </div>
        )}
        <NewContactForm workspaceId={workspaceId} initial={fields as InitialFields} scanned />
      </>
    );
  }

  /* ── 読み取り中 ── */
  if (phase === "reading") {
    return (
      <>
        <ScreenHeader title="スキャン" subtitle="読み取っています" />
        <div className="flex flex-col items-center justify-center gap-6 py-20">
          <div className="relative w-[126px] h-[126px] flex items-center justify-center">
            {SPREAD.map((s, i) => (
              <span
                key={s.shape}
                className="absolute anim-ring"
                style={{ animationDelay: `${i * 180}ms` }}
                aria-hidden="true"
              >
                <ShapeIcon shape={s.shape} color={s.color} size={116} />
              </span>
            ))}
            <span className="relative">
              <SyncleMark size={84} />
            </span>
          </div>
          <p className="text-sm font-bold" style={{ color: "#9AA0A6" }}>
            名刺の文字を読んでいます…
          </p>
        </div>
      </>
    );
  }

  /* ── 読み取れなかった ── */
  if (phase === "failed") {
    return (
      <>
        <ScreenHeader title="スキャン" subtitle="読み取れませんでした" />
        <div className="px-4 py-4">
          <EmptyState
            shape="drop"
            color="red"
            title="読み取れませんでした"
            desc={problem?.message ?? "もう一度撮ってみてください。"}
          >
            <div className="flex flex-col gap-2 pt-1 w-full">
              <OrganicButton
                type="button"
                size="md"
                color="green"
                onClick={() => {
                  setProblem(null);
                  setPhase("ready");
                }}
              >
                <RotateCcw size={15} strokeWidth={3} />
                もう一度撮る
              </OrganicButton>
              <Link href="/customers/new" className="block">
                <OrganicButton type="button" size="md" variant="outline" color="purple" className="w-full">
                  手入力で登録する
                </OrganicButton>
              </Link>
            </div>
          </EmptyState>
        </div>
      </>
    );
  }

  /* ── 撮影画面 ── */
  return (
    <>
      <ScreenHeader title="スキャン" subtitle="名刺を枠いっぱいに写してください" />

      <div className="px-4 py-4 space-y-4">
        {configured === false && (
          <div
            className="px-3.5 py-3 text-xs font-bold"
            style={{ background: SOFT.orange, color: "#8A4B00", borderRadius: "14px 7px 14px 7px" }}
          >
            読み取りの鍵がまだ入っていないので、撮っても文字は読めません。
            いまは手入力で登録してください。
          </div>
        )}

        {queue.length > 0 && (
          <button
            type="button"
            onClick={nextFromQueue}
            className="w-full px-3.5 py-3 text-xs font-bold text-left"
            style={{ background: SOFT.yellow, color: "#9A6B00", borderRadius: "14px 7px 14px 7px" }}
          >
            まとめて読んだ名刺が {queue.length} 枚残っています。続けて登録する →
          </button>
        )}

        {/* ── 撮り方の案内（名刺の縦横比 91:55）── */}
        <button
          type="button"
          onClick={shoot}
          aria-label="カメラを開いて名刺を撮る"
          className="relative w-full flex flex-col items-center justify-center gap-2 bg-white"
          style={{
            aspectRatio: "91 / 55",
            borderRadius: "26px 13px 26px 13px",
            border: `2.5px dashed ${C.line}`,
          }}
        >
          <ShapeIcon shape="square" color="green" size={40} />
          <span className="text-sm font-extrabold">名刺を撮る</span>
          <span className="text-[11px] font-bold px-6 text-center" style={{ color: "#9AA0A6" }}>
            押すとカメラが開きます。名刺を枠いっぱいに、明るい場所で撮ってください。
          </span>
        </button>

        {/* ── 中央にシンボル、両脇にアルバムと一括（SCREENS 6）── */}
        <div className="flex items-center justify-center gap-6 pt-1">
          <SideButton
            label="写真から"
            onClick={() => album.current?.click()}
            icon={<Images size={20} strokeWidth={2.5} style={{ color: C.blue }} />}
          />

          <button
            type="button"
            onClick={shoot}
            aria-label="名刺を撮る"
            className="anim-iconpop"
          >
            <SyncleMark size={92} />
          </button>

          <SideButton
            label="まとめて"
            onClick={() => batch.current?.click()}
            icon={<Layers size={20} strokeWidth={2.5} style={{ color: C.purple }} />}
          />
        </div>

        <Link href="/customers/new" className="block pt-1">
          <OrganicButton type="button" size="md" variant="outline" color="purple" className="w-full">
            手入力で登録する
          </OrganicButton>
        </Link>

        {problem && (
          <p className="text-xs font-bold px-1" style={{ color: C.red }}>
            {problem.message}
          </p>
        )}
      </div>

      {/* 画像の選び口。カメラが開けない端末ではこちらが本線になる */}
      <input
        ref={album}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void fromFiles(e.target.files)}
      />
      <input
        ref={batch}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void fromFiles(e.target.files)}
      />
      {/* capture を付けると、選ぶ画面を出さずに OS のカメラが開く */}
      <input
        ref={nativeCam}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void fromFiles(e.target.files)}
      />
    </>
  );
}

function SideButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span
        className="w-12 h-12 flex items-center justify-center bg-white"
        style={{ border: `2px solid ${C.line}`, borderRadius: "16px 8px 16px 8px" }}
      >
        {icon}
      </span>
      <span className="text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
        {label}
      </span>
    </button>
  );
}

/* ── 画像を縮める ───────────────────────────────────────── */

function toJpeg(source: CanvasImageSource, width: number, height: number): string {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * 写真を縮めて JPEG にする。
 *
 * createImageBitmap が無い／失敗する端末がある（古い Safari、HEIC など）。
 * そこで止まると「押しても何も起きない」になるので、
 * img 要素で読み直す道も用意しておく。
 */
async function shrinkFile(file: File): Promise<string | null> {
  if (file.type && !file.type.startsWith("image/")) return null;

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (bitmap) {
      const out = toJpeg(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      return out;
    }
  }

  return viaImgElement(file);
}

function viaImgElement(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const out = toJpeg(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
