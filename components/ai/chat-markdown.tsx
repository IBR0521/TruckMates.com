"use client"

import ReactMarkdown from "react-markdown"

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm space-y-2 [&_p]:leading-relaxed [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-xs [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:text-xs">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
