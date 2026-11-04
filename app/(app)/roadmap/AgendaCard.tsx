"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, MessageSquare, Plus, Trash2, UserPlus, X } from "lucide-react";
import { AGENDA_STATE, C, SOFT } from "@/lib/design";
import { MemberDot, OrganicButton, ShapeIcon, Sheet } from "@/components/ui";
import {
  addAction, deleteAction, deleteAgenda, openAgendaChannel,
  setAgendaState, setDecision, setParticipants, setSchedule, toggleAction,
} from "./actions";
import { deptOf } from "./depts";
import type { AgendaAction, AgendaRow, Person } from "./AgendaBoard";

type State = AgendaRow["state"];
const STATES: State[] = ["todo", "talking", "decided"];
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

const field = { borderRadius: "22px 11px 22px 11px", border: `2px solid ${C.line}` } as const;

/**
 * 議題1件（SCREENS 8）。
 * 議題・いつ話すか・決まったこと・参加者・やること・チャンネルで話す。
 *
 * 押した瞬間に見た目を変える（useOptimistic）。
 * revalidatePath はページ全体を引き直すので、待つと数秒かかる。
 */
export function AgendaCard({
  item,
  index,
  actions,
  people,
  myMemberId,
  showDept,
}: {
  item: AgendaRow;
  index: number;
  actions: AgendaAction[];
  people: Person[];
  myMemberId: string;
  showDept: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  const [state, moveState] = useOptimistic(item.state, (_: State, next: State) => next);
  const [decision, writeDecision] = useOptimistic(item.decision, (_: string | null, next: string | null) => next);
  const [when, writeWhen] = useOptimistic(item.scheduled_text, (_: string | null, next: string | null) => next);
  const [who, writeWho] = useOptimistic(item.participants, (_: string[], next: string[]) => next);
  const [list, change] = useOptimistic(
    actions,
    (cur: AgendaAction[], op: { kind: "add"; row: AgendaAction } | { kind: "toggle"; id: string } | { kind: "del"; id: string }) => {
      if (op.kind === "add") return [...cur, op.row];
      if (op.kind === "toggle") return cur.map((a) => (a.id === op.id ? { ...a, done: !a.done } : a));
      return cur.filter((a) => a.id !== op.id);
    }
  );

  const [deciding, setDeciding] = useState(false);
  const [draft, setDraft] = useState(item.decision ?? "");
  const [editingDecision, setEditingDecision] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [newAction, setNewAction] = useState("");
  const [assignee, setAssignee] = useState<string>(myMemberId);

  const sc = AGENDA_STATE[state];
  const dd = deptOf(item.dept);
  const byId = (id: string | null) => people.find((p) => p.id === id);

  // サーバーの返事が { error } なら画面に出す。黙って握りつぶさない
  const run = (optimistic: () => void, work: () => Promise<{ error: string } | void>) =>
    start(async () => {
      setProblem(null);
      optimistic();
      const result = await work();
      if (result && "error" in result) setProblem(result.error);
    });

  const chooseState = (next: State) => {
    if (next === state) return;
    if (next === "decided") {
      // 決定済みにするときは、何が決まったかを書いてもらう
      setDraft(decision ?? "");
      setDeciding(true);
      return;
    }
    run(() => moveState(next), () => setAgendaState(item.id, next));
  };

  return (
    <div
      className="bg-white p-4 space-y-3 anim-item"
      style={{
        borderRadius: index % 2 ? "28px 14px 28px 14px" : "14px 28px 14px 28px",
        border: `2.5px solid ${state === "decided" ? C.line : C[sc.color]}`,
        animationDelay: `${Math.min(index, 8) * 40}ms`,
      }}
    >
      {/* ── 議題 ── */}
      <div className="flex items-start gap-2.5">
        <ShapeIcon shape={dd.shape} color={dd.color} size={30} />
        <div className="flex-1 min-w-0">
          <div className="text-base font-extrabold leading-snug break-words">{item.title}</div>
          {showDept && (
            <div className="text-[11px] font-bold mt-0.5" style={{ color: "#8A8A8A" }}>
              {dd.name}
            </div>
          )}
        </div>
      </div>

      {/* ── 状態 ── */}
      <div className="flex gap-1">
        {STATES.map((s) => {
          const on = s === state;
          const tone = AGENDA_STATE[s].color;
          return (
            <button
              key={s}
              type="button"
              disabled={pending}
              aria-pressed={on}
              onClick={() => chooseState(s)}
              className="flex-1 text-[11px] font-bold py-1.5 disabled:opacity-60"
              style={{
                background: on ? SOFT[tone as keyof typeof SOFT] : "#fff",
                color: on ? C[tone] : "#9AA0A6",
                border: `2px solid ${on ? C[tone] : C.line}`,
                borderRadius: "10px 5px 10px 5px",
              }}
            >
              {AGENDA_STATE[s].label}
            </button>
          );
        })}
      </div>

      {/* ── 決まったこと（決定済み）／いつ話すか（それ以外）── */}
      {deciding ? (
        <div className="p-3 space-y-2" style={{ background: SOFT.green, borderRadius: "18px 9px 18px 9px" }}>
          <div className="text-[11px] font-extrabold" style={{ color: C.green }}>
            何が決まりましたか
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            rows={2}
            placeholder="決まったことを一文で"
            className="w-full px-3 py-2 text-sm bg-white outline-none resize-none"
            style={field}
          />
          <div className="flex gap-2">
            <OrganicButton
              type="button"
              size="sm"
              color="green"
              onClick={() => {
                setDeciding(false);
                run(
                  () => {
                    moveState("decided");
                    writeDecision(draft.trim() || null);
                  },
                  () => setAgendaState(item.id, "decided", draft)
                );
              }}
            >
              <Check size={14} strokeWidth={3} />
              決定にする
            </OrganicButton>
            <button
              type="button"
              onClick={() => setDeciding(false)}
              className="text-xs font-bold px-2"
              style={{ color: "#9AA0A6" }}
            >
              やめる
            </button>
          </div>
        </div>
      ) : state === "decided" ? (
        <div className="p-3" style={{ background: SOFT.green, borderRadius: "18px 9px 18px 9px" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Check size={13} strokeWidth={3.4} style={{ color: C.green }} />
            <span className="text-[11px] font-extrabold" style={{ color: C.green }}>
              決まったこと
            </span>
            {item.decided_at && (
              <span className="ml-auto text-[11px] font-bold" style={{ color: "#7A7A7A" }}>
                {formatDay(item.decided_at)}
              </span>
            )}
          </div>
          {editingDecision ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                rows={2}
                className="w-full px-3 py-2 text-sm bg-white outline-none resize-none"
                style={field}
              />
              <div className="flex gap-2">
                <OrganicButton
                  type="button"
                  size="sm"
                  color="green"
                  onClick={() => {
                    setEditingDecision(false);
                    run(() => writeDecision(draft.trim() || null), () => setDecision(item.id, draft));
                  }}
                >
                  直す
                </OrganicButton>
                <button
                  type="button"
                  onClick={() => setEditingDecision(false)}
                  className="text-xs font-bold px-2"
                  style={{ color: "#9AA0A6" }}
                >
                  やめる
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(decision ?? "");
                setEditingDecision(true);
              }}
              className="w-full text-left text-sm font-bold leading-relaxed"
            >
              {decision || <span style={{ color: "#9AA0A6" }}>（まだ書かれていません。押して書く）</span>}
            </button>
          )}
        </div>
      ) : (
        <div
          className="flex items-center gap-2 p-3"
          style={{ background: SOFT[sc.color as keyof typeof SOFT], borderRadius: "18px 9px 18px 9px" }}
        >
          <Calendar size={15} strokeWidth={2.6} style={{ color: C[sc.color] }} />
          <span className="text-sm font-bold flex-1">{when ?? "日程は未定"}</span>
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="text-[11px] font-bold px-2.5 py-1 bg-white shrink-0"
            style={{ color: C[sc.color], borderRadius: "12px 6px 12px 6px" }}
          >
            {when ? "変える" : "日程を決める"}
          </button>
        </div>
      )}

      {/* ── 参加者 ── */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold shrink-0" style={{ color: "#8A8A8A" }}>
          参加
        </span>
        <div className="flex -space-x-1.5 min-w-0 overflow-hidden">
          {who.length === 0 ? (
            <span className="text-[11px] font-bold" style={{ color: "#C8C2B6" }}>
              まだいません
            </span>
          ) : (
            who.map((id) => {
              const p = byId(id);
              return p ? <MemberDot key={id} name={p.name} avatar={p.avatar} size={28} /> : null;
            })
          )}
        </div>
        <button
          type="button"
          onClick={() => setPeopleOpen(true)}
          className="ml-auto flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 shrink-0"
          style={{ background: SOFT.purple, color: C.purple, borderRadius: "14px 7px 14px 7px" }}
        >
          <UserPlus size={13} strokeWidth={2.8} />
          変更
        </button>
      </div>

      {/* ── やること ── */}
      <div className="space-y-1.5 pt-1" style={{ borderTop: `2px dashed ${C.line}` }}>
        <div className="text-[11px] font-extrabold pt-1.5" style={{ color: "#8A8A8A" }}>
          やること
        </div>
        {list.map((a) => {
          const p = byId(a.assignee_id);
          // 追加した直後は仮の id。保存が終わるまで押させない
          const saving = a.id.startsWith("tmp-");
          return (
            <div key={a.id} className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label={a.done ? "未完了にする" : "完了にする"}
                disabled={saving}
                onClick={() => run(() => change({ kind: "toggle", id: a.id }), () => toggleAction(a.id, !a.done))}
                className="w-5 h-5 flex items-center justify-center shrink-0"
                style={{
                  borderRadius: 7,
                  background: a.done ? C.green : "#fff",
                  border: `2.5px solid ${a.done ? C.green : "#D6D0C4"}`,
                }}
              >
                {a.done && <Check size={12} className="text-white anim-check" strokeWidth={3.4} />}
              </button>
              <span
                className={`flex-1 text-sm truncate ${a.done ? "line-through" : "font-bold"}`}
                style={{ color: a.done ? "#B0AA9E" : C.ink }}
              >
                {a.text}
              </span>
              {p && <MemberDot name={p.name} avatar={p.avatar} size={22} />}
              <button
                type="button"
                aria-label="やることを消す"
                disabled={saving}
                onClick={() => run(() => change({ kind: "del", id: a.id }), () => deleteAction(a.id))}
                className="w-6 h-6 flex items-center justify-center shrink-0"
              >
                <X size={13} strokeWidth={3} style={{ color: "#C8C2B6" }} />
              </button>
            </div>
          );
        })}

        <form
          className="flex items-center gap-1.5 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            const text = newAction.trim();
            if (!text) return;
            setNewAction("");
            run(
              () =>
                change({
                  kind: "add",
                  row: {
                    id: `tmp-${Date.now()}`,
                    agenda_item_id: item.id,
                    text,
                    assignee_id: assignee || null,
                    done: false,
                    position: list.length,
                  },
                }),
              () => addAction(item.id, text, assignee || null)
            );
          }}
        >
          <input
            value={newAction}
            onChange={(e) => setNewAction(e.target.value)}
            placeholder="やることを足す"
            className="flex-1 min-w-0 px-3 py-2 text-sm bg-white outline-none"
            style={field}
          />
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            aria-label="担当"
            className="w-24 px-2 py-2 text-xs bg-white outline-none shrink-0"
            style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
          >
            <option value="">担当なし</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            aria-label="やることを追加"
            className="w-9 h-9 flex items-center justify-center shrink-0"
            style={{ background: C.ink, borderRadius: "12px 6px 12px 6px" }}
          >
            <Plus size={16} strokeWidth={3} className="text-white" />
          </button>
        </form>
      </div>

      {/* ── チャンネルで話す ── */}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setProblem(null);
            const result = await openAgendaChannel(item.id);
            if ("error" in result) setProblem(result.error);
            else router.push(`/channels/${result.channelId}`);
          })
        }
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold disabled:opacity-60"
        style={{ background: "#F4F1EA", color: "#6B6B6B", borderRadius: "18px 9px 18px 9px" }}
      >
        <MessageSquare size={15} strokeWidth={2.6} />
        チャンネルで話す
      </button>

      {problem && (
        <p className="text-xs font-bold px-1" style={{ color: C.red }} role="alert">
          {problem}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (window.confirm("この議題を消しますか？やることも一緒に消えます。")) {
              run(() => undefined, () => deleteAgenda(item.id));
            }
          }}
          className="flex items-center gap-1 text-[11px] font-bold"
          style={{ color: "#C8C2B6" }}
        >
          <Trash2 size={12} strokeWidth={2.6} />
          議題を消す
        </button>
      </div>

      <ScheduleSheet
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSave={(text) => {
          setScheduleOpen(false);
          run(() => writeWhen(text || null), () => setSchedule(item.id, text));
        }}
        hasValue={Boolean(when)}
      />

      <PeopleSheet
        open={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        people={people}
        selected={who}
        onSave={(ids) => {
          setPeopleOpen(false);
          run(() => writeWho(ids), () => setParticipants(item.id, ids));
        }}
      />
    </div>
  );
}

