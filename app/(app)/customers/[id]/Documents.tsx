"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Download, Plus, Star, Trash2 } from "lucide-react";
import { C, SOFT, DOC_KIND } from "@/lib/design";
import { OrganicButton, Sheet, ShapeIcon } from "@/components/ui";
import {
  documentUrl, removeDocument, updateDocument, uploadDocument, type DocResult,
} from "../document-actions";
import type { DocKind } from "@/types/db";

export type DocRow = {
  id: string;
  name: string;
  kind: DocKind;
  note: string | null;
  pinned: boolean;
  size_bytes: number | null;
  created_at: string;
};

const KINDS = Object.keys(DOC_KIND) as DocKind[];
const field = { borderRadius: "22px 11px 22px 11px", border: `2px solid ${C.line}` } as const;

function size(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function Documents({ companyId, docs }: { companyId: string; docs: DocRow[] }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<DocKind | null>(null);
  const [state, action, pending] = useActionState<DocResult, FormData>(uploadDocument, undefined);
  const [, start] = useTransition();

  useEffect(() => {
    if (state && "ok" in state) setOpen(false);
  }, [state]);

  const pinned = docs.filter((d) => d.pinned);
  const rest = docs.filter((d) => !d.pinned && (!filter || d.kind === filter));
  const used = new Set(docs.map((d) => d.kind));

  async function openFile(id: string) {
    const result = await documentUrl(id);
    if ("url" in result && result.url) window.open(result.url, "_blank", "noopener");
  }

  return (
    <div className="space-y-3">
      {docs.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-bar">
          <button
            onClick={() => setFilter(null)}
            className={`text-xs font-bold px-3 py-1.5 shrink-0 ${!filter ? "anim-chip" : ""}`}
            style={chip(!filter, "purple")}
          >
            すべて
          </button>
          {KINDS.filter((k) => used.has(k)).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(filter === k ? null : k)}
              className={`text-xs font-bold px-3 py-1.5 shrink-0 ${filter === k ? "anim-chip" : ""}`}
              style={chip(filter === k, DOC_KIND[k].color)}
            >
              {DOC_KIND[k].label}
            </button>
          ))}
        </div>
      )}

      {pinned.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold px-1" style={{ color: C.yellow }}>
            よく使う
          </div>
          {pinned.map((doc, i) => (
            <DocCard key={doc.id} doc={doc} index={i} onOpen={openFile} start={start} />
          ))}
        </div>
      )}

      {rest.length === 0 && pinned.length === 0 ? (
        <p className="text-xs font-bold px-1 py-6" style={{ color: "#C8C2B6" }}>
          書類はまだありません。契約書・見積書・提案書などを置いておけます。
        </p>
      ) : (
        rest.map((doc, i) => (
          <DocCard key={doc.id} doc={doc} index={i} onOpen={openFile} start={start} />
        ))
      )}

      <OrganicButton type="button" size="lg" color="blue" className="w-full" onClick={() => setOpen(true)}>
        <Plus size={16} strokeWidth={3} />
        書類をあげる
      </OrganicButton>

      <Sheet open={open} onClose={() => setOpen(false)} title="書類" subtitle="種類を決めて置いておけます">
        <form action={action} className="space-y-3">
          <input type="hidden" name="companyId" value={companyId} />
          <input
            type="file"
            name="file"
            required
            className="w-full px-4 py-3 text-sm bg-white outline-none file:mr-3 file:px-3 file:py-1.5 file:text-xs file:font-bold file:border-0 file:rounded-lg"
            style={field}
          />
          <select
            name="kind"
            defaultValue="other"
            className="w-full px-4 py-3 text-sm bg-white outline-none"
            style={field}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {DOC_KIND[k].label}
              </option>
            ))}
          </select>
          <input
            name="note"
            placeholder="メモ（任意）"
            className="w-full px-4 py-3 text-sm bg-white outline-none"
            style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
          />
          {state && "error" in state && state.error && (
            <p className="text-xs font-bold" style={{ color: C.red }} role="alert">
              {state.error}
            </p>
          )}
          <OrganicButton type="submit" size="lg" color="blue" className="w-full" disabled={pending}>
            {pending ? "あげています…" : "あげる"}
          </OrganicButton>
        </form>
      </Sheet>
    </div>
  );
}

function DocCard({
  doc, index, onOpen, start,
}: {
  doc: DocRow;
  index: number;
  onOpen: (id: string) => void;
  start: (fn: () => void) => void;
}) {
  const look = DOC_KIND[doc.kind] ?? DOC_KIND.other;
  return (
    <div
      className="flex items-start gap-3 p-3.5 bg-white anim-item"
      style={{
        borderRadius: index % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
        border: `2px solid ${doc.pinned ? C.yellow : C.line}`,
      }}
    >
      <ShapeIcon shape={look.shape} color={look.color} size={38} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold break-words">{doc.name}</div>
        <div className="text-[11px] font-bold mt-0.5" style={{ color: "#9AA0A6" }}>
          {look.label}
          {doc.size_bytes ? ` ・ ${size(doc.size_bytes)}` : ""}
        </div>
        {doc.note && (
          <div className="text-[11px] font-bold mt-1" style={{ color: "#6B6B6B" }}>
            {doc.note}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => void onOpen(doc.id)}
            className="inline-flex items-center gap-1 text-[11px] font-bold"
            style={{ color: C.blue }}
          >
            <Download size={12} strokeWidth={2.5} />
            開く
          </button>
          <button
            type="button"
            onClick={() => start(() => void updateDocument(doc.id, { pinned: !doc.pinned }))}
            className="inline-flex items-center gap-1 text-[11px] font-bold"
            style={{ color: doc.pinned ? C.yellow : "#9AA0A6" }}
          >
            <Star size={12} strokeWidth={2.5} fill={doc.pinned ? "currentColor" : "none"} />
            {doc.pinned ? "よく使うから外す" : "よく使う"}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            aria-label="削除"
            onClick={() => start(() => void removeDocument(doc.id))}
          >
            <Trash2 size={13} strokeWidth={2.5} style={{ color: "#C8C2B6" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

function chip(on: boolean, tone: string) {
  return {
    background: on ? SOFT[tone as keyof typeof SOFT] : "#fff",
    color: on ? C[tone as keyof typeof C] : "#9AA0A6",
    border: `2px solid ${on ? C[tone as keyof typeof C] : C.line}`,
    borderRadius: "14px 7px 14px 7px",
  } as const;
}
