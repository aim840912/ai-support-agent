import { prisma } from "@/lib/db";
import { hashApiKey } from "@/lib/api-key";
import { WidgetChatInterface } from "@/components/widget/widget-chat-interface";
import { notFound } from "next/navigation";

export default async function WidgetPage({ params }: { params: Promise<{ apiKey: string }> }) {
  const { apiKey } = await params;

  // Validate the API key and fetch org + agent settings.
  // Use hash-based lookup (consistent with /api/widget/chat) with a plaintext
  // fallback for orgs created before the hash migration.
  const keyHash = hashApiKey(apiKey);
  const org = await prisma.organization.findFirst({
    where: {
      OR: [{ apiKeyHash: keyHash }, { apiKeyHash: null, apiKey: apiKey }],
    },
    select: {
      id: true,
      name: true,
      agentSettings: {
        select: { welcomeMessage: true },
      },
    },
  });

  if (!org) {
    notFound();
  }

  const welcomeMessage = org.agentSettings?.welcomeMessage ?? "Hi! How can I help you today?";

  return <WidgetChatInterface apiKey={apiKey} welcomeMessage={welcomeMessage} orgName={org.name} />;
}
