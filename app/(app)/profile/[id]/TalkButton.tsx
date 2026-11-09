"use client";

import { useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { OrganicButton } from "@/components/ui";
import { openDm } from "../../channels/actions";

/** 他人のプロフィールの「1対1で話す」（SCREENS 12） */
export function TalkButton({ memberId, name }: { memberId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <OrganicButton
      type="button"
      size="lg"
      color="blue"
      className="w-full"
      disabled={pending}
      onClick={() => start(() => void openDm(memberId))}
      aria-label={`${name} と1対1で話す`}
    >
      <MessageCircle size={17} strokeWidth={2.6} />
      {pending ? "開いています…" : "1対1で話す"}
    </OrganicButton>
  );
}
