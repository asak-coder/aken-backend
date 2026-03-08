import { getPublicGoogleAdsLeadSendTo } from "@/lib/env";

type AnalyticsValue = string | number | boolean;
type AnalyticsParams = Record<string, AnalyticsValue | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function isTrackingReady() {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

function sanitizeParams(params: AnalyticsParams = {}) {
  const output: Record<string, AnalyticsValue> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    output[key] = value;
  }

  return output;
}

export function trackEvent(eventName: string, params?: AnalyticsParams) {
  if (!isTrackingReady()) {
    return false;
  }

  const payload = sanitizeParams(params);
  window.gtag?.("event", eventName, payload);
  return true;
}

type CtaClickInput = {
  ctaName: string;
  ctaLocation: string;
  destination: string;
  ctaType?: "phone" | "whatsapp" | "email" | "internal" | "external" | "button";
  eventName?: string;
};

export function trackCtaClick(input: CtaClickInput) {
  const eventName = input.eventName || "cta_click";

  return trackEvent(eventName, {
    cta_name: input.ctaName,
    cta_location: input.ctaLocation,
    destination: input.destination,
    cta_type: input.ctaType || "button",
  });
}

export function trackPageView(pagePath: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const normalizedPath = pagePath || "/";
  const pageLocation = `${window.location.origin}${normalizedPath}`;

  return trackEvent("page_view", {
    page_title: document.title,
    page_path: normalizedPath,
    page_location: pageLocation,
  });
}

type LeadConversionInput = {
  formName: string;
  pagePath: string;
  leadId?: string;
};

function trackGoogleAdsLeadConversion(input: LeadConversionInput) {
  const sendTo = getPublicGoogleAdsLeadSendTo();
  if (!sendTo) {
    return false;
  }

  return trackEvent("conversion", {
    send_to: sendTo,
    value: 1,
    currency: "INR",
    transaction_id: input.leadId,
  });
}

export function trackLeadConversion(input: LeadConversionInput) {
  const ga4Tracked = trackEvent("generate_lead", {
    form_name: input.formName,
    page_path: input.pagePath,
    lead_id: input.leadId,
    method: "website_form",
    value: 1,
    currency: "INR",
  });

  const adsTracked = trackGoogleAdsLeadConversion(input);
  return ga4Tracked || adsTracked;
}
