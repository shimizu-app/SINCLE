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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [queue, setQueue] = useState<CardFields[]>([]);

  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const album = useRef<HTMLInputElement>(null);
  const batch = useRef<HTMLInputElement>(null);

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

  /* ── カメラ ── */
  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    if (phase !== "ready" || configured === null) return;
    let cancelled = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("この端末ではカメラを開けません。写真から選んでください。");
        return;
      }
      try {
        const got = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          got.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = got;
        if (video.current) {
          video.current.srcObject = got;
          await video.current.play().catch(() => undefined);
        }
        setCameraError(null);
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        setCameraError(
          name === "NotAllowedError"
            ? "カメラを使う許可が下りていません。端末の設定で許可するか、写真から選んでください。"
            : "カメラを開けませんでした。写真から選んでください。"
        );
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [phase, configured, stopCamera]);

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
      stopCamera();
      const got = await send(dataUrl);
      if (!got) {
        setPhase("failed");
        return;
      }
      setFields(got);
      setPhase("confirm");
    },
    [send, stopCamera]
  );

  const shoot = useCallback(() => {
    const el = video.current;
    if (!el || !el.videoWidth) return;
    void readOne(toJpeg(el, el.videoWidth, el.videoHeight));
  }, [readOne]);

  const fromFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const list = [...files];

      if (list.length === 1) {
        const dataUrl = await shrinkFile(list[0]);
        if (dataUrl) void readOne(dataUrl);
        return;
      }

      // ── まとめ読み ──
      setPhase("reading");
      setProblem(null);
      stopCamera();

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
    [readOne, saveQueue, send, stopCamera]
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

        {/* ── ファインダー ── */}
        <div
          className="relative overflow-hidden bg-black"
          style={{ aspectRatio: "91 / 55", borderRadius: "26px 13px 26px 13px", border: `2px solid ${C.line}` }}
        >
          <video
            ref={video}
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ opacity: cameraError ? 0 : 1 }}
          />
          {cameraError && (
            <p
              className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs font-bold"
              style={{ color: "#fff" }}
            >
              {cameraError}
            </p>
          )}
        </div>

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
            disabled={Boolean(cameraError)}
            aria-label="名刺を撮る"
            className="anim-iconpop disabled:opacity-30"
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

async function shrinkFile(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  const out = toJpeg(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  return out;
}
