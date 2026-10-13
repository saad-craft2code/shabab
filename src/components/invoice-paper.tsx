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
        {/* slim gold accent bar */}
        <div className="h-1 bg-amber-600" />

        <div className="px-10 pt-7 pb-8">
          {/* Header */}
          <div className="flex justify-between gap-6">
            <div className="flex gap-4">
              {/* real brand logo */}
              <img
                src="/shabab-logo.png"
                alt="Shabab Express LLC"
                className="h-[60px] w-auto shrink-0 object-contain"
              />
              <div>
                <div className="text-[21px] leading-6 font-bold tracking-tight">
                  {(settings?.name || "Shabab Express").toUpperCase()}
                </div>
                <div className="text-[9.5px] text-neutral-500 mt-1.5">
                  {settings?.addressLine || ""}
                  {settings?.addressLine ? ", " : ""}
                  {settings?.city || ""}, {settings?.state || ""} {settings?.zip || ""}
                </div>
                <div className="text-[9.5px] text-neutral-400 mt-1">
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

          {/* single thin rule */}
          <div className="mt-5 border-t-[1.5px] border-neutral-900" />

          {/* Pay-to + details (plain columns) */}
          <div className="mt-5 grid grid-cols-[1fr_300px] gap-8">
            <div>
              <div className="text-[8.5px] font-bold tracking-[0.18em] text-neutral-400">
                PAY TO THE ORDER OF
              </div>
              <div className="text-[16px] font-bold mt-1.5">{op.name}</div>
              {opAddr && (
                <div className="text-[10.5px] text-neutral-500 mt-1">{opAddr}</div>
              )}
              <div className="text-[10.5px] text-neutral-500 mt-1 space-x-4">
                {op.phone && <span>P&nbsp;&nbsp;{op.phone}</span>}
                {op.email && <span>E&nbsp;&nbsp;{op.email}</span>}
              </div>
            </div>
            <div>
              <div className="text-[8.5px] font-bold tracking-[0.18em] text-neutral-400">
                SETTLEMENT DETAILS
              </div>
              <div className="mt-2 space-y-[6px]">
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
          <div className="mt-8">
            <div className="flex items-baseline gap-3">
              <span className="text-[12px] font-bold tracking-wide">LOAD DETAILS</span>
              <span className="text-[10px] text-neutral-400">
                {invoice.loads.length} load{invoice.loads.length === 1 ? "" : "s"}
              </span>
            </div>
            <table className="w-full mt-3 text-[11.5px] border-collapse">
              <thead>
                <tr className="text-left text-[8.5px] tracking-wider text-neutral-400 border-b border-neutral-300">
                  <th className="py-2 pl-1 font-bold">LOAD #</th>
                  <th className="py-2 font-bold">DATE</th>
                  <th className="py-2 font-bold">ROUTE (PICKUP → DELIVERY)</th>
                  <th className="py-2 font-bold text-right">MILES</th>
                  <th className="py-2 font-bold text-right">RATE</th>
                  <th className="py-2 pr-1 font-bold text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {invoice.loads.map((l, i) => (
                  <tr key={l.id || i}>
                    <td className="py-[7px] pl-1 font-semibold">{l.loadNumber}</td>
                    <td className="py-[7px] text-neutral-500">{formatDate(l.date)}</td>
                    <td className="py-[7px] max-w-[300px] truncate">
                      {l.pickup || "—"} → {l.delivery || "—"}
                    </td>
                    <td className="py-[7px] text-right tnum">
                      {l.miles.toLocaleString("en-US")}
                    </td>
                    <td className="py-[7px] text-right tnum text-neutral-500">
                      {l.rateType === "PER_MILE"
                        ? `$${l.rate.toFixed(2)}/mi`
                        : money(l.rate)}
                    </td>
                    <td className="py-[7px] pr-1 text-right font-bold tnum">
                      {money(l.gross)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-[1.5px] border-neutral-900">
                  <td colSpan={2} className="py-2.5 pl-1 text-[10px] font-bold tracking-wide text-neutral-500">
                    GROSS LINEHAUL TOTAL
                  </td>
                  <td className="py-2.5" />
                  <td className="py-2.5 text-right font-semibold tnum text-[11px]">
                    {totalMiles.toLocaleString("en-US")} mi
                  </td>
                  <td className="py-2.5" />
                  <td className="py-2.5 pr-1 text-right font-bold tnum text-[14px]">
                    {money(calc.grossTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes + Summary */}
          <div className="mt-9 flex gap-10">
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
            <div className="w-[330px] shrink-0">
              <div className="text-[8.5px] font-bold tracking-[0.18em] text-neutral-400">
                SETTLEMENT SUMMARY
              </div>
              <div className="mt-2.5 space-y-[7px]">
                <SumRow label="Gross linehaul revenue" value={money(calc.grossTotal)} bold />
                <SumRow
                  label={`MC / dispatch fee (${invoice.mcFeePercent}% of gross)`}
                  value={`- ${money(calc.mcFee)}`}
                  accent
                />
                <SumRow
                  label="Balance after MC fee"
                  value={money(calc.grossTotal - calc.mcFee)}
                  bold
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
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-[0.14em] text-amber-800">
                  NET PAYOUT
                </span>
                <span className="text-[18px] font-bold text-amber-700 tnum">
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
            {[
              "OWNER-OPERATOR SIGNATURE",
              "AUTHORIZED REPRESENTATIVE",
              "DATE",
            ].map((label, i) => (
              <div key={label}>
                {i === 1 && (
                  <img
                    src="/shabab-signature.png"
                    alt="Authorized signature"
                    className="h-9 w-auto object-contain -mb-0.5"
                  />
                )}
                <div className="border-t border-neutral-400" />
                <div className="text-[8.5px] tracking-wide text-neutral-400 mt-1.5">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer: just a thank-you, nothing else */}
        <div className="border-t border-neutral-200 px-10 py-5 text-center">
          <span className="text-[11px] italic text-neutral-400">Thank you</span>
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
