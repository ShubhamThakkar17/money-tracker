import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-pretty text-ink-2">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-surface-2 px-3 py-6 text-center text-sm text-muted">{children}</p>;
}

type Tone = "neutral" | "good" | "warning" | "critical" | "accent";
const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  good: "bg-good/12 text-good-text",
  warning: "bg-warning/18 text-ink",
  critical: "bg-critical/12 text-critical-text",
  accent: "bg-accent/12 text-accent",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", toneClass[tone])}>
      {children}
    </span>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Select({ options, placeholder, ...props }: ComponentProps<"select"> & {
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
}) {
  return (
    <select {...props} className={cx(inputClass, "pr-8", props.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>{o}</option>
        ) : (
          <option key={o.value} value={o.value}>{o.label}</option>
        ),
      )}
    </select>
  );
}

export function Button({ variant = "primary", ...props }: ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-60",
        variant === "primary"
          ? "bg-accent text-accent-ink hover:brightness-110"
          : variant === "danger"
            ? "bg-critical text-white hover:brightness-110"
            : "border border-line bg-surface text-ink hover:bg-surface-2",
        props.className,
      )}
    />
  );
}
