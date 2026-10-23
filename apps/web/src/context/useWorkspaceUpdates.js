import { useEffect, useState } from "react";

const WORKSPACE_UPDATE_EVENT = "workspace-update";

export function dispatchWorkspaceUpdate() {
  window.dispatchEvent(new Event(WORKSPACE_UPDATE_EVENT));
}

export default function useWorkspaceUpdates() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setVersion((current) => current + 1);
    window.addEventListener(WORKSPACE_UPDATE_EVENT, handleUpdate);
    return () =>
      window.removeEventListener(WORKSPACE_UPDATE_EVENT, handleUpdate);
  }, []);

  return version;
}
