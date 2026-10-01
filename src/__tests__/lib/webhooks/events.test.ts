import { describe, it, expect } from "vitest";
import { buildEvent, parseStoredEvent } from "@/lib/webhooks/events";

const ORG = "org-1";

describe("parseStoredEvent", () => {
  it("recovers a stored event with its original id", () => {
    const event = buildEvent("ticket.created", ORG, { ticketNumber: "TKT-1" });

    const parsed = parseStoredEvent(JSON.stringify(event), ORG);

    expect(parsed).toEqual(event);
  });

  it("refuses a body that was truncated on storage", () => {
    const event = buildEvent("ticket.created", ORG, { description: "x".repeat(3000) });
    const truncated = `${JSON.stringify(event).slice(0, 2000)}…[truncated]`;

    expect(parseStoredEvent(truncated, ORG)).toBeNull();
  });

  it("refuses an event that belongs to another org", () => {
    const event = buildEvent("ticket.created", "org-2", {});

    expect(parseStoredEvent(JSON.stringify(event), ORG)).toBeNull();
  });

  it("refuses an unknown event name", () => {
    const event = { ...buildEvent("ticket.created", ORG, {}), event: "ticket.deleted" };

    expect(parseStoredEvent(JSON.stringify(event), ORG)).toBeNull();
  });

  it("refuses a missing body", () => {
    expect(parseStoredEvent(null, ORG)).toBeNull();
  });
});
