import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

type ExportFormat = "csv" | "json";

/** Escape a CSV field — wrap in quotes and double-up any internal quotes. */
function escapeCsv(value: string | null | undefined): string {
  const str = value ?? "";
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { orgId } = session.user;

  const rawFormat = request.nextUrl.searchParams.get("format") ?? "json";
  const format: ExportFormat = rawFormat === "csv" ? "csv" : "json";

  const rawSource = request.nextUrl.searchParams.get("source");
  const VALID_SOURCES = ["widget", "dashboard", "api"] as const;
  type ValidSource = (typeof VALID_SOURCES)[number];
  const source: ValidSource | undefined =
    rawSource && VALID_SOURCES.includes(rawSource as ValidSource)
      ? (rawSource as ValidSource)
      : undefined;

  try {
    const sessions = await prisma.chatSession.findMany({
      where: {
        orgId,
        ...(source ? { source } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const filename = `conversations-${timestamp}.${format}`;

    if (format === "json") {
      const data = sessions.map((s) => ({
        sessionId: s.id,
        source: s.source,
        visitorId: s.visitorId,
        userId: s.userId,
        createdAt: s.createdAt.toISOString(),
        messages: s.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      }));

      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // CSV: one row per message, sessions flattened
    const rows: string[] = [
      // Header
      ["sessionId", "source", "visitorId", "sessionCreatedAt", "messageId", "role", "content", "messageCreatedAt"].join(","),
    ];

    for (const s of sessions) {
      if (s.messages.length === 0) {
        rows.push(
          [
            escapeCsv(s.id),
            escapeCsv(s.source),
            escapeCsv(s.visitorId),
            escapeCsv(s.createdAt.toISOString()),
            escapeCsv(""),
            escapeCsv(""),
            escapeCsv(""),
            escapeCsv(""),
          ].join(",")
        );
      } else {
        for (const m of s.messages) {
          rows.push(
            [
              escapeCsv(s.id),
              escapeCsv(s.source),
              escapeCsv(s.visitorId),
              escapeCsv(s.createdAt.toISOString()),
              escapeCsv(m.id),
              escapeCsv(m.role),
              escapeCsv(m.content),
              escapeCsv(m.createdAt.toISOString()),
            ].join(",")
          );
        }
      }
    }

    return new Response(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[ConversationsExportAPI]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
