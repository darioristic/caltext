import { useTranslations } from "next-intl";

const ITEM_KEYS = ["freeTrial", "noApp", "noSignUp"] as const;

export function TrustBar() {
  const t = useTranslations("TrustBar");

  return (
    <section className="border-y border-border py-5">
      <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 px-6 text-[13px] text-muted">
        {ITEM_KEYS.map((key, i) => (
          <span key={key} className="flex items-center gap-3">
            {i > 0 && <span className="h-1 w-1 rounded-full bg-muted/40" />}
            {t(`items.${key}`)}
          </span>
        ))}
      </div>
    </section>
  );
}
