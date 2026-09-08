import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/supabase";

// GET /api/query-clusters/[id] — everything needed to render the cluster's
// case file in one call: the cluster, its raw bulk responses, and every
// citation trace with its nested gap fixes and verification runs.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { data: cluster, error: clusterError } = await supabase
    .from("query_clusters")
    .select("*, brands ( id, name, category )")
    .eq("id", id)
    .single();

  if (clusterError || !cluster) {
    return NextResponse.json({ error: clusterError?.message ?? "cluster not found" }, { status: 404 });
  }

  const { data: bulkResponses, error: responsesError } = await supabase
    .from("bulk_responses")
    .select("*")
    .eq("query_cluster_id", id)
    .order("created_at", { ascending: false });

  if (responsesError) {
    return NextResponse.json({ error: responsesError.message }, { status: 500 });
  }

  const { data: citationSources, error: sourcesError } = await supabase
    .from("citation_sources")
    .select("*, gap_fixes ( *, verification_runs ( * ) )")
    .eq("query_cluster_id", id)
    .order("traced_at", { ascending: false });

  if (sourcesError) {
    return NextResponse.json({ error: sourcesError.message }, { status: 500 });
  }

  return NextResponse.json({ cluster, bulkResponses, citationSources });
}
