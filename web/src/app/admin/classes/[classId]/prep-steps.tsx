import type { ClassRef } from "@/server/router-gateway";
import type { BoardSlot, Session } from "@/server/sessions";
import { RulesStep } from "./steps/rules-step";
import { SlotsStep } from "./steps/slots-step";
import type { PrepStepView } from "./workspace";

/** What every 課前準備 step may read; loaded once by the page. Extend it when a step needs more. */
export type SessionContext = {
  cls: ClassRef;
  session: Session;
  isCurrent: boolean;
  slots: BoardSlot[];
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
      key: "rules",
      title: "預約規則",
      // Defaults are usable as-is; the step is "done" once it is visible (原型: 看過即完成).
      done: true,
      hint: `每人 ${ctx.session.perStudentLimit} 格・${
        ctx.session.bookingWindow ? `${ctx.session.bookingWindow.start}–${ctx.session.bookingWindow.end}` : "不限時間"
      }`,
      body: (
        <RulesStep
          sessionId={ctx.session.id}
          perStudentLimit={ctx.session.perStudentLimit}
          bookingWindow={ctx.session.bookingWindow}
        />
      ),
    },
  ];
}
