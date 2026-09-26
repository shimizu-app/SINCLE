"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, SlidersHorizontal } from "lucide-react";
import {
  C, SOFT, KEY_GENRE, KEY_LAYER, KEY_SCOPE, PREFECTURES,
  type ColorKey,
} from "@/lib/design";
import { OrganicButton, Sheet, ShapeIcon } from "@/components/ui";
import { addReferral, saveKeyPerson, type KeyResult } from "./keyperson-actions";
import type { KeyGenre, KeyLayer, KeyScope } from "@/types/db";

export type KeyPersonRow = {
  id: string;
  name: string;
  kana: string | null;
  company_name: string | null;
  title: string | null;
  genre: KeyGenre;
  sub_genres: string[];
  layers: string[];
  scope: KeyScope;
  pref: string | null;
  city: string | null;
  met: string | null;
  about: string | null;
  network: string | null;
  referral_count: number;
};

export type Referral = {
  id: string;
  key_person_id: string;
  to_name: string;
  result: string;
  happened_at: string | null;
};

export type KeyFacet = { kind: string; value: string; count: number };
export type ContactOption = { id: string; name: string; title: string | null; company: string };

const GENRES = Object.keys(KEY_GENRE) as KeyGenre[];
const LAYERS = Object.keys(KEY_LAYER) as KeyLayer[];
const SCOPES = Object.keys(KEY_SCOPE) as KeyScope[];

/** 紹介の結果ごとに色を変える（SCREENS 3-3） */
const RESULTS: Record<string, ColorKey> = {
  初回接触: "blue",
  商談中: "orange",
  受注: "green",
  見送り: "red",
};
const RESULT_LIST = Object.keys(RESULTS);

const field = { borderRadius: "22px 11px 22px 11px", border: `2px solid ${C.line}` } as const;

