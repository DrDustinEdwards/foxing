import { llmsDocument } from "@drdustinedwards/site-helpers/llms";
import { SITE_ORIGIN } from "~/lib/origins";

// llms.txt (llmstxt.org) from Prelum: Foxing's public hubs for answer engines. Each book, author and
// award page is in /sitemap.xml; this names the places they hang from.
const HUBS = [
  {
    path: "/books",
    title: "Books",
    description: "The catalog of public-domain classics, readable free.",
  },
  {
    path: "/awards",
    title: "Awards",
    description: "Nobel, Pulitzer, Newbery and other award-winning classics.",
  },
  {
    path: "/picks",
    title: "Picks",
    description: "Every pick from Oprah, Reese, Jenna, Belletrist and other clubs.",
  },
  {
    path: "/book-of-the-month",
    title: "Book of the month",
    description: "Foxing's own monthly pick.",
  },
  {
    path: "/journal",
    title: "Journal",
    description: "Essays and close readings of the great books.",
  },
  {
    path: "/guide",
    title: "Guide",
    description: "How to find books, track reading, join clubs and follow readers.",
  },
  { path: "/about", title: "About", description: "What Foxing is and who makes it." },
];

export function loader() {
  const body = llmsDocument({
    title: "Foxing",
    summary:
      "Foxing is a reading home for the classics: read public-domain books free, track what you finish, and follow the conversations around great books.",
    intro: ["Citation is welcome. Please cite Foxing and link the page's URL."],
    sections: [
      { heading: "Site", links: HUBS.map((hub) => ({ ...hub, url: `${SITE_ORIGIN}${hub.path}` })) },
    ],
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
