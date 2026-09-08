import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/supabase";

// PATCH /api/gap-fixes/[id]
// body: { published: boolean, publishedUrl?: string }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { published, publishedUrl } = await req.json();

  if (typeof published !== "boolean") {
    return NextResponse.json({ error: "published (boolean) is required" }, { status: 400 });
  }

  if (published && !publishedUrl) {
    return NextResponse.json({ error: "publishedUrl is required when marking a fix published" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("gap_fixes")
    .update({ published, published_url: published ? publishedUrl : null })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ gapFix: data });
}
