import { useState } from "react";
import { ConfirmDialog } from "../ui/Dialog";
import { api } from "../../api/client";
import { useSkills } from "../../stores/skills";
import { useApp } from "../../stores/app";
import { toast } from "../../stores/toasts";
import { makePathDisplay } from "../../lib/paths";

export function UninstallDialog({
  paths,
  name,
  onClose,
}: {
  paths: string[];
  name: string;
  onClose: () => void;
}) {
  const { dropItem, closeDetail } = useSkills();
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const display = makePathDisplay(app.home);
  const humanPaths = paths.map((p) => display.display(p)).join("\n");

  const doUninstall = async () => {
    setBusy(true);
    setError(null);
    try {
      const currentDetail = useSkills.getState().detail;
      const isInspecting = app.inspectorPath && paths.includes(app.inspectorPath);

      let nextPath = null;
      if (isInspecting && currentDetail) {
        const remaining = currentDetail.locations.filter((l) => !paths.includes(l.path));
        if (remaining.length > 0) {
          nextPath = remaining[0].path;
        }
      }

      const removed = await api.uninstallSkills({ paths });
      toast.success("Skill uninstalled", name);
      removed.forEach((p) => dropItem(p));

      if (isInspecting) {
        if (nextPath) {
          app.setInspector(nextPath);
          useSkills.getState().openDetail(nextPath);
        } else {
          app.setInspector(null);
          closeDetail();
        }
      }

      app.refreshCounts();
      onClose();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Remove skill?"
      confirmLabel="Remove"
      danger
      busy={busy}
      onConfirm={doUninstall}
    >
      <p>This will permanently delete:</p>
      <pre className="mt-2 overflow-x-auto rounded-[6px] border border-border bg-bg px-2.5 py-2 text-xs text-text">
        {humanPaths}
      </pre>
      <p className="mt-2 text-xs text-muted">This cannot be undone.</p>
      {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
    </ConfirmDialog>
  );
}
