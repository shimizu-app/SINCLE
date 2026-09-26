"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";

export type ChannelResult = { error: string } | undefined;

/** チャンネルに投稿する */
export async function postMessage(channelId: string, text: string) {
  const current = await requireCurrent();
  if (!text.trim()) return;
  const supabase = await createClient();

  const { error } = await supabase.from("messages").insert({
    channel_id: channelId,
    workspace_id: current.workspace.id,
    author_id: current.member.id,
    text: text.trim(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/channels/${channelId}`);
}

/** DM を送る */
export async function postDm(threadId: string, text: string) {
  const current = await requireCurrent();
  if (!text.trim()) return;
  const supabase = await createClient();

  const { error } = await supabase.from("dm_messages").insert({
    thread_id: threadId,
    workspace_id: current.workspace.id,
    author_id: current.member.id,
    text: text.trim(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/channels/dm/${threadId}`);
}

export async function markChannelRead(channelId: string) {
  await requireCurrent();
  const supabase = await createClient();
  await supabase.rpc("mark_channel_read", { p_channel_id: channelId });
}

export async function markDmRead(threadId: string) {
  await requireCurrent();
  const supabase = await createClient();
  await supabase.rpc("mark_dm_read", { p_thread_id: threadId });
}

/** 相手を選んで DM を開く。無ければ作る。 */
export async function openDm(otherMemberId: string) {
  const current = await requireCurrent();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("open_dm", {
    p_workspace_id: current.workspace.id,
    p_other_id: otherMemberId,
  });
  if (error) return { error: error.message };

  redirect(`/channels/dm/${data as string}`);
}

/** グループチャンネルを作る */
export async function createGroup(_prev: ChannelResult, form: FormData): Promise<ChannelResult> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "チャンネル名を入力してください。" };

  const members = form.getAll("members").map(String).filter(Boolean);

  const { data, error } = await supabase.rpc("create_group_channel", {
    p_workspace_id: current.workspace.id,
    p_name: name,
    p_shape: String(form.get("shape") ?? "flower"),
    p_color: String(form.get("color") ?? "purple"),
    p_members: members,
  });
  if (error) return { error: error.message };

  revalidatePath("/channels");
  redirect(`/channels/${data as string}`);
}
