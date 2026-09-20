"use client";

import { useState, useTransition } from "react";
import { Send, MessageSquare, Mail, Loader2, Plug, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  saveTelegramChannel,
  testTelegramChannel,
  disconnectTelegramChannel,
} from "@/app/(dashboard)/integrations/actions";

export type TelegramChannelView = {
  connected: boolean;
  botUsername: string | null;
  /** Masked hint only — the real token never leaves the server. */
  tokenHint: string | null;
  enabled: boolean;
  lastEventAt: string | null;
};

type ChannelsCardProps = {
  telegram: TelegramChannelView;
  /** Where Telegram will be told to send updates. */
  publicBaseUrl: string;
  reachable: boolean;
  canEdit: boolean;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "No messages yet";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const UNBUILT_CHANNELS = [
  { name: "Slack", icon: MessageSquare, blurb: "Answer from a Slack workspace" },
  { name: "Email", icon: Mail, blurb: "Reply to a support inbox" },
];

export function ChannelsCard({ telegram, publicBaseUrl, reachable, canEdit }: ChannelsCardProps) {
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(telegram.enabled);
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTesting] = useTransition();

  function handleSave(nextEnabled: boolean = enabled) {
    startTransition(async () => {
      const result = await saveTelegramChannel({
        botToken: token.trim() || undefined,
        enabled: nextEnabled,
      });
      if (result.ok) {
        setToken("");
        setEnabled(nextEnabled);
        toast.success(result.message);
      } else {
        // Put the switch back where it was, so the UI never claims a state
        // the server refused.
        setEnabled(telegram.enabled);
        toast.error(result.message);
      }
    });
  }

  function handleTest() {
    startTesting(async () => {
      const result = await testTelegramChannel();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectTelegramChannel();
      if (result.ok) {
        setEnabled(false);
        setToken("");
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Send className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-foreground">Telegram</h3>
            <p className="text-xs text-muted-foreground">
              {telegram.connected && telegram.botUsername
                ? `Connected as @${telegram.botUsername}`
                : "Answer customers from a Telegram bot"}
            </p>
          </div>
          {telegram.connected ? (
            <Badge variant={telegram.enabled ? "default" : "secondary"}>
              {telegram.enabled ? "Active" : "Paused"}
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </div>

        {!reachable && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            Telegram only delivers to public HTTPS addresses, and this server currently reports{" "}
            <code>{publicBaseUrl}</code>. Set <code>INTEGRATIONS_PUBLIC_URL</code> to a public
            address — in local development, a tunnel such as{" "}
            <code>cloudflared tunnel --url http://localhost:3000</code>.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="telegram-token">Bot token</Label>
          <Input
            id="telegram-token"
            name="telegramBotToken"
            type="password"
            autoComplete="off"
            placeholder={telegram.tokenHint ?? "123456789:AA..."}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={!canEdit || isPending}
          />
          <p className="text-xs text-muted-foreground">
            Create a bot with{" "}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              @BotFather
            </a>{" "}
            and paste the token it gives you. Check for the verified badge — impostor accounts use
            the same display name.
            {telegram.connected ? " Leave blank to keep the current token." : ""}
          </p>
        </div>

        {telegram.connected && (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="telegram-enabled">Receive messages</Label>
              <p className="text-xs text-muted-foreground">
                Last message: {formatWhen(telegram.lastEventAt)}
              </p>
            </div>
            <Switch
              id="telegram-enabled"
              checked={enabled}
              disabled={!canEdit || isPending}
              onCheckedChange={(next) => {
                setEnabled(next);
                handleSave(next);
              }}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleSave()} disabled={!canEdit || isPending} size="sm">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plug className="h-4 w-4" aria-hidden="true" />
            )}
            {telegram.connected ? "Update" : "Connect"}
          </Button>

          {telegram.connected && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={!canEdit || isTesting}
              >
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Test connection
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!canEdit || isPending}>
                    <Unplug className="h-4 w-4" aria-hidden="true" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Telegram?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The bot stops replying immediately and the stored token is deleted. Past
                      conversations are kept. Reconnecting needs the token from @BotFather again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Not built. Shown so the section reads as a deliberate scope rather than an empty page. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {UNBUILT_CHANNELS.map((channel) => (
          <div
            key={channel.name}
            className="space-y-2 rounded-lg border border-dashed border-border p-4 opacity-60"
          >
            <div className="flex items-center gap-3">
              <channel.icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-sm font-medium text-foreground">{channel.name}</h3>
              <Badge variant="outline" className="ml-auto">
                Not built
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{channel.blurb}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
