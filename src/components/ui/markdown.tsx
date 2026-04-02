"use client";

import { cn } from "@/lib/utils";

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 text-sm text-gray-700">
          {listItems.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h4 key={i} className="text-sm font-semibold text-gray-900 mt-4 first:mt-0">
          {line.slice(4)}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={i} className="text-base font-semibold text-gray-900 mt-5 first:mt-0">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h2 key={i} className="text-lg font-bold text-gray-900 mt-5 first:mt-0">
          {line.slice(2)}
        </h2>
      );
    } else if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={i} className="text-sm text-gray-700 leading-relaxed">
          {line}
        </p>
      );
    }
    i++;
  }
  flushList();

  return (
    <div className={cn("space-y-2", className)}>
      {elements}
    </div>
  );
}
