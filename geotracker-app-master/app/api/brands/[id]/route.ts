import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/supabase";

// GET /api/brands/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { data, error } = await supabase.from("brands").select("*").eq("id", id).single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "brand not found" }, { status: 404 });
  }

  return NextResponse.json({ brand: data });
}
