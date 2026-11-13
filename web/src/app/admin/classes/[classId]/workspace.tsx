"use client";

import { useState, type ReactNode } from "react";
import { ui } from "@/app/ui";

/** One step of 課前準備 (built on the server in prep-steps.tsx). */
export type PrepStepView = {
  key: string;
  title: string;
  done: boolean;
  /** Short status next to the title, e.g. 「12 格」 */
  hint: string;
  body: ReactNode;
};

/**
 * The 堂課 workspace (原型版本 C): ① 課前準備 (step wizard + 準備狀態 checklist)
 * and ② 上課中. The 上課中 tab appears once `live` is given (#20/#22).
 */
export function Workspace({ steps, live }: { steps: PrepStepView[]; live?: ReactNode }) {
  const [mode, setMode] = useState<"prep" | "live">("prep");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {live ? (
        <div role="tablist" style={{ ...ui.row, background: "var(--muted)", borderRadius: 8, padding: 4, width: "fit-content" }}>
          {(["prep", "live"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              style={{
                ...ui.buttonGhost,
                padding: "6px 12px",
                fontSize: 14,
                background: mode === m ? "var(--surface)" : "transparent",
                boxShadow: mode === m ? "var(--shadow-tab)" : "none",
              }}
            >
              {m === "prep" ? "① 課前準備" : "② 上課中"}
            </button>
          ))}
        </div>
      ) : null}
      {mode === "prep" || !live ? <PrepWizard steps={steps} /> : live}
    </div>
  );
}

function PrepWizard({ steps }: { steps: PrepStepView[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12, flex: "1 1 520px", minWidth: 0 }}>
        {steps.map((step, i) => (
          <li key={step.key} style={{ ...ui.card, padding: 0, borderColor: i === open ? "var(--border-strong)" : "var(--border)" }}>
            <button
              type="button"
              aria-expanded={i === open}
              onClick={() => setOpen(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "14px 16px",
                border: 0,
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 15,
              }}
            >
              <span
                style={{
                  display: "inline-grid",
                  placeItems: "center",
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: step.done ? "var(--success)" : i === open ? "var(--accent)" : "var(--muted)",
                  color: step.done || i === open ? "var(--surface)" : "var(--subtle-fg)",
                }}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <strong style={{ fontWeight: 600 }}>{step.title}</strong>
              <span style={{ ...ui.muted, fontSize: 13 }}>{step.hint}</span>
            </button>
            {i === open ? (
              <div style={{ padding: "0 16px 16px", display: "grid", gap: 16 }}>
                {step.body}
                {steps.length > 1 ? (
                  <div style={ui.row}>
                    {i > 0 ? (
                      <button type="button" style={ui.buttonOutline} onClick={() => setOpen(i - 1)}>
                        上一步
                      </button>
                    ) : null}
                    {i < steps.length - 1 ? (
                      <button type="button" style={ui.buttonPrimary} onClick={() => setOpen(i + 1)}>
                        下一步
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <aside style={{ ...ui.card, padding: 16, flex: "0 1 260px" }}>
        <h2 style={ui.h2}>準備狀態</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "grid", gap: 6, fontSize: 14 }}>
          {steps.map((s) => (
            <li key={s.key} style={{ color: s.done ? "var(--success-fg)" : "var(--subtle-fg)" }}>
              {s.done ? "✓" : "○"} {s.title}
            </li>
          ))}
        </ul>
        <p style={{ ...ui.muted, fontSize: 13, margin: 0 }}>
          不必按「開放」：課堂開始時間一到，學生用邀請碼換到的金鑰就能預約；下課自動失效。
        </p>
      </aside>
    </div>
  );
}
