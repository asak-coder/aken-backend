import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogPosts } from "@/lib/blog-data";
import TrackedLink from "@/components/TrackedLink";

type BlogPostRouteParams = {
  slug: string;
};

type BlogPostPageProps = {
  params: Promise<BlogPostRouteParams>;
};

function getPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

const SITE_URL = "https://aken.firm.in";
const BLOG_BASE_URL = `${SITE_URL}/blog`;
const ORG_NAME = "A K ENGINEERING";

function getPostUrl(slug: string) {
  return `${BLOG_BASE_URL}/${slug}`;
}

function estimateReadingTimeMinutes(content: string) {
  const words = content
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 200));
}

export function generateStaticParams(): BlogPostRouteParams[] {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: "Blog Post Not Found | A K ENGINEERING",
      description: "The requested article is not available.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonicalUrl = getPostUrl(post.slug);
  const publishedTime = new Date(post.date).toISOString();
  const modifiedTime = new Date(post.updatedAt || post.date).toISOString();

  return {
    title: `${post.title} | A K ENGINEERING`,
    description: post.description,
    keywords: post.keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: post.title,
      description: post.description,
      siteName: ORG_NAME,
      publishedTime,
      modifiedTime,
      authors: [ORG_NAME],
      tags: post.keywords,
      locale: "en_IN",
    },
    twitter: {
      card: "summary",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const contentLines = post.content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const canonicalUrl = getPostUrl(post.slug);
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: new Date(post.date).toISOString(),
    dateModified: new Date(post.updatedAt || post.date).toISOString(),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    author: {
      "@type": "Organization",
      name: ORG_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: ORG_NAME,
      url: SITE_URL,
    },
    articleSection: "Industrial Engineering",
    keywords: post.keywords.join(", "),
    wordCount: post.content.split(/\s+/).filter(Boolean).length,
    timeRequired: `PT${estimateReadingTimeMinutes(post.content)}M`,
    inLanguage: "en-IN",
  };

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <section className="bg-black px-6 py-20 text-center text-white">
        <h1 className="mx-auto max-w-4xl text-4xl font-bold md:text-5xl">
          {post.title}
        </h1>
        <p className="mt-4 text-gray-300">
          Published on {post.date} · {estimateReadingTimeMinutes(post.content)} min read
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        <article className="space-y-5 leading-relaxed text-gray-700">
          {contentLines.map((line, index) => (
            <p key={`${post.slug}-${index}`}>{line}</p>
          ))}
        </article>

        <div className="mt-10 border-t border-gray-200 pt-6">
          <TrackedLink
            href="/blog"
            ctaName="Back to all articles"
            ctaLocation="blog_post_footer"
            eventName="blog_back_click"
            className="font-semibold text-blue-600 hover:underline"
          >
            Back to all articles
          </TrackedLink>
        </div>
      </section>
    </main>
  );
}
