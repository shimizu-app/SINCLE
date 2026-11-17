"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Building2, Clock, Trash2, Video } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { OrganicButton, Sheet } from "@/components/ui";
import { addCalendarEvent, deleteCalendarEvent, saveTask, type ActionResult, type EventResult } from "./actions";
import { hm, jst, look, minToHm, type CalendarItem } from "./calendar-util";

const DURATIONS = [15, 30, 60, 90, 120] as const;
const PRIORITIES = ["高", "中", "低"] as const;

const field = { borderRadius: "14px 7px 14px 7px", border: `2px solid ${C.line}` } as const;

/**
 * カレンダーから入れる（025）。
 *   予定：打合せ・用事。長さがあり、時間割に長さどおりに並ぶ。Google カレンダーにも入れられる
 *   タスク：やること。会社を選ばなければ「自分のTODO」（本人にだけ見える）
 */
export function CalendarAddSheet(props: {
  open: boolean;
  date: string;
  time: string;
  companies: { id: string; name: string }[];
  googleConnected: boolean;
  canWriteGoogle: boolean;
  onClose: () => void;
  onDone: (note?: string) => void;
}) {
  const [kind, setKind] = useState<"event" | "task">("event");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(props.date);
  const [time, setTime] = useState(props.time);
  const [noTime, setNoTime] = useState(false);
  const [duration, setDuration] = useState<number>(60);
  const [companyId, setCompanyId] = useState("");
  const [google, setGoogle] = useState(props.canWriteGoogle);
  const [meet, setMeet] = useState(false);
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("中");

  const [eventState, eventAction, eventPending] = useActionState<EventResult, FormData>(addCalendarEvent, undefined);
  const [taskState, taskAction, taskPending] = useActionState<ActionResult, FormData>(saveTask, undefined);

  // 開くたびに、押した日と時刻から始める
  useEffect(() => {
    if (!props.open) return;
    setTitle("");
    setDate(props.date);
    setTime(props.time);
    setNoTime(false);
    setCompanyId("");
    setGoogle(props.canWriteGoogle);
    setMeet(false);
  }, [props.open, props.date, props.time, props.canWriteGoogle]);

  const { onDone } = props;
  useEffect(() => {
    if (eventState && "ok" in eventState) onDone(eventState.note);
  }, [eventState, onDone]);
  useEffect(() => {
    if (taskState && "ok" in taskState) onDone();
  }, [taskState, onDone]);

  const pending = eventPending || taskPending;
  const error =
    kind === "event"
      ? eventState && "error" in eventState
        ? eventState.error
        : null
      : taskState && "error" in taskState
        ? taskState.error
        : null;

  const endLabel = (() => {
    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h)) return "";
    return `〜${minToHm((h * 60 + m + duration) % (24 * 60))}`;
  })();

  return (
    <Sheet open={props.open} onClose={props.onClose} title="カレンダーに入れる">
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            ["event", "予定", "打合せ・用事"],
            ["task", "タスク", "やること"],
          ] as const
        ).map(([key, label, sub]) => {
          const on = kind === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              aria-pressed={on}
              className="py-2.5 text-center"
              style={{
                background: on ? (key === "event" ? SOFT.green : SOFT.yellow) : "#fff",
                border: `2px solid ${on ? (key === "event" ? C.green : C.yellow) : C.line}`,
                borderRadius: "16px 8px 16px 8px",
              }}
            >
              <div className="text-sm font-extrabold">{label}</div>
              <div className="text-[10px] font-bold" style={{ color: "#9AA0A6" }}>
                {sub}
              </div>
            </button>
          );
        })}
      </div>

      <form action={kind === "event" ? eventAction : taskAction} className="space-y-3">
        {/* 予定とタスクで送る名前が違う */}
        {kind === "event" ? (
          <>
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="time" value={time} />
            <input type="hidden" name="duration" value={duration} />
            <input type="hidden" name="companyId" value={companyId} />
            {google && <input type="hidden" name="google" value="on" />}
            {google && meet && <input type="hidden" name="meet" value="on" />}
          </>
        ) : (
          <>
            <input type="hidden" name="dueDate" value={date} />
            <input type="hidden" name="dueTime" value={noTime ? "" : time} />
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="priority" value={priority} />
            <input type="hidden" name="share" value="assignee" />
          </>
        )}

        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder={kind === "event" ? "例：○○社と打合せ / 歯医者" : "例：見積書を送る"}
          className="w-full px-4 py-3 text-sm font-bold outline-none bg-white"
          style={field}
        />

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="block text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
              日付
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm font-bold outline-none bg-white"
              style={field}
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
              {kind === "event" ? `始まり ${endLabel}` : "時刻"}
            </span>
            <input
              type="time"
              value={time}
              step={300}
              onChange={(e) => setTime(e.target.value)}
              disabled={kind === "task" && noTime}
              required={kind === "event" || !noTime}
              className="w-full px-3 py-2.5 text-sm font-bold outline-none bg-white disabled:opacity-40"
              style={field}
            />
          </label>
        </div>

        {kind === "event" ? (
          <div className="space-y-1">
            <span className="block text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
              長さ
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {DURATIONS.map((d) => (
                <Chip key={d} on={duration === d} onClick={() => setDuration(d)}>
                  {d < 60 ? `${d}分` : d % 60 ? `${Math.floor(d / 60)}時間${d % 60}分` : `${d / 60}時間`}
                </Chip>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2 px-1 text-xs font-bold" style={{ color: "#6B6B6B" }}>
              <input type="checkbox" checked={noTime} onChange={(e) => setNoTime(e.target.checked)} className="w-4 h-4" />
              時刻を決めない（その日の「終日」に入ります）
            </label>
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => (
                <Chip key={p} on={priority === p} onClick={() => setPriority(p)}>
                  優先度 {p}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <label className="block space-y-1">
          <span className="block text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
            会社
          </span>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm font-bold outline-none bg-white"
            style={field}
          >
            <option value="">{kind === "event" ? "会社なし（自分だけの予定）" : "会社なし（自分のTODO）"}</option>
            {props.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="block text-[10px] font-bold px-1" style={{ color: "#9AA0A6" }}>
            {companyId
              ? "その会社が見える人のカレンダーにも出ます。"
              : "あなたにだけ見えます。"}
          </span>
        </label>

        {kind === "event" && props.googleConnected && (
          <div className="space-y-1.5 px-1">
            <label className="flex items-center gap-2 text-xs font-bold" style={{ color: props.canWriteGoogle ? C.ink : "#C8C2B6" }}>
              <input
                type="checkbox"
                checked={google}
                disabled={!props.canWriteGoogle}
                onChange={(e) => setGoogle(e.target.checked)}
                className="w-4 h-4"
              />
              Google カレンダーにも入れる
            </label>
            {!props.canWriteGoogle && (
              <p className="text-[10px] font-bold" style={{ color: "#9AA0A6" }}>
                予定を入れる許可がまだです。
                <a href="/api/google/connect" className="underline">
                  つなぎ直す
                </a>
                と入れられるようになります。
              </p>
            )}
            {google && (
              <label className="flex items-center gap-2 text-xs font-bold" style={{ color: C.ink }}>
                <input type="checkbox" checked={meet} onChange={(e) => setMeet(e.target.checked)} className="w-4 h-4" />
                Google Meet のリンクをつける
              </label>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
            {error}
          </p>
        )}

        <OrganicButton
          type="submit"
          size="lg"
          color={kind === "event" ? "green" : "yellow"}
          className="w-full"
          disabled={pending || !title.trim()}
        >
          {pending ? "入れています…" : kind === "event" ? "予定を入れる" : "タスクを入れる"}
        </OrganicButton>
      </form>
    </Sheet>
  );
}

/** 時間割の予定を押したとき */
export function CalendarItemSheet({
  item,
  onClose,
  onDeleted,
}: {
  item: CalendarItem | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [item]);

  if (!item) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const l = look(item);
  const at = new Date(item.at);
  const p = jst(at);
  const when = item.has_time
    ? `${p.m}月${p.d}日 ${hm(at)}${item.end_at ? `〜${hm(new Date(item.end_at))}` : ""}`
    : `${p.m}月${p.d}日（終日）`;

  return (
    <Sheet open onClose={onClose} title={item.title} subtitle={l.label}>
      <div className="space-y-2.5">
        <Row icon={<Clock size={14} strokeWidth={2.6} />}>{when}</Row>
        {item.company_name && (
          <Row icon={<Building2 size={14} strokeWidth={2.6} />}>
            {item.company_id ? (
              <Link href={`/customers/${item.company_id}`} className="underline" style={{ color: C.purple }}>
                {item.company_name}
              </Link>
            ) : (
              item.company_name
            )}
          </Row>
        )}
        {item.meet_url && (
          <Row icon={<Video size={14} strokeWidth={2.6} />}>
            <a href={item.meet_url} target="_blank" rel="noreferrer" className="underline break-all" style={{ color: C.blue }}>
              {item.meet_url}
            </a>
          </Row>
        )}
        {item.kind === "gcal" && (
          <p className="text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
            Google カレンダーの予定です。変えるときは Google カレンダーで。
          </p>
        )}
        {(item.kind === "task" || item.kind === "todo") && (
          <Link href="/tasks" className="block">
            <OrganicButton type="button" size="md" variant="outline" color="yellow" className="w-full">
              タスクの一覧で開く
            </OrganicButton>
          </Link>
        )}
        {item.kind === "event" && (
          <OrganicButton
            type="button"
            size="md"
            variant="outline"
            color="red"
            className="w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await deleteCalendarEvent(item.id);
                if ("error" in r) setError(r.error);
                else {
                  onClose();
                  onDeleted();
                }
              })
            }
          >
            <Trash2 size={14} strokeWidth={2.6} />
            {pending ? "消しています…" : item.gcal_event_id ? "この予定を消す（Google からも）" : "この予定を消す"}
          </OrganicButton>
        )}
        {error && (
          <p className="text-xs font-bold" style={{ color: C.red }} role="alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm font-bold">
      <span className="pt-0.5 shrink-0" style={{ color: "#9AA0A6" }}>
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="text-xs font-bold px-3 py-1.5"
      style={{
        background: on ? C.ink : "#fff",
        color: on ? "#fff" : "#6B6B6B",
        border: `2px solid ${on ? C.ink : C.line}`,
        borderRadius: "12px 6px 12px 6px",
      }}
    >
      {children}
    </button>
  );
}
