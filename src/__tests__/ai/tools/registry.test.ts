import { describe, it, expect } from "vitest";
import { TOOL_REGISTRY, TOOL_NAMES, getToolsForPlan, isToolAllowed } from "@/lib/ai/tools/registry";
import { TOOL_METADATA, TOOL_LABELS } from "@/lib/ai/tool-metadata";
import { getPlanLimits } from "@/lib/plan/limits";

describe("TOOL_REGISTRY", () => {
  it("has an entry for every declared tool name", () => {
    expect(Object.keys(TOOL_REGISTRY).sort()).toEqual([...TOOL_NAMES].sort());
  });

  it("keys agree with the name inside each entry", () => {
    for (const [key, definition] of Object.entries(TOOL_REGISTRY)) {
      expect(definition.name).toBe(key);
    }
  });

  it("has matching display metadata for every tool", () => {
    // Cheap drift guard: a new tool added without metadata would render as a
    // blank badge in the dashboard and as a nameless entry in an MCP client.
    for (const name of TOOL_NAMES) {
      expect(TOOL_METADATA[name]).toBeDefined();
      expect(TOOL_LABELS[name]).toBeDefined();
    }
  });

  it("marks exactly the writing tool as destructive", () => {
    const mutating = TOOL_NAMES.filter((name) => TOOL_REGISTRY[name].mutates);
    expect(mutating).toEqual(["createTicket"]);
  });

  it("exposes a zod schema and a runner for every tool", () => {
    for (const name of TOOL_NAMES) {
      const definition = TOOL_REGISTRY[name];
      expect(typeof definition.run).toBe("function");
      // The same object the AI SDK tool receives — parseable, which is what
      // the MCP SDK requires of a Standard Schema.
      expect(definition.inputSchema.safeParse({}).success).toBeDefined();
    }
  });
});

describe("plan gating", () => {
  it("gives the free plan exactly the two read-only tools", () => {
    expect(getToolsForPlan("free").map((t) => t.name)).toEqual([
      "searchKnowledgeBase",
      "getOrderStatus",
    ]);
  });

  it("gives the pro plan all four", () => {
    expect(
      getToolsForPlan("pro")
        .map((t) => t.name)
        .sort()
    ).toEqual([...TOOL_NAMES].sort());
  });

  it("falls back to the free set for an unknown plan", () => {
    expect(getToolsForPlan("enterprise-unreleased").map((t) => t.name)).toEqual(
      getToolsForPlan("free").map((t) => t.name)
    );
  });

  it("does not expose writing tools on the free plan", () => {
    expect(isToolAllowed("free", "createTicket")).toBe(false);
    expect(isToolAllowed("pro", "createTicket")).toBe(true);
  });

  it("rejects a name that is not a tool at all", () => {
    expect(isToolAllowed("pro", "deleteEverything")).toBe(false);
  });

  it("agrees with the plan limits it derives from", () => {
    // The registry must not become a second, drifting copy of the plan rules.
    for (const plan of ["free", "pro"]) {
      expect(
        getToolsForPlan(plan)
          .map((t) => t.name)
          .sort()
      ).toEqual([...getPlanLimits(plan).enabledTools].sort());
    }
  });
});
