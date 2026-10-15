export function Card({ className = "", children }) {
  return (
    <section
      className={`rounded-lg border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between px-3.5 pt-3.5">
      <div>
        <h2 className="text-[12px] font-semibold leading-4 text-ink">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[10px] leading-4 text-muted">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function CardLink({ href = "#", children }) {
  return (
    <a
      href={href}
      className="text-[10px] font-medium text-brand hover:underline"
    >
      {children}
    </a>
  );
}
