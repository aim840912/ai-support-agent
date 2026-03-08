import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Agentation } from "agentation";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ai-support-agent.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "AI Support Agent",
    template: "%s | AI Support Agent",
  },
  description:
    "Train an AI agent on your knowledge base and embed a chat widget on any website. Resolve customer queries instantly — with order lookup, inventory check, and ticket escalation built in.",
  metadataBase: new URL(appUrl),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: appUrl,
    siteName: "AI Support Agent",
    title: "AI Support Agent — AI Customer Support That Never Sleeps",
    description:
      "Train an AI agent on your knowledge base and embed a chat widget on any website. Resolve 80% of support queries automatically.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Support Agent — AI Customer Support That Never Sleeps",
    description:
      "Train an AI agent on your knowledge base and embed a chat widget on any website. Resolve 80% of support queries automatically.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
