import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/supabase";
import { verifyGapFix } from "@/lib/jobs/verification";

// POST /api/gap-fixes/[id]/verify — re-runs the cluster's first prompt through
// a cheap model and checks whether the brand now appears. Requires the fix to
// already be marked published.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { data: gapFix, error: fetchError } = await supabase
    .from("gap_fixes")
    .select(
      "id, published, citation_sources ( query_cluster_id, query_clusters ( prompts, brands ( name ) ) )"
    )
    .eq("id", id)
    .single();

  if (fetchError || !gapFix) {
    return NextResponse.json({ error: fetchError?.message ?? "gap fix not found" }, { status: 404 });
  }

  if (!gapFix.published) {
    return NextResponse.json({ error: "publish this fix before verifying it" }, { status: 400 });
  }

  const citationSource = (gapFix as any).citation_sources;
  const cluster = citationSource?.query_clusters;
  const brand = cluster?.brands;
  const prompt: string | undefined = cluster?.prompts?.[0];
  const queryClusterId: string | undefined = citationSource?.query_cluster_id;

  if (!cluster || !brand || !prompt || !queryClusterId) {
    return NextResponse.json({ error: "could not resolve cluster/brand/prompt for this gap fix" }, { status: 500 });
  }

  try {
    const { brandAppeared, rawResponse } = await verifyGapFix({ brandName: brand.name, prompt });

    const { data: run, error: insertError } = await supabase
      .from("verification_runs")
      .insert({
        gap_fix_id: id,
        query_cluster_id: queryClusterId,
        brand_appeared: brandAppeared,
        raw_response: rawResponse,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ verificationRun: run }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run verification";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
