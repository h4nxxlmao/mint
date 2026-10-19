import type { MDXComponents } from "mdx/types";
import { HighlightedPre } from "@/components/docs/highlighted-pre";
import { MdxHeading } from "@/components/mdx-heading";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: ({ children }) => <MdxHeading level={2}>{children}</MdxHeading>,
    h3: ({ children }) => <MdxHeading level={3}>{children}</MdxHeading>,
    pre: HighlightedPre,
    table: ({ children }) => (
      <div
        className="table-scroll -mx-1 overflow-x-auto rounded-lg border border-line px-1 sm:mx-0 sm:px-0"
        role="region"
        aria-label="Table, scroll horizontally if needed"
        tabIndex={0}
      >
        <table>{children}</table>
      </div>
    ),
    a: ({ href = "", children, ...props }) => {
      const external = /^https?:\/\//.test(href);
      return (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          {...props}
        >
          {children}
        </a>
      );
    },
    ...components,
  };
}
