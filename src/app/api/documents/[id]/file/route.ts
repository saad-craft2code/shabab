import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/** Download the stored file attached to a document. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const doc = await db.document.findUnique({
    where: { id },
    select: { fileName: true, mimeType: true, fileData: true },
  });
  if (!doc || !doc.fileData) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const buffer = Buffer.from(doc.fileData, "base64");
  const safeName = (doc.fileName || "document").replace(/[^\w.\-() ]+/g, "_");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
