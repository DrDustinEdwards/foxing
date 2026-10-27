import { Eyebrow } from "~/components/ui";

// The parts the three guide pages share (routes/guide.tsx, app-guide.tsx, features.tsx): the jump
// links under the header, a section, a paragraph and a dotted list.

export function GuideNav({ anchors }: { anchors: { href: string; label: string }[] }) {
  return (
    <nav aria-label="Sections" className="fx-guide-row">
      {anchors.map((a) => (
        <a key={a.href} href={a.href} className="fx-guide-link">
          {a.label}
        </a>
      ))}
    </nav>
  );
}

export function Section({
  id,
  eyebrow,
  heading,
  children,
}: {
  id: string;
  eyebrow: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="fx-guide-section">
      <Eyebrow className="mb-2">{eyebrow}</Eyebrow>
      <h2 className="fx-guide-title">{heading}</h2>
      <div className="mt-4 stack">{children}</div>
    </section>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <p className="fx-guide-text-2">{children}</p>;
}

export function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="stack-2">
      {items.map((item) => (
        <li key={item} className="fx-guide-row-2">
          <span aria-hidden="true" className="accent-ui">
            &middot;
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
