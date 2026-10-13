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
import { SHABAB_LOGO } from "@/lib/shabab.logo";
import { SHABAB_SIGNATURE } from "@/lib/shabab.signature";

type Params = { params: Promise<{ id: string }> };

/* ---------- Clean & light palette (white · ink · amber gold) ---------- */
const INK = rgb(0.09, 0.09, 0.1);
const MUTED = rgb(0.42, 0.42, 0.45);
const FAINT = rgb(0.62, 0.62, 0.65);
const LINE = rgb(0.87, 0.87, 0.89);
const GOLD = rgb(0.851, 0.467, 0.024);
const GOLD_DARK = rgb(0.706, 0.325, 0.035);
const GOLD_SOFT = rgb(0.998, 0.957, 0.855);
const GOLD_TEXT = rgb(0.608, 0.325, 0.071);
const GREEN_SOFT = rgb(0.851, 0.969, 0.906);
const GREEN_TEXT = rgb(0.05, 0.36, 0.27);
const WHITE = rgb(1, 1, 1);

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

  // brand images (embedded at build-time via base64 — works on serverless)
  let logoImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  let sigImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  try {
    logoImg = await pdfDoc.embedPng(SHABAB_LOGO);
  } catch {}
  try {
    sigImg = await pdfDoc.embedPng(SHABAB_SIGNATURE);
  } catch {}

  const W = PageSizes.Letter[0];
  const H = PageSizes.Letter[1];
  const M = 48; // margin
  const CONTENT_BOTTOM = 92; // nothing below this — footer zone starts

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

  /** Real Shabab Express shield logo; falls back to glyph tile if unavailable. */
  const drawLogo = (page: PDFPage, x: number, yTop: number, s = 34) => {
    if (logoImg) {
      const iw = logoImg.width;
      const ih = logoImg.height;
      const scale = s / ih;
      const w = iw * scale;
      page.drawImage(logoImg, { x: x + (s - w) / 2, y: yTop - s, width: w, height: s });
      return;
    }
    roundRect(page, x, yTop, s, s, 7, INK);
    const cy = yTop - s / 2;
    page.drawRectangle({ x: x + 6, y: cy + 0.5, width: 13, height: 7.5, color: GOLD });
    page.drawRectangle({ x: x + 20.5, y: cy + 0.5, width: 6.5, height: 5.5, color: GOLD });
    page.drawRectangle({ x: x + 23.5, y: cy + 3.2, width: 3.5, height: 2.8, color: INK });
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
  const companyContact = `${settings?.phone || ""}   ·   ${settings?.email || ""}`;
  const strip = (s: string | undefined, re: RegExp) => (s || "").replace(re, "").trim() || "—";
  const authority = `US DOT ${strip(settings?.dotNumber, /^DOT\s*/i)}   ·   MC ${strip(settings?.mcNumber, /^MC\s*/i)}`;
  const isPaid = invoice.status === "PAID";

  /* ---------- page furniture ---------- */
  const brandBar = (p: PDFPage, h = 3) =>
    p.drawRectangle({ x: 0, y: H - h, width: W, height: h, color: GOLD });

  /** Slim continuation header; returns content baseline just below it. */
  const slimHeader = (p: PDFPage): number => {
    brandBar(p, 2.5);
    const yy = H - 42;
    t(p, `${companyName.toUpperCase()}   ·   ${invoice.number}   ·   CONTINUED`, M, yy, {
      size: 7.8,
      font: bold,
      color: MUTED,
    });
    p.drawLine({ start: { x: M, y: yy - 10 }, end: { x: W - M, y: yy - 10 }, thickness: 0.7, color: LINE });
    return yy - 24;
  };

  /* ================= PAGE 1 ================= */
  let page = pdfDoc.addPage(PageSizes.Letter);
  brandBar(page, 3);

  // header — left: logo + identity (kept light: name, address, contact, authority)
  drawLogo(page, M, H - 28, 48);
  const LX = M + 62;
  t(page, companyName.toUpperCase(), LX, H - 38, { size: 17, font: bold, maxW: 300 });
  t(page, companyAddr, LX + 0.5, H - 52, { size: 7.8, color: MUTED, maxW: 320 });
  t(page, companyContact, LX + 0.5, H - 63, { size: 7.8, color: FAINT, maxW: 320 });
  t(page, authority, LX + 0.5, H - 77, { size: 8.2, font: bold, color: GOLD_DARK });

  // header — right: document meta
  const RX = W - M;
  t(page, "O W N E R - O P E R A T O R   S E T T L E M E N T", RX, H - 38, {
    size: 6.6,
    color: FAINT,
    align: "right",
  });
  t(page, invoice.number, RX, H - 58, { size: 17, font: bold, align: "right" });
  t(page, `Issued ${usdDate(invoice.issueDate)}`, RX, H - 70, {
    size: 8.5,
    color: MUTED,
    align: "right",
  });
  const chipW = 64;
  const chipH = 17;
  const chipTop = H - 90;
  roundRect(page, RX - chipW, chipTop, chipW, chipH, 4.5, isPaid ? GREEN_SOFT : GOLD_SOFT);
  t(page, isPaid ? "PAID" : "PENDING", RX - chipW / 2, chipTop - 11.4, {
    size: 7.8,
    font: bold,
    color: isPaid ? GREEN_TEXT : GOLD_TEXT,
    align: "center",
  });

  // single thin rule
  page.drawLine({ start: { x: M, y: H - 106 }, end: { x: W - M, y: H - 106 }, thickness: 0.9, color: INK });

  /* ---------- pay-to + details (plain, no cards) ---------- */
  const infoTop = H - 128;
  t(page, "PAY TO THE ORDER OF", M, infoTop, { size: 6.5, font: bold, color: FAINT });
  t(page, invoice.operator.name, M, infoTop - 17, { size: 12.5, font: bold, maxW: 300 });
  let ly = infoTop - 31;
  const opAddrParts = [
    invoice.operator.address,
    [invoice.operator.city, invoice.operator.state].filter(Boolean).join(", ") +
      (invoice.operator.zip ? ` ${invoice.operator.zip}` : ""),
  ]
    .filter((v) => v && String(v).trim())
    .join("  ·  ");
  if (opAddrParts) {
    t(page, opAddrParts, M, ly, { size: 8.3, color: MUTED, maxW: 300 });
    ly -= 12;
  }
  if (invoice.operator.phone) {
    t(page, `P  ${invoice.operator.phone}`, M, ly, { size: 8.3, color: MUTED });
    ly -= 12;
  }
  if (invoice.operator.email) {
    t(page, `E  ${invoice.operator.email}`, M, ly, { size: 8.3, color: MUTED, maxW: 300 });
    ly -= 12;
  }

  const DX = W - M - 250;
  const DW = 250;
  t(page, "SETTLEMENT DETAILS", DX, infoTop, { size: 6.5, font: bold, color: FAINT });
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
  let dy = infoTop - 17;
  for (const [k, v] of detailRows) {
    t(page, k, DX, dy, { size: 8, color: MUTED });
    t(page, v, DX + DW, dy, { size: 8.5, font: bold, align: "right", maxW: DW - 90 });
    dy -= 11.5;
  }

  /* ---------- loads table ---------- */
  let y = Math.min(ly, dy) - 24;
  t(page, `LOAD DETAILS`, M, y, { size: 9, font: bold });
  t(page, `${invoice.loads.length} load${invoice.loads.length === 1 ? "" : "s"}`, M + 78, y, {
    size: 8,
    color: FAINT,
  });

  const colLoad = M + 6;
  const colDate = M + 92;
  const colRoute = M + 150;
  const colMiles = W - M - 168;
  const colRate = W - M - 92;
  const colGross = W - M - 6;
  const routeMaxW = colMiles - colRoute - 16;

  /** Column labels + hairline; returns first-row baseline. */
  const tableHeader = (p: PDFPage, yy: number): number => {
    const hy = yy - 16;
    t(p, "LOAD #", colLoad, hy, { size: 6.6, font: bold, color: FAINT });
    t(p, "DATE", colDate, hy, { size: 6.6, font: bold, color: FAINT });
    t(p, "ROUTE (PICKUP -> DELIVERY)", colRoute, hy, { size: 6.6, font: bold, color: FAINT });
    t(p, "MILES", colMiles, hy, { size: 6.6, font: bold, color: FAINT, align: "right" });
    t(p, "RATE", colRate, hy, { size: 6.6, font: bold, color: FAINT, align: "right" });
    t(p, "AMOUNT", colGross, hy, { size: 6.6, font: bold, color: FAINT, align: "right" });
    p.drawLine({ start: { x: M, y: hy - 7 }, end: { x: W - M, y: hy - 7 }, thickness: 0.7, color: LINE });
    return hy - 22;
  };
  y = tableHeader(page, y);

  const rowH = 21;
  for (const l of invoice.loads) {
    if (y - rowH - 48 < CONTENT_BOTTOM) {
      page = pdfDoc.addPage(PageSizes.Letter);
      y = slimHeader(page);
      y = tableHeader(page, y);
    }
    const route = `${l.pickup || "—"} -> ${l.delivery || "—"}`;
    const rateStr = l.rateType === "PER_MILE" ? `$${l.rate.toFixed(2)}/mi` : money(l.rate);
    t(page, l.loadNumber, colLoad, y, { size: 9, font: bold });
    t(page, usdDate(l.date), colDate, y, { size: 8.3, color: MUTED });
    t(page, route, colRoute, y, { size: 9, maxW: routeMaxW });
    t(page, l.miles.toLocaleString("en-US"), colMiles, y, { size: 9, align: "right" });
    t(page, rateStr, colRate, y, { size: 8.5, color: MUTED, align: "right" });
    t(page, money(l.gross), colGross, y, { size: 9, font: bold, align: "right" });
    y -= rowH;
  }

  // gross total strip
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.9, color: INK });
  y -= 19;
  t(page, `GROSS LINEHAUL TOTAL`, colLoad, y, { size: 8, font: bold, color: MUTED });
  t(page, `${totalMiles.toLocaleString("en-US")} mi`, colMiles, y, {
    size: 8.5,
    font: bold,
    align: "right",
  });
  t(page, money(grossTotal), colGross, y, { size: 11.5, font: bold, align: "right" });

  /* ---------- final section: summary (right) + notes (left) + signatures ---------- */
  y -= 34;

  const sumW = 280;
  const sumX = W - M - sumW;
  const notesMaxW = sumX - M - 34;

  // measured heights so the whole block can move to a fresh page when tight
  const sumRowCount = 3 + invoice.deductions.length;
  const sumColH = 20 + sumRowCount * 16 + 6 + 16 + 10 + 32 + (isPaid ? 16 : 4);
  let notesH = 12;
  if (settings?.paymentTerms) {
    notesH += 13 + wrap(settings.paymentTerms, regular, 8.3, notesMaxW).length * 11 + 6;
  }
  if (invoice.notes) {
    notesH += 13 + wrap(invoice.notes, regular, 8.3, notesMaxW).length * 11 + 6;
  }
  notesH += 26; // closing italic lines

  const finalH = Math.max(sumColH, notesH) + 92; // + signature area
  if (y - finalH < CONTENT_BOTTOM) {
    page = pdfDoc.addPage(PageSizes.Letter);
    y = slimHeader(page) + 8;
  }

  const sumTop = y;

  // right: settlement summary (plain rows, one soft gold accent on NET)
  t(page, "SETTLEMENT SUMMARY", sumX, sumTop, { size: 6.8, font: bold, color: FAINT });
  let sy = sumTop - 20;
  t(page, "Gross linehaul revenue", sumX, sy, { size: 8.8 });
  t(page, money(grossTotal), sumX + sumW, sy, { size: 9.4, font: bold, align: "right" });
  sy -= 16;
  // 10% MC fee comes off the gross FIRST, before any other deductions
  t(page, `MC / dispatch fee (${invoice.mcFeePercent}% of gross)`, sumX, sy, {
    size: 8.8,
    color: GOLD_DARK,
  });
  t(page, `- ${money(mcFee)}`, sumX + sumW, sy, {
    size: 9.4,
    font: bold,
    color: GOLD_DARK,
    align: "right",
  });
  sy -= 16;
  t(page, "Balance after MC fee", sumX, sy, { size: 8.8, font: bold });
  t(page, money(grossTotal - mcFee), sumX + sumW, sy, {
    size: 9.4,
    font: bold,
    align: "right",
  });
  sy -= 16;
  for (const d of invoice.deductions) {
    t(page, d.label, sumX, sy, { size: 8.8, color: MUTED, maxW: sumW - 90 });
    t(page, `- ${money(d.amount)}`, sumX + sumW, sy, {
      size: 9.4,
      color: MUTED,
      align: "right",
    });
    sy -= 16;
  }
  sy -= 6;
  page.drawLine({ start: { x: sumX, y: sy }, end: { x: sumX + sumW, y: sy }, thickness: 0.7, color: LINE });
  sy -= 16;
  t(page, "Total deductions", sumX, sy, { size: 9, font: bold });
  t(page, `- ${money(totalDeductions)}`, sumX + sumW, sy, {
    size: 9.4,
    font: bold,
    align: "right",
  });

  // NET payout — soft gold chip
  const netTop = sy - 10;
  roundRect(page, sumX, netTop, sumW, 32, 7, GOLD_SOFT);
  t(page, "NET PAYOUT", sumX + 14, netTop - 19, { size: 8, font: bold, color: GOLD_TEXT });
  t(page, money(netPayout), sumX + sumW - 14, netTop - 21.5, {
    size: 13.5,
    font: bold,
    color: GOLD_DARK,
    align: "right",
  });
  if (isPaid) {
    const paidInfo = `PAID ${usdDate(invoice.paidDate)}${invoice.paymentMethod ? ` via ${invoice.paymentMethod}` : ""}${invoice.paymentRef ? ` · Ref ${invoice.paymentRef}` : ""}`;
    t(page, paidInfo, sumX, netTop - 46, { size: 8, font: bold, color: GREEN_TEXT, maxW: sumW });
  }

  // left: notes & terms
  let ny = sumTop;
  t(page, "PAYMENT TERMS", M, ny, { size: 6.8, font: bold, color: FAINT });
  ny -= 13;
  if (settings?.paymentTerms) {
    for (const line of wrap(settings.paymentTerms, regular, 8.3, notesMaxW)) {
      t(page, line, M, ny, { size: 8.3, color: MUTED });
      ny -= 11;
    }
    ny -= 6;
  }
  if (invoice.notes) {
    t(page, "NOTES", M, ny, { size: 6.8, font: bold, color: FAINT });
    ny -= 13;
    for (const line of wrap(invoice.notes, regular, 8.3, notesMaxW)) {
      t(page, line, M, ny, { size: 8.3, color: INK });
      ny -= 11;
    }
    ny -= 6;
  }
  t(page, `All loads were hauled under the authority of ${settings?.legalName || companyName}.`, M, ny, {
    size: 7.6,
    font: oblique,
    color: FAINT,
    maxW: notesMaxW,
  });
  ny -= 11;
  t(page, "Please report any discrepancies within 7 days of receipt.", M, ny, {
    size: 7.6,
    font: oblique,
    color: FAINT,
    maxW: notesMaxW,
  });

  /* ---------- signatures ---------- */
  const sigY = sumTop - Math.max(sumColH, notesH) - 36;
  const sigW = 150;
  const gaps = (W - M * 2 - sigW * 3) / 2;
  const sigXs = [M, M + sigW + gaps, M + (sigW + gaps) * 2];
  if (sigImg) {
    const sigScale = 34 / sigImg.height;
    const sigDrawW = Math.min(sigImg.width * sigScale, 64);
    const sigDrawH = sigDrawW / (sigImg.width / sigImg.height);
    page.drawImage(sigImg, {
      x: sigXs[1] + sigW / 2 - sigDrawW / 2,
      y: sigY + 3,
      width: sigDrawW,
      height: sigDrawH,
    });
  }
  sigXs.forEach((sx, i) => {
    page.drawLine({ start: { x: sx, y: sigY }, end: { x: sx + sigW, y: sigY }, thickness: 0.7, color: FAINT });
    t(page, ["OWNER-OPERATOR SIGNATURE", "AUTHORIZED REPRESENTATIVE", "DATE"][i], sx, sigY - 11, {
      size: 6.3,
      color: FAINT,
    });
  });

  /* ---------- footer: just a thank-you, nothing else ---------- */
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 58 }, end: { x: W - M, y: 58 }, thickness: 0.6, color: LINE });
    t(p, "Thank you", W / 2, 43, { size: 10, font: oblique, color: MUTED, align: "center" });
    t(p, `Page ${i + 1} of ${pages.length}`, W - M, 43, { size: 6.8, color: FAINT, align: "right" });
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
