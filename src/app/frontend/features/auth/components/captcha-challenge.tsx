import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Unable to load the abuse-protection challenge."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export const captchaSiteKey =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? "";

export function CaptchaChallenge({
  onToken,
  onError,
}: {
  onToken: (token: string) => void;
  onError: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!captchaSiteKey || !container.current) return;
    let active = true;
    let widgetId: string | null = null;
    void loadTurnstile()
      .then(() => {
        if (!active || !container.current || !window.turnstile) return;
        widgetId = window.turnstile.render(container.current, {
          sitekey: captchaSiteKey,
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () =>
            onError(
              "Unable to verify the abuse-protection challenge. Please retry.",
            ),
        });
      })
      .catch((error) =>
        onError(
          error instanceof Error
            ? error.message
            : "Unable to load the abuse-protection challenge.",
        ),
      );
    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onError, onToken]);
  if (!captchaSiteKey) return null;
  return <div ref={container} aria-label="Abuse-protection challenge" />;
}
