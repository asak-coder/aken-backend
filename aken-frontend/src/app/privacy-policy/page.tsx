import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | A K ENGINEERING",
  description:
    "Learn how A K ENGINEERING collects, uses and protects contact and project-related information.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-white text-gray-900">
      <section className="bg-black px-6 py-20 text-center text-white">
        <h1 className="mb-4 text-4xl font-bold md:text-5xl">Privacy Policy</h1>
        <p className="mx-auto max-w-2xl text-gray-300">Last updated: March 2, 2026</p>
      </section>

      <section className="mx-auto max-w-4xl space-y-8 px-6 py-14 text-lg leading-relaxed">
        <p>
          This Privacy Policy describes how A K ENGINEERING collects and uses
          personal information received through this website, enquiry forms, and
          related communication channels.
        </p>

        <section>
          <h2 className="mb-3 text-2xl font-bold">1. Information We Collect</h2>
          <p className="mb-3">
            We collect information you voluntarily share while requesting
            consultation or quotations.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Contact person name</li>
            <li>Email address and phone number</li>
            <li>Company name and project details</li>
            <li>Communication history with our team</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-bold">2. Why We Use This Data</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Respond to enquiries and prepare project quotations</li>
            <li>Provide engineering and execution support</li>
            <li>Track service quality and improve response time</li>
            <li>Comply with legal and contractual obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-bold">3. Data Sharing</h2>
          <p>
            We do not sell personal data. Information may be shared only with
            internal teams, trusted service providers, or legal authorities when
            required to complete projects or satisfy compliance obligations.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-bold">4. Data Security</h2>
          <p>
            We apply reasonable administrative and technical safeguards to
            protect stored information from unauthorized access, alteration or
            misuse.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-bold">5. Cookies and Analytics</h2>
          <p>
            Our website may use cookies and analytics tools to understand usage
            patterns and improve website performance. You can manage cookies
            through your browser settings.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-bold">6. Your Rights</h2>
          <p>
            You may request access, correction or deletion of your personal data
            by contacting us at the email address below.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-bold">7. Contact</h2>
          <p>A K ENGINEERING, Sambalpur, Odisha, India</p>
          <p>Email: web.akengg@gmail.com</p>
          <p>Phone: +91 99999 99999</p>
        </section>
      </section>
    </main>
  );
}
