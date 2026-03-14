import type { Metadata } from "next";
import Link from "next/link";
import SmartEnquiryWizard from "@/components/SmartEnquiryWizard";

export const metadata: Metadata = {
  title: "Industrial Project Enquiry | A K ENGINEERING",
  description:
    "Send an industrial project enquiry for EPC services including PEB sheds, steel structure fabrication, sheet cladding, industrial maintenance, and structural repair. Get a fast engineering callback and quotation support.",
};

export default function EnquiryPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr] lg:items-start">
          <div className="order-2 lg:order-1">
            <SmartEnquiryWizard />

            <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Need urgent assistance?
              </p>
              <h2 className="mt-2 text-xl font-bold text-gray-900">Call our engineering team.</h2>
              <p className="mt-2 text-sm text-gray-600">
                Phone: <span className="font-semibold text-gray-900">+91 XXXXXXXXXX</span>
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/enquiry"
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black transition"
                >
                  Request Project Quote
                </Link>
                <p className="text-xs text-gray-500">
                  For fastest response, submit this enquiry and we’ll call you back.
                </p>
              </div>
            </section>
          </div>

          <aside className="order-1 lg:order-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900">Industrial EPC & Steel Works</h2>
              <p className="mt-2 text-sm text-gray-600">
                Use this wizard to share key project details. It helps our team understand scope, tonnage,
                timeline, and location for faster quotation.
              </p>

              <dl className="mt-5 grid gap-4">
                <div className="rounded-xl bg-gray-50 p-4">
                  <dt className="text-xs font-semibold text-gray-500">Services</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    PEB • Fabrication • Cladding • Maintenance • Retrofitting
                  </dd>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <dt className="text-xs font-semibold text-gray-500">What you’ll need</dt>
                  <dd className="mt-1 text-sm text-gray-700">
                    Location, approximate tonnage, project type and timeline. Drawings/BOQ are optional.
                  </dd>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <dt className="text-xs font-semibold text-gray-500">Response</dt>
                  <dd className="mt-1 text-sm text-gray-700">
                    Our engineering team typically contacts you within 24 working hours.
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
