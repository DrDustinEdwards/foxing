import { Link } from "capsomer/react/link";
import { Eyebrow } from "~/components/ui";

// The parts the three guide pages share (routes/guide.tsx, app-guide.tsx, features.tsx): the jump
// links under the header, a section, a paragraph, a dotted list and the closing sign-up line.

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
      <div className="mt-4 cap-stack">{children}</div>
    </section>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <p className="fx-guide-text-2">{children}</p>;
}

export function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="cap-stack" data-gap="3">
      {items.map((item) => (
        <li key={item} className="fx-guide-row-2">
          <span aria-hidden="true" className="fx-mark">
            &middot;
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function GuideFooter() {
  return (
    <p className="mt-16 fx-guide-text">
      Free to join.{" "}
      <Link to="/signup" className="link">
        Create an account
      </Link>{" "}
      or{" "}
      <Link to="/books" className="link">
        browse the library
      </Link>
      .
    </p>
  );
}
