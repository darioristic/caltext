"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ChatDemoScenario, ChatIMessageAnimation } from "./animations/chat-demo";
import { DEMO_STORIES } from "./chat-demo-rail";
import { IPhoneMock } from "./iphone-mock";

const PHONE_W = 418;
const PHONE_H = 890;
const SCALE = 0.72;
const PAUSE_BETWEEN_SCENARIOS_MS = 1500;

export function ChatDemoWithRail({ className = "" }: { className?: string }) {
  const featuresT = useTranslations("Features");
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [startAtEnd, setStartAtEnd] = useState(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scenario: ChatDemoScenario = DEMO_STORIES[scenarioIndex]?.id ?? "smartReminders";

  const label = useMemo(() => {
    const labelKey = DEMO_STORIES[scenarioIndex]?.labelKey ?? "smartReminders.title";
    return featuresT(labelKey);
  }, [featuresT, scenarioIndex]);

  const handleComplete = useCallback(() => {
    setPlaying(false);
    setStartAtEnd(false);

    pauseTimerRef.current = setTimeout(() => {
      setScenarioIndex((prev) => (prev + 1) % DEMO_STORIES.length);
      setPlaying(true);
      pauseTimerRef.current = null;
    }, PAUSE_BETWEEN_SCENARIOS_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current !== null) {
        clearTimeout(pauseTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-6 ${className}`}>
      <div className="flex min-h-0 flex-1 items-center justify-center pb-4">
        <div
          className="relative"
          style={{
            width: Math.round(PHONE_W * SCALE),
            height: Math.round(PHONE_H * SCALE),
          }}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ transform: `scale(${SCALE})` }}
          >
            <IPhoneMock>
              <ChatIMessageAnimation
                key={`${scenario}-${startAtEnd ? "end" : "start"}`}
                scenario={scenario}
                playing={playing}
                startAtEnd={startAtEnd}
                onComplete={handleComplete}
              />
            </IPhoneMock>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-3 pb-2">
        <AnimatePresence mode="wait">
          <motion.span
            key={scenario}
            initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="text-xs font-medium text-muted"
          >
            {label}
          </motion.span>
        </AnimatePresence>

        <div className="flex items-center gap-1.5">
          {DEMO_STORIES.map((story, i) => (
            <motion.div
              key={story.id}
              className={`h-1.5 rounded-full ${
                i === scenarioIndex ? "bg-primary" : "bg-primary/20"
              }`}
              animate={{ width: i === scenarioIndex ? 16 : 6 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
