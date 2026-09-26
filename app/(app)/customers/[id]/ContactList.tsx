"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { OrganicButton, ShapeIcon } from "@/components/ui";
import { setPrimaryContact } from "../actions";
import type { Tables } from "@/types/supabase";

export function ContactList({
  companyId,
  contacts,
  primaryContactId,
}: {
  companyId: string;
  contacts: Tables<"contacts">[];
  primaryContactId: string | null;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2.5">
      {contacts.length === 0 && (
        <p className="text-sm font-bold text-center py-6" style={{ color: "#9AA0A6" }}>
          まだ名刺がありません。
        </p>
      )}

      {contacts.map((contact, i) => {
        const primary = contact.id === primaryContactId;
        return (
          <div
            key={contact.id}
            className="bg-white p-3.5 anim-item"
            style={{
              borderRadius: i % 2 ? "13px 26px 13px 26px" : "26px 13px 26px 13px",
              border: `2px solid ${primary ? C.yellow : C.line}`,
              animationDelay: `${Math.min(i, 10) * 40}ms`,
            }}
          >
            <div className="flex items-start gap-3">
              <ShapeIcon shape="blob" color={primary ? "yellow" : "orange"} size={42} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-extrabold truncate">{contact.name}</span>
                  {primary && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5 shrink-0"
                      style={{ background: SOFT.yellow, color: "#9A6B00", borderRadius: "6px 3px 6px 3px" }}
                    >
                      <Star size={9} strokeWidth={3} fill="currentColor" />
                      窓口
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold mt-0.5" style={{ color: "#9AA0A6" }}>
                  {[contact.dept, contact.title].filter(Boolean).join(" / ") || "役職・部署は未登録"}
                </div>
                {(contact.email || contact.phone) && (
                  <div className="text-[11px] font-bold mt-1.5 space-y-0.5" style={{ color: "#6B6B6B" }}>
                    {contact.email && <div className="truncate">{contact.email}</div>}
                    {contact.phone && <div>{contact.phone}</div>}
                  </div>
                )}
              </div>
            </div>

            {!primary && (
              <button
                type="button"
                disabled={pending}
                onClick={() => start(() => void setPrimaryContact(companyId, contact.id))}
                className="mt-2.5 w-full text-xs font-bold py-2 disabled:opacity-40"
                style={{
                  background: "#fff",
                  color: C.yellow,
                  border: `2px solid ${C.yellow}`,
                  borderRadius: "14px 7px 14px 7px",
                }}
              >
                窓口にする
              </button>
            )}
          </div>
        );
      })}

      <Link href="/customers/new" className="block pt-1">
        <OrganicButton type="button" size="lg" color="green" className="w-full">
          名刺を追加する
        </OrganicButton>
      </Link>
    </div>
  );
}
