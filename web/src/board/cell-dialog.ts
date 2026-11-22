/**
 * What the 日展開's in-page dialog asks before a teacher cell action (設保留、解除保留、
 * 刪除海報), as plain data the dialog component renders.
 */

import { DEFAULT_HOLD_NAME } from "./hold-name";
import type { BoardSlot } from "./types";

export type CellAction = "setHold" | "releaseHold" | "deletePoster";

export type CellDialogContent = {
  action: CellAction;
  title: string;
  message: string;
  /** Only 設保留 asks for text: the optional 保留 name. */
  nameField?: { label: string; placeholder: string };
  confirmLabel: string;
  /** The confirm button is styled destructive (刪除海報). */
  danger: boolean;
};

/**
 * The dialog for a 日展開 cell's teacher action: 設保留 on an open 可借格, 解除保留 on a
 * held one, 刪除海報 on a 預約 with a 海報. Null when the cell has no action.
 */
export function cellDialogFor(slot: BoardSlot): CellDialogContent | null {
  const where = `${slot.room} ${slot.start}–${slot.end}`;
  if (slot.held) {
    return {
      action: "releaseHold",
      title: `解除 ${where} 的保留？`,
      message: "學生就能預約這一格。",
      confirmLabel: "解除保留",
      danger: false,
    };
  }
  if (slot.status === "open") {
    return {
      action: "setHold",
      title: `保留 ${where}`,
      message: "學生與 Agent 會看到這一格已借。",
      nameField: { label: `學生看到的名字（選填，空白顯示「${DEFAULT_HOLD_NAME}」）`, placeholder: DEFAULT_HOLD_NAME },
      confirmLabel: "設保留",
      danger: false,
    };
  }
  if (slot.poster) {
    return {
      action: "deletePoster",
      title: `刪除 ${where} 的海報？`,
      message: `「${slot.poster.title}」會從看板撤下，預約會保留。`,
      confirmLabel: "刪除海報",
      danger: true,
    };
  }
  return null;
}
