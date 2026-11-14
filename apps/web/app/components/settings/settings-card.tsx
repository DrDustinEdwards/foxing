import { useHydrated } from "capsomer/react/hooks";
import { FormError } from "~/components/ui";

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
        <span
          className="cap-text"
          data-size="small"
          data-tone="ink"
          data-weight="strong"
          data-face="ui"
        >
          {label}
        </span>
        <span className="cap-text" data-size="tiny" data-tone="dim" data-face="ui">
          {subtext}
        </span>
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
    <section className="cap-card">
      <h2 className="cap-title" data-size="4">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

/** Capsomer's input, on the page's ground where a form sits on a card. */
export const inputClass = "cap-input fx-input-ground";

/** A settings form's submit button, its done note and its error. The button waits for the page to
 *  hydrate: the form saves through script, and a press before that sends it as a plain GET instead. */
export function SubmitRow({
  disabled,
  pending,
  label,
  pendingLabel,
  done,
  error,
}: {
  disabled: boolean;
  pending: boolean;
  label: string;
  pendingLabel: string;
  done: string | null;
  error: string | null;
}) {
  const hydrated = useHydrated();
  return (
    <>
      <div className="cap-cluster" data-gap="4">
        <button type="submit" disabled={disabled || !hydrated} className="cap-btn">
          {pending ? pendingLabel : label}
        </button>
        {done ? (
          <span className="cap-text" data-size="small" data-tone="dim" data-face="ui" role="status">
            {done}
          </span>
        ) : null}
      </div>
      <FormError error={error} />
    </>
  );
}
