"use client";

import Link from "next/link";
import { useUserId } from "../hooks/useUserId";

export function TopBar() {
  const { userId, setUserId, ready } = useUserId();

  return (
    <div className="topbar">
      <Link href="/" className="wordmark">
        Geo<span className="wordmark-mark">Tracker</span>
      </Link>
      <label className="identity-field">
        Working as
        <input
          value={ready ? userId : ""}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="keeper"
        />
      </label>
    </div>
  );
}
