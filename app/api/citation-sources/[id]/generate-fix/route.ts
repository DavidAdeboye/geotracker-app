import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/supabase";
import { generateGapFix, FixType } from "@/lib/jobs/gapFixGeneration";
import { MODEL_FOR_JOB } from "@/lib/agentrouter/client";

const VALID_FIX_TYPES: FixType[] = ["comparison_page", "faq_block", "reddit_answer"];

// POST /api/citation-sources/[id]/generate-fix
// body: { fixType: "comparison_page" | "faq_block" | "reddit_answer" }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { fixType } = await req.json();

  if (!VALID_FIX_TYPES.includes(fixType)) {
    return NextResponse.json(
      { error: `fixType must be one of: ${VALID_FIX_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  const { data: citationSource, error: fetchError } = await supabase
    .from("citation_sources")
    .select("id, brand_footprint, gap_description, query_clusters ( cluster_label, brands ( name, category ) )")
    .eq("id", id)
    .single();

  if (fetchError || !citationSource) {
    return NextResponse.json({ error: fetchError?.message ?? "citation source not found" }, { status: 404 });
  }

  if (citationSource.brand_footprint === "strong") {
    return NextResponse.json(
      { error: "footprint is already strong for this citation source — no gap to fix" },
      { status: 400 }
    );
  }

  const cluster = (citationSource as any).query_clusters;
  const brand = cluster?.brands;

  if (!cluster || !brand) {
    return NextResponse.json({ error: "could not resolve brand/query cluster for this citation source" }, { status: 500 });
  }

  try {
    const content = await generateGapFix({
      brandName: brand.name,
      category: brand.category,
      queryCluster: cluster.cluster_label,
      gapDescription: citationSource.gap_description,
      fixType,
    });

    const { data: gapFix, error: insertError } = await supabase
      .from("gap_fixes")
      .insert({
        citation_source_id: id,
        fix_type: fixType,
        generated_content: content,
        generation_model: MODEL_FOR_JOB.gap_fix_generation,
        published: false,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ gapFix }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate gap fix";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
