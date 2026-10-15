import { Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { roleMeta } from "../config/roles";
import { permissionMeta } from "../config/permissions";
import { PageHeader } from "../components/layout/PageHeader";
import { StaffFormModal } from "../components/staff/StaffFormModal";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { useApp } from "../hooks/useApp";
import type { StaffAccount } from "../types";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Team() {
  const { staff, session, deleteStaff, pushToast } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [deleting, setDeleting] = useState<StaffAccount | null>(null);

  const handleDelete = async (account: StaffAccount) => {
    const result = await deleteStaff(account.id);
    if (!result.ok) {
      pushToast({
        level: "warning",
        title: "Cannot deactivate account",
        message: result.error ?? "Deactivation was blocked.",
      });
      return;
    }
    pushToast({
      level: "success",
      title: "Staff deactivated",
      message: account.name,
    });
  };

  return (
    <>
      <PageHeader
        title="Team & Permissions"
        description="Create staff logins. Access is granted by role: administrators manage the shop, staff handle sales and stock."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4" />
            Add staff
          </Button>
        }
      />

      {staff.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No staff accounts"
            description="Add a staff account so your shop team can log in and take sales."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <UserPlus className="h-4 w-4" />
                Add staff
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((account) => {
            const meta = roleMeta[account.role];
            const isYou = account.id === session?.accountId;
            const effectivePermissions = account.permissions;
            return (
              <Card key={account.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white ${
                        account.role === "admin" ? "bg-primary" : "bg-surface-muted text-foreground"
                      }`}
                    >
                      {initials(account.name)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                        <span className="truncate">{account.name}</span>
                        {isYou && <Badge tone="success">You</Badge>}
                      </h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {account.email || roleMeta[account.role].blurb}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${account.name}`}
                      onClick={() => {
                        setEditing(account);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${account.name}`}
                      className="text-danger hover:bg-danger-soft"
                      disabled={isYou}
                      onClick={() => setDeleting(account)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <Badge tone={meta.tone === "primary" ? "primary" : "info"}>
                    {meta.badge}
                  </Badge>
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {effectivePermissions.length} permissions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {effectivePermissions.slice(0, 5).map((permission) => (
                      <Badge key={permission} tone="neutral">
                        {permissionMeta[permission as keyof typeof permissionMeta].label}
                      </Badge>
                    ))}
                    {effectivePermissions.length > 5 && (
                      <Badge tone="neutral">
                        +{effectivePermissions.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {formOpen && (
        <StaffFormModal
          account={editing}
          onClose={() => setFormOpen(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete staff account"
        message={`Delete "${deleting?.name}"? They will no longer be able to log in.`}
        confirmLabel="Delete account"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) handleDelete(deleting);
          setDeleting(null);
        }}
      />
    </>
  );
}
