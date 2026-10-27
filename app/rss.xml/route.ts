import { NextResponse } from "next/server";

import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { getChangelogEntries } from "@/lib/changelog";

export const revalidate = false;

export const GET = () => {
  const items = getChangelogEntries()
    .map((entry) => {
      const link = `${SITE.URL}${entry.path}`;
      const date = new Date(`${entry.date}T00:00:00Z`).toUTCString();

      return `    <item>
      <title><![CDATA[${entry.title}]]></title>
      <link>${link}</link>
      <guid isPermaLink="false">${SITE.NAME}-${entry.id}</guid>
      <description><![CDATA[${entry.description}]]></description>
      <pubDate>${date}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE.NAME} changelog</title>
    <link>${SITE.URL}</link>
    <description><![CDATA[${SITE.DESCRIPTION.LONG}]]></description>
    <language>en-us</language>
    <atom:link href="${SITE.URL}${ROUTES.RSS}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
};
