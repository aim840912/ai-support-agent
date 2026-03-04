import { prisma } from "@/lib/db";
import { WidgetChatInterface } from "@/components/widget/widget-chat-interface";
import { notFound } from "next/navigation";

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ apiKey: string }>;
}) {
  const { apiKey } = await params;

  // Validate the API key and fetch org + agent settings
  const org = await prisma.organization.findUnique({
    where: { apiKey },
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

  const welcomeMessage =
    org.agentSettings?.welcomeMessage ??
    "Hi! How can I help you today?";

  return (
    <WidgetChatInterface
      apiKey={apiKey}
      welcomeMessage={welcomeMessage}
      orgName={org.name}
    />
  );
}
