import { useState } from "react";
import type { PackageRef } from "../api/types";
import { useStore } from "../store";
import { Modal } from "./Modal";

export function ConfirmUninstall({ pkg, onClose }: { pkg: PackageRef; onClose: () => void }) {
  const { enqueue } = useStore();
  const [purge, setPurge] = useState(false);
  return (
    <Modal
      title={`Uninstall ${pkg.name}?`}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Keep it
          </button>
          <button
            className="btn danger"
            onClick={() => {
              void enqueue([{ kind: "uninstall", id: pkg.id, name: pkg.name, source: pkg.source, purge }]);
              onClose();
            }}
          >
            Uninstall
          </button>
        </>
      }
    >
      <p>The app is removed with its own uninstaller, so a prompt may appear. Your documents are not touched.</p>
      <label className="check">
        <input type="checkbox" checked={purge} onChange={(e) => setPurge(e.target.checked)} />
        <span>Also delete all files and settings (portable apps only)</span>
      </label>
    </Modal>
  );
}
