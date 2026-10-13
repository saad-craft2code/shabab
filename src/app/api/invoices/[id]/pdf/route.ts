import { NextRequest, NextResponse } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  PageSizes,
  PDFFont,
  PDFPage,
  RGB,
} from "pdf-lib";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/* ---------- Modern classy palette (white · ink · amber gold) ---------- */
const INK = rgb(0.09, 0.09, 0.10);
const MUTED = rgb(0.45, 0.45, 0.47);
const FAINT = rgb(0.64, 0.64, 0.66);
const LINE = rgb(0.88, 0.88, 0.90);
const CARD = rgb(0.958, 0.958, 0.955);
const ZEBRA = rgb(0.976, 0.976, 0.974);
const WHITE = rgb(1, 1, 1);
const GOLD = rgb(0.851, 0.467, 0.024); // amber-600 accent
const GOLD_DARK = rgb(0.706, 0.325, 0.035);
const GOLD_SOFT = rgb(0.996, 0.953, 0.78);
const GOLD_TEXT = rgb(0.573, 0.251, 0.055);
const GREEN_SOFT = rgb(0.82, 0.98, 0.898);
const GREEN_TEXT = rgb(0.024, 0.373, 0.275);

function money(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const neg = v < 0;
  const abs = Math.abs(v);
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return neg ? `- $${s}` : `$${s}`;
}

function usdDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** WinAnsi (CP1252) safe text — standard PDF fonts cannot encode arrows & co. */
function sanitize(s: string): string {
  return s
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u2194/g, "<->")
    .replace(/[\u2028\u2029]/g, " ")
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/g, "");
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      operator: true,
      loads: { orderBy: { sortOrder: "asc" } },
      deductions: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const settings = (await db.companySettings.findFirst()) || null;

  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const W = PageSizes.Letter[0];
  const H = PageSizes.Letter[1];
  const M = 44; // margin

  /* ---------- helpers ---------- */
  const t = (
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    opts: {
      size?: number;
      font?: PDFFont;
      color?: RGB;
      align?: "left" | "right" | "center";
      maxW?: number;
    } = {}
  ) => {
    const size = opts.size ?? 9;
    const f = opts.font ?? regular;
    let str = sanitize(text);
    if (opts.maxW) {
      while (f.widthOfTextAtSize(str, size) > opts.maxW && str.length > 1) {
        str = str.slice(0, -2) + "…";
      }
    }
    let xx = x;
    if (opts.align === "right") {
      xx = x - f.widthOfTextAtSize(str, size);
    } else if (opts.align === "center") {
      xx = x - f.widthOfTextAtSize(str, size) / 2;
    }
    page.drawText(str, { x: xx, y, size, font: f, color: opts.color ?? INK });
  };

  const wrap = (text: string, font: PDFFont, size: number, maxW: number): string[] => {
    const words = sanitize(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= maxW) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  /** Rounded rectangle via SVG path (pdf-lib flips y, so path coords run downward). */
  const roundRect = (
    page: PDFPage,
    x: number,
    y: number, // top edge in PDF coords
    w: number,
    h: number,
    r: number,
    fill?: RGB,
    border?: RGB,
    borderW = 0.75
  ) => {
    const path = [
      `M ${r} 0`,
      `H ${w - r}`,
      `C ${w} 0 ${w} ${r} ${w} ${r}`,
      `V ${h - r}`,
      `C ${w} ${h} ${w - r} ${h} ${w - r} ${h}`,
      `H ${r}`,
      `C 0 ${h} 0 ${h - r} 0 ${h - r}`,
      `V ${r}`,
      `C 0 0 ${r} 0 ${r} 0`,
      `Z`,
    ].join(" ");
    page.drawSvgPath(path, {
      x,
      y,
      color: fill,
      borderColor: border,
      borderWidth: border ? borderW : undefined,
    });
  };

  /** Minimal geometric truck glyph inside a dark rounded tile. */
  const drawLogo = (page: PDFPage, x: number, yTop: number, s = 34) => {
    roundRect(page, x, yTop, s, s, 7, INK);
    const cy = yTop - s / 2;
    // trailer body
    page.drawRectangle({ x: x + 6, y: cy + 0.5, width: 13, height: 7.5, color: GOLD });
    // cab
    page.drawRectangle({ x: x + 20.5, y: cy + 0.5, width: 6.5, height: 5.5, color: GOLD });
    page.drawRectangle({ x: x + 23.5, y: cy + 3.2, width: 3.5, height: 2.8, color: INK });
    // wheels
    page.drawCircle({ x: x + 10, y: cy - 1.6, size: 1.9, color: GOLD });
    page.drawCircle({ x: x + 16.5, y: cy - 1.6, size: 1.9, color: GOLD });
    page.drawCircle({ x: x + 24, y: cy - 1.6, size: 1.9, color: GOLD });
  };

  /* ---------- totals ---------- */
  const grossTotal =
    Math.round(invoice.loads.reduce((s, l) => s + l.gross, 0) * 100) / 100;
  const mcFee = Math.round(grossTotal * (invoice.mcFeePercent / 100) * 100) / 100;
  const otherDeductions =
    Math.round(invoice.deductions.reduce((s, d) => s + d.amount, 0) * 100) / 100;
  const totalDeductions = mcFee + otherDeductions;
  const netPayout = Math.round((grossTotal - totalDeductions) * 100) / 100;
  const totalMiles = invoice.loads.reduce((s, l) => s + l.miles, 0);

  const companyName = settings?.name || "Shabab Express";
  const companyAddr = `${settings?.addressLine || ""}, ${settings?.city || ""}, ${settings?.state || ""} ${settings?.zip || ""}`;
  const companyContact = `${settings?.phone || ""}   •   ${settings?.email || ""}`;
  const strip = (s: string | undefined, re: RegExp) => (s || "").replace(re, "").trim() || "—";
  const authority = `US DOT ${strip(settings?.dotNumber, /^DOT\s*/i)}   •   MC ${strip(settings?.mcNumber, /^MC\s*/i)}`;
  const isPaid = invoice.status === "PAID";

  /* ================= PAGE 1 ================= */
  let page = pdfDoc.addPage(PageSizes.Letter);

  // top gold accent bar
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: GOLD });

  // header — left: logo + identity
  const headerTop = H - 34;
  drawLogo(page, M, headerTop, 34);
  t(page, (settings?.name || "Shabab Express").toUpperCase(), M + 46, H - 48, {
    size: 19,
    font: bold,
    maxW: 300,
  });
  t(page, settings?.legalName || "", M + 46.5, H - 60, { size: 7.5, color: MUTED });
  t(page, companyAddr, M + 46.5, H - 71, { size: 7.5, color: FAINT, maxW: 300 });
  t(page, companyContact, M + 46.5, H - 82, { size: 7.5, color: FAINT, maxW: 300 });
  t(page, authority, M + 46.5, H - 97, { size: 8, font: bold, color: GOLD_DARK });

  // header — right: document meta
  const RX = W - M;
  t(page, "O W N E R - O P E R A T O R   S E T T L E M E N T", RX, H - 40, {
    size: 6.8,
    color: FAINT,
    align: "right",
  });
  t(page, invoice.number, RX, H - 60, { size: 17, font: bold, align: "right" });
  t(page, `Issued ${usdDate(invoice.issueDate)}`, RX, H - 72, {
    size: 8.5,
    color: MUTED,
    align: "right",
  });
  // status chip (roundRect y = TOP edge, path draws downward)
  const chipW = 66;
  const chipH = 18;
  const chipTop = H - 96;
  roundRect(page, RX - chipW, chipTop, chipW, chipH, 4.5, isPaid ? GREEN_SOFT : GOLD_SOFT);
  t(page, isPaid ? "PAID" : "PENDING", RX - chipW / 2, chipTop - 6.2, {
    size: 8,
    font: bold,
    color: isPaid ? GREEN_TEXT : GOLD_TEXT,
    align: "center",
  });

  // double rule divider
  page.drawLine({ start: { x: M, y: H - 117 }, end: { x: W - M, y: H - 117 }, thickness: 1.4, color: INK });
  page.drawLine({ start: { x: M, y: H - 120.5 }, end: { x: W - M, y: H - 120.5 }, thickness: 0.8, color: GOLD });

  /* ---------- info cards ---------- */
  const cardTop = H - 134;
  const cardH = 94;
  const leftW = 296;
  const rightW = W - M * 2 - leftW - 14;
  const rightX = W - M - rightW;

  roundRect(page, M, cardTop, leftW, cardH, 8, CARD);
  t(page, "PAY TO THE ORDER OF", M + 14, cardTop - 16, { size: 6.5, font: bold, color: FAINT });
  t(page, invoice.operator.name, M + 14, cardTop - 33, { size: 12.5, font: bold, maxW: leftW - 28 });
  const opAddrParts = [
    invoice.operator.address,
    [invoice.operator.city, invoice.operator.state].filter(Boolean).join(", ") +
      (invoice.operator.zip ? ` ${invoice.operator.zip}` : ""),
  ]
    .filter((v) => v && String(v).trim())
    .join("  •  ");
  t(page, opAddrParts || "—", M + 14, cardTop - 47, { size: 8, color: MUTED, maxW: leftW - 28 });
  if (invoice.operator.phone) {
    t(page, `P  ${invoice.operator.phone}`, M + 14, cardTop - 60, { size: 8, color: MUTED, maxW: leftW - 28 });
  }
  if (invoice.operator.email) {
    t(page, `E  ${invoice.operator.email}`, M + 14, cardTop - 72, { size: 8, color: MUTED, maxW: leftW - 28 });
  }

  roundRect(page, rightX, cardTop, rightW, cardH, 8, CARD);
  t(page, "SETTLEMENT DETAILS", rightX + 14, cardTop - 16, { size: 6.5, font: bold, color: FAINT });
  const periodStr =
    invoice.periodStart && invoice.periodEnd
      ? `${usdDate(invoice.periodStart)} — ${usdDate(invoice.periodEnd)}`
      : usdDate(invoice.issueDate);
  const detailRows: [string, string][] = [
    ["Pay period", periodStr],
    ["Loads", `${invoice.loads.length}`],
    ["Total miles", totalMiles.toLocaleString("en-US")],
    ["Truck #", invoice.operator.truckNumber || "—"],
    ["Trailer #", invoice.operator.trailerNumber || "—"],
  ];
  let dyr = cardTop - 29;
  for (const [k, v] of detailRows) {
    t(page, k, rightX + 14, dyr, { size: 8, color: MUTED });
    t(page, v, rightX + rightW - 14, dyr, { size: 8.5, font: bold, align: "right", maxW: rightW - 90 });
    dyr -= 12.5;
  }

  /* ---------- loads table ---------- */
  let y = cardTop - cardH - 26;
  t(page, `LOAD DETAILS`, M, y, { size: 9, font: bold });
  t(page, `${invoice.loads.length} load${invoice.loads.length === 1 ? "" : "s"}`, M + 78, y, {
    size: 8,
    color: FAINT,
  });
  y -= 8;

  const colLoad = M + 8;
  const colDate = M + 96;
  const colRoute = M + 152;
  const colMiles = W - M - 168;
  const colRate = W - M - 92;
  const colGross = W - M - 8;
  const routeMaxW = colMiles - colRoute - 16;

  y -= 4;
  const tableHeader = (p: PDFPage) => {
    p.drawRectangle({ x: M, y: y - 3.5, width: W - M * 2, height: 16, color: CARD });
    t(p, "LOAD #", colLoad, y + 2, { size: 6.8, font: bold, color: MUTED });
    t(p, "DATE", colDate, y + 2, { size: 6.8, font: bold, color: MUTED });
    t(p, "ROUTE (PICKUP -> DELIVERY)", colRoute, y + 2, { size: 6.8, font: bold, color: MUTED });
    t(p, "MILES", colMiles, y + 2, { size: 6.8, font: bold, color: MUTED, align: "right" });
    t(p, "RATE", colRate, y + 2, { size: 6.8, font: bold, color: MUTED, align: "right" });
    t(p, "AMOUNT", colGross, y + 2, { size: 6.8, font: bold, color: MUTED, align: "right" });
    y -= 18;
  };
  tableHeader(page);

  const rowH = 19;
  let zebra = false;
  invoice.loads.forEach((l) => {
    if (y < 210) {
      page = pdfDoc.addPage(PageSizes.Letter);
      y = H - 64;
      page.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: GOLD });
      t(page, `${companyName.toUpperCase()} — ${invoice.number} (continued)`, M, y, {
        size: 8.5,
        font: bold,
        color: MUTED,
      });
      y -= 14;
      tableHeader(page);
    }
    if (zebra) {
      page.drawRectangle({ x: M, y: y - 3.5, width: W - M * 2, height: rowH - 2, color: ZEBRA });
    }
    zebra = !zebra;
    const route = `${l.pickup || "—"} -> ${l.delivery || "—"}`;
    const rateStr = l.rateType === "PER_MILE" ? `$${l.rate.toFixed(2)}/mi` : money(l.rate);
    t(page, l.loadNumber, colLoad, y, { size: 9, font: bold });
    t(page, usdDate(l.date), colDate, y, { size: 8.5, color: MUTED });
    t(page, route, colRoute, y, { size: 9, maxW: routeMaxW });
    t(page, l.miles.toLocaleString("en-US"), colMiles, y, { size: 9, align: "right" });
    t(page, rateStr, colRate, y, { size: 9, color: MUTED, align: "right" });
    t(page, money(l.gross), colGross, y, { size: 9, font: bold, align: "right" });
    y -= rowH;
  });

  // totals strip under table
  y -= 1;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.9, color: INK });
  y -= 15;
  t(page, `GROSS LINEHAUL TOTAL`, colRoute, y, { size: 8, font: bold, color: MUTED });
  t(page, `${totalMiles.toLocaleString("en-US")} mi`, colMiles, y, {
    size: 8.5,
    font: bold,
    align: "right",
  });
  t(page, money(grossTotal), colGross, y, { size: 10.5, font: bold, align: "right" });

  /* ---------- summary card (right) + notes (left) ---------- */
  y -= 30;

  const sumW = 258;
  const sumX = W - M - sumW;
  const sumRows = 2 + invoice.deductions.length; // gross + fee + deductions
  // vertical rhythm: title 18 + rows 38.. + divider + total + netbox + pad
  const sumH = 126 + 17 * (sumRows - 1);
  const needSpace = sumH + 90;
  if (y - needSpace < 90) {
    page = pdfDoc.addPage(PageSizes.Letter);
    y = H - 64;
    page.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: GOLD });
    t(page, `${companyName.toUpperCase()} — ${invoice.number} (continued)`, M, y, {
      size: 8.5,
      font: bold,
      color: MUTED,
    });
    y -= 20;
  }

  const sumTop = y;
  roundRect(page, sumX, sumTop, sumW, sumH, 8, CARD);
  t(page, "SETTLEMENT SUMMARY", sumX + 14, sumTop - 18, { size: 6.8, font: bold, color: FAINT });

  let sy = sumTop - 38;
  t(page, "Gross linehaul revenue", sumX + 14, sy, { size: 8.8 });
  t(page, money(grossTotal), sumX + sumW - 14, sy, { size: 9.2, font: bold, align: "right" });
  sy -= 17;
  t(page, `MC / dispatch fee (${invoice.mcFeePercent}%)`, sumX + 14, sy, {
    size: 8.8,
    color: GOLD_DARK,
  });
  t(page, `- ${money(mcFee)}`, sumX + sumW - 14, sy, {
    size: 9.2,
    font: bold,
    color: GOLD_DARK,
    align: "right",
  });
  sy -= 17;
  for (const d of invoice.deductions) {
    t(page, d.label, sumX + 14, sy, { size: 8.8, color: MUTED, maxW: sumW - 110 });
    t(page, `- ${money(d.amount)}`, sumX + sumW - 14, sy, {
      size: 9.2,
      color: MUTED,
      align: "right",
    });
    sy -= 17;
  }
  sy -= 6;
  page.drawLine({ start: { x: sumX + 14, y: sy }, end: { x: sumX + sumW - 14, y: sy }, thickness: 0.7, color: LINE });
  sy -= 14;
  t(page, "Total deductions", sumX + 14, sy, { size: 9, font: bold });
  t(page, `- ${money(totalDeductions)}`, sumX + sumW - 14, sy, {
    size: 9.2,
    font: bold,
    align: "right",
  });

  // NET PAYOUT dark box (inside card, near bottom)
  const netH = 34;
  const netTop = sumTop - sumH + 44; // top edge, sits ~5pt under the Total row
  roundRect(page, sumX + 10, netTop, sumW - 20, netH, 6, INK);
  t(page, "NET PAYOUT", sumX + 22, netTop - netH / 2 - 3.2, { size: 8.5, font: bold, color: WHITE });
  t(page, money(netPayout), sumX + sumW - 22, netTop - netH / 2 - 5.5, {
    size: 14,
    font: bold,
    color: GOLD,
    align: "right",
  });

  if (isPaid) {
    const paidInfo = `PAID ${usdDate(invoice.paidDate)}${invoice.paymentMethod ? ` via ${invoice.paymentMethod}` : ""}${invoice.paymentRef ? ` · Ref ${invoice.paymentRef}` : ""}`;
    t(page, paidInfo, sumX, sumTop - sumH - 12, { size: 8, font: bold, color: GREEN_TEXT, maxW: sumW });
  }

  // left: notes & terms
  const notesMaxW = sumX - M - 26;
  let ny = sumTop - 20;
  t(page, "PAYMENT TERMS", M, ny, { size: 6.8, font: bold, color: FAINT });
  ny -= 13;
  if (settings?.paymentTerms) {
    for (const line of wrap(settings.paymentTerms, regular, 8.3, notesMaxW)) {
      t(page, line, M, ny, { size: 8.3, color: MUTED });
      ny -= 11.5;
    }
    ny -= 4;
  }
  if (invoice.notes) {
    t(page, "NOTES", M, ny, { size: 6.8, font: bold, color: FAINT });
    ny -= 13;
    for (const line of wrap(invoice.notes, regular, 8.3, notesMaxW)) {
      t(page, line, M, ny, { size: 8.3, color: INK });
      ny -= 11.5;
    }
    ny -= 4;
  }
  t(page, `All loads were hauled under the authority of ${settings?.legalName || companyName}.`, M, ny, {
    size: 7.6,
    font: oblique,
    color: FAINT,
    maxW: notesMaxW,
  });
  ny -= 11.5;
  t(page, "Please report any discrepancies within 7 days of receipt.", M, ny, {
    size: 7.6,
    font: oblique,
    color: FAINT,
    maxW: notesMaxW,
  });

  /* ---------- signatures ---------- */
  const sigY = Math.max(Math.min(sumTop - sumH - 44, ny - 34), 96);
  const sigW = 148;
  const gaps = (W - M * 2 - sigW * 3) / 2;
  const sigXs = [M, M + sigW + gaps, M + (sigW + gaps) * 2];
  sigXs.forEach((sx, i) => {
    page.drawLine({ start: { x: sx, y: sigY }, end: { x: sx + sigW, y: sigY }, thickness: 0.7, color: FAINT });
    t(page, ["OWNER-OPERATOR SIGNATURE", "AUTHORIZED REPRESENTATIVE", "DATE"][i], sx, sigY - 11, {
      size: 6.3,
      color: FAINT,
    });
  });

  /* ---------- footer ---------- */
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 56 }, end: { x: W - M, y: 56 }, thickness: 0.6, color: LINE });
    t(p, `Thank you for hauling with ${settings?.legalName || companyName} — we appreciate your business.`, M, 42, {
      size: 7.5,
      color: MUTED,
    });
    t(p, `${companyAddr}   •   ${settings?.phone || ""}   •   ${settings?.email || ""}`, M, 31, {
      size: 6.8,
      color: FAINT,
      maxW: W - M * 2 - 80,
    });
    t(p, `Page ${i + 1} of ${pages.length}`, W - M, 31, { size: 6.8, color: FAINT, align: "right" });
    t(p, `${settings?.mcNumber || ""} · ${settings?.dotNumber || ""}`, W - M, 42, {
      size: 6.8,
      font: bold,
      color: FAINT,
      align: "right",
    });
  });

  const bytes = await pdfDoc.save();
  const filename = `Shabab-Express-Settlement-${invoice.number}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
