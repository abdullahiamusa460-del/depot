import { ShieldX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { permissionMeta } from "../../config/permissions";
import type { Permission } from "../../types";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

export interface AccessDeniedProps {
  permission?: Permission;
}

export function AccessDenied({ permission }: AccessDeniedProps) {
  const navigate = useNavigate();
  const meta = permission ? permissionMeta[permission] : undefined;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm">
      <EmptyState
        icon={ShieldX}
        title="Access denied"
        description={
          meta
            ? `You do not have permission to ${meta.label.toLowerCase()}. Ask an administrator to grant it on the Team & Permissions page.`
            : "You do not have permission to view this page."
        }
        action={
          <Button variant="secondary" onClick={() => navigate("/")}>
            Back to dashboard
          </Button>
        }
      />
    </div>
  );
}
