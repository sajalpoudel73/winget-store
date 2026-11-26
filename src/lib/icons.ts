import type { PackageDetails } from "../api/types";

function parse(url: string | undefined): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function githubOwner(url: string | undefined): string | null {
  const u = parse(url);
  if (!u || !/^(www\.)?github\.com$/.test(u.hostname)) return null;
  return u.pathname.split("/").filter(Boolean)[0] ?? null;
}

function plainHost(url: string | undefined): string | null {
  const u = parse(url);
  if (!u || !/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.replace(/^www\./, "");
  return /^(github\.com|githubusercontent\.com|raw\.githubusercontent\.com)$/.test(h) ? null : h;
}

const favicon = (host: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
const ddg = (host: string) => `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
const avatar = (owner: string) => `https://github.com/${encodeURIComponent(owner)}.png?size=128`;

/**
 * winget's CLI does not expose manifest icons, so we infer a logo from the package's own URLs:
 * the GitHub owner's avatar for GitHub-hosted projects, otherwise the site's favicon.
 * Candidates are tried in order; the UI falls back to a lettered tile.
 */
export function iconCandidates(d: PackageDetails | undefined | null): string[] {
  if (!d) return [];
  const urls = [d.homepage, d.publisherUrl, d.publisherSupportUrl, d.releaseNotesUrl, d.licenseUrl, ...d.installers.map((i) => i.downloadUrl)];
  const owner = urls.map(githubOwner).find(Boolean) ?? null;
  const homeHost = plainHost(d.homepage);
  const pubHost = plainHost(d.publisherUrl);
  const out: string[] = [];
  const homeIsGithub = githubOwner(d.homepage) !== null;
  if (homeIsGithub && owner) out.push(avatar(owner));
  if (homeHost) out.push(favicon(homeHost), ddg(homeHost));
  if (!homeIsGithub && owner) out.push(avatar(owner));
  if (pubHost && pubHost !== homeHost) out.push(favicon(pubHost));
  return out.slice(0, 4);
}
