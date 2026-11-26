import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpCircle, Check, Copy, ExternalLink, FolderOpen, Trash2 } from "lucide-react";
import { api } from "../api";
import type { PackageDetails, PackageRef } from "../api/types";
import { ActionButton } from "../components/ActionButton";
import { ConfirmUninstall } from "../components/ConfirmUninstall";
import { PackageIcon } from "../components/PackageIcon";
import { copyText, hostOf } from "../lib/format";
import { fetchDetails, peekDetails } from "../lib/details";
import { useStore } from "../store";

function Link({ url, label }: { url?: string; label?: string }) {
  if (!url) return <span className="muted">—</span>;
  return (
    <a
      href={url}
      className="ext"
      onClick={(e) => {
        e.preventDefault();
        void api.openUrl(url);
      }}
    >
      {label ?? hostOf(url) ?? url} <ExternalLink size={12} />
    </a>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Versions({ pkg, current, installedVersion }: { pkg: PackageRef; current?: string; installedVersion?: string }) {
  const { enqueue, activeTaskFor } = useStore();
  const [versions, setVersions] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const busy = !!activeTaskFor(pkg.id);

  useEffect(() => {
    if (!open || versions || error) return;
    api.packageVersions(pkg.id, pkg.source).then(setVersions).catch((e) => setError(String(e)));
  }, [open, versions, error, pkg.id, pkg.source]);

  return (
    <section className="block">
      <h2>Other versions</h2>
      {!open ? (
        <button className="btn" onClick={() => setOpen(true)}>
          Show older versions
        </button>
      ) : error ? (
        <p className="muted">{error}</p>
      ) : !versions ? (
        <p className="muted">Loading versions…</p>
      ) : (
        <div className="vlist">
          {versions.map((v) => {
            const isInstalled = installedVersion === v;
            return (
              <div className="vrow" key={v}>
                <span className="vnum">
                  {v}
                  {v === current ? <span className="pill soft">Latest</span> : null}
                  {isInstalled ? <span className="pill">Installed</span> : null}
                </span>
                <span className="vact">
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => void enqueue([{ kind: "download", id: pkg.id, name: pkg.name, source: pkg.source, version: v }])}
                  >
                    Download installer
                  </button>
                  {!isInstalled ? (
                    <button
                      className="btn"
                      disabled={busy}
                      title={installedVersion ? "Replaces the installed version" : undefined}
                      onClick={() =>
                        void enqueue([{ kind: "install", id: pkg.id, name: pkg.name, source: pkg.source, version: v, force: !!installedVersion }])
                      }
                    >
                      {installedVersion ? "Switch to this" : "Install this"}
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function Detail({ pkg }: { pkg: PackageRef }) {
  const { closeDetail, installedById, upgradeFor, tasks, activeTaskFor, enqueue, toast } = useStore();
  const [details, setDetails] = useState<PackageDetails | undefined>(() => peekDetails(pkg.id, pkg.source));
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetchDetails(pkg.id, pkg.source, { priority: true })
      .then((d) => alive && setDetails(d))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [pkg.id, pkg.source]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && !confirm && closeDetail();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [closeDetail, confirm]);

  const inst = installedById(pkg.id);
  const up = upgradeFor(pkg.id);
  const name = details?.name ?? pkg.name;
  const ref: PackageRef = { id: pkg.id, name, source: pkg.source, version: details?.version };
  const lastDownload = useMemo(
    () => tasks.filter((t) => t.kind === "download" && t.status === "succeeded" && t.id.toLowerCase() === pkg.id.toLowerCase() && t.outputPath).slice(-1)[0],
    [tasks, pkg.id],
  );
  const installer = details?.installers[0];
  const busy = activeTaskFor(pkg.id);

  return (
    <div className="page detail">
      <button className="btn ghost back" onClick={closeDetail}>
        <ArrowLeft size={16} /> Back
      </button>

      <header className="hero">
        <PackageIcon id={pkg.id} name={name} details={details} size={88} />
        <div className="hero-main">
          <h1>{name}</h1>
          <div className="hero-sub">
            {details?.publisher || pkg.id}
            {inst ? <span className="pill">Installed {inst.version}</span> : null}
            {up ? <span className="pill accent">Update to {up.available}</span> : null}
          </div>
          <div className="hero-actions">
            <ActionButton pkg={ref} size="lg" />
            {inst && !busy ? (
              <button className="btn lg" onClick={() => setConfirm(true)}>
                <Trash2 size={16} /> Uninstall
              </button>
            ) : null}
            {details?.homepage ? (
              <button className="btn lg ghost" onClick={() => void api.openUrl(details.homepage)}>
                <ExternalLink size={16} /> Website
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {error && !details ? (
        <div className="empty">
          <div className="empty-title">Couldn’t load details</div>
          <p className="empty-text">{error}</p>
        </div>
      ) : !details ? (
        <div className="block">
          <div className="skeleton line" style={{ width: "70%" }} />
          <div className="skeleton line" style={{ width: "55%" }} />
          <div className="skeleton line" style={{ width: "62%" }} />
        </div>
      ) : (
        <>
          <section className="block prose">
            <h2>About</h2>
            <p>{details.description || "The publisher did not provide a description."}</p>
            {details.tags.length ? (
              <div className="tags">
                {details.tags.map((t) => (
                  <span className="pill soft" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="block">
            <h2>Details</h2>
            <dl className="facts">
              <Fact label="Latest version">{details.version}</Fact>
              <Fact label="Publisher">{details.publisherUrl ? <Link url={details.publisherUrl} label={details.publisher} /> : details.publisher || "—"}</Fact>
              <Fact label="License">{details.licenseUrl ? <Link url={details.licenseUrl} label={details.license || "License"} /> : details.license || "—"}</Fact>
              <Fact label="Package id">
                <span className="mono">{details.id}</span>
              </Fact>
              <Fact label="Support">
                <Link url={details.publisherSupportUrl} />
              </Fact>
              <Fact label="Privacy">
                <Link url={details.privacyUrl} />
              </Fact>
              {details.moniker ? (
                <Fact label="Short name">
                  <span className="mono">{details.moniker}</span>
                </Fact>
              ) : null}
              {details.author ? <Fact label="Author">{details.author}</Fact> : null}
            </dl>
          </section>

          {installer ? (
            <section className="block">
              <h2>Installer</h2>
              <dl className="facts">
                <Fact label="Type">{installer.installerType || "—"}</Fact>
                <Fact label="Architecture">{installer.architecture || "Chosen for your PC"}</Fact>
                <Fact label="Released">{installer.releaseDate || "—"}</Fact>
                <Fact label="Scope">{installer.scope || "Either"}</Fact>
              </dl>
              {installer.downloadUrl ? (
                <div className="urlbox">
                  <span className="muted">Downloads from</span>
                  <code>{installer.downloadUrl}</code>
                  <button className="icon-btn" title="Copy link" aria-label="Copy download link" onClick={async () => toast((await copyText(installer.downloadUrl)) ? "Link copied" : "Couldn’t copy the link")}>
                    <Copy size={14} />
                  </button>
                </div>
              ) : null}
              {installer.sha256 ? (
                <div className="urlbox">
                  <span className="muted">SHA-256</span>
                  <code>{installer.sha256}</code>
                </div>
              ) : null}
              <div className="dl-row">
                <button className="btn" disabled={!!busy} onClick={() => void enqueue([{ kind: "download", id: pkg.id, name, source: pkg.source, version: details.version }])}>
                  Download installer only
                </button>
                <span className="muted">Saved to Downloads\Winget Store, not installed.</span>
                {lastDownload?.outputPath ? (
                  <button className="btn ghost" onClick={() => void api.revealPath(lastDownload.outputPath!)}>
                    <FolderOpen size={15} /> Show in folder
                  </button>
                ) : null}
              </div>
              {details.installers.length > 1 ? <p className="muted">{details.installers.length} installers listed; winget picks the one that matches your PC.</p> : null}
            </section>
          ) : null}

          {details.releaseNotes || details.releaseNotesUrl ? (
            <section className="block prose">
              <h2>What’s new</h2>
              {details.releaseNotes ? <p className="pre">{details.releaseNotes}</p> : null}
              {details.releaseNotesUrl ? <Link url={details.releaseNotesUrl} label="Full release notes" /> : null}
            </section>
          ) : null}

          {details.documentation.length ? (
            <section className="block">
              <h2>Documentation</h2>
              <div className="links">
                {details.documentation.map((d, i) => (
                  <Link key={i} url={d.url} label={d.label || hostOf(d.url)} />
                ))}
              </div>
            </section>
          ) : null}

          <Versions pkg={ref} current={details.version} installedVersion={inst?.version} />
        </>
      )}
      {confirm ? <ConfirmUninstall pkg={ref} onClose={() => setConfirm(false)} /> : null}
      <span hidden>
        <Check />
        <ArrowUpCircle />
      </span>
    </div>
  );
}
