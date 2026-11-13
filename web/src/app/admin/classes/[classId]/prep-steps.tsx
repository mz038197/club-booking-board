import type { ClassRef } from "@/server/router-gateway";
import type { BoardSlot, Session } from "@/server/sessions";
import type { AgentBuilderSettings } from "@/server/public-urls";
import { AgentBuilderStep } from "./steps/agent-builder-step";
import { SlotsStep } from "./steps/slots-step";
import type { PrepStepView } from "./workspace";

/** What every 課前準備 step may read; loaded once by the page. Extend it when a step needs more. */
export type SessionContext = {
  cls: ClassRef;
  session: Session;
  isCurrent: boolean;
  slots: BoardSlot[];
  /** Agent Builder 設定 values + the 學生專用 OpenAPI (JSON text) to copy. */
  agentBuilder: { settings: AgentBuilderSettings; openApi: string };
  /** Students on this 堂課's 名冊 (called the API at least once). */
  rosterCount: number;
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
      key: "agent-builder",
      title: "Agent Builder 設定",
      // Not stored anywhere: the space is set up outside this app. Once a student's
      // Agent has called the API in this 堂課, the setup evidently works.
      done: ctx.rosterCount > 0,
      hint: ctx.rosterCount > 0 ? `${ctx.rosterCount} 位學生已連上` : "整個空間設一次",
      body: <AgentBuilderStep settings={ctx.agentBuilder.settings} openApi={ctx.agentBuilder.openApi} />,
    },
  ];
}
