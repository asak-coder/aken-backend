import Image from "next/image";
import Link from "next/link";
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_E164,
  CONTACT_WHATSAPP_PREFILL_URL,
  CONTACT_WHATSAPP_URL,
} from "@/lib/contact";

export default function SiteFooter() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Company + Trust */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-3"
              aria-label="A K ENGINEERING Home"
            >
              <Image
                src="/logo/logo.svg"
                alt="A K ENGINEERING"
                width={44}
                height={44}
                className="h-11 w-11 rounded-md bg-white/5 p-1 object-contain"
              />
              <div className="text-lg font-extrabold tracking-tight">A K ENGINEERING</div>
            </Link>

            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Industrial EPC contractor specializing in steel fabrication, structural erection,
              and pre-engineered buildings (PEB). Execution-first delivery with safety compliance
              and procurement-friendly coordination.
            </p>

            <div className="mt-5 grid gap-2 text-xs text-white/70">
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                Safety-first site execution
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-orange-400" aria-hidden="true" />
                Confidential drawings handling
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden="true" />
                Pan-India execution capability
              </div>
            </div>
          </div>

          {/* Column 2: Quick links */}
          <div>
            <div className="text-sm font-extrabold tracking-wide text-white/90">QUICK LINKS</div>
            <ul className="mt-4 grid gap-2 text-sm">
              <li>
                <Link className="text-white/75 hover:text-white" href="/">
                  Home
                </Link>
              </li>
              <li>
                <Link className="text-white/75 hover:text-white" href="/services">
                  Services
                </Link>
              </li>
              <li>
                <Link className="text-white/75 hover:text-white" href="/projects">
                  Projects
                </Link>
              </li>
              <li>
                <Link className="text-white/75 hover:text-white" href="/about">
                  About Us
                </Link>
              </li>
              <li>
                <Link className="text-white/75 hover:text-white" href="/blog">
                  Insights
                </Link>
              </li>
              <li>
                <Link className="text-white/75 hover:text-white" href="/contact">
                  Contact
                </Link>
              </li>
              <li>
                <Link className="text-white/75 hover:text-white" href="/privacy-policy">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link className="text-white/75 hover:text-white" href="/terms-and-conditions">
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Core services */}
          <div>
            <div className="text-sm font-extrabold tracking-wide text-white/90">
              CORE SERVICES
            </div>
            <ul className="mt-4 grid gap-2 text-sm">
              <li className="text-white/75">
                <Link className="hover:text-white" href="/services#peb">
                  Pre-Engineered Buildings (PEB)
                </Link>
              </li>
              <li className="text-white/75">
                <Link className="hover:text-white" href="/services#fabrication">
                  Heavy Steel Fabrication
                </Link>
              </li>
              <li className="text-white/75">
                <Link className="hover:text-white" href="/services#erection">
                  Structural Steel Erection
                </Link>
              </li>
              <li className="text-white/75">
                <Link className="hover:text-white" href="/services#maintenance">
                  Mechanical Maintenance & Retrofitting
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact operations */}
          <div>
            <div className="text-sm font-extrabold tracking-wide text-white/90">
              CONTACT OPERATIONS
            </div>

            <div className="mt-4 grid gap-3 text-sm text-white/75">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/90">Headquarters</div>
                <div className="mt-1 leading-relaxed">
                  Hirakud, Sambalpur, Odisha, India
                </div>
              </div>

              <a
                href={`tel:${CONTACT_PHONE_E164}`}
                className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10"
              >
                <div className="text-xs font-semibold text-white/90">Phone</div>
                <div className="mt-1">{CONTACT_PHONE_DISPLAY}</div>
              </a>

              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10"
              >
                <div className="text-xs font-semibold text-white/90">Email</div>
                <div className="mt-1 break-all">{CONTACT_EMAIL}</div>
              </a>

              <a
                href={CONTACT_WHATSAPP_PREFILL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/10 bg-emerald-500/90 p-4 font-semibold text-black hover:bg-emerald-400"
              >
                WhatsApp Business
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <div>
            © {new Date().getFullYear()} A K ENGINEERING. All rights reserved.
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <span>A K ENGINEERING - Premier EPC & Steel Fabrication Contractors</span>
            <span className="hidden md:inline">•</span>
            <Link className="underline hover:text-white" href="/contact">
              Request a Quote
            </Link>
          </div>
        </div>
      </div>

      {/* Optional: in-page quick WhatsApp for footer context */}
      <a href={CONTACT_WHATSAPP_URL} className="sr-only">
        {CONTACT_WHATSAPP_URL}
      </a>
      <a href={CONTACT_WHATSAPP_PREFILL_URL} className="sr-only">
        {CONTACT_WHATSAPP_PREFILL_URL}
      </a>
    </footer>
  );
}
