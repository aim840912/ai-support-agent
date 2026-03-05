"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Server actions are callable from the browser — always validate input.
// The TypeScript type alone is NOT sufficient: the caller can send arbitrary
// data (e.g., via a crafted fetch to the action endpoint).
const VALID_TOOLS = [
  "searchKnowledgeBase",
  "getOrderStatus",
  "checkInventory",
  "createTicket",
] as const;

const updateAgentSettingsSchema = z.object({
  welcomeMessage: z.string().max(500, "Welcome message must be 500 characters or fewer"),
  systemPrompt: z.string().max(5000, "System prompt must be 5000 characters or fewer"),
  enabledTools: z.array(z.enum(VALID_TOOLS)),
});

// Use a looser input type at the TypeScript boundary — the Zod schema enforces
// correctness at runtime. This avoids requiring callers to cast to the literal
// union type, while still catching invalid values server-side.
type UpdateAgentSettingsInput = {
  welcomeMessage: string;
  systemPrompt: string;
  enabledTools: string[];
};

export async function updateAgentSettings(input: UpdateAgentSettingsInput) {
  const session = await auth();
  if (!session?.user?.orgId) {
    throw new Error("Unauthorized");
  }

  const { orgId } = session.user;

  // Validate and sanitize input before writing to the database
  const validated = updateAgentSettingsSchema.parse(input);

  await prisma.agentSettings.upsert({
    where: { orgId },
    create: {
      orgId,
      welcomeMessage: validated.welcomeMessage,
      systemPrompt: validated.systemPrompt || null,
      enabledTools: validated.enabledTools,
    },
    update: {
      welcomeMessage: validated.welcomeMessage,
      systemPrompt: validated.systemPrompt || null,
      enabledTools: validated.enabledTools,
    },
  });

  revalidatePath("/settings");
}
