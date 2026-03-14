import TrackedLink from "@/components/TrackedLink";

export const metadata = {
  title: "About Us | A K ENGINEERING",
  description:
    "A K ENGINEERING is a premier EPC, heavy structural steel fabrication, and construction contractor based in Hirakud, Odisha.",
};

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

function IconBlueprint(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 8h6M9 12h6M9 16h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconStopwatch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9 2h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 6a8 8 0 108 8 8 8 0 00-8-8z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 14l3-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M18.3 7.7l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AboutPage() {
  return (
    <main className="bg-white text-slate-900">
      {/* =========================================================
          ABOUT US / CORPORATE PROFILE — A K ENGINEERING
          Design System: Heavy-Duty Minimalist (Engineering Blue, Construction Orange, Steel Grey)
          Notes:
          - Background image placeholders are provided via /public/hero-steel.jpg and /public/engineers-blueprint.jpg
          - Replace headshot placeholder with an actual photo when available
         ========================================================= */}

      {/* SECTION 1: THE HERO HEADER */}
      <section className="relative isolate overflow-hidden bg-slate-950">
        {/* Background image placeholder */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/hero-steel.jpg)" }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-slate-950/70" />

        {/* Subtle cinematic edge highlights */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -top-24 left-1/2 h-72 w-[52rem] -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute -bottom-28 right-[-10%] h-72 w-[44rem] rounded-full bg-orange-500/15 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-24 lg:py-28">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              About Us / Corporate Profile
            </p>

            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Engineering the Backbone of India’s Heavy Industry.
            </h1>

            <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/80 sm:text-lg">
              A K ENGINEERING is a premier EPC, heavy structural steel
              fabrication, and construction contractor based in Hirakud, Odisha.
              We transform complex blueprints into unyielding industrial reality.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <TrackedLink
                href="/contact"
                ctaName="Upload Your Project Drawings for Technical Review"
                ctaLocation="about_hero"
                eventName="about_upload_drawings_click"
                className="inline-flex items-center justify-center rounded-md bg-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm shadow-orange-500/20 ring-1 ring-orange-300/30 transition hover:bg-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                Upload Your Project Drawings for Technical Review
              </TrackedLink>

              <TrackedLink
                href="/services"
                ctaName="View Services"
                ctaLocation="about_hero"
                eventName="about_view_services_click"
                className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                View Services
              </TrackedLink>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: THE CORPORATE PROFILE */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="mt-1 h-10 w-1 rounded-full bg-slate-800" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                    Precision Scale. Uncompromising Execution.
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    Strategically headquartered in the industrial heartland of
                    Hirakud, Sambalpur, A K ENGINEERING serves as a
                    single-source EPC partner for the power, cement, mining, and
                    manufacturing sectors. We do not just construct buildings;
                    we engineer the critical frameworks that keep heavy
                    industries operational.
                  </p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4 text-xs text-slate-600">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">Location</p>
                  <p className="mt-1">Hirakud, Sambalpur, Odisha</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">
                    Single-Source EPC
                  </p>
                  <p className="mt-1">Design • Fabrication • Erection</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">Fabrication</p>
                  <p className="mt-1">In-house control</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">
                    Delivery Timelines
                  </p>
                  <p className="mt-1">Aggressive & disciplined</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-base leading-relaxed text-slate-700 sm:text-lg">
                From the rapid manufacturing of Pre-Engineered Buildings (PEB)
                to high-tonnage structural steel erection and live-environment
                mechanical retrofitting, our capability spans the entire
                industrial construction lifecycle. By controlling the fabrication
                process within our own advanced facility, we eliminate
                third-party bottlenecks, ensuring strict metallurgical
                tolerances and aggressive project delivery timelines.
              </p>

              <div className="mt-10 rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Built for Procurement Confidence
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Single-source accountability from design to erection.
                    </p>
                  </div>
                  <TrackedLink
                    href="/contact"
                    ctaName="Request Technical Review"
                    ctaLocation="about_profile"
                    eventName="about_request_tech_review_click"
                    className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    Request Technical Review
                  </TrackedLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: THE LEADERSHIP GUARANTEE */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            {/* Headshot placeholder */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gradient-to-br from-slate-200 to-slate-100">
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <div className="mx-auto h-16 w-16 rounded-full bg-slate-300" />
                      <p className="mt-3 text-xs font-medium text-slate-600">
                        Headshot Placeholder
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm text-slate-600">
                  Leadership accountability is embedded into every deliverable.
                </p>
              </div>
            </div>

            {/* Blockquote */}
            <div className="lg:col-span-8">
              <div className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="pointer-events-none absolute -top-6 left-6 select-none text-7xl font-semibold text-slate-200">
                  “
                </div>

                <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Driven by Engineering Excellence
                </h2>

                <blockquote className="mt-6 text-base leading-relaxed text-slate-700 sm:text-lg">
                  {
                    '"In the EPC and structural fabrication sector, trust is built exactly like our steel structures: weld by weld, project by project. At A K ENGINEERING, our philosophy is anchored in absolute accountability. We do not over-promise, and we do not under-deliver. When we take on your project, my team and I treat your operational deadlines as our own. We enforce the strictest safety protocols, demand engineering perfection, and stand behind every single ton of steel we erect."'
                  }
                </blockquote>

                <p className="mt-6 text-sm font-semibold text-slate-900">
                  Ashis Mahato | Proprietor, A K ENGINEERING
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: OUR TURNKEY EXECUTION METHODOLOGY */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Our Turnkey Execution Methodology
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              A disciplined, four-phase workflow built for site certainty.
            </h2>
          </div>

          {/* 4-step timeline / card grid */}
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-7 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Phase 1: Advanced Design & Detailing
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    (Translating your technical requirements into precise
                    AutoCAD and STAAD.Pro structural models to ensure zero
                    site-fitment issues.)
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-7 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Phase 2: Heavy Fabrication in Hirakud
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    (Utilizing advanced CNC cutting, submerged arc welding
                    (SAW), and rigorous non-destructive testing (NDT) to
                    manufacture high-tensile structural components.)
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-7 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Phase 3: Strategic Logistics
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    (Coordinating the safe, sequenced transportation of heavy
                    fabricated members from our Sambalpur facility directly to
                    your project site.)
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-7 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white">
                  4
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Phase 4: Mechanized Site Erection
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    (Deploying expert rigging teams, heavy-lifting equipment,
                    and strict fall-protection protocols to assemble your
                    structure rapidly and safely.)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* optional central graphic placeholder */}
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Blueprint-to-Commissioning
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  A predictable sequence designed to reduce rework and downtime.
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-slate-900/10" />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: CORE VALUES & SAFETY */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
              Core Values & Safety
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              The A K ENGINEERING Standard
            </h2>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/20">
                  <IconShield className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">
                    {'"Zero-Harm" Safety Culture'}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    We operate under the strict belief that no project is
                    successful unless every engineer and rigger goes home safely.
                    Comprehensive site safety management and engineered lifting
                    plans are non-negotiable on our sites.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/20">
                  <IconBlueprint className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">
                    Unyielding Quality Control
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    100% material traceability. Every beam, column, and truss
                    undergoes rigorous in-house dimensional and welding
                    inspections before it ever leaves our shop floor.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/20">
                  <IconStopwatch className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">
                    Timeline Integrity
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    Downtime is the enemy of industry. Our synchronized
                    fabrication and erection schedules are designed to get your
                    facility online, producing revenue, months faster than
                    conventional civil construction.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/75">
              Procurement-ready delivery: engineered lifting plans, documented
              inspections, and disciplined sequencing that protects both people
              and operations.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 6: THE FINAL CALL-TO-ACTION */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Partner With a Proven EPC Contractor
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Whether you are planning a massive multi-span logistics park,
              require heavy structural fabrication, or need immediate industrial
              shed retrofitting, our engineering team is ready to mobilize.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <TrackedLink
                href="/contact"
                ctaName="Upload Your Project Drawings for Technical Review"
                ctaLocation="about_final_cta"
                eventName="about_upload_drawings_final_click"
                className="inline-flex items-center justify-center rounded-md bg-orange-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-sm shadow-orange-500/20 ring-1 ring-orange-300/30 transition hover:bg-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                Upload Your Project Drawings for Technical Review
              </TrackedLink>

              <TrackedLink
                href="/contact"
                ctaName="Talk to Engineering"
                ctaLocation="about_final_cta"
                eventName="about_talk_to_engineering_click"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Talk to Engineering
              </TrackedLink>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
