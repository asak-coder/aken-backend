import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description:
    "Terms and conditions governing enquiry submission, project consultation, and communication with A K ENGINEERING.",
};

export default function TermsAndConditionsPage() {
  return (
    <main className="bg-white text-gray-900">
      <section className="bg-black px-6 py-20 text-center text-white">
        <h1 className="mb-4 text-4xl font-bold md:text-5xl">Terms and Conditions</h1>
        <p className="mx-auto max-w-2xl text-gray-300">Last updated: March 2, 2026</p>
      </section>

      <section className="mx-auto max-w-4xl space-y-8 px-6 py-14 text-lg leading-relaxed">
        <p>
          These Terms and Conditions apply to all users of the A K ENGINEERING
          website and to all enquiry submissions made through this platform.
        </p>

        <section>
          <h2 className="mb-3 text-2xl font-bold">1. Scope of Information</h2>
          <p>
            Content on this website is provided for general business information
            regarding Industrial EPC, PEB, steel fabrication, and erection
            services. Final project scope, pricing, and delivery terms are
            defined only through formal quotations and contractual documents.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-bold">2. Enquiry Submission</h2>
          <p>
            By submitting an enquiry form, you confirm that the provided details
            are accurate and that you authorize our team to contact you for
            project discussion, quotation, and technical clarification.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-bold">3. Quotation and Commercial Terms</h2>
          <p>
            Any estimate shared via email, phone, or messaging channels is
            indicative unless explicitly stated as final. Binding terms are
            valid only after mutual acceptance of approved quotation and contract
            conditions.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-bold">4. Intellectual Property</h2>
          <p>
            All website content, including text, structure, and branding, is the
            property of A K ENGINEERING unless otherwise stated. Unauthorized
            commercial reproduction is not permitted.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-bold">5. Limitation of Liability</h2>
          <p>
            A K ENGINEERING is not liable for business decisions taken solely on
            the basis of website content without project-level technical and
            commercial evaluation.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-bold">6. Governing Jurisdiction</h2>
          <p>
            These terms are governed by applicable laws in India. Any disputes
            arising from website use are subject to jurisdiction as per governing
            legal provisions.
          </p>
        </section>
      </section>
    </main>
  );
}
