import { api } from "../api";
import { clearDetailsCache } from "../lib/details";
import { useStore, type Settings as S } from "../store";

export function Settings() {
  const { settings, setSettings, status, recheckStatus, toast } = useStore();
  const radio = <K extends keyof S>(key: K, value: S[K], label: string, help?: string) => (
    <label className="radio">
      <input type="radio" name={key} checked={settings[key] === value} onChange={() => setSettings({ [key]: value } as Partial<S>)} />
      <span>
        {label}
        {help ? <small>{help}</small> : null}
      </span>
    </label>
  );
  return (
    <div className="page narrow">
      <header className="page-head"><h1>Settings</h1></header>

      <section className="block">
        <h2>Appearance</h2>
        <div className="radios">
          {radio("theme", "system", "Match Windows")}
          {radio("theme", "light", "Light")}
          {radio("theme", "dark", "Dark")}
        </div>
      </section>

      <section className="block">
        <h2>Install for</h2>
        <div className="radios">
          {radio("scope", "default", "Package default", "Let each package decide.")}
          {radio("scope", "user", "Just me", "No administrator prompt, when the package supports it.")}
          {radio("scope", "machine", "Everyone on this PC", "Asks for administrator approval.")}
        </div>
      </section>

      <section className="block">
        <h2>Icons</h2>
        <label className="check">
          <input type="checkbox" checked={settings.onlineIcons} onChange={(e) => setSettings({ onlineIcons: e.target.checked })} />
          <span>Load app icons from the web<small>winget doesn’t include icons, so they come from the publisher’s website or GitHub avatar. Turn off to show letter tiles and make no requests.</small></span>
        </label>
        <button className="btn" onClick={() => { clearDetailsCache(); toast("Cached app details cleared"); }}>Clear cached app details</button>
      </section>

      <section className="block">
        <h2>winget</h2>
        <p>{status?.available ? `Found winget ${status.version ?? ""}` : status ? status.error : "Checking…"}</p>
        <div className="dl-row">
          <button className="btn" onClick={recheckStatus}>Check again</button>
          <button className="btn" onClick={() => void api.refreshSources().then((m) => toast(m, "good")).catch((e) => toast(String(e), "bad"))}>Refresh package sources</button>
        </div>
      </section>
    </div>
  );
}
