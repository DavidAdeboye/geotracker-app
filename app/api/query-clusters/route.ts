import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string) {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

// POST /api/query-clusters — create a query cluster
// body: { brandId: string, clusterLabel: string, prompts: string[] }
export async function POST(req: NextRequest) {
  const { brandId, clusterLabel, prompts } = await req.json();

  if (!brandId || !clusterLabel || !Array.isArray(prompts) || prompts.length === 0) {
    return NextResponse.json(
      { error: "brandId, clusterLabel, and a non-empty prompts array are required" },
      { status: 400 }
    );
  }

  if (!isValidUuid(brandId)) {
    return NextResponse.json({ error: "brandId must be a valid UUID" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .single();

  if (brandError || !brand) {
    return NextResponse.json({ error: brandError?.message ?? "brand not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("query_clusters")
    .insert({ brand_id: brandId, cluster_label: clusterLabel, prompts })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ queryCluster: data }, { status: 201 });
}
