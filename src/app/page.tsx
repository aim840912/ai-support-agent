import Link from "next/link";
import {
  Bot,
  FileText,
  MessageSquare,
  BarChart3,
  Code,
  ArrowRight,
  ShieldCheck,
  Users,
  Package,
} from "lucide-react";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { LiveDemo } from "@/components/landing/live-demo";
import { demoSignIn } from "@/actions/demo";

const features = [
  {
    icon: FileText,
    title: "RAG Knowledge Base",
    description:
      "Upload PDFs and documents. Auto-chunked, embedded, and indexed for semantic vector search via pgvector.",
  },
  {
    icon: MessageSquare,
    title: "AI Chat Agent",
    description:
      "Tool-calling agent powered by Groq Llama 3. Looks up orders, checks inventory, and escalates tickets automatically.",
  },
  {
    icon: Code,
    title: "1-Line Embed",
    description:
      "Paste one iframe snippet to deploy your support widget on any website. API-key authenticated, zero dependencies.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description:
      "Track conversation volume, resolution rates, and response times. Spot trends before they become problems.",
  },
  {
    icon: Users,
    title: "Team Management",
    description:
      "Invite teammates via email with role-based access. Collaborate on knowledge base and ticket reviews.",
  },
  {
    icon: Package,
    title: "Order & Inventory",
    description:
      'Connect your product catalog and order data. The AI agent answers "where\'s my order?" and inventory questions instantly.',
  },
  {
    icon: ShieldCheck,
    title: "Enterprise Security",
    description:
      "SHA-256 API key hashing, CSP/HSTS headers, rate limiting, bcrypt auth, and full multi-tenant data isolation.",
  },
  {
    icon: Bot,
    title: "Multi-tenant SaaS",
    description:
      "Every organization's data is fully isolated. Free and Pro plans with usage limits enforced automatically.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-muted">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Bot className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold text-foreground">AI Support Agent</span>
          </div>

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
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-muted dot-pattern px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
            Production-ready · Multi-tenant · Open source
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            AI Customer Support
            <br />
            That Never Sleeps
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Train an AI agent on your knowledge base. Embed it on your website in under 5 minutes.
            Let it handle 80% of your support tickets automatically.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors sm:w-auto"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <form action={demoSignIn} className="w-full sm:w-auto">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-accent"
              >
                Try Demo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>

          {/* Social proof strip */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
            <span>No credit card required</span>
            <span>50 conversations / month free</span>
            <span>Deploy in &lt; 5 minutes</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Everything You Need, Nothing You Don&apos;t
          </h2>
          <p className="mt-3 text-center text-sm text-muted-foreground sm:text-base">
            A complete, production-grade support platform — not just a chatbot wrapper
          </p>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <HowItWorks />

      {/* Live Demo (only renders if NEXT_PUBLIC_DEMO_API_KEY is set) */}
      <LiveDemo />

      {/* Pricing */}
      <Pricing />

      {/* Final CTA */}
      <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ready to Automate Your Support?
          </h2>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            Join teams using AI Support Agent to handle customer queries 24/7. Set up takes under 5
            minutes.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
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
          <span>© 2026 AI Support Agent. Open source.</span>
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
