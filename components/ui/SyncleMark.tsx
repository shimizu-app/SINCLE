import { C } from "@/lib/design";

/** SYNCLE のブランドシンボル。6色が輪になり、中心が白く抜ける。 */
export function SyncleMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0" aria-hidden="true">
      <circle cx="50" cy="20" r="17" fill={C.red} />
      <circle cx="76" cy="35" r="17" fill={C.yellow} />
      <circle cx="76" cy="65" r="17" fill={C.green} />
      <circle cx="50" cy="80" r="17" fill={C.blue} />
      <circle cx="24" cy="65" r="17" fill={C.purple} />
      <circle cx="24" cy="35" r="17" fill={C.pink} />
      <circle cx="50" cy="50" r="16" fill="#fff" />
    </svg>
  );
}
