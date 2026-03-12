"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import { trackEvent, trackLeadConversion, trackCtaClick } from "@/lib/analytics";
import { getLeadAttributionPayload } from "@/lib/utm";

type ServiceType =
  | "PEB Shed Construction"
  | "Steel Structure Fabrication"
  | "Sheet Cladding Work"
  | "Industrial Maintenance"
  | "Structural Repair / Retrofitting"
  | "Dismantling & Scrap Handling";

type ProjectType = "New Construction" | "Expansion" | "Maintenance" | "Shutdown Job";

type Timeline = "Immediately" | "Within 1 month" | "Within 3 months" | "Within 6 months" | "Planning Stage";

type WizardData = {
  // Step 1
  serviceType: ServiceType | "";

  // Step 2
  projectLocation: string;
  estimatedTonnage: string; // keep string for input control
  projectType: ProjectType | "";

  // Step 3
  timeline: Timeline | "";

  // Step 4 (optional)
  attachment: File | null;

  // Step 5
  name: string;
  company: string;
  phone: string;
  email: string;
  notes: string;
};

type FieldErrors = Partial<Record<keyof WizardData, string>>;

const TOTAL_STEPS = 5;

const SERVICE_OPTIONS: ServiceType[] = [
  "PEB Shed Construction",
  "Steel Structure Fabrication",
  "Sheet Cladding Work",
  "Industrial Maintenance",
  "Structural Repair / Retrofitting",
  "Dismantling & Scrap Handling",
];

const PROJECT_TYPE_OPTIONS: ProjectType[] = ["New Construction", "Expansion", "Maintenance", "Shutdown Job"];

const TIMELINE_OPTIONS: Timeline[] = [
  "Immediately",
  "Within 1 month",
  "Within 3 months",
  "Within 6 months",
  "Planning Stage",
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "").trim();
}

function clampStep(n: number) {
  return Math.max(1, Math.min(TOTAL_STEPS, n));
}

