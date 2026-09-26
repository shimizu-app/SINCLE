"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { C, SOFT, PRIORITY_STYLE } from "@/lib/design";
import { MemberDot, OrganicButton, PriorityBadge, ShapeIcon } from "@/components/ui";
import {
  addSubtask, deleteSubtask, deleteTask, deleteTodo,
  toggleSubtask, toggleTask, toggleTodo,
} from "./actions";
import type { Avatar, Priority } from "@/types/db";

export type TaskRow = {
  id: string;
  title: string;
  due_at: string | null;
  due_has_time: boolean;
  priority: Priority;
  share: string;
  done: boolean;
  company_id: string | null;
  company_name: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_avatar: Avatar | null;
  contact_name: string | null;
  subtask_total: number;
  subtask_done: number;
};

export type Subtask = { id: string; text: string; done: boolean; task_id: string };
export type TodoRow = {
  id: string;
  title: string;
  due_at: string | null;
  due_has_time: boolean;
  priority: Priority;
  done: boolean;
};

/** 付箋の紙の色は優先度（SCREENS 7-1：傾きはつけない） */
function paper(priority: Priority) {
  const tone = PRIORITY_STYLE[priority]?.color ?? "orange";
  return SOFT[tone as keyof typeof SOFT];
}

export function formatDue(at: string | null, hasTime: boolean) {
  if (!at) return null;
  const d = new Date(at);
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  if (!hasTime) return md;
  return `${md} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isOverdue(at: string | null) {
  if (!at) return false;
  return new Date(at).getTime() < Date.now() - 86400000;
}

export function TaskList({
  tasks,
  todos,
  subtasks,
  onAdd,
}: {
  tasks: TaskRow[];
  todos: TodoRow[];
  subtasks: Subtask[];
  onAdd: () => void;
}) {
  // 会社ごとにまとめる（SCREENS 7-1）
  const groups = new Map<string, { name: string; id: string | null; rows: TaskRow[] }>();
  for (const t of tasks) {
    const key = t.company_id ?? "__none__";
    if (!groups.has(key)) {
      groups.set(key, { name: t.company_name ?? "会社なし", id: t.company_id, rows: [] });
    }
    groups.get(key)!.rows.push(t);
  }

  return (
    <div className="space-y-5">
      {/* ── 自分のTODO ── */}
      <section className="space-y-2">
        <Head shape="drop" color="blue" title="自分のTODO" count={todos.length} />
        {todos.length === 0 ? (
          <Muted>いまは空です。</Muted>
        ) : (
          todos.map((todo, i) => <TodoCard key={todo.id} todo={todo} index={i} />)
        )}
      </section>

      {/* ── 会社のタスク ── */}
      <section className="space-y-2">
        <Head shape="sun" color="yellow" title="会社のタスク" count={tasks.length} />
        {tasks.length === 0 ? (
          <Muted>いまは空です。</Muted>
        ) : (
          [...groups.values()].map((group) => (
            <div key={group.id ?? "none"} className="space-y-2">
              <div className="flex items-center gap-2 px-1 pt-1">
                {group.id ? (
                  <Link
                    href={`/customers/${group.id}`}
                    className="text-xs font-extrabold truncate"
                    style={{ color: C.purple }}
                  >
                    {group.name}
                  </Link>
                ) : (
                  <span className="text-xs font-extrabold" style={{ color: "#9AA0A6" }}>
                    {group.name}
                  </span>
                )}
                <span className="text-[11px] font-bold" style={{ color: "#C8C2B6" }}>
                  {group.rows.length}件
                </span>
              </div>
              {group.rows.map((task, i) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={i}
                  subtasks={subtasks.filter((s) => s.task_id === task.id)}
                />
              ))}
            </div>
          ))
        )}
      </section>

      <OrganicButton type="button" size="lg" color="yellow" className="w-full" onClick={onAdd}>
        <Plus size={16} strokeWidth={3} />
        タスクを追加
      </OrganicButton>
    </div>
  );
}

function TaskCard({ task, index, subtasks }: { task: TaskRow; index: number; subtasks: Subtask[] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  // revalidatePath はページ全体を引き直すので、反映まで数秒かかる。
  // 押した瞬間に見た目を変えて、サーバーの結果が来たら上書きさせる。
  const [items, addItem] = useOptimistic(subtasks, (state, item: Subtask) => [...state, item]);
  const [flipped, flip] = useOptimistic(
    subtasks,
    (state, id: string) => state.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
  );
  const [done, setDone] = useOptimistic(task.done, (_: boolean, next: boolean) => next);

  // 追加ぶんと反転ぶんを合わせる
  const list = items.map((s) => flipped.find((f) => f.id === s.id) ?? s);

  const due = formatDue(task.due_at, task.due_has_time);
  const late = !done && isOverdue(task.due_at);

  return (
    <div
      className="anim-item"
      style={{
        background: paper(task.priority),
        borderRadius: index % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
        border: `2px solid ${late ? C.red : C.line}`,
        animationDelay: `${Math.min(index, 10) * 40}ms`,
      }}
    >
      <div className="flex items-start gap-2.5 p-3.5">
        <button
          type="button"
          aria-label={done ? "未完了にする" : "完了にする"}
          disabled={pending}
          onClick={() =>
            start(() => {
              setDone(!done);
              void toggleTask(task.id, !done);
            })
          }
          className="w-6 h-6 shrink-0 mt-0.5 flex items-center justify-center"
          style={{
            background: done ? C.green : "#fff",
            border: `2.5px solid ${done ? C.green : C.line}`,
            borderRadius: "8px 4px 8px 4px",
          }}
        >
          {done && <Check size={13} strokeWidth={4} className="text-white anim-check" />}
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <div
            className="text-sm font-bold break-words"
            style={{ textDecoration: done ? "line-through" : "none", opacity: done ? 0.5 : 1 }}
          >
            {task.title}
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[11px] font-bold flex-wrap" style={{ color: "#6B6B6B" }}>
            {due && <span style={{ color: late ? C.red : undefined }}>{late ? "期限切れ " : ""}{due}</span>}
            {task.contact_name && <span>{task.contact_name}</span>}
            {list.length > 0 && (
              <span>
                チェック {list.filter((s) => s.done).length}/{list.length}
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <PriorityBadge pri={task.priority} size={26} />
          {task.assignee_name && (
            <MemberDot name={task.assignee_name} avatar={task.assignee_avatar} size={26} />
          )}
          <ChevronDown
            size={15}
            strokeWidth={3}
            style={{
              color: "#C8C2B6",
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform .2s",
            }}
          />
        </div>
      </div>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-2 anim-fade">
          {list.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                aria-label={s.done ? "戻す" : "済みにする"}
                onClick={() =>
                  start(() => {
                    flip(s.id);
                    void toggleSubtask(s.id, !s.done);
                  })
                }
                className="w-5 h-5 shrink-0 flex items-center justify-center"
                style={{
                  background: s.done ? C.purple : "#fff",
                  border: `2px solid ${s.done ? C.purple : C.line}`,
                  borderRadius: "999px",
                }}
              >
                {s.done && <Check size={11} strokeWidth={4} className="text-white" />}
              </button>
              <span
                className="flex-1 min-w-0 text-xs font-bold break-words"
                style={{ textDecoration: s.done ? "line-through" : "none", opacity: s.done ? 0.5 : 1 }}
              >
                {s.text}
              </span>
              <button
                type="button"
                aria-label="削除"
                onClick={() => start(() => void deleteSubtask(s.id))}
                className="shrink-0"
              >
                <Trash2 size={13} strokeWidth={2.5} style={{ color: "#C8C2B6" }} />
              </button>
            </div>
          ))}

          <div className="flex gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !text.trim()) return;
                e.preventDefault();
                const value = text.trim();
                setText("");
                start(() => {
                  addItem({ id: `temp-${Date.now()}`, text: value, done: false, task_id: task.id });
                  void addSubtask(task.id, value);
                });
              }}
              placeholder="チェックリストを足す"
              className="flex-1 min-w-0 px-3 py-2 text-xs bg-white outline-none"
              style={{ borderRadius: "11px 22px 11px 22px", border: `2px solid ${C.line}` }}
            />
            <button
              type="button"
              disabled={!text.trim() || pending}
              onClick={() => {
                const value = text.trim();
                setText("");
                start(() => {
                  addItem({ id: `temp-${Date.now()}`, text: value, done: false, task_id: task.id });
                  void addSubtask(task.id, value);
                });
              }}
              className="px-3 text-xs font-bold disabled:opacity-40"
              style={{ background: "#fff", color: C.purple, border: `2px solid ${C.purple}`, borderRadius: "11px 22px 11px 22px" }}
            >
              追加
            </button>
          </div>

          <button
            type="button"
            onClick={() => start(() => void deleteTask(task.id))}
            className="text-[11px] font-bold pt-1"
            style={{ color: C.red }}
          >
            このタスクを削除
          </button>
        </div>
      )}
    </div>
  );
}

function TodoCard({ todo, index }: { todo: TodoRow; index: number }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useOptimistic(todo.done, (_: boolean, next: boolean) => next);
  const due = formatDue(todo.due_at, todo.due_has_time);

  return (
    <div
      className="flex items-center gap-2.5 p-3 anim-item"
      style={{
        background: paper(todo.priority),
        borderRadius: index % 2 ? "11px 22px 11px 22px" : "22px 11px 22px 11px",
        border: `2px solid ${C.line}`,
        animationDelay: `${Math.min(index, 10) * 40}ms`,
      }}
    >
      <button
        type="button"
        aria-label={done ? "未完了にする" : "完了にする"}
        disabled={pending}
        onClick={() =>
          start(() => {
            setDone(!done);
            void toggleTodo(todo.id, !done);
          })
        }
        className="w-5 h-5 shrink-0 flex items-center justify-center"
        style={{
          background: done ? C.green : "#fff",
          border: `2.5px solid ${done ? C.green : C.line}`,
          borderRadius: "999px",
        }}
      >
        {done && <Check size={11} strokeWidth={4} className="text-white anim-check" />}
      </button>
      <span
        className="flex-1 min-w-0 text-sm font-bold break-words"
        style={{ textDecoration: done ? "line-through" : "none", opacity: done ? 0.5 : 1 }}
      >
        {todo.title}
      </span>
      {due && (
        <span className="text-[11px] font-bold shrink-0" style={{ color: "#9AA0A6" }}>
          {due}
        </span>
      )}
      <button
        type="button"
        aria-label="削除"
        onClick={() => start(() => void deleteTodo(todo.id))}
        className="shrink-0"
      >
        <Trash2 size={13} strokeWidth={2.5} style={{ color: "#C8C2B6" }} />
      </button>
    </div>
  );
}

function Head({
  shape, color, title, count,
}: {
  shape: "drop" | "sun";
  color: "blue" | "yellow";
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <ShapeIcon shape={shape} color={color} size={26} />
      <span className="text-sm font-extrabold">{title}</span>
      <span className="text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
        {count}件
      </span>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold px-1 py-3" style={{ color: "#C8C2B6" }}>
      {children}
    </p>
  );
}
