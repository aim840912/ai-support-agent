"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

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

  await prisma.agentSettings.upsert({
    where: { orgId },
    create: {
      orgId,
      welcomeMessage: input.welcomeMessage,
      systemPrompt: input.systemPrompt || null,
      enabledTools: input.enabledTools,
    },
    update: {
      welcomeMessage: input.welcomeMessage,
      systemPrompt: input.systemPrompt || null,
      enabledTools: input.enabledTools,
    },
  });

  revalidatePath("/settings");
}
