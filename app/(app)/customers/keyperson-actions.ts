"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrent } from "@/lib/workspace";
import type { KeyGenre, KeyLayer, KeyScope } from "@/types/db";

export type KeyResult = { error: string } | { ok: true } | undefined;

const str = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

export async function saveKeyPerson(_prev: KeyResult, form: FormData): Promise<KeyResult> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const name = str(form, "name");
  if (!name) return { error: "名前を入力してください。" };

  const row = {
    workspace_id: current.workspace.id,
    contact_id: str(form, "contactId"),
    name,
    kana: str(form, "kana"),
    company_name: str(form, "companyName"),
    title: str(form, "title"),
    genre: (str(form, "genre") ?? "other") as KeyGenre,
    sub_genres: form.getAll("subGenres").map(String) as KeyGenre[],
    layers: form.getAll("layers").map(String) as KeyLayer[],
    scope: (str(form, "scope") ?? "pref") as KeyScope,
    pref: str(form, "pref"),
    city: str(form, "city"),
    met: str(form, "met"),
    about: str(form, "about"),
    network: str(form, "network"),
  };

  const id = str(form, "id");
  const { error } = id
    ? await supabase
        .from("key_persons")
        .update(row)
        .eq("id", id)
        .eq("workspace_id", current.workspace.id)
    : await supabase.from("key_persons").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { ok: true };
}

export async function addReferral(_prev: KeyResult, form: FormData): Promise<KeyResult> {
  const current = await requireCurrent();
  const supabase = await createClient();

  const keyPersonId = str(form, "keyPersonId");
  const toName = str(form, "toName");
  if (!keyPersonId || !toName) return { error: "紹介先を入力してください。" };

  const { error } = await supabase.from("referrals").insert({
    workspace_id: current.workspace.id,
    key_person_id: keyPersonId,
    to_name: toName,
    result: str(form, "result") ?? "初回接触",
    happened_at: str(form, "happenedAt"),
  });
  if (error) return { error: error.message };

  revalidatePath("/customers");
  return { ok: true };
}

export async function deleteKeyPerson(id: string) {
  const current = await requireCurrent();
  const supabase = await createClient();
  await supabase.from("key_persons").delete().eq("id", id).eq("workspace_id", current.workspace.id);
  revalidatePath("/customers");
}
