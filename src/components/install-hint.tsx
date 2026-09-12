"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "easy-check-in.install-hint-dismissed";

const subscribe = () => () => {};

function isIosSafari() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  // Chrome and Firefox on iOS are Safari underneath but cannot install.
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS predates display-mode for home-screen apps.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * iOS offers no install prompt of its own, so the only way a user learns they
 * can add the app to their home screen is being told. Android fires
 * `beforeinstallprompt`, which gives us a real button instead.
 */
export function InstallHint() {
  // Everything this decides on lives in the browser, so nothing is decided
  // until after hydration.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const [deferred, setDeferred] = useState<Event | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!mounted || dismissed) return null;
  if (wasDismissed() || isInstalled()) return null;

  const mode = deferred ? "prompt" : isIosSafari() ? "ios" : null;
  if (!mode) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Forgetting the dismissal is a small annoyance, not a failure.
    }
    setDismissed(true);
  }

  return (
    <aside className="border-border/70 bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <p className="text-sm">
        {mode === "ios" ? (
          <>
            Add Easy Check-In to your home screen: tap <strong>Share</strong>,
            then <strong>Add to Home Screen</strong>.
          </>
        ) : (
          "Install Easy Check-In for one-tap access from your home screen."
        )}
      </p>
      <span className="flex gap-2">
        {mode === "prompt" ? (
          <Button
            size="sm"
            onClick={async () => {
              await (
                deferred as Event & { prompt?: () => Promise<void> }
              )?.prompt?.();
              dismiss();
            }}
          >
            Install
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </span>
    </aside>
  );
}
