import Link from "next/link";
import { AGENDA_STATE, C, SOFT, type ColorKey } from "@/lib/design";
import { ShapeIcon } from "@/components/ui";
import { deptOf, sameYm, type DeptKey, type YearMonth } from "./depts";
import type { AgendaRow } from "./AgendaBoard";

type State = keyof typeof AGENDA_STATE;

/**
 * マスの色。話し合い中が1つでもあれば橙、これから話すが残っていれば青、
 * 全部決まっていれば緑。いちばん手当てが要る状態を見せる。
 */
function cellState(list: AgendaRow[]): State | null {
  if (!list.length) return null;
  if (list.some((t) => t.state === "talking")) return "talking";
  if (list.some((t) => t.state === "todo")) return "todo";
  return "decided";
}

/**
 * ロードマップ図（SCREENS 8）。部署×月のマス目。
 * 「全社」なら4部署が縦に並ぶ。下に、選んだ月の議題をタイムラインで並べる。
 * 押せるのはリンクだけなので、サーバー側で描く。
 */
export function RoadmapMap({
  months,
  selected,
  thisMonth,
  depts,
  color,
  items,
  hrefFor,
  agendaHref,
}: {
  months: YearMonth[];
  selected: YearMonth;
  thisMonth: YearMonth;
  depts: DeptKey[];
  color: ColorKey;
  items: AgendaRow[];
  hrefFor: (m: YearMonth, dept?: DeptKey) => string;
  agendaHref: string;
}) {
  const cellOf = (dept: DeptKey, m: YearMonth) =>
    items.filter((t) => t.dept === dept && t.year === m.year && t.month === m.month);

  const ofMonth = items
    .filter((t) => t.year === selected.year && t.month === selected.month)
    .sort((a, b) => order(a.state) - order(b.state));

  return (
    <div className="space-y-3 anim-screen">
      {/* 月の見出し */}
      <div className="flex items-center gap-1 pl-[86px] pr-2.5">
        {months.map((m) => {
          const past = m.year * 12 + m.month < thisMonth.year * 12 + thisMonth.month;
          return (
            <div
              key={`${m.year}-${m.month}`}
              className="flex-1 text-center text-[10px] font-extrabold"
              style={{ color: sameYm(m, selected) ? C[color] : past ? "#C8C2B6" : "#8A8A8A" }}
            >
              {m.month}月
            </div>
          );
        })}
      </div>

      {depts.map((dk, ri) => {
        const dd = deptOf(dk);
        return (
          <div
            key={dk}
            className="bg-white p-2.5"
            style={{
              borderRadius: ri % 2 ? "24px 12px 24px 12px" : "12px 24px 12px 24px",
              border: `2.5px solid ${C.line}`,
            }}
          >
            <div className="flex items-center gap-1.5">
              <Link
                href={hrefFor(selected, dk)}
                className="flex items-center gap-1.5 shrink-0"
                style={{ width: 76 }}
              >
                <ShapeIcon shape={dd.shape} color={dd.color} size={24} />
                <span className="text-[11px] font-extrabold leading-tight truncate">{dd.name}</span>
              </Link>
              <div className="flex-1 flex items-center gap-1">
                {months.map((m, i) => {
                  const list = cellOf(dk, m);
                  const st = cellState(list);
                  const on = sameYm(m, selected);
                  const tone = st ? AGENDA_STATE[st].color : null;
                  return (
                    <Link
                      key={`${m.year}-${m.month}`}
                      href={hrefFor(m)}
                      aria-label={`${dd.name} ${m.month}月 ${list.length}件`}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5"
                      style={{
                        height: 46,
                        background: tone ? SOFT[tone as keyof typeof SOFT] : "#F7F5F0",
                        border: `2px solid ${on ? C[dd.color] : "transparent"}`,
                        borderRadius: i % 2 ? "12px 6px 12px 6px" : "6px 12px 6px 12px",
                      }}
                    >
                      {tone ? (
                        <>
                          <span className="text-sm font-extrabold" style={{ color: C[tone] }}>
                            {list.length}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C[tone] }} />
                        </>
                      ) : (
                        <span className="text-[10px] font-bold" style={{ color: "#C8C2B6" }}>
                          —
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* 凡例 */}
      <div className="flex items-center justify-center gap-3 pt-1">
        {(Object.keys(AGENDA_STATE) as State[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: C[AGENDA_STATE[k].color] }} />
            <span className="text-[11px] font-bold" style={{ color: "#8A8A8A" }}>
              {AGENDA_STATE[k].label}
            </span>
          </span>
        ))}
      </div>

      {/* 選んだ月の流れ */}
      <div className="pt-2 space-y-2.5">
        <div className="flex items-center gap-2 px-1">
          <span
            className="text-sm font-extrabold px-3 py-1.5"
            style={{
              background: SOFT[color as keyof typeof SOFT],
              color: C[color],
              borderRadius: "16px 8px 16px 8px",
            }}
          >
            {selected.month}月の流れ
          </span>
          <div className="flex-1 h-0.5 rounded-full" style={{ background: C.line }} />
        </div>

        {ofMonth.length === 0 ? (
          <p className="text-sm font-bold text-center py-6" style={{ color: "#C8C2B6" }}>
            この月の議題はまだありません。
          </p>
        ) : (
          <div className="relative pl-5">
            <span
              className="absolute left-[7px] top-1 bottom-1 w-0.5 rounded-full"
              style={{ background: C.line }}
              aria-hidden="true"
            />
            {ofMonth.map((t) => {
              const sc = AGENDA_STATE[t.state as State];
              const dd = deptOf(t.dept);
              return (
                <Link key={t.id} href={agendaHref} className="relative block pb-3">
                  <span
                    className="absolute -left-[18px] top-1.5 w-3 h-3 rounded-full border-2 border-white"
                    style={{ background: C[sc.color] }}
                    aria-hidden="true"
                  />
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] font-extrabold px-2 py-0.5"
                      style={{
                        background: SOFT[sc.color as keyof typeof SOFT],
                        color: C[sc.color],
                        borderRadius: "8px 4px 8px 4px",
                      }}
                    >
                      {sc.label}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: "#9AA0A6" }}>
                      {dd.name}
                    </span>
                  </div>
                  <div className="text-sm font-extrabold leading-snug mt-1">{t.title}</div>
                  {t.decision && (
                    <div className="text-xs font-bold mt-0.5" style={{ color: C.green }}>
                      → {t.decision}
                    </div>
                  )}
                  {!t.decision && t.scheduled_text && (
                    <div className="text-xs font-bold mt-0.5" style={{ color: "#9AA0A6" }}>
                      {t.scheduled_text}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function order(s: string) {
  return s === "talking" ? 0 : s === "todo" ? 1 : 2;
}
