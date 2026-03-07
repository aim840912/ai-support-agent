"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { generateApiKey, hashApiKey } from "@/lib/api-key";
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

  // Only owners and admins can change agent settings
  const role = session.user.role;
  if (role !== "owner" && role !== "admin") {
    throw new Error("Forbidden: insufficient permissions");
  }

  const { orgId } = session.user;

  // safeParse avoids throwing a raw ZodError — invalid input is handled
  // explicitly rather than propagating opaque validation exceptions.
  const result = updateAgentSettingsSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Validation failed");
  }

  const validated = result.data;

  try {
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
  } catch (error) {
    console.error("[updateAgentSettings]", error);
    throw new Error("Failed to save settings. Please try again.");
  }

  revalidatePath("/settings");
}

export async function regenerateApiKey() {
  const session = await auth();
  if (!session?.user?.orgId) {
    throw new Error("Unauthorized");
  }

  // Only the org owner can regenerate the API key — this is a destructive action
  // that immediately breaks all existing widget embed scripts.
  const role = session.user.role;
  if (role !== "owner") {
    throw new Error("Forbidden: only the organization owner can regenerate the API key");
  }

  const { orgId } = session.user;

  const newKey = generateApiKey();
  const newHash = hashApiKey(newKey);

  try {
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        apiKey: newKey,
        apiKeyHash: newHash,
      },
    });
  } catch (error) {
    console.error("[regenerateApiKey]", error);
    throw new Error("Failed to regenerate API key. Please try again.");
  }

  revalidatePath("/settings");

  // Return the new raw key so the UI can display it immediately
  return { apiKey: newKey };
}
