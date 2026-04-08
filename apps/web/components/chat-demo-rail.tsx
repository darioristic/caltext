"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { JSX } from "react";

export type ChatDemoScenario = "snapOrText" | "dailySummaries" | "smartReminders";

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 4l1.2 2H15a3 3 0 013 3v7a3 3 0 01-3 3H7a3 3 0 01-3-3V9a3 3 0 013-3h2z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 19V10M12 19V5M19 19v-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3a4 4 0 00-4 4v2.3c0 .8-.24 1.59-.7 2.24L6 13.5V15h12v-1.5l-1.3-1.96A4 4 0 0116 9.3V7a4 4 0 00-4-4zm-2 15a2 2 0 104 0h-4z"
        fill="currentColor"
      />
    </svg>
  );
}

export const DEMO_STORIES: ReadonlyArray<{
  id: ChatDemoScenario;
  labelKey: "snapOrText.title" | "dailySummaries.title" | "smartReminders.title";
  Icon: ({ className }: { className?: string }) => JSX.Element;
}> = [
  {
    id: "snapOrText",
    labelKey: "snapOrText.title",
    Icon: CameraIcon,
  },
  {
    id: "smartReminders",
    labelKey: "smartReminders.title",
    Icon: BellIcon,
  },
  {
    id: "dailySummaries",
    labelKey: "dailySummaries.title",
    Icon: ChartIcon,
  },
];

export function ChatDemoRail({
  activeScenario,
  onSelect,
  className,
  size = "default",
}: {
  activeScenario: ChatDemoScenario;
  onSelect: (scenario: ChatDemoScenario) => void;
  className?: string;
  size?: "default" | "sm";
}) {
  const t = useTranslations("Features");
  const isSmall = size === "sm";

  return (
    <motion.div
      className={className}
      initial={{ y: 18, opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      animate={{ y: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{
        type: "spring",
        stiffness: 220,
        damping: 24,
        mass: 0.95,
      }}
    >
      <div
        className={`pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center overflow-x-auto rounded-[22px] border border-black/5 bg-[rgba(247,247,247,0.98)] shadow-[0_10px_30px_rgba(17,24,39,0.08)] backdrop-blur-[18px] ${
          isSmall ? "gap-0 p-0.5" : "gap-1 p-1 sm:gap-1 sm:p-1.5"
        }`}
      >
        {DEMO_STORIES.map((story) => {
          const Icon = story.Icon;
          const isActive = activeScenario === story.id;

          return (
            <button
              key={story.id}
              type="button"
              onClick={() => onSelect(story.id)}
              className={`flex shrink-0 items-center rounded-[18px] transition-colors ${
                isSmall
                  ? "gap-1.5 px-2 py-1 font-sans text-xs"
                  : "gap-2 px-2.5 py-1.5 font-sans text-sm sm:px-3 sm:py-1.5"
              } ${isActive ? "bg-black/4 text-primary" : "text-secondary hover:text-primary"}`}
            >
              <Icon className={isSmall ? "size-3" : "size-4"} />
              <span className="whitespace-nowrap font-medium">{t(story.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
