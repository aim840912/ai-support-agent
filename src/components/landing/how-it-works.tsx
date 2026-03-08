import { Upload, Cpu, Globe, BarChart3 } from "lucide-react";

const steps = [
  {
    icon: Upload,
    step: "01",
    title: "Upload Your Content",
    description:
      "Upload PDFs, text files, or paste your FAQs. The platform automatically chunks, embeds, and indexes everything for semantic search.",
  },
  {
    icon: Cpu,
    step: "02",
    title: "Train the Agent",
    description:
      "Configure your AI agent's personality, tone, and which tools it can use — order lookup, inventory check, or ticket escalation.",
  },
  {
    icon: Globe,
    step: "03",
    title: "Embed on Your Site",
    description:
      "Copy a single iframe snippet from Settings and paste it into any website. Your agent goes live in under a minute.",
  },
  {
    icon: BarChart3,
    step: "04",
    title: "Monitor & Improve",
    description:
      "Track resolution rates, conversation volume, and response times. Review escalated tickets and continuously improve your knowledge base.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Up and Running in Minutes
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            No AI expertise required. Just upload, configure, and embed.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, step, title, description }) => (
            <div key={step} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
                  <Icon className="h-5 w-5 text-foreground" aria-hidden="true" />
                </div>
                <span className="text-xs font-mono font-semibold text-muted-foreground">
                  STEP {step}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
