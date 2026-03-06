import Link from "next/link";
import { Bot, FileText, MessageSquare, BarChart3, Code, ArrowRight } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Knowledge Base",
    description:
      "Upload documents, FAQs, and product guides. Your AI agent learns from your content instantly.",
  },
  {
    icon: MessageSquare,
    title: "AI Chat",
    description:
      "Deploy an intelligent chat widget that answers customer questions 24/7 without human intervention.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description:
      "Track conversation volume, resolution rates, and customer satisfaction across all interactions.",
  },
  {
    icon: Code,
    title: "Easy Integration",
    description:
      "Embed your support agent with a single line of code. Works with any website or web app.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-muted">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Bot className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold text-foreground">AI Support Agent</span>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-muted px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            AI-Powered Customer Support
            <br />
            That Never Sleeps
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Resolve customer queries instantly with an intelligent AI agent trained on your
            knowledge base.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors sm:w-auto"
            >
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors sm:w-auto"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
            Everything You Need
          </h2>
          <p className="mt-3 text-center text-sm text-muted-foreground sm:text-base">
            A complete platform to automate your customer support
          </p>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="mb-4 inline-flex rounded-lg bg-muted p-2.5">
                  <Icon className="h-5 w-5 text-foreground" aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            Ready to Transform Your Customer Support?
          </h2>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            Set up your AI agent in minutes. No coding required.
          </p>
          <div className="mt-8">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <span>© 2026 AI Support Agent</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-foreground transition-colors">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
