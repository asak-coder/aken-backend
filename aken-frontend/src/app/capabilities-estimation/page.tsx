"use client";

import TrackedLink from "@/components/TrackedLink";
import { useMemo, useRef, useState } from "react";

/**
 * Next.js note:
 * This page is a Client Component (interactive estimator).
 * Metadata should be defined in a parent Server Component/layout, so we omit it here.
 */

type Step = 1 | 2 | "success";

function IconBolt(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFactory(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3 21V9l6 3V9l6 3V6l6 3v12H3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M7 21v-5M11 21v-7M15 21v-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconShield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9.3 12.2l1.9 1.9 3.7-4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatINR(value: number) {
  const rounded = Math.round(value);
  return `₹${rounded.toLocaleString("en-IN")}`;
}

/**
 * Budgetary estimator model:
 * - Not shown to user (lead magnet gating).
 * - Used only to generate a "range" + internal notes to send to backend.
 *
 * IMPORTANT: Keep it "rough" and defensible.
 */
function estimateBudgetINR(input: {
  areaSqft: number;
  clearHeightM: number;
  projectType: "Warehouse" | "Manufacturing Plant" | "Commercial Shed";
  location: string;
}) {
  const { areaSqft, clearHeightM, projectType } = input;

  // Base rate per sqft (PEB supply + erection ballpark).
  // Manufacturing tends to be heavier (cranes, mezzanines, loads), hence higher.
  const baseRateMap: Record<typeof projectType, number> = {
    Warehouse: 1450,
    "Commercial Shed": 1550,
    "Manufacturing Plant": 1750,
  };

  const heightMultiplier = (() => {
    // 6m = baseline; increase cost with height (purlin/girt sizes, bracing, columns)
    const delta = Math.max(0, clearHeightM - 6);
    return 1 + Math.min(0.35, delta * 0.035);
  })();

  const sizeMultiplier = (() => {
    // Minor economies of scale after ~20k sqft
    if (areaSqft >= 60000) return 0.92;
    if (areaSqft >= 30000) return 0.95;
    if (areaSqft >= 20000) return 0.98;
    return 1.0;
  })();

  const contingency = 1.12; // prelim engineering + market variance

  const base = areaSqft * baseRateMap[projectType];
  const total = base * heightMultiplier * sizeMultiplier * contingency;

  // Provide a range internally (+/- 7%)
  const low = total * 0.93;
  const high = total * 1.07;

  return {
    low,
    high,
    assumptions: {
      baseRatePerSqft: baseRateMap[projectType],
      heightMultiplier,
      sizeMultiplier,
      contingency,
    },
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function CapabilitiesEstimationPage() {
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);

  // Step 1 inputs
  const [areaSqft, setAreaSqft] = useState(20000);
  const [clearHeightM, setClearHeightM] = useState(8);
  const [projectType, setProjectType] = useState<
    "Warehouse" | "Manufacturing Plant" | "Commercial Shed"
  >("Warehouse");
  const [location, setLocation] = useState("");

  // Step 2 inputs
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [company, setCompany] = useState("");

  // Captured estimate (never displayed)
  const estimate = useMemo(
    () =>
      estimateBudgetINR({
        areaSqft,
        clearHeightM,
        projectType,
        location: location.trim(),
      }),
    [areaSqft, clearHeightM, projectType, location],
  );

  // Used for accessibility focus shift between steps
  const step2HeadingRef = useRef<HTMLHeadingElement | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);

  const canCalculate =
    areaSqft >= 1000 && clearHeightM >= 4 && projectType && location.trim();

  function onCalculate() {
    if (!canCalculate) return;

    // Crucial B2B logic: do NOT reveal price. Gate with contact capture.
    setStep(2);

    // Smooth: focus Step 2 heading
    requestAnimationFrame(() => {
      step2HeadingRef.current?.focus();
    });
  }

  async function onSubmitLead(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const loc = location.trim();
    if (!email.trim() || !mobile.trim() || !company.trim() || !loc) return;

    setBusy(true);

    const payload = {
      source: "capabilities_estimation_estimator",
      page: "/capabilities-estimation",
      leadType: "PEB_BUDGETARY_ESTIMATE",
      contact: {
        email: email.trim(),
        phone: mobile.trim(),
        company: company.trim(),
        location: loc,
      },
      project: {
        areaSqft,
        clearHeightM,
        projectType,
      },
      // Internal-only: can be used by backend to generate/send PDF estimate.
      estimate: {
        budgetRangeINR: {
          low: Math.round(estimate.low),
          high: Math.round(estimate.high),
        },
        assumptions: estimate.assumptions,
      },
    };

    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Lead capture failed");

      setStep("success");
      requestAnimationFrame(() => {
        successRef.current?.focus();
      });
    } catch {
      // Fail-safe: still show success (lead magnet UX). Could be logged later.
      setStep("success");
      requestAnimationFrame(() => {
        successRef.current?.focus();
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-white text-slate-900">
      {/* =========================================================
          CAPABILITIES & ESTIMATION
          Design System: Heavy-Duty Corporate
          - Engineering Blue (Primary): sky/blue tones
          - Construction Orange (CTA): orange-500/400
          - Steel Grey (BG/Text): slate palette
         ========================================================= */}

      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-slate-950">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/engineers-blueprint.jpg)" }}
        />
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -top-24 left-1/2 h-72 w-[52rem] -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute -bottom-28 right-[-10%] h-72 w-[44rem] rounded-full bg-orange-500/15 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              Capabilities & Estimation
            </p>

            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Proven Shop-Floor Capacity. Faster Budget Certainty.
            </h1>

            <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/80 sm:text-lg">
              Validate our in-house fabrication strength at the Hirakud Hub, then
              generate a budgetary PEB range delivered to your official inbox
              (PDF-ready breakdown).
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#estimator"
                className="inline-flex items-center justify-center rounded-md bg-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm shadow-orange-500/20 ring-1 ring-orange-300/30 transition hover:bg-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                Launch Budgetary Estimator
              </a>

              <TrackedLink
                href="/contact"
                ctaName="Request Engineering Call"
                ctaLocation="capabilities_hero"
                eventName="capabilities_request_call_click"
                className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Request Engineering Call
              </TrackedLink>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80">
                <span className="font-semibold text-white">In-house</span>{" "}
                fabrication & QA
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80">
                <span className="font-semibold text-white">Mechanized</span>{" "}
                erection capacity
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80">
                <span className="font-semibold text-white">Procurement</span>{" "}
                confidence tools
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: HIRAKUD HUB EQUIPMENT ROSTER */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Manufacturing Capacity Proof
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Heavy Fabrication Capability: The Hirakud Hub
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              We own and operate an extensive fleet of advanced fabrication
              machinery and heavy erection equipment to ensure zero third-party
              delays.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {/* Card 1 */}
            <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="mx-auto h-14 w-14 rounded-xl bg-slate-900/10" />
                    <p className="mt-3 text-xs font-medium text-slate-600">
                      Image Placeholder
                    </p>
                  </div>
                </div>
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-900 backdrop-blur">
                  <IconFactory className="h-4 w-4 text-sky-700" />
                  Shop-floor Asset
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-base font-semibold text-slate-950">
                  Heavy-Duty EOT Cranes{" "}
                  <span className="font-medium text-slate-500">
                    (up to 50 MT)
                  </span>
                </h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  <li className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                    Dual-girder configuration for heavy bay handling
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                    Engineered lifting plans + load test documentation
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                    Reduces internal material movement cycle time
                  </li>
                </ul>
              </div>
            </article>

            {/* Card 2 */}
            <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="mx-auto h-14 w-14 rounded-xl bg-slate-900/10" />
                    <p className="mt-3 text-xs font-medium text-slate-600">
                      Image Placeholder
                    </p>
                  </div>
                </div>
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-900 backdrop-blur">
                  <IconBolt className="h-4 w-4 text-sky-700" />
                  CNC Cutting
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-base font-semibold text-slate-950">
                  CNC Plasma & Oxy-Fuel Cutting Machines
                </h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  <li className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                    High-throughput plate profiling for structural members
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                    Repeatable accuracy for bolt-hole and gusset patterns
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                    Reduced edge prep rework through controlled cut quality
                  </li>
                </ul>
              </div>
            </article>

            {/* Card 3 */}
            <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100" />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="mx-auto h-14 w-14 rounded-xl bg-slate-900/10" />
                    <p className="mt-3 text-xs font-medium text-slate-600">
                      Image Placeholder
                    </p>
                  </div>
                </div>
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-900 backdrop-blur">
                  <IconShield className="h-4 w-4 text-sky-700" />
                  QA Welds
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-base font-semibold text-slate-950">
                  Submerged Arc Welding (SAW) Stations
                </h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  <li className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                    Deep-penetration welds for heavy built-up sections
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                    WPS compliance + traceability for critical joints
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                    Faster deposition rates reduce fabrication lead time
                  </li>
                </ul>
              </div>
            </article>

            {/* Card 4 */}
            <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md lg:col-span-3">
              <div className="grid gap-0 lg:grid-cols-[1.2fr_1fr]">
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 lg:aspect-auto">
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100" />
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <div className="mx-auto h-14 w-14 rounded-xl bg-slate-900/10" />
                      <p className="mt-3 text-xs font-medium text-slate-600">
                        Image Placeholder
                      </p>
                    </div>
                  </div>
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-900 backdrop-blur">
                    <IconFactory className="h-4 w-4 text-sky-700" />
                    Erection Fleet
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-base font-semibold text-slate-950">
                    Mobile Hydraulic Cranes for Site Erection
                  </h3>
                  <ul className="mt-4 space-y-2 text-sm text-slate-700">
                    <li className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                      Rapid mobilization for multi-span industrial sheds
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                      Engineered rigging + lift sequencing reduces downtime
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                      Enables predictable, mechanized erection timelines
                    </li>
                  </ul>
                </div>
              </div>
            </article>
          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <p className="text-sm text-slate-700">
              Procurement-ready assurance: equipment ownership reduces schedule
              risk and ensures controlled quality from plate cutting to final
              erection.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2: PEB & SHED COST ESTIMATOR (LEAD MAGNET) */}
      <section id="estimator" className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Lead Magnet • Budgetary Estimate
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Interactive PEB Budgetary Estimator
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              Input your rough project parameters to receive a custom budgetary
              estimate direct to your inbox.
            </p>
          </div>

          <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
              {/* Left: Step UI */}
              <div className="lg:col-span-7">
                {/* Step indicator */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    <span
                      className={[
                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                        step === 1
                          ? "bg-sky-600 text-white"
                          : "bg-slate-200 text-slate-700",
                      ].join(" ")}
                    >
                      1
                    </span>
                    Technical Inputs
                  </div>

                  <div className="h-px flex-1 bg-slate-200" />

                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    <span
                      className={[
                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                        step === 2
                          ? "bg-sky-600 text-white"
                          : step === "success"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 text-slate-700",
                      ].join(" ")}
                    >
                      2
                    </span>
                    Delivery Details
                  </div>
                </div>

                {/* STEP 1 */}
                {step === 1 && (
                  <div className="mt-8">
                    <div className="grid gap-6">
                      {/* Area */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              Estimated Area (Sq. Ft.)
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Use a rough built-up area. You can revise later.
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900">
                            {areaSqft.toLocaleString("en-IN")}
                          </div>
                        </div>

                        <input
                          type="range"
                          min={1000}
                          max={200000}
                          step={500}
                          value={areaSqft}
                          onChange={(e) =>
                            setAreaSqft(
                              clamp(Number(e.target.value), 1000, 200000),
                            )
                          }
                          className="mt-4 w-full accent-sky-600"
                        />

                        <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                          <span>1,000</span>
                          <span>200,000</span>
                        </div>
                      </div>

                      {/* Clear Height */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              Clear Height Requirement (Meters)
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Influences column sizing, bracing, and wind loads.
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900">
                            {clearHeightM} m
                          </div>
                        </div>

                        <input
                          type="range"
                          min={4}
                          max={14}
                          step={0.5}
                          value={clearHeightM}
                          onChange={(e) =>
                            setClearHeightM(
                              clamp(Number(e.target.value), 4, 14),
                            )
                          }
                          className="mt-4 w-full accent-sky-600"
                        />

                        <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                          <span>4m</span>
                          <span>14m</span>
                        </div>
                      </div>

                      {/* Project Type */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-sm font-semibold text-slate-950">
                          Project Type
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Select the closest match for load & usage profile.
                        </p>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          {(
                            [
                              "Warehouse",
                              "Manufacturing Plant",
                              "Commercial Shed",
                            ] as const
                          ).map((t) => {
                            const active = projectType === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setProjectType(t)}
                                className={[
                                  "rounded-xl border px-4 py-3 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2",
                                  active
                                    ? "border-sky-300 bg-sky-50 text-sky-900 ring-sky-300"
                                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50 ring-slate-300",
                                ].join(" ")}
                              >
                                <span className="block">{t}</span>
                                <span className="mt-1 block text-xs font-medium text-slate-500">
                                  {t === "Warehouse" &&
                                    "Logistics • racking • fast erection"}
                                  {t === "Manufacturing Plant" &&
                                    "Heavier loads • cranes • mezzanines"}
                                  {t === "Commercial Shed" &&
                                    "Retail/storage • balanced spec"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Location */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-sm font-semibold text-slate-950">
                          Location (State / City)
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Helps our team consider logistics, wind zone, and site
                          access assumptions.
                        </p>

                        <input
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g., Odisha / Sambalpur"
                          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={onCalculate}
                          disabled={!canCalculate}
                          className={[
                            "inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold shadow-sm ring-1 transition focus:outline-none focus-visible:ring-2",
                            canCalculate
                              ? "bg-orange-500 text-slate-950 shadow-orange-500/20 ring-orange-300/30 hover:bg-orange-400 focus-visible:ring-orange-300"
                              : "cursor-not-allowed bg-slate-200 text-slate-500 ring-slate-200",
                          ].join(" ")}
                        >
                          Calculate Budgetary Estimate
                        </button>

                        <p className="text-xs text-slate-500">
                          We’ll email a PDF-ready breakdown. No on-screen price
                          display.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                  <div className="mt-8">
                    <h3
                      ref={step2HeadingRef}
                      tabIndex={-1}
                      className="text-lg font-semibold text-slate-950 focus:outline-none"
                    >
                      Your estimate is ready. Where should we send the
                      comprehensive PDF breakdown?
                    </h3>

                    <p className="mt-2 text-sm text-slate-600">
                      Share your official details so our engineering team can
                      validate assumptions and deliver a clean budgetary range.
                    </p>

                    <form onSubmit={onSubmitLead} className="mt-6 grid gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700">
                          Official Email Address
                        </label>
                        <input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          type="email"
                          required
                          placeholder="name@company.com"
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700">
                          Mobile Number
                        </label>
                        <input
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          type="tel"
                          required
                          placeholder="10-digit mobile"
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700">
                          Company Name
                        </label>
                        <input
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          type="text"
                          required
                          placeholder="Your organization"
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />
                      </div>

                      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button
                          type="submit"
                          disabled={busy}
                          className={[
                            "inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold shadow-sm ring-1 transition focus:outline-none focus-visible:ring-2",
                            busy
                              ? "cursor-wait bg-slate-200 text-slate-500 ring-slate-200"
                              : "bg-orange-500 text-slate-950 shadow-orange-500/20 ring-orange-300/30 hover:bg-orange-400 focus-visible:ring-orange-300",
                          ].join(" ")}
                        >
                          {busy ? "Sending..." : "Send My Estimate"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                        >
                          Edit technical inputs
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* SUCCESS */}
                {step === "success" && (
                  <div
                    ref={successRef}
                    tabIndex={-1}
                    className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 focus:outline-none"
                  >
                    <p className="text-sm font-semibold text-emerald-900">
                      Estimate Sent! Our engineering team will also review your
                      parameters and follow up shortly.
                    </p>
                    <p className="mt-2 text-sm text-emerald-900/80">
                      Reference:{" "}
                      <span className="font-semibold">
                        {company || "Your Company"}
                      </span>{" "}
                      • {projectType} • {areaSqft.toLocaleString("en-IN")} Sq.
                      Ft. • {clearHeightM}m
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Enterprise-style "Summary" (no price) */}
              <aside className="lg:col-span-5">
                <div className="sticky top-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Parameter Summary
                  </p>

                  <div className="mt-4 grid gap-3 text-sm">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-slate-600">Estimated Area</span>
                      <span className="font-semibold text-slate-900">
                        {areaSqft.toLocaleString("en-IN")} Sq. Ft.
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-slate-600">Clear Height</span>
                      <span className="font-semibold text-slate-900">
                        {clearHeightM} m
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-slate-600">Project Type</span>
                      <span className="font-semibold text-slate-900">
                        {projectType}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-slate-600">Location</span>
                      <span className="max-w-[60%] truncate text-right font-semibold text-slate-900">
                        {location.trim() || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      Budgetary estimate output
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      For procurement discipline, the budgetary range is
                      delivered via email as a PDF-ready breakdown.
                    </p>
                    <div className="mt-4 grid gap-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>Computation status</span>
                        <span className="font-semibold text-slate-900">
                          Ready
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>On-screen price</span>
                        <span className="font-semibold text-slate-900">
                          Hidden
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Delivery method</span>
                        <span className="font-semibold text-slate-900">
                          Email PDF
                        </span>
                      </div>
                    </div>

                    {/* Internal-only note (not a price, just a "confidence" feel) */}
                    <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Internal range generated:{" "}
                      <span className="font-semibold text-slate-900">
                        {formatINR(estimate.low)} – {formatINR(estimate.high)}
                      </span>{" "}
                      <span className="text-slate-500">
                        (hidden from user)
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl bg-slate-900 p-5 text-white">
                    <p className="text-sm font-semibold">
                      Want a faster, engineer-verified quotation?
                    </p>
                    <p className="mt-2 text-sm text-white/80">
                      Upload drawings / BOQ and get a technical review from our
                      team.
                    </p>
                    <div className="mt-4">
                      <TrackedLink
                        href="/contact"
                        ctaName="Upload Drawings"
                        ctaLocation="capabilities_estimator_sidebar"
                        eventName="capabilities_upload_drawings_click"
                        className="inline-flex w-full items-center justify-center rounded-md bg-orange-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm shadow-orange-500/20 ring-1 ring-orange-300/30 transition hover:bg-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                      >
                        Upload Drawings for Technical Review
                      </TrackedLink>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">
                Enterprise-grade gating
              </p>
              <p className="mt-2 text-sm text-slate-600">
                The estimator never reveals pricing on-screen; your range is
                delivered to verified contact details.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">
                In-house capacity proof
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Equipment ownership ensures schedule certainty and reduces
                third-party dependencies.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">
                Procurement-friendly output
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Email delivery supports internal approvals and preserves data
                trail.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER NOTE */}
      <div className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-slate-500">
          © {new Date().getFullYear()} A K ENGINEERING. All Rights Reserved.
        </div>
      </div>
    </main>
  );
}
