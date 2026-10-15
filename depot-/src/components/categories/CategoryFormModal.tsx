import { useState } from "react";
import { useApp } from "../../hooks/useApp";
import type { Category } from "../../types";
import { Button } from "../ui/Button";
import { Field, Input, Textarea } from "../ui/Input";
import { Modal } from "../ui/Modal";

const swatches = [
  "#0d9488",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#f59e0b",
  "#16a34a",
  "#0ea5e9",
  "#64748b",
];

export interface CategoryFormModalProps {
  category: Category | null;
  onClose: () => void;
}

export function CategoryFormModal({
  category,
  onClose,
}: CategoryFormModalProps) {
  const { categories, addCategory, updateCategory, pushToast } = useApp();
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [color, setColor] = useState(category?.color ?? swatches[0]);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Category name is required.");
      return;
    }
    const duplicate = categories.some(
      (entry) =>
        entry.id !== category?.id &&
        entry.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setError("A category with this name already exists.");
      return;
    }
    if (category) {
      updateCategory(category.id, { name: trimmed, description: description.trim(), color });
      pushToast({ level: "success", title: "Category updated", message: trimmed });
    } else {
      const created = addCategory({ name: trimmed, description: description.trim(), color });
      if (!created) {
        pushToast({
          level: "danger",
          title: "Category not added",
          message: "You do not have permission to manage categories.",
        });
        return;
      }
      pushToast({ level: "success", title: "Category added", message: trimmed });
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={category ? "Edit category" : "Add category"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {category ? "Save changes" : "Add category"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Category name" required error={error}>
          <Input
            value={name}
            invalid={Boolean(error)}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Soft Drinks"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short description"
            className="min-h-[72px]"
          />
        </Field>
        <Field label="Accent colour">
          <div className="flex flex-wrap gap-2">
            {swatches.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use colour ${swatch}`}
                onClick={() => setColor(swatch)}
                className={
                  color === swatch
                    ? "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-surface ring-primary"
                    : "h-8 w-8 rounded-full ring-1 ring-border"
                }
                style={{ background: swatch }}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
