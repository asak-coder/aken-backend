import { blogPosts } from "@/lib/blog-data";
import TrackedAnchor from "@/components/TrackedAnchor";
import TrackedLink from "@/components/TrackedLink";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_E164, CONTACT_WHATSAPP_URL } from "@/lib/contact";

export const metadata = {
  title: "Industrial Engineering Blog | A K ENGINEERING",
  description:
    "Read expert articles on Pre-Engineered Buildings, Industrial Steel Fabrication and EPC project execution.",
};

export default function BlogPage() {
  return (
    <main className="bg-white text-gray-900 min-h-screen">
      <section className="bg-black text-white py-20 text-center px-6">
        <h1 className="text-4xl font-bold">Industrial Engineering Blog</h1>
        <p className="mt-4 text-gray-300">
          Insights on PEB, Steel Fabrication & Industrial EPC Projects
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <TrackedAnchor
            href={CONTACT_WHATSAPP_URL}
            ctaName="WhatsApp"
            ctaLocation="blog_hero"
            eventName="whatsapp_click"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-green-500 px-5 py-2 font-semibold text-black hover:bg-green-400 transition"
          >
            WhatsApp
          </TrackedAnchor>
          <TrackedAnchor
            href={`tel:${CONTACT_PHONE_E164}`}
            ctaName="Call Now"
            ctaLocation="blog_hero"
            eventName="phone_click"
            className="rounded-lg border border-white px-5 py-2 hover:bg-white hover:text-black transition"
          >
            {CONTACT_PHONE_DISPLAY}
          </TrackedAnchor>
        </div>
      </section>

      <section className="max-w-5xl mx-auto py-16 px-6">
        <div className="space-y-10">
          {blogPosts.map((post) => (
            <div key={post.slug} className="border-b pb-8">
              <h2 className="text-2xl font-semibold mb-2">
                <TrackedLink
                  href={`/blog/${post.slug}`}
                  ctaName={post.title}
                  ctaLocation="blog_listing"
                  eventName="blog_article_click"
                  className="text-blue-600 hover:underline"
                >
                  {post.title}
                </TrackedLink>
              </h2>

              <p className="text-gray-600 mb-2">{post.description}</p>

              <p className="text-sm text-gray-400">Published on {post.date}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
