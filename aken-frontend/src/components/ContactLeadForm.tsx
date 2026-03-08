"use client";

import { useState } from "react";
import { trackCtaClick, trackEvent, trackLeadConversion } from "@/lib/analytics";
import { getLeadAttributionPayload } from "@/lib/utm";

export default function ContactLeadForm() {
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [didStartForm, setDidStartForm] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const responseBody = await res.json().catch(() => null);
        const leadId = responseBody?.data?.leadId as string | undefined;

        trackLeadConversion({
          formName: "contact_page_enquiry_form",
          pagePath: "/contact",
          leadId,
        });

        setSuccess(true);
        e.currentTarget.reset();
        setDidStartForm(false);
      } else {
        trackEvent("lead_submit_failed", {
          form_name: "contact_page_enquiry_form",
          page_path: "/contact",
        });
      }
    } catch {
      trackEvent("lead_submit_failed", {
        form_name: "contact_page_enquiry_form",
        page_path: "/contact",
      });
      console.error("Submission error.");
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        name="contactPerson"
        placeholder="Your Name"
        required
        className="w-full p-3 border rounded-lg"
        onFocus={() => {
          if (!didStartForm) {
            setDidStartForm(true);
            trackEvent("form_start", {
              form_name: "contact_page_enquiry_form",
              page_path: "/contact",
            });
          }
        }}
      />

      <input
        name="email"
        type="email"
        placeholder="Your Email"
        required
        className="w-full p-3 border rounded-lg"
      />

      <input
        name="companyName"
        placeholder="Company Name"
        required
        className="w-full p-3 border rounded-lg"
      />

      <input
        name="phone"
        placeholder="Phone Number"
        required
        className="w-full p-3 border rounded-lg"
      />

      <textarea
        name="message"
        placeholder="Project Requirement"
        required
        rows={4}
        className="w-full p-3 border rounded-lg"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
        onClick={() => {
          trackCtaClick({
            ctaName: "Submit Enquiry",
            ctaLocation: "contact_form",
            destination: "/api/public/leads",
            ctaType: "button",
            eventName: "form_submit_click",
          });
        }}
      >
        {loading ? "Submitting..." : "Submit Enquiry"}
      </button>

      {success && (
        <p className="text-green-600 font-semibold mt-3">
          Enquiry submitted successfully!
        </p>
      )}
    </form>
  );
}