export function KeyPersons({
  people, referrals, facets, contacts,
}: {
  people: KeyPersonRow[];
  referrals: Referral[];
  facets: KeyFacet[];
  contacts: ContactOption[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<KeyPersonRow | null>(null);
  const [openFilter, setOpenFilter] = useState(false);

  const picked = (kind: string) => params.getAll(kind);

  function toggle(kind: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const current = next.getAll(kind);
    next.delete(kind);
    const after = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    for (const v of after) next.append(kind, v);
    next.set("tab", "keypersons");
    router.replace(`/customers?${next}`, { scroll: false });
  }

  const has = (kind: string, value: string) => picked(kind).includes(value);
  const count = ["genre", "scope", "pref", "layer"].reduce((n, k) => n + picked(k).length, 0);
  const used = (kind: string) => facets.filter((f) => f.kind === kind).map((f) => f.value);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs font-bold px-1" style={{ color: "#9AA0A6" }}>
          紹介の多い順 ・ {people.length}人
        </p>
        <button
          onClick={() => setOpenFilter((v) => !v)}
          className="relative w-10 h-10 flex items-center justify-center"
          style={{
            background: openFilter || count > 0 ? SOFT.pink : "#fff",
            border: `2px solid ${openFilter || count > 0 ? C.pink : C.line}`,
            borderRadius: "14px 7px 14px 7px",
          }}
          aria-label="絞り込み"
        >
          <SlidersHorizontal size={16} strokeWidth={2.5} style={{ color: C.pink }} />
          {count > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[10px] font-extrabold text-white rounded-full border-2 border-white"
              style={{ background: C.red }}
            >
              {count}
            </span>
          )}
        </button>
      </div>

      {openFilter && (
        <div
          className="bg-white p-3.5 space-y-3 anim-fade"
          style={{ ...field, borderRadius: "22px 11px 22px 11px" }}
        >
          <Group label="ジャンル（本業と、顔が利くジャンルの両方で探します）">
            {GENRES.filter((g) => used("genre").includes(g) || has("genre", g)).map((g) => (
              <Chip key={g} on={has("genre", g)} tone={KEY_GENRE[g].color} onClick={() => toggle("genre", g)}>
                {KEY_GENRE[g].label}
              </Chip>
            ))}
          </Group>
          <Group label="影響範囲">
            {SCOPES.map((s) => (
              <Chip key={s} on={has("scope", s)} tone={KEY_SCOPE[s].color} onClick={() => toggle("scope", s)}>
                {KEY_SCOPE[s].label}
              </Chip>
            ))}
          </Group>
          {used("pref").length > 0 && (
            <Group label="県">
              {used("pref").map((p) => (
                <Chip key={p} on={has("pref", p)} tone="green" onClick={() => toggle("pref", p)}>
                  {p}
                </Chip>
              ))}
            </Group>
          )}
          <Group label="どんな層に強いか">
            {LAYERS.map((l) => (
              <Chip key={l} on={has("layer", l)} tone={KEY_LAYER[l].color} onClick={() => toggle("layer", l)}>
                {KEY_LAYER[l].label}
              </Chip>
            ))}
          </Group>
        </div>
      )}

      {people.length === 0 ? (
        <p className="text-sm font-bold text-center py-8" style={{ color: "#9AA0A6" }}>
          {count > 0 ? "条件に合う人がいません。" : "まだ登録がありません。"}
        </p>
      ) : (
        people.map((p, i) => {
          const g = KEY_GENRE[p.genre] ?? KEY_GENRE.other;
          const sc = KEY_SCOPE[p.scope] ?? KEY_SCOPE.pref;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setDetail(p)}
              className="w-full text-left flex items-start gap-3 p-3.5 bg-white anim-item"
              style={{
                borderRadius: i % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
                border: `2px solid ${C.line}`,
              }}
            >
              <ShapeIcon shape={g.shape} color={g.color} size={44} />
              <div className="flex-1 min-w-0">
                <div className="text-base font-extrabold truncate">{p.name}</div>
                <div className="text-xs font-bold truncate" style={{ color: "#9AA0A6" }}>
                  {[p.company_name, p.title].filter(Boolean).join(" / ") || "所属未登録"}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  <Tag tone={g.color}>{g.label}</Tag>
                  <Tag tone={sc.color}>{sc.label}{p.pref ? `・${p.pref}` : ""}</Tag>
                  {p.layers.slice(0, 2).map((l) => (
                    <Tag key={l} tone={KEY_LAYER[l as KeyLayer]?.color ?? "lime"}>
                      {KEY_LAYER[l as KeyLayer]?.label ?? l}
                    </Tag>
                  ))}
                </div>
              </div>
              <div className="text-center shrink-0">
                <div className="text-xl font-extrabold leading-none" style={{ color: C.pink }}>
                  {p.referral_count}
                </div>
                <div className="text-[10px] font-bold" style={{ color: "#9AA0A6" }}>
                  紹介
                </div>
              </div>
            </button>
          );
        })
      )}

      <OrganicButton type="button" size="lg" color="pink" className="w-full" onClick={() => setAdding(true)}>
        <Plus size={16} strokeWidth={3} />
        キーパーソンを登録
      </OrganicButton>

      <AddSheet open={adding} onClose={() => setAdding(false)} contacts={contacts} />
      <DetailSheet
        person={detail}
        referrals={referrals.filter((r) => r.key_person_id === detail?.id)}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

