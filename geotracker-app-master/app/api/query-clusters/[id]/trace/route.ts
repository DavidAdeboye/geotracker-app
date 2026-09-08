import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/supabase";
import { traceCitations } from "@/lib/jobs/citationTrace";

// POST /api/query-clusters/[id]/trace — runs the Opus 5 citation-tracing
// step over this cluster's existing bulk_responses. Run /run first.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clusterId = id;
  const supabase = getServiceClient();

  const { data: cluster, error: clusterError } = await supabase
    .from("query_clusters")
    .select("id, cluster_label, brand_id, brands ( name )")
    .eq("id", clusterId)
    .single();

  if (clusterError || !cluster) {
    return NextResponse.json({ error: clusterError?.message ?? "cluster not found" }, { status: 404 });
  }

  const { data: responses, error: responsesError } = await supabase
    .from("bulk_responses")
    .select("response")
    .eq("query_cluster_id", clusterId)
    .not("response", "is", null);

  if (responsesError) {
    return NextResponse.json({ error: responsesError.message }, { status: 500 });
  }

  if (!responses || responses.length === 0) {
    return NextResponse.json(
      { error: "no bulk responses found for this cluster — run /run first" },
      { status: 400 }
    );
  }

  const brandName = (cluster as any).brands?.name ?? "Unknown brand";

  const trace = await traceCitations({
    brandName,
    queryCluster: cluster.cluster_label,
    rawResponses: responses.map((r) => r.response as string),
  });

  const { data: saved, error: saveError } = await supabase
    .from("citation_sources")
    .insert({
      query_cluster_id: clusterId,
      likely_sources: trace.likelySources,
      brand_footprint: trace.brandFootprint,
      gap_description: trace.gapDescription,
    })
    .select()
    .single();

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ citationSource: saved });
}
