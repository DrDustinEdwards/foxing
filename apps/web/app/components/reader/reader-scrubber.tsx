export function ProgressScrubber({
  pct,
  background,
  onSeek,
}: {
  pct: number;
  background: string;
  onSeek: (percent: number) => void;
}) {
  return (
    <footer className="py-2 fx-reader-view-foot" style={{ background }}>
      <label className="fx-reader-view-row">
        <span className="cap-num" aria-hidden>
          {pct.toFixed(0)}%
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={pct}
          aria-label="Reading progress"
          className="fx-reader-view-input"
          onChange={(e) => onSeek(Number(e.target.value))}
        />
      </label>
    </footer>
  );
}
