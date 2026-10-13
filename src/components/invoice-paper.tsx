"use client";

import { useEffect, useRef, useState } from "react";
import { money, formatDate, calcTotals } from "@/lib/format";
import type { Invoice, CompanySettings } from "@/lib/api";

const PAPER_W = 820;

function stripPrefix(s: string | undefined, re: RegExp): string {
  return (s || "").replace(re, "").trim() || "—";
}

export default function InvoicePaper({
  invoice,
  settings,
}: {
  invoice: Invoice;
  settings: CompanySettings | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const paper = paperRef.current;
    if (!wrap || !paper) return;
    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth;
      const s = Math.min(1, w / PAPER_W);
      setScale(s);
      setHeight(paper.offsetHeight * s);
    });
    ro.observe(wrap);
    ro.observe(paper);
    return () => ro.disconnect();
  }, []);

  const calc = calcTotals(invoice.loads, invoice.mcFeePercent, invoice.deductions);
  const totalMiles = invoice.loads.reduce((s, l) => s + (l.miles || 0), 0);
  const op = invoice.operator;
  const isPaid = invoice.status === "PAID";
  const period =
    invoice.periodStart && invoice.periodEnd
      ? `${formatDate(invoice.periodStart)} — ${formatDate(invoice.periodEnd)}`
      : formatDate(invoice.issueDate);
  const opAddr = [
    op.address,
    [op.city, op.state].filter(Boolean).join(", ") + (op.zip ? ` ${op.zip}` : ""),
  ]
    .filter((v) => v && v.trim() && v !== " ")
    .join(" • ");

  const detailRows: [string, string][] = [
    ["Pay period", period],
    ["Loads", `${invoice.loads.length}`],
    ["Total miles", totalMiles.toLocaleString("en-US")],
    ["Truck #", op.truckNumber || "—"],
    ["Trailer #", op.trailerNumber || "—"],
  ];

  return (
    <div ref={wrapRef} style={{ height: height ?? undefined }} className="w-full">
      <div
        ref={paperRef}
        style={{ width: PAPER_W, transform: `scale(${scale})`, transformOrigin: "top left" }}
        className="bg-white text-neutral-900 shadow-[0_2px_24px_rgba(0,0,0,0.10)] border border-neutral-200/70 rounded-sm overflow-hidden"
      >
        {/* gold accent bar */}
        <div className="h-1.5 bg-amber-600" />

        <div className="px-9 pt-6 pb-7">
          {/* Header */}
          <div className="flex justify-between gap-6">
            <div className="flex gap-4">
              {/* logo tile */}
              <div className="h-12 w-12 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 34 34" className="h-7 w-7">
                  <rect x="4" y="13" width="14" height="8" rx="1" fill="#d97706" />
                  <rect x="19.5" y="15" width="7" height="6" rx="1" fill="#d97706" />
                  <rect x="22.5" y="16.4" width="4" height="2.4" fill="#171717" />
                  <circle cx="8.5" cy="23.5" r="2.1" fill="#d97706" />
                  <circle cx="15.5" cy="23.5" r="2.1" fill="#d97706" />
                  <circle cx="23" cy="23.5" r="2.1" fill="#d97706" />
                </svg>
              </div>
              <div>
                <div className="text-[24px] leading-6 font-bold tracking-tight">
                  {(settings?.name || "Shabab Express").toUpperCase()}
                </div>
                <div className="text-[9.5px] text-neutral-500 mt-1 tracking-wide">
                  {settings?.legalName || ""}
                </div>
                <div className="text-[9.5px] text-neutral-400 mt-1.5 leading-relaxed">
                  {settings?.addressLine || ""}
                  {settings?.addressLine ? ", " : ""}
                  {settings?.city || ""}, {settings?.state || ""} {settings?.zip || ""}
                  <br />
                  {settings?.phone || ""} · {settings?.email || ""}
                </div>
                <div className="text-[10px] font-semibold text-amber-700 mt-1.5 tracking-wide">
                  US DOT {stripPrefix(settings?.dotNumber, /^DOT\s*/i)} · MC{" "}
                  {stripPrefix(settings?.mcNumber, /^MC\s*/i)}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] font-semibold tracking-[0.22em] text-neutral-400">
                OWNER-OPERATOR SETTLEMENT
              </div>
              <div className="text-[24px] font-bold tracking-tight mt-1.5">
                {invoice.number}
              </div>
              <div className="text-[10.5px] text-neutral-500">
                Issued {formatDate(invoice.issueDate)}
              </div>
              <div
                className={`inline-block mt-2.5 text-[10px] font-bold tracking-widest px-3 py-1 rounded-md ${
                  isPaid
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {isPaid ? "PAID" : "PENDING"}
              </div>
            </div>
          </div>

          {/* double rule */}
          <div className="mt-5">
            <div className="border-t-[1.5px] border-neutral-900" />
            <div className="border-t-[2px] border-amber-600 mt-[2.5px]" />
          </div>

          {/* Info cards */}
          <div className="mt-5 grid grid-cols-[1fr_300px] gap-3.5">
            <div className="bg-neutral-100 rounded-lg px-5 py-4">
              <div className="text-[8.5px] font-bold tracking-[0.18em] text-neutral-400">
                PAY TO THE ORDER OF
              </div>
              <div className="text-[17px] font-bold mt-1.5">{op.name}</div>
              {opAddr && (
                <div className="text-[10.5px] text-neutral-500 mt-1">{opAddr}</div>
              )}
              <div className="text-[10.5px] text-neutral-500 mt-1 space-x-4">
                {op.phone && <span>P&nbsp;&nbsp;{op.phone}</span>}
                {op.email && <span>E&nbsp;&nbsp;{op.email}</span>}
              </div>
            </div>
            <div className="bg-neutral-100 rounded-lg px-5 py-4">
              <div className="text-[8.5px] font-bold tracking-[0.18em] text-neutral-400">
                SETTLEMENT DETAILS
              </div>
              <div className="mt-2 space-y-[5px]">
                {detailRows.map(([k, v]) => (
                  <div key={k} className="flex justify-between items-baseline text-[10.5px]">
                    <span className="text-neutral-500">{k}</span>
                    <span className="font-semibold tnum max-w-[180px] truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Loads table */}
          <div className="mt-7">
            <div className="flex items-baseline gap-3">
              <span className="text-[12px] font-bold tracking-wide">LOAD DETAILS</span>
              <span className="text-[10px] text-neutral-400">
                {invoice.loads.length} load{invoice.loads.length === 1 ? "" : "s"}
              </span>
            </div>
            <table className="w-full mt-2.5 text-[11.5px] border-collapse">
              <thead>
                <tr className="bg-neutral-100 text-left text-[8.5px] tracking-wider text-neutral-500">
                  <th className="py-2 pl-3 font-bold">LOAD #</th>
                  <th className="py-2 font-bold">DATE</th>
                  <th className="py-2 font-bold">ROUTE (PICKUP → DELIVERY)</th>
                  <th className="py-2 font-bold text-right">MILES</th>
                  <th className="py-2 font-bold text-right">RATE</th>
                  <th className="py-2 pr-3 font-bold text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {invoice.loads.map((l, i) => (
                  <tr key={l.id || i} className={i % 2 === 1 ? "bg-neutral-50" : ""}>
                    <td className="py-2 pl-3 font-semibold">{l.loadNumber}</td>
                    <td className="py-2 text-neutral-500">{formatDate(l.date)}</td>
                    <td className="py-2 max-w-[300px] truncate">
                      {l.pickup || "—"} → {l.delivery || "—"}
                    </td>
                    <td className="py-2 text-right tnum">
                      {l.miles.toLocaleString("en-US")}
                    </td>
                    <td className="py-2 text-right tnum text-neutral-500">
                      {l.rateType === "PER_MILE"
                        ? `$${l.rate.toFixed(2)}/mi`
                        : money(l.rate)}
                    </td>
                    <td className="py-2 pr-3 text-right font-bold tnum">
                      {money(l.gross)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-[1.5px] border-neutral-900">
                  <td colSpan={2} className="py-2.5 pl-3 text-[10px] font-bold tracking-wide text-neutral-500">
                    GROSS LINEHAUL TOTAL
                  </td>
                  <td className="py-2.5" />
                  <td className="py-2.5 text-right font-semibold tnum text-[11px]">
                    {totalMiles.toLocaleString("en-US")} mi
                  </td>
                  <td className="py-2.5" />
                  <td className="py-2.5 pr-3 text-right font-bold tnum text-[14px]">
                    {money(calc.grossTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes + Summary */}
          <div className="mt-8 flex gap-9">
            <div className="flex-1 min-w-0 text-[11px]">
              <div className="text-[8.5px] font-bold tracking-[0.18em] text-neutral-400">
                PAYMENT TERMS
              </div>
              {settings?.paymentTerms && (
                <p className="mt-2 text-neutral-600 leading-relaxed">
                  {settings.paymentTerms}
                </p>
              )}
              {invoice.notes && (
                <>
                  <div className="text-[8.5px] font-bold tracking-[0.18em] text-neutral-400 mt-4">
                    NOTES
                  </div>
                  <p className="mt-2 text-neutral-800 leading-relaxed">{invoice.notes}</p>
                </>
              )}
              <p className="mt-4 text-[9.5px] text-neutral-400 italic leading-relaxed">
                All loads were hauled under the authority of{" "}
                {settings?.legalName || settings?.name || "Shabab Express"}. Please
                report any discrepancies within 7 days of receipt.
              </p>
            </div>
            <div className="w-[330px] shrink-0 bg-neutral-100 rounded-lg px-5 py-4">
              <div className="text-[8.5px] font-bold tracking-[0.18em] text-neutral-400">
                SETTLEMENT SUMMARY
              </div>
              <div className="mt-2.5 space-y-[7px]">
                <SumRow label="Gross linehaul revenue" value={money(calc.grossTotal)} bold />
                <SumRow
                  label={`MC / dispatch fee (${invoice.mcFeePercent}%)`}
                  value={`- ${money(calc.mcFee)}`}
                  accent
                />
                {invoice.deductions.map((d, i) => (
                  <SumRow
                    key={d.id || i}
                    label={d.label}
                    value={`- ${money(d.amount)}`}
                    muted
                  />
                ))}
              </div>
              <div className="border-t border-neutral-300 mt-2.5 pt-2.5">
                <SumRow label="Total deductions" value={`- ${money(calc.totalDeductions)}`} bold />
              </div>
              <div className="mt-3 bg-neutral-900 text-white rounded-md px-4 py-3 flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-[0.14em]">NET PAYOUT</span>
                <span className="text-[18px] font-bold text-amber-500 tnum">
                  {money(calc.netPayout)}
                </span>
              </div>
              {isPaid && (
                <p className="mt-2.5 text-[10px] font-semibold text-emerald-700">
                  PAID {formatDate(invoice.paidDate)}
                  {invoice.paymentMethod ? ` via ${invoice.paymentMethod}` : ""}
                  {invoice.paymentRef ? ` · Ref ${invoice.paymentRef}` : ""}
                </p>
              )}
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-12 grid grid-cols-3 gap-10">
            {["OWNER-OPERATOR SIGNATURE", "AUTHORIZED REPRESENTATIVE", "DATE"].map(
              (label) => (
                <div key={label}>
                  <div className="border-t border-neutral-400" />
                  <div className="text-[8.5px] tracking-wide text-neutral-400 mt-1.5">
                    {label}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 px-9 py-4 flex justify-between items-center text-[9px] text-neutral-400">
          <div>
            <span className="font-semibold text-neutral-500">
              Thank you for hauling with {settings?.legalName || settings?.name || "Shabab Express"} — we
              appreciate your business.
            </span>
            <br />
            {settings?.addressLine || ""}, {settings?.city || ""},{" "}
            {settings?.state || ""} {settings?.zip || ""} · {settings?.phone || ""} ·{" "}
            {settings?.email || ""}
          </div>
          <div className="font-semibold">
            {settings?.mcNumber || ""} · {settings?.dotNumber || ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function SumRow({
  label,
  value,
  bold,
  muted,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span
        className={`text-[11px] ${bold ? "font-semibold text-neutral-900" : ""} ${
          muted ? "text-neutral-500" : ""
        } ${accent ? "text-amber-700 font-medium" : ""}`}
      >
        {label}
      </span>
      <span
        className={`text-[11.5px] tnum shrink-0 ${bold ? "font-bold" : ""} ${
          muted ? "text-neutral-500" : ""
        } ${accent ? "text-amber-700 font-bold" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
