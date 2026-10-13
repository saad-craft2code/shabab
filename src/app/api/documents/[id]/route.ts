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
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const b = await req.json();
    const existing = await db.document.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    let fileData: string | null | undefined = undefined;
    let fileSize: number | null | undefined = undefined;
    if (b.fileData) {
      const raw = String(b.fileData);
      const base64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
      const size = Math.floor((base64.length * 3) / 4);
      if (size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: "File is too large (max 4 MB)." },
          { status: 400 }
        );
      }
      fileData = base64;
      fileSize = size;
    } else if (b.removeFile === true) {
      fileData = null;
      fileSize = null;
    }
    const holderType = b.holderType
      ? HOLDERS.includes(b.holderType)
        ? b.holderType
        : existing.holderType
      : existing.holderType;
    const updated = await db.document.update({
      where: { id },
      data: {
        title: b.title !== undefined ? String(b.title).trim() : undefined,
        type: b.type !== undefined && DOC_TYPES.includes(b.type) ? b.type : undefined,
        holderType,
        operatorId:
          holderType === "OPERATOR"
            ? b.operatorId
              ? String(b.operatorId)
              : existing.operatorId
            : null,
        truckId:
          holderType === "TRUCK"
            ? b.truckId
              ? String(b.truckId)
              : existing.truckId
            : null,
        documentNumber:
          b.documentNumber !== undefined ? String(b.documentNumber) : undefined,
        issuedDate: b.issuedDate !== undefined ? parseDate(b.issuedDate) : undefined,
        expiryDate: b.expiryDate !== undefined ? parseDate(b.expiryDate) : undefined,
        fileName: b.fileName !== undefined ? String(b.fileName) : undefined,
        mimeType: b.mimeType !== undefined ? String(b.mimeType) : undefined,
        fileSize,
        fileData,
        notes: b.notes !== undefined ? String(b.notes) : undefined,
      },
      include: {
        operator: { select: { id: true, name: true } },
        truck: { select: { id: true, unitNumber: true, type: true } },
      },
    });
    const { fileData: _, ...safe } = updated;
    return NextResponse.json({ document: { ...safe, hasFile: Boolean(updated.fileData) } });
  } catch {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    await db.document.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
