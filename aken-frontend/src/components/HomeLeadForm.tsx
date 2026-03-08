"use client";

import { useState } from "react";
import { trackEvent, trackLeadConversion, trackCtaClick } from "@/lib/analytics";
import { getLeadAttributionPayload } from "@/lib/utm";

export default function HomeLeadForm() {
  const [status, setStatus] = useState("");
  const [didStartForm, setDidStartForm] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const attribution = getLeadAttributionPayload();
    const payload = {
      ...data,
      ...attribution,
    };

    try {
      const res = await fetch(`/api/public/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const responseBody = await res.json().catch(() => null);
        const leadId = responseBody?.data?.leadId as string | undefined;

        trackLeadConversion({
          formName: "homepage_enquiry_form",
          pagePath: "/",
          leadId,
        });

        setStatus("Enquiry submitted successfully.");
        e.currentTarget.reset();
        setDidStartForm(false);
      } else {
        trackEvent("lead_submit_failed", {
          form_name: "homepage_enquiry_form",
          page_path: "/",
        });
        setStatus("Something went wrong. Please try again.");
      }
    } catch {
      trackEvent("lead_submit_failed", {
        form_name: "homepage_enquiry_form",
        page_path: "/",
      });
      setStatus("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl bg-gray-900 p-6 text-white shadow-xl">
      <h2 className="text-2xl font-bold">Request Industrial Quotation</h2>
      <p className="text-sm text-gray-300">
        Share your requirement and our engineering team will contact you.
      </p>

      <input
        name="contactPerson"
        placeholder="Contact Person Name"
        required
        className="rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
        onFocus={() => {
          if (!didStartForm) {
            setDidStartForm(true);
            trackEvent("form_start", {
              form_name: "homepage_enquiry_form",
              page_path: "/",
            });
          }
        }}
      />
      <input
        name="email"
        type="email"
        placeholder="Business Email"
        required
        className="rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
      />
      <input
        name="companyName"
        placeholder="Company Name"
        required
        className="rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
      />
      <input
        name="phone"
        placeholder="Phone Number"
        required
        className="rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
      />
      <textarea
        name="message"
        placeholder="Project Requirement (PEB, fabrication, erection, EPC)"
        rows={4}
        required
        className="rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
      />

      <button
        type="submit"
        className="rounded-lg bg-yellow-500 px-4 py-3 font-semibold text-black hover:bg-yellow-400 transition"
        onClick={() => {
          trackCtaClick({
            ctaName: "Submit Enquiry",
            ctaLocation: "home_form",
            destination: "/api/public/leads",
            ctaType: "button",
            eventName: "form_submit_click",
          });
        }}
      >
        Submit Enquiry
      </button>

      {status ? <p className="text-sm text-green-300">{status}</p> : null}
    </form>
  );
}
