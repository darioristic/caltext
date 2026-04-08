import { useTranslations } from "next-intl";
import { IMessageButton } from "./imessage-button";

export function Nav() {
  const t = useTranslations("Nav");

  return (
    <nav className="fixed inset-x-0 top-0 z-50 px-4 pt-2.5">
      <div className="mx-auto max-w-150">
        <div className="flex items-center justify-between rounded-full border border-white/70 bg-white/72 px-3 py-2 shadow-[0_10px_30px_rgba(17,24,39,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[11px] border border-primary/85 bg-primary shadow-[0_8px_18px_rgba(17,24,39,0.18)]">
              <span className="font-heading text-[0.95rem] leading-none text-white">C</span>
            </div>
            <span className="font-body text-[1.08rem] leading-none font-semibold tracking-[-0.02em] text-primary">
              {t("logo")}
            </span>
          </div>

          <div className="hidden items-center gap-8 text-[13px] font-medium text-primary/88 md:flex">
            <a href="#features" className="transition-colors hover:text-primary">
              {t("features")}
            </a>
            <a href="#faqs" className="transition-colors hover:text-primary">
              {t("faqs")}
            </a>
          </div>

          <IMessageButton
            short
            compact
            showIcon={false}
            className="hidden sm:inline-flex min-h-8.5 rounded-full px-3 py-0.75 text-[0.78rem]"
          />
        </div>
      </div>
    </nav>
  );
}
