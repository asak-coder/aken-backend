export function trackEvent(action: string, params: Record<string, any> = {}) {
  if (typeof window === "undefined") return;
  if ((window as any).gtag) {
    (window as any).gtag("event", action, params);
  } else {
    // fallback to dataLayer
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({ event: action, ...params });
  }
}