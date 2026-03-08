const DEMO_API_KEY = process.env.NEXT_PUBLIC_DEMO_API_KEY ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ai-support-agent.vercel.app";

export function LiveDemo() {
  if (!DEMO_API_KEY) return null;

  return (
    <section className="bg-muted px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          {/* Copy */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Try It Live
            </h2>
            <p className="mt-4 text-sm text-muted-foreground sm:text-base leading-relaxed">
              This widget is powered by the AI Support Agent platform. Ask it about
              orders, products, or request support — the agent will look up real data
              and escalate when needed.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {[
                "Ask: \"What is the status of order ORD-001?\"",
                "Ask: \"Do you have the AUDIO-WNC-BLK in stock?\"",
                "Ask: \"I have a problem with my order, can you help?\"",
              ].map((hint) => (
                <li key={hint} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-foreground">→</span>
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Widget embed */}
          <div className="flex justify-center lg:justify-end">
            <iframe
              src={`${APP_URL}/widget/${DEMO_API_KEY}`}
              width="380"
              height="540"
              style={{ border: "none", borderRadius: "16px" }}
              className="shadow-xl"
              title="AI Support Agent live demo"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
