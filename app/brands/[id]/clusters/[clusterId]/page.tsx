"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "../../../../components/TopBar";
import { FootprintBadge, ResultBadge } from "../../../../components/Stamp";

type FixType = "comparison_page" | "faq_block" | "reddit_answer";

interface VerificationRun {
  id: string;
  ran_at: string;
  brand_appeared: boolean;
  raw_response: string;
}

interface GapFix {
  id: string;
  fix_type: FixType;
  generated_content: string;
  published: boolean;
  published_url: string | null;
  created_at: string;
  verification_runs: VerificationRun[];
}

interface CitationSource {
  id: string;
  likely_sources: string[];
  brand_footprint: "strong" | "weak" | "absent";
  gap_description: string | null;
  traced_at: string;
  gap_fixes: GapFix[];
}

interface BulkResponse {
  id: string;
  prompt: string;
  model: string;
  response: string | null;
  error: string | null;
}

interface ClusterDetail {
  id: string;
  cluster_label: string;
  prompts: string[];
  brands: { id: string; name: string; category: string };
}

const FIX_TYPE_LABEL: Record<FixType, string> = {
  comparison_page: "Comparison page",
  faq_block: "FAQ block",
  reddit_answer: "Reddit-style answer",
};

export default function ClusterPage({
  params,
}: {
  params: Promise<{ id: string; clusterId: string }>;
}) {
  const { id: brandId, clusterId } = use(params);

  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [bulkResponses, setBulkResponses] = useState<BulkResponse[]>([]);
  const [citationSources, setCitationSources] = useState<CitationSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pending, setPending] = useState<Set<string>>(new Set());
  const [publishUrls, setPublishUrls] = useState<Record<string, string>>({});

  function isPending(key: string) {
    return pending.has(key);
  }
  function setPendingKey(key: string, on: boolean) {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/query-clusters/${clusterId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load this cluster");
      setCluster(data.cluster);
      setBulkResponses(data.bulkResponses ?? []);
      setCitationSources(data.citationSources ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this cluster");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId]);

  async function runFanOut() {
    setPendingKey("run", true);
    setError(null);
    try {
      const res = await fetch(`/api/query-clusters/${clusterId}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fan-out failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fan-out failed");
    } finally {
      setPendingKey("run", false);
    }
  }

  async function traceCitations() {
    setPendingKey("trace", true);
    setError(null);
    try {
      const res = await fetch(`/api/query-clusters/${clusterId}/trace`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Citation trace failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Citation trace failed");
    } finally {
      setPendingKey("trace", false);
    }
  }

  async function generateFix(citationSourceId: string, fixType: FixType) {
    const key = `genfix-${citationSourceId}-${fixType}`;
    setPendingKey(key, true);
    setError(null);
    try {
      const res = await fetch(`/api/citation-sources/${citationSourceId}/generate-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate fix");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate fix");
    } finally {
      setPendingKey(key, false);
    }
  }

  async function publishFix(gapFixId: string) {
    const url = publishUrls[gapFixId];
    if (!url?.trim()) return;
    const key = `publish-${gapFixId}`;
    setPendingKey(key, true);
    setError(null);
    try {
      const res = await fetch(`/api/gap-fixes/${gapFixId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: true, publishedUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not publish fix");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish fix");
    } finally {
      setPendingKey(key, false);
    }
  }

  async function verifyFix(gapFixId: string) {
    const key = `verify-${gapFixId}`;
    setPendingKey(key, true);
    setError(null);
    try {
      const res = await fetch(`/api/gap-fixes/${gapFixId}/verify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setPendingKey(key, false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <TopBar />
        <p style={{ color: "var(--ink-soft)" }}>Loading the case file…</p>
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="page">
        <TopBar />
        <div className="error-banner">{error ?? "Cluster not found"}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <TopBar />

      <Link href={`/brands/${brandId}`} className="back-link">
        ← {cluster.brands.name}
      </Link>

      <h1 style={{ fontSize: "var(--step-4)" }}>{cluster.cluster_label}</h1>
      <p style={{ marginTop: "0.375rem", color: "var(--ink-soft)" }}>
        {cluster.brands.name} · {cluster.brands.category}
      </p>

      {error && <div className="error-banner" style={{ marginTop: "var(--sp-3)" }}>{error}</div>}

      <div className="section">
        <h2 className="section-heading">The questions</h2>
        <ol className="stack" style={{ paddingLeft: "1.25rem" }}>
          {cluster.prompts.map((prompt, i) => (
            <li key={i}>{prompt}</li>
          ))}
        </ol>
      </div>

      <div className="section">
        <h2 className="section-heading">Bulk responses</h2>
        <div className="btn-row" style={{ marginBottom: "var(--sp-2)" }}>
          <button className="btn btn-primary" onClick={runFanOut} disabled={isPending("run")}>
            {isPending("run") ? "Running fan-out…" : "Run fan-out across the cluster"}
          </button>
        </div>
        {bulkResponses.length === 0 ? (
          <div className="empty-state">No responses yet — run the fan-out to see what the models actually say.</div>
        ) : (
          <div className="stack">
            {bulkResponses.map((r) => (
              <details key={r.id} className="card">
                <summary style={{ cursor: "pointer" }}>
                  <span className="chip">{r.model}</span> {r.prompt}
                  {r.error && <span className="stamp stamp-absent" style={{ marginLeft: "0.5rem" }}>error</span>}
                </summary>
                <div className="prose-block" style={{ marginTop: "var(--sp-1)" }}>
                  {r.error ?? r.response}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-heading">Citation trace</h2>
        <div className="btn-row" style={{ marginBottom: "var(--sp-2)" }}>
          <button
            className="btn btn-primary"
            onClick={traceCitations}
            disabled={isPending("trace") || bulkResponses.length === 0}
          >
            {isPending("trace") ? "Tracing…" : "Trace citations"}
          </button>
        </div>

        {citationSources.length === 0 ? (
          <div className="empty-state">
            No traces yet. Run the fan-out first, then trace to see where the brand's footprint stands.
          </div>
        ) : (
          <div className="stack">
            {citationSources.map((source) => (
              <div key={source.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "var(--sp-2)" }}>
                  <FootprintBadge value={source.brand_footprint} />
                  <span className="ledger-row-meta">{new Date(source.traced_at).toLocaleString()}</span>
                </div>

                {source.likely_sources.length > 0 && (
                  <div className="chip-row" style={{ marginTop: "var(--sp-1)" }}>
                    {source.likely_sources.map((s, i) => (
                      <span key={i} className="chip">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {source.gap_description && (
                  <p style={{ marginTop: "var(--sp-1)" }}>{source.gap_description}</p>
                )}

                {source.brand_footprint !== "strong" && (
                  <div style={{ marginTop: "var(--sp-2)" }}>
                    <span className="eyebrow">Generate a fix:</span>
                    <div className="btn-row" style={{ marginTop: "0.375rem" }}>
                      {(Object.keys(FIX_TYPE_LABEL) as FixType[]).map((fixType) => (
                        <button
                          key={fixType}
                          className="btn"
                          onClick={() => generateFix(source.id, fixType)}
                          disabled={isPending(`genfix-${source.id}-${fixType}`)}
                        >
                          {isPending(`genfix-${source.id}-${fixType}`) ? "Writing…" : FIX_TYPE_LABEL[fixType]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {source.gap_fixes.length > 0 && (
                  <div className="stack" style={{ marginTop: "var(--sp-2)" }}>
                    {source.gap_fixes.map((fix) => (
                      <div key={fix.id} className="card" style={{ background: "var(--paper)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="eyebrow">{FIX_TYPE_LABEL[fix.fix_type]}</span>
                          {fix.published ? (
                            <a href={fix.published_url ?? "#"} target="_blank" rel="noreferrer" className="chip">
                              published →
                            </a>
                          ) : null}
                        </div>

                        <div className="prose-block" style={{ marginTop: "var(--sp-1)" }}>
                          {fix.generated_content}
                        </div>

                        {!fix.published ? (
                          <div className="btn-row" style={{ marginTop: "var(--sp-1)" }}>
                            <input
                              placeholder="URL once you've published this"
                              value={publishUrls[fix.id] ?? ""}
                              onChange={(e) =>
                                setPublishUrls((prev) => ({ ...prev, [fix.id]: e.target.value }))
                              }
                              style={{
                                flex: 1,
                                font: "inherit",
                                fontSize: "var(--step--1)",
                                border: "1px solid var(--rule)",
                                borderRadius: "2px",
                                padding: "0.4rem 0.6rem",
                                background: "var(--paper)",
                                color: "var(--ink)",
                              }}
                            />
                            <button
                              className="btn"
                              onClick={() => publishFix(fix.id)}
                              disabled={isPending(`publish-${fix.id}`) || !publishUrls[fix.id]?.trim()}
                            >
                              {isPending(`publish-${fix.id}`) ? "Marking…" : "Mark published"}
                            </button>
                          </div>
                        ) : (
                          <div className="btn-row" style={{ marginTop: "var(--sp-1)" }}>
                            <button
                              className="btn"
                              onClick={() => verifyFix(fix.id)}
                              disabled={isPending(`verify-${fix.id}`)}
                            >
                              {isPending(`verify-${fix.id}`) ? "Checking…" : "Verify"}
                            </button>
                          </div>
                        )}

                        {fix.verification_runs.length > 0 && (
                          <div className="stack" style={{ marginTop: "var(--sp-1)" }}>
                            {fix.verification_runs.map((run) => (
                              <div key={run.id} style={{ display: "flex", gap: "var(--sp-1)", alignItems: "center" }}>
                                <ResultBadge appeared={run.brand_appeared} />
                                <span className="ledger-row-meta">{new Date(run.ran_at).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
