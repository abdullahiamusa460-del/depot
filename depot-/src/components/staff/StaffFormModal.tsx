import { useState } from "react";
import { useApp } from "../../hooks/useApp";
import { permissionLabel, permissionsForRole } from "../../config/permissions";
import { roleMeta, roleOrder } from "../../config/roles";
import type { Role, StaffAccount, StaffInput } from "../../types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Field, Input, Select } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Switch } from "../ui/Switch";

export interface StaffFormModalProps {
  account: StaffAccount | null;
  onClose: () => void;
}

export function StaffFormModal({ account, onClose }: StaffFormModalProps) {
  const { addStaff, updateStaff, pushToast } = useApp();
  const isEdit = Boolean(account);
  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(account?.role ?? "staff");
  const [active, setActive] = useState(account?.active ?? true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const rolePermissionsList = permissionsForRole(role);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!isEdit && password.trim().length < 6) {
      setError("Choose a password with at least 6 characters.");
      return;
    }
    const input: StaffInput = {
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
      role,
      active,
    };
    setBusy(true);
    const result = isEdit
      ? await updateStaff(account!.id, input)
      : await addStaff(input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save the staff account.");
      return;
    }
    pushToast({
      level: "success",
      title: isEdit ? "Staff updated" : "Staff added",
      message: input.name,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? "Edit staff account" : "Add staff account"}
      description={
        isEdit
          ? "Update the account details and access level for this person."
          : "Create a login and choose the access level this person needs."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={busy}>
            {isEdit ? "Save changes" : "Add staff"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={error}>
            <Input
              value={name}
              invalid={Boolean(error)}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Ngozi Okafor"
            />
          </Field>
          <Field label="Email" required>
            <Input
              value={email}
              type="email"
              autoCapitalize="off"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="e.g. ngozi@shop.com"
            />
          </Field>
          {!isEdit && (
            <Field
              label="Password"
              required
              hint="At least 6 characters. Used to sign in."
              className="sm:col-span-2"
            >
              <Input
                value={password}
                type="password"
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </Field>
          )}
          <Field
            label="Role"
            hint="Administrators manage the whole shop; staff handle sales and stock."
            className={isEdit ? undefined : "sm:col-span-2"}
          >
            <Select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {roleOrder.map((entry) => (
                <option key={entry} value={entry}>
                  {roleMeta[entry].label} — {roleMeta[entry].blurb}
                </option>
              ))}
            </Select>
          </Field>
          {isEdit && (
            <Field label="Account status" hint="Inactive accounts cannot sign in.">
              <div className="flex h-10 items-center gap-3">
                <Switch
                  checked={active}
                  onChange={setActive}
                  label="Account active"
                />
                <span className="text-sm font-medium text-foreground">
                  {active ? "Active" : "Inactive"}
                </span>
              </div>
            </Field>
          )}
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-foreground">
              Access for this role
            </h3>
            <Badge tone={roleMeta[role].tone}>{roleMeta[role].badge}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Access is determined by the role and cannot be customised per account.
          </p>
          <div className="flex flex-wrap gap-2">
            {rolePermissionsList.map((permission) => (
              <span
                key={permission}
                className="rounded-full border border-border bg-surface-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground"
              >
                {permissionLabel(permission)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
