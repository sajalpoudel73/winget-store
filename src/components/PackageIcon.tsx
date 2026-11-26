import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { PackageDetails } from "../api/types";
import { hashHue, initials } from "../lib/format";
import { iconCandidates } from "../lib/icons";
import { useStore } from "../store";

interface Props {
  id: string;
  name: string;
  details?: PackageDetails;
  size?: number;
}

export function PackageIcon({ id, name, details, size = 48 }: Props) {
  const { settings } = useStore();
  const candidates = useMemo(() => (settings.onlineIcons ? iconCandidates(details) : []), [details, settings.onlineIcons]);
  const sig = candidates.join("|");
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [sig]);
  const src = candidates[idx];
  const style = { "--s": `${size}px`, "--h": hashHue(id) } as CSSProperties;
  return (
    <span className="icon" style={style} aria-hidden="true">
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setIdx((i) => i + 1)} />
      ) : (
        <span className="icon-letters">{initials(name)}</span>
      )}
    </span>
  );
}