function AddSheet({
  open, onClose, contacts,
}: {
  open: boolean;
  onClose: () => void;
  contacts: ContactOption[];
}) {
  const [state, action, pending] = useActionState<KeyResult, FormData>(saveKeyPerson, undefined);
  const [fromContact, setFromContact] = useState("");

  useEffect(() => {
    if (state && "ok" in state) onClose();
  }, [state, onClose]);

  const picked = contacts.find((c) => c.id === fromContact);

  return (
    <Sheet open={open} onClose={onClose} title="キーパーソン" subtitle="紹介の起点になる人">
      <form action={action} className="space-y-3">
        <input type="hidden" name="contactId" value={fromContact} />

        {contacts.length > 0 && (
          <div className="space-y-1.5">
            <Label>名刺から選ぶ</Label>
            <select
              value={fromContact}
              onChange={(e) => setFromContact(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-white outline-none"
              style={field}
            >
              <option value="">手で入力する</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}（{c.company}）
                </option>
              ))}
            </select>
          </div>
        )}

        <input
          name="name"
          required
          key={picked?.id ?? "manual"}
          defaultValue={picked?.name ?? ""}
          placeholder="名前"
          className="w-full px-4 py-3 text-base bg-white outline-none"
          style={field}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            name="companyName"
            key={`c-${picked?.id ?? "manual"}`}
            defaultValue={picked?.company ?? ""}
            placeholder="所属"
            className="w-full px-4 py-3 text-sm bg-white outline-none"
            style={field}
          />
          <input
            name="title"
            key={`t-${picked?.id ?? "manual"}`}
            defaultValue={picked?.title ?? ""}
            placeholder="役職"
            className="w-full px-4 py-3 text-sm bg-white outline-none"
            style={{ ...field, borderRadius: "11px 22px 11px 22px" }}
          />
        </div>

        <div className="space-y-1.5">
          <Label>本業のジャンル</Label>
          <select name="genre" defaultValue="other" className="w-full px-4 py-3 text-sm bg-white outline-none" style={field}>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {KEY_GENRE[g].label}
              </option>
            ))}
          </select>
        </div>

        <CheckGroup label="顔が利くジャンル（複数可）" name="subGenres"
          options={GENRES.map((g) => [g, KEY_GENRE[g].label])} />

        <CheckGroup label="どんな層に強いか（複数可）" name="layers"
          options={LAYERS.map((l) => [l, KEY_LAYER[l].label])} />

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>影響範囲</Label>
            <select name="scope" defaultValue="pref" className="w-full px-3 py-3 text-sm bg-white outline-none" style={field}>
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {KEY_SCOPE[s].label}（{KEY_SCOPE[s].desc}）
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>県</Label>
            <select name="pref" defaultValue="" className="w-full px-3 py-3 text-sm bg-white outline-none"
              style={{ ...field, borderRadius: "11px 22px 11px 22px" }}>
              <option value="">未設定</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <textarea name="met" rows={2} placeholder="どこで出会ったか"
          className="w-full px-4 py-3 text-sm bg-white outline-none resize-none" style={field} />
        <textarea name="about" rows={2} placeholder="どういう人か"
          className="w-full px-4 py-3 text-sm bg-white outline-none resize-none"
          style={{ ...field, borderRadius: "11px 22px 11px 22px" }} />
        <textarea name="network" rows={2} placeholder="どんな人脈を持っているか"
          className="w-full px-4 py-3 text-sm bg-white outline-none resize-none" style={field} />

        {state && "error" in state && state.error && (
          <p className="text-xs font-bold" style={{ color: C.red }}>
            {state.error}
          </p>
        )}
        <OrganicButton type="submit" size="lg" color="pink" className="w-full" disabled={pending}>
          {pending ? "登録しています…" : "登録する"}
        </OrganicButton>
      </form>
    </Sheet>
  );
}

