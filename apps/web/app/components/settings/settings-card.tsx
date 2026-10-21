import { cn } from "~/lib/cn";

export function ToggleRow({
  checked,
  onChange,
  label,
  subtext,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  subtext: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border-subtle bg-base p-3">
      <div className="flex flex-col">
        <span className="font-ui text-sm font-medium text-primary">{label}</span>
        <span className="font-ui text-xs text-tertiary">{subtext}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-brand-ui" : "bg-border-strong",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border-subtle bg-surface p-6">
      <h2 className="font-display text-xl text-primary">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export const inputClass =
  "w-full rounded-md border border-border-subtle bg-base px-3 py-2 font-ui text-sm text-primary";
