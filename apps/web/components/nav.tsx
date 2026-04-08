import { useTranslations } from "next-intl";
import { IMessageButton } from "./imessage-button";

export function Nav() {
  const t = useTranslations("Nav");

  return (
    <nav className="fixed inset-x-0 top-0 z-50 px-4 pt-2.5">
      <div className="mx-auto max-w-150">
        <div className="flex items-center justify-between rounded-full border border-bg/70 bg-bg/72 px-3 py-2 shadow-[0_10px_30px_rgba(44,40,37,0.08),inset_0_1px_0_rgba(246,244,241,0.7)] backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[11px] border border-[#e8751a]/20 bg-[linear-gradient(145deg,#f5a623_0%,#e8751a_100%)] shadow-[0_8px_18px_rgba(232,117,26,0.25)]">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M19.5 10.5C19.5 6 16 2.5 11 2.5C6 2.5 2.5 6 2.5 10.5C2.5 12.8 3.5 14.8 5.2 16.2L4 21L8 18.5C9 18.9 10 19 11 19C12.2 19 13.3 18.8 14.3 18.3"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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
