import { Link } from "capsomer/react/link";

export function JournalCard({
  to,
  label,
  title,
  excerpt,
  minutes,
  heading: Heading = "h3",
}: {
  to: string;
  label?: string | null;
  title: string;
  excerpt?: string | null;
  minutes?: number | null;
  heading?: "h2" | "h3";
}) {
  return (
    <Link to={to}>
      <div className="cap-card cap-stack fx-journal-tag-card" data-gap="5">
        {label ? <span className="fx-journal-tag-caps">{label}</span> : null}
        <Heading className="fx-journal-tag-title">{title}</Heading>
        {excerpt ? <p className="fx-journal-tag-text">{excerpt}</p> : null}
        {minutes ? <p className="fx-journal-tag-text-2">{minutes} min read</p> : null}
      </div>
    </Link>
  );
}
