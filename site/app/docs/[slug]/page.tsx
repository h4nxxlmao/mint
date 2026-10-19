import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsPager } from "@/components/docs/docs-pager";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { DocsTocDesktop, DocsTocMobile } from "@/components/docs/docs-toc";
import { DOCS, getAdjacentDocs, getDoc, getDocToc } from "@/lib/docs";
import { site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);

  if (!doc) return {};

  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: `/docs/${doc.slug}` },
    openGraph: {
      type: "article",
      title: `${doc.title} | mint docs`,
      description: doc.description,
      url: `${site.url}/docs/${doc.slug}`,
    },
  };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);

  if (!doc) notFound();

  const toc = getDocToc(doc.slug);
  const { previous, next } = getAdjacentDocs(doc.slug);
  const Doc = doc.component;

  return (
    <div className="wrap py-10 md:py-14">
      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
        <DocsSidebar />

        <div className="min-w-0">
          <DocsTocMobile toc={toc} />

          <header className="mb-8 border-b border-line pb-7">
            <p className="mono-label">{doc.group} / Documentation</p>
            <h1 className="mt-3 text-balance text-[clamp(2.25rem,4.7vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-foreground">
              {doc.title}
            </h1>
            <p className="mt-4 max-w-[62ch] text-pretty text-base leading-7 text-muted">{doc.description}</p>
          </header>

          <article className="prose-docs max-w-none">
            <Doc />
          </article>

          <DocsPager previous={previous} next={next} />
        </div>

        <DocsTocDesktop toc={toc} />
      </div>
    </div>
  );
}
