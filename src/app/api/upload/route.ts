import { uploadToImageKit } from "@/lib/imagekit";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const result = await uploadToImageKit(file);
    return NextResponse.json({ url: result.url, fileId: result.fileId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Upload failed";
    console.error("Upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
