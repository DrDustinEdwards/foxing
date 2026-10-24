export function ToggleRow({
  checked,
  onChange,
  label,
  subtext,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  subtext: string;
}) {
  return (
    <div className="items-start fx-settings-card-card">
      <div className="fx-settings-card-stack">
        <span className="sans small strong">{label}</span>
        <span className="fine">{subtext}</span>
      </div>
      {/* Capsomer's switch, sky blue when on (Rule 05). */}
      <label className="cap-switch">
        <input
          type="checkbox"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
    </div>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="fx-settings-card-card-2">
      <h2 className="display-1">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Capsomer's input, on the page's ground where a form sits on a card. */
export const inputClass = "cap-input fx-input-ground";
