"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Lock, MessageCircle, Settings } from "lucide-react";
import { C, SOFT } from "@/lib/design";
import { OrganicButton } from "@/components/ui";
import { openDm } from "../channels/actions";

/**
 * 「会社全体」に鍵がかかっているときの画面（023）。
 * 全員の名刺は、管理者から「全員の名刺を見る」をもらった人だけが開ける。
 * 管理者本人なら設定から自分に付けられるので、そこへ案内する。
 */
export function LockedAll({
  admins,
  isAdmin,
  myMemberId,
}: {
  admins: { id: string; name: string }[];
  isAdmin: boolean;
  myMemberId: string;
}) {
  const [pending, start] = useTransition();
  const others = admins.filter((a) => a.id !== myMemberId);

  return (
    <div
      className="bg-white px-5 py-7 text-center space-y-4 anim-item"
      style={{ border: `2.5px dashed ${C.line}`, borderRadius: "28px 14px 28px 14px" }}
    >
      <div
        className="mx-auto w-16 h-16 flex items-center justify-center"
        style={{ background: SOFT.purple, borderRadius: "22px 11px 22px 11px" }}
      >
        <Lock size={28} strokeWidth={2.6} style={{ color: C.purple }} />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-base font-extrabold">会社全体には鍵がかかっています</h2>
        <p className="text-xs font-bold leading-relaxed" style={{ color: "#6B6B6B" }}>
          全員が登録した名刺は、管理者から「全員の名刺を見る」の許可をもらった人だけが開けます。
          <br />
          あなたが登録した名刺は「個人」で見られます。
        </p>
      </div>

      {isAdmin ? (
        <Link href="/settings" className="block">
          <OrganicButton type="button" size="md" color="purple" className="w-full">
            <Settings size={15} strokeWidth={2.6} />
            設定で自分に許可を付ける
          </OrganicButton>
        </Link>
      ) : others.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
            管理者：{others.map((a) => `${a.name}さん`).join("・")}
          </p>
          <OrganicButton
            type="button"
            size="md"
            color="blue"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() => start(() => void openDm(others[0].id))}
          >
            <MessageCircle size={15} strokeWidth={2.6} />
            {pending ? "開いています…" : `${others[0].name}さんに許可をお願いする`}
          </OrganicButton>
        </div>
      ) : (
        <p className="text-[11px] font-bold" style={{ color: "#9AA0A6" }}>
          管理者に「全員の名刺を見る」をオンにしてもらってください。
        </p>
      )}
    </div>
  );
}