export default function SmartEnquiryWizard() {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<number>(1);
  const [didStartForm, setDidStartForm] = useState(false);

  const [data, setData] = useState<WizardData>({
    serviceType: "",
    projectLocation: "",
    estimatedTonnage: "",
    projectType: "",
    timeline: "",
    attachment: null,
    name: "",
    company: "",
    phone: "",
    email: "",
    notes: "",
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"" | "success" | "error">("");
  const [submitMessage, setSubmitMessage] = useState<string>("");

  const progressPct = useMemo(() => Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100), [step]);

  function setField<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (!didStartForm) {
      setDidStartForm(true);
      trackEvent("form_start", {
        form_name: "smart_project_enquiry_wizard",
        page_path: "/enquiry",
      });
    }
  }

  function validateStep(currentStep: number): FieldErrors {
    const e: FieldErrors = {};

    if (currentStep === 1) {
      if (!data.serviceType) e.serviceType = "Please select a service type.";
    }

    if (currentStep === 2) {
      if (!data.projectLocation.trim()) e.projectLocation = "Project location is required.";
      if (!data.projectType) e.projectType = "Please select a project type.";

      if (!data.estimatedTonnage.trim()) {
        e.estimatedTonnage = "Estimated tonnage is required.";
      } else {
        const ton = Number(data.estimatedTonnage);
        if (!Number.isFinite(ton) || ton <= 0) e.estimatedTonnage = "Enter a valid tonnage greater than 0.";
      }
    }

    if (currentStep === 3) {
      if (!data.timeline) e.timeline = "Please select a timeline.";
    }

    if (currentStep === 4) {
      // Optional. If provided, validate.
      if (data.attachment) {
        const typeOk =
          data.attachment.type === "application/pdf" ||
          data.attachment.type.startsWith("image/") ||
          // DWG often comes as these, but can vary; still validate by extension below as fallback.
          data.attachment.type === "application/acad" ||
          data.attachment.type === "image/vnd.dwg" ||
          data.attachment.type === "application/octet-stream";

        const ext = data.attachment.name.toLowerCase().split(".").pop() || "";
        const extOk = ext === "pdf" || ext === "dwg" || ["png", "jpg", "jpeg", "webp"].includes(ext);

        if (!typeOk && !extOk) e.attachment = "Unsupported file type. Upload PDF, DWG, or an image.";
        if (data.attachment.size > MAX_FILE_SIZE_BYTES) e.attachment = "File too large. Maximum size is 10MB.";
      }
    }

    if (currentStep === 5) {
      if (!data.name.trim()) e.name = "Name is required.";
      if (!data.company.trim()) e.company = "Company name is required.";

      const phone = normalizePhone(data.phone);
      if (!phone) e.phone = "Phone number is required.";
      else if (phone.replace(/\D/g, "").length < 8) e.phone = "Enter a valid phone number.";

      if (!data.email.trim()) e.email = "Email is required.";
      else if (!isValidEmail(data.email)) e.email = "Enter a valid email address.";

      // notes optional
    }

    return e;
  }

  function firstErrorFieldId(errs: FieldErrors) {
    const order: (keyof WizardData)[] = [
      "serviceType",
      "projectLocation",
      "estimatedTonnage",
      "projectType",
      "timeline",
      "attachment",
      "name",
      "company",
      "phone",
      "email",
      "notes",
    ];
    const key = order.find((k) => errs[k]);
    return key ? `${formId}-${String(key)}` : null;
  }

  function goNext() {
    const stepErrors = validateStep(step);
    if (Object.keys(stepErrors).length) {
      setErrors((prev) => ({ ...prev, ...stepErrors }));
      const focusId = firstErrorFieldId(stepErrors);
      if (focusId) {
        // allow DOM to paint errors
        setTimeout(() => document.getElementById(focusId)?.focus(), 0);
      }
      return;
    }
    setSubmitStatus("");
    setSubmitMessage("");
    setStep((s) => clampStep(s + 1));
  }

  function goBack() {
    setSubmitStatus("");
    setSubmitMessage("");
    setStep((s) => clampStep(s - 1));
  }

  async function submit() {
    // Validate all steps before submitting (so we don't send partial)
    const allErrors: FieldErrors = {
      ...validateStep(1),
      ...validateStep(2),
      ...validateStep(3),
      ...validateStep(4),
      ...validateStep(5),
    };

    if (Object.keys(allErrors).length) {
      setErrors(allErrors);
      const focusId = firstErrorFieldId(allErrors);
      if (focusId) setTimeout(() => document.getElementById(focusId)?.focus(), 0);
      // Move user to the earliest step with an error
      const stepForField = (key: keyof WizardData) => {
        if (key === "serviceType") return 1;
        if (key === "projectLocation" || key === "estimatedTonnage" || key === "projectType") return 2;
        if (key === "timeline") return 3;
        if (key === "attachment") return 4;
        return 5;
      };
      const firstKey = (Object.keys(allErrors) as (keyof WizardData)[])[0];
      setStep(stepForField(firstKey));
      return;
    }

    setSubmitting(true);
    setSubmitStatus("");
    setSubmitMessage("");

    const attribution = getLeadAttributionPayload();

    // IMPORTANT: Do not change API contract. The existing proxy forwards JSON to backend.
    // Upload is optional and not part of required payload; we keep it client-side for now.
    const payload = {
      name: data.name.trim(),
      company: data.company.trim(),
      phone: normalizePhone(data.phone),
      email: data.email.trim(),
      serviceType: data.serviceType,
      projectLocation: data.projectLocation.trim(),
      estimatedTonnage: Number(data.estimatedTonnage),
      projectType: data.projectType,
      timeline: data.timeline,
      notes: data.notes.trim(),
      ...attribution,
      // Optional hint (non-breaking): attachment metadata only (no file upload via this endpoint).
      ...(data.attachment
        ? {
            attachmentName: data.attachment.name,
            attachmentSize: data.attachment.size,
            attachmentType: data.attachment.type || "unknown",
          }
        : {}),
    };

    try {
      trackCtaClick({
        ctaName: "Submit Project Enquiry",
        ctaLocation: "enquiry_wizard",
        destination: "/api/public/leads",
        ctaType: "button",
        eventName: "form_submit_click",
      });

      const res = await fetch(`/api/public/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const responseBody = await res.json().catch(() => null);
        const leadId = responseBody?.data?.leadId as string | undefined;

        trackLeadConversion({
          formName: "smart_project_enquiry_wizard",
          pagePath: "/enquiry",
          leadId,
        });

        setSubmitStatus("success");
        setSubmitMessage("Thank you. Our engineering team will contact you shortly.");
        setDidStartForm(false);

        // reset
        setData({
          serviceType: "",
          projectLocation: "",
          estimatedTonnage: "",
          projectType: "",
          timeline: "",
          attachment: null,
          name: "",
          company: "",
          phone: "",
          email: "",
          notes: "",
        });
        setErrors({});
        setStep(1);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        // Try to surface validation errors if server returns JSON with message
        const errJson = await res.json().catch(() => null);
        const msg =
          errJson?.error?.message ||
          errJson?.message ||
          "Please review your details and try again.";
        trackEvent("lead_submit_failed", {
          form_name: "smart_project_enquiry_wizard",
          page_path: "/enquiry",
          status: res.status,
        });
        setSubmitStatus("error");
        setSubmitMessage(msg);
      }
    } catch {
      trackEvent("lead_submit_failed", {
        form_name: "smart_project_enquiry_wizard",
        page_path: "/enquiry",
        status: "network_error",
      });
      setSubmitStatus("error");
      setSubmitMessage("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const panelTitle = (() => {
    switch (step) {
      case 1:
        return "Service Type";
      case 2:
        return "Project Details";
      case 3:
        return "Timeline";
      case 4:
        return "Upload Drawing / BOQ (Optional)";
      case 5:
        return "Contact Details";
      default:
        return "Project Enquiry";
    }
  })();

  return (
    <section className="w-full">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="border-b border-gray-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-gray-500">A K ENGINEERING</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">Smart Project Enquiry</h1>
              <p className="mt-2 text-sm text-gray-600">
                Answer a few quick questions so our engineers can quote faster and more accurately.
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 px-3 py-2 text-right">
              <p className="text-xs font-medium text-gray-600">Step</p>
              <p className="text-lg font-bold text-gray-900">
                {step}/{TOTAL_STEPS}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{panelTitle}</p>
              <p className="text-xs text-gray-500">{progressPct}%</p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-yellow-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        </header>

        <div className="p-6">
          <div
            className="relative overflow-hidden"
            aria-live="polite"
            aria-busy={submitting ? "true" : "false"}
          >
            {/* Step panels */}
            <div className="transition-all duration-300">
              {step === 1 ? (
                <div className="grid gap-4">
                  <fieldset className="grid gap-3">
                    <legend className="text-sm font-semibold text-gray-900">
                      What service do you require?
                    </legend>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {SERVICE_OPTIONS.map((opt) => {
                        const active = data.serviceType === opt;
                        return (
                          <label
                            key={opt}
                            className={[
                              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition",
                              active
                                ? "border-yellow-500 bg-yellow-50"
                                : "border-gray-200 bg-white hover:border-gray-300",
                            ].join(" ")}
                          >
                            <input
                              id={`${formId}-serviceType`}
                              name="serviceType"
                              type="radio"
                              className="mt-1 h-4 w-4 accent-yellow-500"
                              checked={active}
                              onChange={() => setField("serviceType", opt)}
                            />
                            <span className="text-sm font-medium text-gray-900">{opt}</span>
                          </label>
                        );
                      })}
                    </div>

                    {errors.serviceType ? (
                      <p className="text-sm text-red-600" role="alert">
                        {errors.serviceType}
                      </p>
                    ) : null}
                  </fieldset>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid gap-5">
                  <div className="grid gap-2">
                    <label htmlFor={`${formId}-projectLocation`} className="text-sm font-semibold text-gray-900">
                      Project Location
                    </label>
                    <input
                      id={`${formId}-projectLocation`}
                      value={data.projectLocation}
                      onChange={(e) => setField("projectLocation", e.target.value)}
                      placeholder="e.g., Kharagpur, West Bengal"
                      className={[
                        "w-full rounded-xl border bg-white px-4 py-3 text-gray-900 outline-none transition",
                        errors.projectLocation ? "border-red-300 focus:ring-2 focus:ring-red-200" : "border-gray-200 focus:ring-2 focus:ring-yellow-100",
                      ].join(" ")}
                      autoComplete="off"
                    />
                    {errors.projectLocation ? (
                      <p className="text-sm text-red-600" role="alert">
                        {errors.projectLocation}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor={`${formId}-estimatedTonnage`} className="text-sm font-semibold text-gray-900">
                      Estimated Steel Tonnage
                    </label>
                    <div className="relative">
                      <input
                        id={`${formId}-estimatedTonnage`}
                        value={data.estimatedTonnage}
                        onChange={(e) => setField("estimatedTonnage", e.target.value)}
                        inputMode="decimal"
                        placeholder="e.g., 25"
                        className={[
                          "w-full rounded-xl border bg-white px-4 py-3 pr-14 text-gray-900 outline-none transition",
                          errors.estimatedTonnage ? "border-red-300 focus:ring-2 focus:ring-red-200" : "border-gray-200 focus:ring-2 focus:ring-yellow-100",
                        ].join(" ")}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        MT
                      </span>
                    </div>
                    {errors.estimatedTonnage ? (
                      <p className="text-sm text-red-600" role="alert">
                        {errors.estimatedTonnage}
                      </p>
                    ) : null}
                  </div>

                  <fieldset className="grid gap-2">
                    <legend className="text-sm font-semibold text-gray-900">Project Type</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {PROJECT_TYPE_OPTIONS.map((opt) => {
                        const active = data.projectType === opt;
                        return (
                          <label
                            key={opt}
                            className={[
                              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition",
                              active
                                ? "border-yellow-500 bg-yellow-50"
                                : "border-gray-200 bg-white hover:border-gray-300",
                            ].join(" ")}
                          >
                            <input
                              id={`${formId}-projectType`}
                              name="projectType"
                              type="radio"
                              className="mt-1 h-4 w-4 accent-yellow-500"
                              checked={active}
                              onChange={() => setField("projectType", opt)}
                            />
                            <span className="text-sm font-medium text-gray-900">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                    {errors.projectType ? (
                      <p className="text-sm text-red-600" role="alert">
                        {errors.projectType}
                      </p>
                    ) : null}
                  </fieldset>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="grid gap-4">
                  <fieldset className="grid gap-3">
                    <legend className="text-sm font-semibold text-gray-900">
                      When do you plan to start the project?
                    </legend>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {TIMELINE_OPTIONS.map((opt) => {
                        const active = data.timeline === opt;
                        return (
                          <label
                            key={opt}
                            className={[
                              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition",
                              active
                                ? "border-yellow-500 bg-yellow-50"
                                : "border-gray-200 bg-white hover:border-gray-300",
                            ].join(" ")}
                          >
                            <input
                              id={`${formId}-timeline`}
                              name="timeline"
                              type="radio"
                              className="mt-1 h-4 w-4 accent-yellow-500"
                              checked={active}
                              onChange={() => setField("timeline", opt)}
                            />
                            <span className="text-sm font-medium text-gray-900">{opt}</span>
                          </label>
                        );
                      })}
                    </div>

                    {errors.timeline ? (
                      <p className="text-sm text-red-600" role="alert">
                        {errors.timeline}
                      </p>
                    ) : null}
                  </fieldset>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="grid gap-4">
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Attach drawing / BOQ (optional)</p>
                        <p className="text-sm text-gray-600">
                          Accepted: PDF, DWG, images. Max size: 10MB.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black transition disabled:opacity-50"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={submitting}
                      >
                        Choose File
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      id={`${formId}-attachment`}
                      type="file"
                      className="sr-only"
                      accept=".pdf,.dwg,image/*"
                      onChange={(e) => {
                        const f = e.currentTarget.files?.[0] || null;
                        setField("attachment", f);
                      }}
                    />

                    <div className="mt-3 rounded-lg bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {data.attachment ? data.attachment.name : "No file selected"}
                          </p>
                          {data.attachment ? (
                            <p className="text-xs text-gray-500">
                              {(data.attachment.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          ) : (
                            <p className="text-xs text-gray-500">You can skip this step.</p>
                          )}
                        </div>

                        {data.attachment ? (
                          <button
                            type="button"
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                            onClick={() => {
                              setField("attachment", null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>

                      {errors.attachment ? (
                        <p className="mt-2 text-sm text-red-600" role="alert">
                          {errors.attachment}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-sm font-semibold text-gray-900">Note</p>
                    <p className="mt-1 text-sm text-gray-600">
                      File upload is optional. If your backend lead endpoint doesn’t accept multipart uploads,
                      the file won’t be sent—only its metadata is included with the enquiry. You can still ask the
                      team to collect the drawing over WhatsApp/email after submission.
                    </p>
                  </div>
                </div>
              ) : null}

              {step === 5 ? (
                <div className="grid gap-5">
                  <div className="grid gap-2">
                    <label htmlFor={`${formId}-name`} className="text-sm font-semibold text-gray-900">
                      Name
                    </label>
                    <input
                      id={`${formId}-name`}
                      value={data.name}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder="Your full name"
                      className={[
                        "w-full rounded-xl border bg-white px-4 py-3 text-gray-900 outline-none transition",
                        errors.name ? "border-red-300 focus:ring-2 focus:ring-red-200" : "border-gray-200 focus:ring-2 focus:ring-yellow-100",
                      ].join(" ")}
                      autoComplete="name"
                    />
                    {errors.name ? (
                      <p className="text-sm text-red-600" role="alert">
                        {errors.name}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor={`${formId}-company`} className="text-sm font-semibold text-gray-900">
                      Company Name
                    </label>
                    <input
                      id={`${formId}-company`}
                      value={data.company}
                      onChange={(e) => setField("company", e.target.value)}
                      placeholder="e.g., ABC Infra Pvt Ltd"
                      className={[
                        "w-full rounded-xl border bg-white px-4 py-3 text-gray-900 outline-none transition",
                        errors.company ? "border-red-300 focus:ring-2 focus:ring-red-200" : "border-gray-200 focus:ring-2 focus:ring-yellow-100",
                      ].join(" ")}
                      autoComplete="organization"
                    />
                    {errors.company ? (
                      <p className="text-sm text-red-600" role="alert">
                        {errors.company}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label htmlFor={`${formId}-phone`} className="text-sm font-semibold text-gray-900">
                        Phone Number
                      </label>
                      <input
                        id={`${formId}-phone`}
                        value={data.phone}
                        onChange={(e) => setField("phone", e.target.value)}
                        placeholder="e.g., +91 98xxxxxx"
                        className={[
                          "w-full rounded-xl border bg-white px-4 py-3 text-gray-900 outline-none transition",
                          errors.phone ? "border-red-300 focus:ring-2 focus:ring-red-200" : "border-gray-200 focus:ring-2 focus:ring-yellow-100",
                        ].join(" ")}
                        autoComplete="tel"
                        inputMode="tel"
                      />
                      {errors.phone ? (
                        <p className="text-sm text-red-600" role="alert">
                          {errors.phone}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-2">
                      <label htmlFor={`${formId}-email`} className="text-sm font-semibold text-gray-900">
                        Email
                      </label>
                      <input
                        id={`${formId}-email`}
                        value={data.email}
                        onChange={(e) => setField("email", e.target.value)}
                        placeholder="name@company.com"
                        className={[
                          "w-full rounded-xl border bg-white px-4 py-3 text-gray-900 outline-none transition",
                          errors.email ? "border-red-300 focus:ring-2 focus:ring-red-200" : "border-gray-200 focus:ring-2 focus:ring-yellow-100",
                        ].join(" ")}
                        autoComplete="email"
                        inputMode="email"
                      />
                      {errors.email ? (
                        <p className="text-sm text-red-600" role="alert">
                          {errors.email}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor={`${formId}-notes`} className="text-sm font-semibold text-gray-900">
                      Additional Notes
                    </label>
                    <textarea
                      id={`${formId}-notes`}
                      value={data.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      placeholder="Share scope, dimensions, site constraints, crane access, etc."
                      rows={4}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:ring-2 focus:ring-yellow-100"
                    />
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-900">Summary</p>
                    <dl className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold text-gray-500">Service</dt>
                        <dd className="font-medium text-gray-900">{data.serviceType || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-gray-500">Timeline</dt>
                        <dd className="font-medium text-gray-900">{data.timeline || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-gray-500">Location</dt>
                        <dd className="font-medium text-gray-900">{data.projectLocation || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-gray-500">Tonnage</dt>
                        <dd className="font-medium text-gray-900">
                          {data.estimatedTonnage ? `${data.estimatedTonnage} MT` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-gray-500">Project Type</dt>
                        <dd className="font-medium text-gray-900">{data.projectType || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-gray-500">Attachment</dt>
                        <dd className="font-medium text-gray-900">{data.attachment ? "Yes" : "No"}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Status */}
            {submitStatus ? (
              <div
                className={[
                  "mt-6 rounded-xl border p-4 text-sm",
                  submitStatus === "success"
                    ? "border-green-200 bg-green-50 text-green-900"
                    : "border-red-200 bg-red-50 text-red-900",
                ].join(" ")}
                role="status"
              >
                {submitMessage}
              </div>
            ) : null}

            {/* Navigation */}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={submitting || step === 1}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                {step < TOTAL_STEPS ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit Enquiry"}
                  </button>
                )}

                <p className="text-center text-xs text-gray-500 sm:text-right">
                  Your details stay private. We only use them to contact you.
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-gray-100 bg-white p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500">Fast Response</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Engineer callback</p>
              <p className="mt-1 text-sm text-gray-600">Typically within 24 hours (working days).</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500">Accurate Quotation</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Right scope first</p>
              <p className="mt-1 text-sm text-gray-600">We confirm tonnage, drawings, and execution plan.</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500">Industrial EPC</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Design • Fabrication • Erection</p>
              <p className="mt-1 text-sm text-gray-600">PEB sheds, steel structures, cladding and maintenance.</p>
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
}
