import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/supabase";
import { runBulkFanOut, QueryClusterJob } from "@/lib/jobs/bulkFanOut";
import { MODEL_FOR_JOB } from "@/lib/agentrouter/client";

// POST /api/query-clusters/[id]/run — runs every prompt in this cluster
// through the cheap-model bulk fan-out and stores raw responses.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clusterId = id;
  const supabase = getServiceClient();

  const { data: cluster, error: fetchError } = await supabase
    .from("query_clusters")
    .select("id, brand_id, prompts")
    .eq("id", clusterId)
    .single();

  if (fetchError || !cluster) {
    return NextResponse.json({ error: fetchError?.message ?? "cluster not found" }, { status: 404 });
  }

  const jobs: QueryClusterJob[] = (cluster.prompts as string[]).map((prompt, i) => ({
    id: `${clusterId}-${i}`,
    brandId: cluster.brand_id,
    prompt,
  }));

  const results = await runBulkFanOut(jobs);

  const rows = results.map((r, i) => ({
    query_cluster_id: clusterId,
    prompt: r.prompt,
    model: i % 2 === 0 ? MODEL_FOR_JOB.bulk_fanout : MODEL_FOR_JOB.bulk_fanout_alt,
    response: r.response,
    error: r.error,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("bulk_responses")
    .insert(rows)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const failures = results.filter((r) => r.error).length;

  return NextResponse.json({
    clusterId,
    total: results.length,
    failures,
    responses: inserted,
  });
}
