import { Card, CardHeader, CardLink } from "./Card";

export default function BlockedRecipients({ rows }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Blocked recipients"
        subtitle={`${rows.length} blocked`}
        action={<CardLink>Manage</CardLink>}
      />

      <table className="mt-3 w-full table-fixed text-left text-[10px]">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[38%]" />
          <col />
        </colgroup>
        <thead>
          <tr className="border-y border-line bg-slate-50/70 text-[8px] font-semibold tracking-wider text-muted uppercase">
            <th className="py-2 pl-3.5 font-semibold">Email</th>
            <th className="py-2 font-semibold">Reason</th>
            <th className="py-2 pr-3.5 font-semibold">Added</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.email} className="border-b border-line last:border-0">
              <td className="truncate py-[11px] pl-3.5">{r.email}</td>
              <td className="truncate py-[11px] text-brand">{r.reason}</td>
              <td className="py-[11px] pr-3.5 text-slate-500">{r.added}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
