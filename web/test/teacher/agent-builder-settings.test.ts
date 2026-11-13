import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentBuilderStep } from "@/app/admin/classes/[classId]/steps/agent-builder-step";
import { agentBuilderSettings } from "@/server/public-urls";

describe("Agent Builder 設定 values", () => {
  it("defaults to the vans MCP OAuth entry and the router's OAuth endpoints", () => {
    expect(agentBuilderSettings({}, "https://club.example.app")).toEqual({
      apiBaseUrl: "https://club.example.app/api/v1",
      mcpUrl: "https://mcp.vanscoding.com/mcp-oauth/",
      authorizationUrl: "https://ai.vanscoding.com/oauth/authorize",
      tokenUrl: "https://ai.vanscoding.com/oauth/token",
      scope: "classroom",
      clientId: "agent-builder",
    });
  });

  it("follows ROUTER_URL for the OAuth endpoints", () => {
    const s = agentBuilderSettings({ ROUTER_URL: "https://router.example.com/" }, "https://club.example.app");

    expect(s.authorizationUrl).toBe("https://router.example.com/oauth/authorize");
    expect(s.tokenUrl).toBe("https://router.example.com/oauth/token");
  });

  it("takes every URL and the client id from env when set", () => {
    const s = agentBuilderSettings(
      {
        PUBLIC_BASE_URL: "https://booking.example.org",
        ROUTER_URL: "http://router.internal",
        ROUTER_PUBLIC_URL: "https://router.example.com",
        MCP_SERVER_URL: "https://mcp.example.com/mcp-oauth/",
        AGENT_BUILDER_CLIENT_ID: "mitac-space-1",
      },
      "https://ignored.example.app",
    );

    expect(s).toEqual({
      apiBaseUrl: "https://booking.example.org/api/v1",
      mcpUrl: "https://mcp.example.com/mcp-oauth/",
      authorizationUrl: "https://router.example.com/oauth/authorize",
      tokenUrl: "https://router.example.com/oauth/token",
      scope: "classroom",
      clientId: "mitac-space-1",
    });
  });
});

describe("課前準備・Agent Builder 設定 card", () => {
  const settings = agentBuilderSettings({}, "https://club.example.app");
  const html = renderToStaticMarkup(createElement(AgentBuilderStep, { settings, openApi: '{"openapi":"3.0.3"}' }));

  it("shows the API tool and the MCP Server, each with OAuth 2.0 user authorization", () => {
    expect(html).toContain("API 工具");
    expect(html).toContain("MCP Server");
    expect(html.match(/OAuth 2\.0（使用者授權）/g)).toHaveLength(2);
  });

  it.each([
    ["Base URL", "https://club.example.app/api/v1"],
    ["MCP URL", "https://mcp.vanscoding.com/mcp-oauth/"],
    ["Authorization URL", "https://ai.vanscoding.com/oauth/authorize"],
    ["Token URL", "https://ai.vanscoding.com/oauth/token"],
    ["Scope", "classroom"],
    ["Client ID", "agent-builder"],
  ])("offers %s (%s) with a copy button", (label, value) => {
    expect(html).toContain(value);
    expect(html).toContain(`aria-label="複製 ${label}"`);
  });

  it("offers the student OpenAPI to copy, and warns about a localhost callback", () => {
    expect(html).toContain("複製學生用 OpenAPI");
    expect(html).toContain("localhost");
  });
});
