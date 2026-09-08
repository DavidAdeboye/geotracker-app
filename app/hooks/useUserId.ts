"use client";

// Temporary stand-in for real auth. The API already accepts any non-UUID
// string as a dev identity outside production (see app/api/brands/route.ts —
// resolveUserId) and maps it to a Supabase auth user behind the scenes.
// Swap this out for a real session once auth is built.

import { useEffect, useState } from "react";

const STORAGE_KEY = "geotracker_dev_identity";
const DEFAULT_IDENTITY = "keeper";

export function useUserId() {
  const [userId, setUserId] = useState(DEFAULT_IDENTITY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setUserId(stored);
    setReady(true);
  }, []);

  function update(next: string) {
    setUserId(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return { userId, setUserId: update, ready };
}
