"use client";

import { ChatDemoWithRail } from "./chat-demo-with-rail";

interface ChatMessage {
  text: string;
  from: "user" | "bot";
}

export function PhoneMockup({ className = "" }: { className?: string }) {
  return <ChatDemoWithRail className={className} />;
}

export function MiniChat({
  messages,
  className = "",
}: {
  messages: ChatMessage[];
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-black p-3 ${className}`}>
      <div className="flex flex-col gap-1.5">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-1.5 text-[11px] leading-[1.4] whitespace-pre-line ${
                msg.from === "user" ? "bg-imessage text-white" : "bg-[#2a2a2c] text-white"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
