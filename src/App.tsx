import { useEffect, useRef, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Toasts } from "./components/Toasts";
import { EmptyState } from "./components/EmptyState";
import { useDebounced } from "./lib/hooks";
import { api } from "./api";
import { StoreProvider, useStore } from "./store";
import { Activity } from "./pages/Activity";
import { Detail } from "./pages/Detail";
import { Discover } from "./pages/Discover";
import { Installed } from "./pages/Installed";
import { Search } from "./pages/Search";
import { Settings } from "./pages/Settings";
import { Updates } from "./pages/Updates";

function Shell() {
  const { view, detail, status, recheckStatus, go } = useStore();
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 350);
  const input = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [view, detail?.id, q]);

  // Typing in the search box on Installed filters that list; elsewhere it searches the catalog.
  const filtering = view === "installed";
  const searching = !filtering && q.length >= 2 && (view === "discover" || view === "updates" || view === "activity");

  let body;
  if (status && !status.available) {
    body = (
      <div className="page">
        <EmptyState
          title="winget isn’t available"
          action={<button className="btn primary" onClick={recheckStatus}>Check again</button>}
        >
          {status.error} winget comes with “App Installer” on Windows 10 (1809 and later) and Windows 11.
        </EmptyState>
      </div>
    );
  } else if (detail) body = <Detail key={`${detail.source}:${detail.id}`} pkg={detail} />;
  else if (searching) body = <Search query={q} />;
  else if (view === "discover") body = <Discover />;
  else if (view === "installed") body = <Installed filter={query} />;
  else if (view === "updates") body = <Updates />;
  else if (view === "activity") body = <Activity />;
  else body = <Settings />;

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <TopBar
          ref={input}
          value={query}
          onChange={(v) => {
            setQuery(v);
            if (view === "settings") go("discover");
          }}
          placeholder={filtering ? "Filter installed apps" : "Search apps, publishers, tags"}
        />
        {api.isMock ? <div className="mock-banner">Showing sample data. Run the desktop app on Windows to use your real winget.</div> : null}
        <main ref={scroller} className="content">{body}</main>
      </div>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
