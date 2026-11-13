const MASK = "○";

/**
 * 遮蔽顯示名稱 for the projection: keep a leading seat number, the first and the
 * last character of the name, hide the rest (王小明 → 王○明, 07王小明 → 07王○明, 小明 → 小○).
 */
export function maskDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  const [, seat, name] = /^(\d*)(.*)$/su.exec(trimmed) ?? ["", "", trimmed];
  const chars = Array.from(name);
  if (chars.length <= 1) return trimmed;
  if (chars.length === 2) return `${seat}${chars[0]}${MASK}`;
  return `${seat}${chars[0]}${MASK.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}
