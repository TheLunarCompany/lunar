import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/** Sanitization schema: allow safe markdown + custom <example> with description only. */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "example"],
  attributes: {
    ...defaultSchema.attributes,
    example: [["description"]],
  },
};

/** Max allowed markdown length to avoid DoS from huge content (default 500KB). */
const DEFAULT_MAX_CONTENT_LENGTH = 500_000;

export interface MarkdownContentProps {
  /** Markdown source to render (must be a non-empty string after trim). */
  content: string;
  /** Optional class name for the wrapper */
  className?: string;
  /** Optional truncate: show only first block or limit lines (e.g. for cards) */
  truncate?: boolean;
  /** Max lines when truncate is true (default 3) */
  maxLines?: number;
  /** Max content length; content beyond this is truncated (default 500KB). Set 0 to disable. */
  maxContentLength?: number;
}

const defaultComponents: Components = {
  h1: ({ node: _node, ...props }) => (
    <h1 className="text-xl font-semibold mt-4 mb-2 first:mt-0" {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 className="text-lg font-semibold mt-4 mb-2 first:mt-0" {...props} />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="text-base font-semibold mt-3 mb-1" {...props} />
  ),
  p: ({ node: _node, ...props }) => (
    <p className="text-sm leading-relaxed mb-2 last:mb-0" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="list-disc list-inside text-sm mb-2 space-y-1" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol
      className="list-decimal list-inside text-sm mb-2 space-y-1"
      {...props}
    />
  ),
  li: ({ node: _node, ...props }) => (
    <li className="text-sm leading-relaxed" {...props} />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold" {...props} />
  ),
  code: ({ node: _node, ...props }) => {
    const inline = (props as { inline?: boolean }).inline;
    return inline ? (
      <code
        className="px-1.5 py-0.5 rounded bg-[var(--color-bg-container-secondary)] text-[var(--color-text-primary)] font-mono text-xs"
        {...props}
      />
    ) : (
      <code
        className="block p-3 rounded bg-[var(--color-bg-container-secondary)] text-[var(--color-text-primary)] font-mono text-xs overflow-x-auto"
        {...props}
      />
    );
  },
  pre: ({ node: _node, ...props }) => (
    <pre
      className="p-3 rounded bg-[var(--color-bg-container-secondary)] overflow-x-auto my-2 text-sm"
      {...props}
    />
  ),
  a: ({ node: _node, ...props }) => (
    <a
      className="text-[var(--component-colours-color-fg-interactive-hover)] underline hover:no-underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="border-l-2 border-gray-300 pl-3 my-2 text-sm text-[var(--color-text-secondary)]"
      {...props}
    />
  ),
};

// Custom HTML elements (e.g. <example>) – rendered when using rehype-raw
const customTagComponents = {
  example: (
    props: React.HTMLAttributes<HTMLElement> & { description?: string },
  ) => {
    const { description, children, className, ...rest } = props;
    return (
      <div
        className={`my-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-container-secondary)] overflow-hidden ${className ?? ""}`}
        {...rest}
      >
        {description && (
          <div className="px-3 pt-3 pb-1.5 text-xs font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border-primary)]/50">
            {description}
          </div>
        )}
        <pre className="m-3 p-3 rounded bg-[var(--color-bg-container)] text-xs font-mono leading-relaxed whitespace-pre-wrap break-words overflow-x-hidden text-[var(--color-text-primary)]">
          {children}
        </pre>
      </div>
    );
  },
};

/**
 * Renders markdown content with consistent styling for tool descriptions and similar content.
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  className = "",
  truncate = false,
  maxLines = 3,
  maxContentLength = DEFAULT_MAX_CONTENT_LENGTH,
}) => {
  if (content == null || typeof content !== "string") {
    return null;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  const safeContent =
    maxContentLength > 0 && trimmed.length > maxContentLength
      ? `${trimmed.slice(0, maxContentLength)}\n\n… (content truncated)`
      : trimmed;

  const wrapperClass = truncate
    ? `markdown-content truncate overflow-hidden ${className}`
    : `markdown-content ${className}`;

  const style = truncate
    ? {
        WebkitLineClamp: maxLines,
        display: "-webkit-box",
        WebkitBoxOrient: "vertical" as const,
      }
    : undefined;

  return (
    <div className={wrapperClass} style={style}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        remarkRehypeOptions={{ allowDangerousHtml: true }}
        components={
          { ...defaultComponents, ...customTagComponents } as Components
        }
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  );
};
