type FootprintStamp = "strong" | "weak" | "absent";
type ResultStamp = "pass" | "fail";

export function FootprintBadge({ value }: { value: FootprintStamp }) {
  const label = value === "strong" ? "Strong" : value === "weak" ? "Weak" : "Absent";
  return <span className={`stamp stamp-${value}`}>{label}</span>;
}

export function ResultBadge({ appeared }: { appeared: boolean }) {
  const value: ResultStamp = appeared ? "pass" : "fail";
  return <span className={`stamp stamp-${value}`}>{appeared ? "Cited" : "Not cited"}</span>;
}
