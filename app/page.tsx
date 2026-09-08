"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TopBar } from "./components/TopBar";
import { useUserId } from "./hooks/useUserId";

interface Brand {
  id: string;
  name: string;
  category: string;
  created_at: string;
}

export default function Home() {
  const { userId, ready } = useUserId();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/brands?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load brands");
        if (!cancelled) setBrands(data.brands ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load brands");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, ready]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !category.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add brand");
      setBrands((prev) => [data.brand, ...prev]);
      setName("");
      setCategory("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add brand");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <TopBar />

      <h1 className="display-1" style={{ fontSize: "var(--step-4)" }}>
        The ledger
      </h1>
      <p style={{ marginTop: "0.5rem", color: "var(--ink-soft)" }}>
        Every brand you're tracking, and whether AI answers actually cite it.
      </p>

      <div className="section" style={{ display: "grid", gridTemplateColumns: "minmax(16rem, 20rem) 1fr", gap: "var(--sp-4)" }}>
        <form onSubmit={handleSubmit} className="card card-gold-edge stack">
          <h2 style={{ fontSize: "var(--step-1)" }}>Open a new entry</h2>
          <div className="field">
            <label htmlFor="name">Brand name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" required />
          </div>
          <div className="field">
            <label htmlFor="category">Category</label>
            <input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="project management SaaS"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Adding…" : "Add brand"}
          </button>
        </form>

        <div>
          {error && <div className="error-banner" style={{ marginBottom: "var(--sp-2)" }}>{error}</div>}

          {loading ? (
            <p style={{ color: "var(--ink-soft)" }}>Loading the ledger…</p>
          ) : brands.length === 0 ? (
            <div className="empty-state">No brands catalogued yet. Add one to start tracking its citations.</div>
          ) : (
            <motion.div
              className="card-grid"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            >
              {brands.map((brand) => (
                <motion.div
                  key={brand.id}
                  variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                >
                  <Link href={`/brands/${brand.id}`} className="card brand-card">
                    <h3>{brand.name}</h3>
                    <span className="eyebrow">{brand.category}</span>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
