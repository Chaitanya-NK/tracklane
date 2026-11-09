import type { Components } from "react-markdown";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders user-written Markdown (GitHub flavour). Raw HTML is not rendered, so user content
 * can't inject markup or scripts; links open in a new tab without referrer.
 */
const components: Components = {
  a: ({ href, children }) =>
    href?.startsWith("user:") ? (
      <span className="rounded bg-primary/10 px-1 py-0.5 font-medium text-primary">{children}</span>
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="font-medium text-primary underline underline-offset-4"
      >
        {children}
      </a>
    ),
  h1: ({ children }) => <h3 className="mt-4 text-lg font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h4 className="mt-4 text-base font-semibold first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="mt-3 font-semibold first:mt-0">{children}</h5>,
  p: ({ children }) => <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => (
    <code className={cn("rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]", className)}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border px-2 py-1 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
  hr: () => <hr className="my-4" />,
  img: ({ src, alt }) =>
    typeof src === "string" ? (
      // eslint-disable-next-line @next/next/no-img-element -- user content from arbitrary hosts
      <img src={src} alt={alt ?? ""} className="my-2 max-h-96 rounded-md border" loading="lazy" />
    ) : null,
};

/** @[Name](user:id) → a link labelled "@Name" that renders as a mention chip. */
const withMentions = (markdown: string) =>
  markdown.replace(/@\[([^\]\n]{1,80})\]\(user:([A-Za-z0-9_-]{1,64})\)/g, "[@$1](user:$2)");

/** Keeps mention links (user:…); everything else goes through react-markdown's safe default. */
const urlTransform = (url: string) =>
  /^user:[A-Za-z0-9_-]+$/.test(url) ? url : defaultUrlTransform(url);

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-sm break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        urlTransform={urlTransform}
        skipHtml
      >
        {withMentions(children)}
      </ReactMarkdown>
    </div>
  );
}
