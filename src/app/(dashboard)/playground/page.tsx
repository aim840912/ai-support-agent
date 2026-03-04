import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isLlmMockMode } from "@/lib/mock-mode";
import { ChatInterface } from "@/components/chat/chat-interface";
import { DEFAULT_WELCOME_MESSAGE } from "@/lib/ai/prompts";

export default async function PlaygroundPage() {
  const session = await auth();
  if (!session?.user?.orgId) {
    redirect("/login");
  }

  const { orgId } = session.user;

  // Fetch agent settings for welcome message (non-fatal if DB unavailable)
  let welcomeMessage = DEFAULT_WELCOME_MESSAGE;
  try {
    const settings = await prisma.agentSettings.findUnique({
      where: { orgId },
      select: { welcomeMessage: true },
    });
    if (settings?.welcomeMessage) {
      welcomeMessage = settings.welcomeMessage;
    }
  } catch {
    // Use default welcome message if DB query fails
  }

  const llmMock = isLlmMockMode();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Page header */}
      <div className="shrink-0 px-6 py-4 border-b border-zinc-200 bg-white">
        <h1 className="text-xl font-semibold text-zinc-900">Playground</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Test your AI support agent before deploying to customers
        </p>
      </div>

      {/* Chat fills remaining height */}
      <div className="flex-1 min-h-0">
        <ChatInterface
          orgId={orgId}
          isLlmMock={llmMock}
          welcomeMessage={welcomeMessage}
        />
      </div>
    </div>
  );
}