function DetailSheet({
  person, referrals, onClose,
}: {
  person: KeyPersonRow | null;
  referrals: Referral[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<KeyResult, FormData>(addReferral, undefined);
  if (!person) return null;

  const g = KEY_GENRE[person.genre] ?? KEY_GENRE.other;

  return (
    <Sheet open onClose={onClose} title={person.name} subtitle={person.company_name ?? ""}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ShapeIcon shape={g.shape} color={g.color} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag tone={g.color}>{g.label}</Tag>
              <Tag tone={KEY_SCOPE[person.scope].color}>
                {KEY_SCOPE[person.scope].label}
                {person.pref ? `・${person.pref}` : ""}
              </Tag>
            </div>
            <div className="flex items-center gap-1 flex-wrap mt-1">
              {person.layers.map((l) => (
                <Tag key={l} tone={KEY_LAYER[l as KeyLayer]?.color ?? "lime"}>
                  {KEY_LAYER[l as KeyLayer]?.label ?? l}
                </Tag>
              ))}
            </div>
          </div>
        </div>

        {([["出会い", person.met], ["どういう人か", person.about], ["どんな人脈か", person.network]] as const)
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label} className="space-y-1">
              <Label>{label}</Label>
              <p className="text-sm font-bold leading-relaxed whitespace-pre-wrap">{value}</p>
            </div>
          ))}

        {/* ── ご紹介いただいた先（縦のタイムライン） ── */}
        <div className="space-y-2">
          <Label>ご紹介いただいた先（{referrals.length}件）</Label>
          {referrals.length === 0 ? (
            <p className="text-xs font-bold" style={{ color: "#C8C2B6" }}>
              まだありません。
            </p>
          ) : (
            referrals.map((r, i) => {
              const tone = RESULTS[r.result] ?? "blue";
              return (
                <div key={r.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: C[tone] }} />
                    {i < referrals.length - 1 && (
                      <span className="flex-1 w-0.5 my-1" style={{ background: C.line }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="text-sm font-bold break-words">{r.to_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Tag tone={tone}>{r.result}</Tag>
                      {r.happened_at && (
                        <span className="text-[10px] font-bold" style={{ color: "#C8C2B6" }}>
                          {r.happened_at.replace(/^\d{4}-/, "").replace("-", "/")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form action={action} className="space-y-2">
          <input type="hidden" name="keyPersonId" value={person.id} />
          <Label>紹介を記録する</Label>
          <input name="toName" required placeholder="紹介先"
            className="w-full px-4 py-3 text-sm bg-white outline-none" style={field} />
          <div className="grid grid-cols-2 gap-2">
            <select name="result" defaultValue="初回接触"
              className="w-full px-3 py-3 text-sm bg-white outline-none" style={field}>
              {RESULT_LIST.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input name="happenedAt" type="date"
              className="w-full px-3 py-3 text-sm bg-white outline-none"
              style={{ ...field, borderRadius: "11px 22px 11px 22px" }} />
          </div>
          {state && "error" in state && state.error && (
            <p className="text-xs font-bold" style={{ color: C.red }}>
              {state.error}
            </p>
          )}
          <OrganicButton type="submit" size="md" color="pink" className="w-full" disabled={pending}>
            {pending ? "記録しています…" : "記録する"}
          </OrganicButton>
        </form>
      </div>
    </Sheet>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold px-1" style={{ color: "#9AA0A6" }}>
      {children}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function CheckGroup({
  label, name, options,
}: {
  label: string;
  name: string;
  options: [string, string][];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1.5 flex-wrap">
        {options.map(([value, text]) => (
          <label key={value} className="cursor-pointer">
            <input type="checkbox" name={name} value={value} className="peer sr-only" />
            <span
              className="block text-[11px] font-bold px-2.5 py-1.5 peer-checked:anim-chip"
              style={{ border: `2px solid ${C.line}`, borderRadius: "10px 5px 10px 5px", color: "#9AA0A6" }}
            >
              {text}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Chip({
  on, tone, onClick, children,
}: {
  on: boolean;
  tone: ColorKey;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-bold px-2.5 py-1.5 ${on ? "anim-chip" : ""}`}
      style={{
        background: on ? SOFT[tone as keyof typeof SOFT] : "#fff",
        color: on ? C[tone] : "#9AA0A6",
        border: `2px solid ${on ? C[tone] : C.line}`,
        borderRadius: "10px 5px 10px 5px",
      }}
    >
      {children}
    </button>
  );
}

function Tag({ tone, children }: { tone: ColorKey; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold px-2 py-0.5"
      style={{
        background: SOFT[tone as keyof typeof SOFT],
        color: tone === "yellow" ? "#9A6B00" : C[tone],
        borderRadius: "7px 3px 7px 3px",
      }}
    >
      {children}
    </span>
  );
}