/** 「いつ話すか」。日付と時刻を選ぶと「11/12（水）14:00」の形にして残す */
function ScheduleSheet({
  open,
  onClose,
  onSave,
  hasValue,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  hasValue: boolean;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const text = (() => {
    if (!date) return "";
    const d = new Date(`${date}T00:00:00`);
    const head = `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
    return time ? `${head}${time}` : head;
  })();

  return (
    <Sheet open={open} onClose={onClose} title="いつ話すか" subtitle="日付と時刻を選びます">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-3 text-sm bg-white outline-none"
            style={field}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-3 py-3 text-sm bg-white outline-none"
            style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
          />
        </div>
        {text && (
          <p className="text-sm font-bold px-1">
            {text} <span style={{ color: "#9AA0A6" }}>に話す</span>
          </p>
        )}
        <OrganicButton
          type="button"
          size="lg"
          color="orange"
          className="w-full"
          disabled={!text}
          onClick={() => onSave(text)}
        >
          この日程にする
        </OrganicButton>
        {hasValue && (
          <button
            type="button"
            onClick={() => onSave("")}
            className="w-full text-xs font-bold py-2"
            style={{ color: "#9AA0A6" }}
          >
            日程を未定に戻す
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** 参加者の入れ替え */
function PeopleSheet({
  open,
  onClose,
  people,
  selected,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  people: Person[];
  selected: string[];
  onSave: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(selected);

  return (
    <Sheet open={open} onClose={onClose} title="参加者" subtitle="この議題を話す人">
      <div className="space-y-2">
        {people.map((p) => {
          const on = picked.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPicked((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
              className="w-full flex items-center gap-3 p-2.5 bg-white"
              style={{
                border: `2px solid ${on ? C.purple : C.line}`,
                borderRadius: "16px 8px 16px 8px",
              }}
            >
              <MemberDot name={p.name} avatar={p.avatar} size={30} />
              <span className="flex-1 text-left text-sm font-bold truncate">{p.name}</span>
              <span
                className="w-5 h-5 flex items-center justify-center shrink-0"
                style={{
                  borderRadius: 7,
                  background: on ? C.purple : "#fff",
                  border: `2.5px solid ${on ? C.purple : "#D6D0C4"}`,
                }}
              >
                {on && <Check size={12} className="text-white" strokeWidth={3.4} />}
              </span>
            </button>
          );
        })}
        <OrganicButton type="button" size="lg" className="w-full" onClick={() => onSave(picked)}>
          決める
        </OrganicButton>
      </div>
    </Sheet>
  );
}

function formatDay(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
