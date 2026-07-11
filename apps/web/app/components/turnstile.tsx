// Minimal Cloudflare Turnstile widget. Rendered only when enforcement is enabled;
// the token is sent to Better Auth as the x-captcha-response header.
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void },
      ) => string;
    };
  }
}

export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scriptId = "cf-turnstile-script";
    const render = () => {
      if (ref.current && window.turnstile) {
        window.turnstile.render(ref.current, { sitekey: siteKey, callback: onToken });
      }
    };
    if (document.getElementById(scriptId)) {
      render();
      return;
    }
    const s = document.createElement("script");
    s.id = scriptId;
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [siteKey, onToken]);

  return <div ref={ref} />;
}
