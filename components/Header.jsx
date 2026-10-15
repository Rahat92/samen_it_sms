import { ChevronDownIcon } from "./Icons";

function Select({ children, className = "" }) {
  return (
    <label
      className={`relative flex h-[26px] items-center rounded-md border border-line bg-white text-[10px] font-medium text-ink shadow-[0_1px_1px_rgba(16,24,40,0.04)] ${className}`}
    >
      <select className="h-full w-full appearance-none bg-transparent pr-6 pl-2.5 outline-none">
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2 size-3 text-muted" />
    </label>
  );
}

export default function Header() {
  return (
    <header className="flex items-start justify-between">
      <div>
        <h1 className="text-[17px] font-bold leading-6 tracking-tight">
          Dashboard
        </h1>
        <p className="text-[10px] text-muted">Delivery health across your tenants</p>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="rounded border border-line bg-white/60 px-2 py-1 text-[8px] font-medium uppercase tracking-wider text-muted">
          Sample data
        </span>
        <Select className="w-[100px]">
          <option>Last 24 hours</option>
          <option>Last 7 days</option>
          <option>Last 30 days</option>
        </Select>
        <Select className="w-[138px]">
          <option>All Tenants</option>
        </Select>
        <span className="grid size-6 place-items-center rounded-full bg-indigo-100 text-[8px] font-bold text-brand">
          AD
        </span>
      </div>
    </header>
  );
}
