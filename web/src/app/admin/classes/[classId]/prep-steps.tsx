import type { ClassRef } from "@/server/router-gateway";
import type { BoardSlot, Session } from "@/server/sessions";
import { remainingText } from "@/board/format";
import { DisplayStep } from "./steps/display-step";
import { ShareStep } from "./steps/share-step";
import { SlotsStep } from "./steps/slots-step";
import type { PrepStepView } from "./workspace";

/** What every 課前準備 step may read; loaded once by the page. Extend it when a step needs more. */
export type SessionContext = {
  cls: ClassRef;
  session: Session;
  isCurrent: boolean;
  slots: BoardSlot[];
  /** 學生分享連結: expiry (ISO) of the live link, null when there is none */
  shareLinkExpiresAt: string | null;
  /** When the page was rendered (deps.now()), for time-based hints */
  now: Date;
};

/**
 * 課前準備 steps, in order (原型版本 C): 可借清單 → 預約規則 (#19) → Agent Builder 設定 (#23)
 * → 學生分享連結 (#22) → 投影顯示 (#21). Add a step by appending an entry here;
 * put its client UI in ./steps/.
 */
export function prepSteps(ctx: SessionContext): PrepStepView[] {
  return [
    {
      key: "slots",
      title: "可借清單",
      done: ctx.slots.length > 0,
      hint: `${ctx.slots.length} 格`,
      body: <SlotsStep sessionId={ctx.session.id} slots={ctx.slots} />,
    },
    {
      key: "share",
      title: "學生分享連結",
      // Optional: students can work without it; done once a live link exists.
      done: ctx.shareLinkExpiresAt !== null,
      hint: ctx.shareLinkExpiresAt
        ? remainingText(ctx.shareLinkExpiresAt, ctx.now)
        : ctx.isCurrent
          ? "未產生"
          : "僅限目前堂課",
      body: (
        // No key on purpose: the URL lives only in this component's state (only a hash
        // is stored), so a router.refresh() after 產生 must not remount it.
        <ShareStep
          sessionId={ctx.session.id}
          isCurrent={ctx.isCurrent}
          expiresAt={ctx.shareLinkExpiresAt}
        />
      ),
    },
    {
      key: "display",
      title: "投影顯示",
      // Optional settings: the step is ready as soon as there is something to project.
      done: ctx.slots.length > 0,
      hint: [ctx.session.maskNames ? "遮蔽名稱" : "完整名稱", ctx.session.autoFollow ? "自動跳日" : null]
        .filter(Boolean)
        .join("・"),
      body: (
        <DisplayStep
          key={`${ctx.session.maskNames}-${ctx.session.autoFollow}`}
          classId={ctx.cls.id}
          sessionId={ctx.session.id}
          initial={{ mask_names: ctx.session.maskNames, auto_follow: ctx.session.autoFollow }}
        />
      ),
    },
  ];
}
