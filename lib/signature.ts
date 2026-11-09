/** 署名を入れていない人の既定の署名（AIメールの末尾に付ける） */
export function defaultSignature(name: string, role: string, workspace: string, email: string): string {
  return ["――――――――――", workspace, role && role !== "メンバー" ? `${role}　${name}` : name, email].join("\n");
}
