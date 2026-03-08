import ContactLeadForm from "@/components/ContactLeadForm";
import LazyMapEmbed from "@/components/LazyMapEmbed";
import TrackedAnchor from "@/components/TrackedAnchor";
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_E164,
  CONTACT_WHATSAPP_URL,
} from "@/lib/contact";

export default function ContactPage() {
  return (
    <main className="bg-white text-gray-900">
      <section className="bg-black text-white py-20 text-center px-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Contact A K ENGINEERING
        </h1>
        <p className="max-w-3xl mx-auto text-lg text-gray-300">
          Get in touch with our engineering team for Industrial EPC Projects,
          Pre-Engineered Buildings, Structural Steel Fabrication and Erection Services.
        </p>
      </section>

      <section className="py-20 px-6 max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
        <div>
          <h2 className="text-2xl font-bold mb-6">Business Information</h2>

          <div className="space-y-4 text-lg">
            <p><strong>Company Name:</strong> A K ENGINEERING</p>
            <p><strong>Business Type:</strong> Industrial EPC Contractor</p>
            <p><strong>Specialization:</strong> PEB Structures, Steel Fabrication, Industrial Shed Construction & Erection</p>
            <p><strong>Service Area:</strong> Pan India</p>

            <p>
              <strong>Email:</strong>{" "}
              <TrackedAnchor
                href={`mailto:${CONTACT_EMAIL}`}
                ctaName="Send Email"
                ctaLocation="contact_business_info"
                className="text-blue-600 underline"
                eventName="email_click"
              >
                {CONTACT_EMAIL}
              </TrackedAnchor>
            </p>

            <p>
              <strong>Phone:</strong>{" "}
              <TrackedAnchor
                href={`tel:${CONTACT_PHONE_E164}`}
                ctaName="Call Contact Page"
                ctaLocation="contact_business_info"
                className="text-blue-600 underline"
                eventName="phone_click"
              >
                {CONTACT_PHONE_DISPLAY}
              </TrackedAnchor>
            </p>

            <p>
              <strong>WhatsApp:</strong>{" "}
              <TrackedAnchor
                href={CONTACT_WHATSAPP_URL}
                ctaName="WhatsApp Contact Page"
                ctaLocation="contact_business_info"
                className="text-green-700 underline"
                eventName="whatsapp_click"
                target="_blank"
                rel="noopener noreferrer"
              >
                Start Chat
              </TrackedAnchor>
            </p>

            <p><strong>Office Location:</strong> Sambalpur, Odisha, India</p>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6">Request Industrial Quotation</h2>
          <ContactLeadForm />
        </div>
      </section>

      <section className="pb-20 px-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">Our Location</h2>
        <LazyMapEmbed />
      </section>

    </main>
  );
}
