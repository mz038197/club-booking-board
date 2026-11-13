"use client";

import { useState } from "react";
import type { AgentBuilderSettings } from "@/server/public-urls";
import { ui } from "@/app/ui";

/** Copies `text`, then shows 「已複製」 on the button for 2 s. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFailed(false);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      setFailed(true);
    }
  };
  return { copied, failed, copy };
}

type Row = [label: string, value: string];

/**
 * 課前準備・Agent Builder 設定: values the teacher pastes into the shared Agent Builder space,
 * once. API 工具 and MCP Server both use OAuth 2.0 (user authorization) at the router
 * (router ADR 0094), so no key is handed to students.
 */
export function AgentBuilderStep({ settings, openApi }: { settings: AgentBuilderSettings; openApi: string }) {
  const { copied, failed, copy } = useCopy();
  const oauth: Row[] = [
    ["Authorization URL", settings.authorizationUrl],
    ["Token URL", settings.tokenUrl],
    ["Scope", settings.scope],
    ["Client ID", settings.clientId],
  ];

  const block = (id: string, title: string, first: Row) => (
    <section style={{ display: "grid", gap: 8 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{title}</h3>
      <dl style={{ display: "grid", gridTemplateColumns: "max-content minmax(0, 1fr) max-content", gap: "6px 12px", margin: 0, alignItems: "center" }}>
        {[first, ["驗證方式", "OAuth 2.0（使用者授權）"] as Row, ...oauth].map(([label, value]) => {
          const key = `${id}-${label}`;
          const copyable = label !== "驗證方式";
          return (
            <div key={key} style={{ display: "contents" }}>
              <dt style={ui.muted}>{label}</dt>
              <dd style={{ ...ui.mono, margin: 0, overflowWrap: "anywhere" }}>{value}</dd>
              {copyable ? (
                <button type="button" style={ui.buttonGhost} aria-label={`複製 ${label}`} onClick={() => copy(key, value)}>
                  {copied === key ? "已複製" : "複製"}
                </button>
              ) : (
                <span />
              )}
            </div>
          );
        })}
        <dt style={ui.muted}>Client Secret</dt>
        <dd style={{ ...ui.muted, margin: 0 }}>向 router 管理員索取，不顯示在這裡</dd>
        <span />
      </dl>
    </section>
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <p style={{ ...ui.muted, margin: 0 }}>
        整個 Agent Builder 空間只要設定一次。學生第一次用工具時，會被帶去 router 輸入邀請碼與暱稱（或 Google），不用發金鑰給學生。
      </p>
      {block("api", "API 工具：社團教室預約", ["Base URL", settings.apiBaseUrl])}
      {block("mcp", "MCP Server：vans-mcp", ["MCP URL", settings.mcpUrl])}
      <div style={ui.row}>
        <button type="button" style={ui.buttonOutline} onClick={() => copy("openapi", openApi)}>
          {copied === "openapi" ? "已複製 OpenAPI" : "複製學生用 OpenAPI"}
        </button>
        <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer" style={{ ...ui.muted, fontSize: 13 }}>
          開啟 openapi.json
        </a>
      </div>
      {failed ? <p style={{ ...ui.alert, margin: 0 }}>無法存取剪貼簿，請手動選取文字複製。</p> : null}
      <p style={{ ...ui.muted, margin: 0 }}>
        ⚠ 平台的 OAuth Redirect URI（回呼網址）若顯示 localhost，學生授權後會導不回來，要請平台管理員改成實際網址。
      </p>
    </div>
  );
}
