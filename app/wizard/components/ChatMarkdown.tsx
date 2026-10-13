"use client";

import ReactMarkdown from "react-markdown";

interface ChatMarkdownProps {
  content: string;
}

// Renders assistant chat messages as markdown, with spacing tightened for chat bubbles.
export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none [--tw-prose-invert-body:#a1a1aa] [--tw-prose-invert-bold:#e4e4e7] [--tw-prose-invert-headings:#e4e4e7] prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-hr:my-4 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
