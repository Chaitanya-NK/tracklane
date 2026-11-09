"use client";

import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  type NotificationChannel,
  type NotificationChannels,
  type NotificationType,
} from "@tracklane/core";
import { BellRingIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deletePushSubscriptionAction,
  savePushSubscriptionAction,
  setPreferenceAction,
} from "../server/actions";

type Prefs = Record<NotificationType, NotificationChannels>;
const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  inApp: "Inbox",
  email: "Email",
  push: "Push",
};

export function NotificationPreferences({
  preferences,
  vapidPublicKey,
  pushDevices,
}: {
  preferences: Prefs;
  vapidPublicKey: string | null;
  pushDevices: number;
}) {
  const [prefs, setPrefs] = useOptimistic(preferences);
  const [, startTransition] = useTransition();
  const save = useAction(setPreferenceAction);

  function toggle(type: NotificationType, channel: NotificationChannel, on: boolean) {
    const channels = { ...prefs[type], [channel]: on };
    startTransition(async () => {
      setPrefs({ ...prefs, [type]: channels });
      const res = await save.executeAsync({ type, channels });
      if (res?.serverError) toast.error(res.serverError.message);
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">My notifications</h2>
          <p className="text-sm text-muted-foreground">
            Choose where each kind of update reaches you. Emails are batched: at most one per
            minute, listing everything new. These settings are yours and apply in every workspace.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Update</TableHead>
                {(Object.keys(CHANNEL_LABELS) as NotificationChannel[]).map((c) => (
                  <TableHead key={c} className="w-20 text-center">
                    {CHANNEL_LABELS[c]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {NOTIFICATION_TYPES.map((type) => (
                <TableRow key={type}>
                  <TableCell className="whitespace-normal">
                    <div className="font-medium">{NOTIFICATION_TYPE_LABELS[type].label}</div>
                    <div className="text-xs text-muted-foreground">
                      {NOTIFICATION_TYPE_LABELS[type].description}
                    </div>
                  </TableCell>
                  {(Object.keys(CHANNEL_LABELS) as NotificationChannel[]).map((channel) => (
                    <TableCell key={channel} className="text-center">
                      <Checkbox
                        checked={prefs[type][channel]}
                        onCheckedChange={(v) => toggle(type, channel, v === true)}
                        aria-label={`${NOTIFICATION_TYPE_LABELS[type].label}: ${CHANNEL_LABELS[channel]}`}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      <PushSetup vapidPublicKey={vapidPublicKey} devices={pushDevices} />
    </div>
  );
}

// ── Web Push ────────────────────────────────────────────────────────────────

const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const noop = () => () => {};

function base64UrlToBytes(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function PushSetup({
  vapidPublicKey,
  devices,
}: {
  vapidPublicKey: string | null;
  devices: number;
}) {
  const supported = useSyncExternalStore(noop, pushSupported, () => false);
  const [busy, setBusy] = useState(false);
  const [enabledHere, setEnabledHere] = useState<boolean | null>(null);
  const saveSub = useAction(savePushSubscriptionAction);
  const deleteSub = useAction(deletePushSubscriptionAction);

  useEffect(() => {
    if (!supported) return;
    void currentSubscription().then((subscription) => setEnabledHere(Boolean(subscription)));
  }, [supported]);

  async function enable() {
    if (!vapidPublicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications are blocked for this site in your browser settings");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(vapidPublicKey),
        }));
      const json = subscription.toJSON();
      const res = await saveSub.executeAsync({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent.slice(0, 300),
      });
      if (res?.serverError) throw new Error(res.serverError.message);
      setEnabledHere(true);
      toast.success("Push notifications are on for this browser");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't turn on push notifications");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await deleteSub.executeAsync({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setEnabledHere(false);
      toast.success("Push notifications are off for this browser");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Push notifications</h2>
        <p className="text-sm text-muted-foreground">
          Browser notifications for the updates ticked under Push, even when Tracklane isn&apos;t
          open. {devices ? `On for ${devices} browser${devices === 1 ? "" : "s"}.` : ""}
        </p>
      </div>
      {!vapidPublicKey ? (
        <Alert>
          <BellRingIcon />
          <AlertTitle>Push isn&apos;t set up on this server</AlertTitle>
          <AlertDescription>
            Run <code>bash .devcontainer/setup.sh</code> to generate the VAPID keys, then restart{" "}
            <code>pnpm dev</code>.
          </AlertDescription>
        </Alert>
      ) : !supported ? (
        <p className="text-sm text-muted-foreground">
          This browser doesn&apos;t support push notifications.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {enabledHere === null ? (
            <Spinner />
          ) : enabledHere ? (
            <Button variant="outline" onClick={disable} disabled={busy}>
              {busy ? <Spinner /> : null}
              Turn off for this browser
            </Button>
          ) : (
            <Button onClick={enable} disabled={busy}>
              {busy ? <Spinner /> : <BellRingIcon />}
              Turn on for this browser
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
