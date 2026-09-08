"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "../../components/TopBar";

interface Brand {
  id: string;
  name: string;
  category: string;
}

interface QueryCluster {
  id: string;
  cluster_label: string;
  prompts: string[];
  created_at: string;
}

export default function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: brandId } = use(params);

  const [brand, setBrand] = useState<Brand | null>(null);
  const [clusters, setClusters] = useState<QueryCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [promptsText, setPromptsText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [brandRes, clustersRes] = await Promise.all([
        fetch(`/api/brands/${brandId}`),
        fetch(`/api/query-clusters?brandId=${brandId}`),
      ]);
      const brandData = await brandRes.json();
      const clustersData = await clustersRes.json();
      if (!brandRes.ok) throw new Error(brandData.error ?? "Could not load brand");
      if (!clustersRes.ok) throw new Error(clustersData.error ?? "Could not load query clusters");
      setBrand(brandData.brand);
      setClusters(clustersData.queryClusters ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this brand");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const prompts = promptsText
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    if (!label.trim() || prompts.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/query-clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, clusterLabel: label, prompts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add query cluster");
      setClusters((prev) => [data.queryCluster, ...prev]);
      setLabel("");
      setPromptsText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add query cluster");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <TopBar />

      <Link href="/" className="back-link">
        ← The ledger
      </Link>

      {brand && (
        <>
          <h1 style={{ fontSize: "var(--step-4)" }}>{brand.name}</h1>
          <p style={{ marginTop: "0.375rem", color: "var(--ink-soft)" }}>{brand.category}</p>
        </>
      )}

      {error && <div className="error-banner" style={{ marginTop: "var(--sp-3)" }}>{error}</div>}

      <div className="section" style={{ display: "grid", gridTemplateColumns: "minmax(16rem, 22rem) 1fr", gap: "var(--sp-4)" }}>
        <form onSubmit={handleSubmit} className="card card-gold-edge stack">
          <h2 style={{ fontSize: "var(--step-1)" }}>New query cluster</h2>
          <div className="field">
            <label htmlFor="label">Cluster label</label>
            <input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="best PM tools for remote teams"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="prompts">Prompt variants (one per line)</label>
            <textarea
              id="prompts"
              value={promptsText}
              onChange={(e) => setPromptsText(e.target.value)}
              placeholder={"What's the best project management tool for a remote team?\nTop PM software for distributed teams in 2026"}
              required
            />
            <span className="field-hint">Each line becomes a separate prompt run in the bulk fan-out.</span>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Adding…" : "Add cluster"}
          </button>
        </form>

        <div>
          {loading ? (
            <p style={{ color: "var(--ink-soft)" }}>Loading query clusters…</p>
          ) : clusters.length === 0 ? (
            <div className="empty-state">No query clusters yet. Add the questions you want to track above.</div>
          ) : (
            <div className="ledger">
              {clusters.map((cluster) => (
                <Link key={cluster.id} href={`/brands/${brandId}/clusters/${cluster.id}`} className="ledger-row">
                  <span className="ledger-row-label">{cluster.cluster_label}</span>
                  <span className="ledger-row-meta">
                    {cluster.prompts.length} prompt{cluster.prompts.length === 1 ? "" : "s"}
                  </span>
                  <span className="ledger-row-meta">{new Date(cluster.created_at).toLocaleDateString()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
