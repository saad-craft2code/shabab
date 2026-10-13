import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const DOC_TYPES = [
  "CDL",
  "MEDICAL_CARD",
  "INSURANCE",
  "REGISTRATION",
  "INSPECTION",
  "W9",
  "AGREEMENT",
  "DRUG_TEST",
  "OTHER",
];
const HOLDERS = ["COMPANY", "OPERATOR", "TRUCK"];
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const holderType = searchParams.get("holderType") || undefined;
  const operatorId = searchParams.get("operatorId") || undefined;
  const type = searchParams.get("type") || undefined;
  const search = searchParams.get("search")?.trim();

  const where: Record<string, unknown> = {};
  if (holderType && HOLDERS.includes(holderType)) where.holderType = holderType;
  if (operatorId) where.operatorId = operatorId;
  if (type && DOC_TYPES.includes(type)) where.type = type;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { documentNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const documents = await db.document.findMany({
    where,
    orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    include: {
      operator: { select: { id: true, name: true } },
      truck: { select: { id: true, unitNumber: true, type: true } },
    },
  });
  // never ship file payloads in list responses
  const safe = documents.map(({ fileData, ...d }) => ({
    ...d,
    hasFile: Boolean(fileData),
  }));
  return NextResponse.json({ documents: safe });
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const b = await req.json();
    const title = String(b.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    let fileData: string | null = null;
    let fileSize: number | null = null;
    if (b.fileData) {
      const raw = String(b.fileData);
      const base64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
      fileSize = Math.floor((base64.length * 3) / 4);
      if (fileSize > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: "File is too large (max 4 MB)." },
          { status: 400 }
        );
      }
      fileData = base64;
    }
    const holderType = HOLDERS.includes(b.holderType) ? b.holderType : "COMPANY";
    const document = await db.document.create({
      data: {
        title,
        type: DOC_TYPES.includes(b.type) ? b.type : "OTHER",
        holderType,
        operatorId: holderType === "OPERATOR" && b.operatorId ? String(b.operatorId) : null,
        truckId: holderType === "TRUCK" && b.truckId ? String(b.truckId) : null,
        documentNumber: b.documentNumber ? String(b.documentNumber) : null,
        issuedDate: parseDate(b.issuedDate),
        expiryDate: parseDate(b.expiryDate),
        fileName: b.fileName ? String(b.fileName) : null,
        mimeType: b.mimeType ? String(b.mimeType) : null,
        fileSize,
        fileData,
        notes: b.notes ? String(b.notes) : null,
      },
      include: {
        operator: { select: { id: true, name: true } },
        truck: { select: { id: true, unitNumber: true, type: true } },
      },
    });
    const { fileData: _, ...safe } = document;
    return NextResponse.json({ document: { ...safe, hasFile: Boolean(fileData) } });
  } catch {
    return NextResponse.json({ error: "Create failed." }, { status: 500 });
  }
}
