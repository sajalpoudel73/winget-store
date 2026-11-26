import { forwardRef } from "react";
import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

export const TopBar = forwardRef<HTMLInputElement, Props>(function TopBar({ value, onChange, placeholder }, ref) {
  return (
    <div className="topbar">
      <label className="search">
        <Search size={16} aria-hidden="true" />
        <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} spellCheck={false} />
        {value ? (
          <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => onChange("")}>
            <X size={14} />
          </button>
        ) : (
          <kbd>Ctrl K</kbd>
        )}
      </label>
    </div>
  );
});
