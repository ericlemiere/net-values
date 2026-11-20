import type { NextRequest } from "next/server";

// Starts the daily BALLDONTLIE job (.github/workflows/daily.yml) at 2am
// Pacific. Vercel Cron calls this; GitHub's own schedule ran six to ten hours
// late, while a run started through the API begins within a minute. The job
// itself still runs on GitHub Actions: it's minutes of Python, too long for a
// function here.
//
// Vercel's cron is UTC and ignores daylight saving, so vercel.json schedules
// both 09:00 and 10:00 UTC and this lets through whichever is 2am Pacific.
//
// Needs CRON_SECRET (Vercel sends it as a bearer token) and
// GITHUB_DISPATCH_TOKEN, a fine-grained token for this repository with
// Actions: read and write.

const REPO = "ericlemiere/net-values";
const WORKFLOW = "daily.yml";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
  if (hour !== 2) {
    return Response.json({ skipped: `${hour}:00 Pacific isn't 2am` });
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return new Response("GITHUB_DISPATCH_TOKEN not set", { status: 500 });

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );
  if (!res.ok) {
    // A 500 shows as a failed invocation in Vercel's cron log.
    return new Response(`GitHub ${res.status}: ${await res.text()}`, { status: 500 });
  }
  return Response.json({ dispatched: WORKFLOW });
}
