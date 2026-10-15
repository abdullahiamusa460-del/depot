import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { CategoryFormModal } from "../components/categories/CategoryFormModal";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { useApp } from "../hooks/useApp";
import { formatCurrency } from "../lib/format";
import type { Category } from "../types";
import { productStats } from "../lib/analytics";

export default function Categories() {
  const { categories, products, sales, settings, deleteCategory, pushToast } =
    useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const stats = productStats(sales);

  const countFor = (id: string) =>
    products.filter((product) => product.categoryId === id).length;

  const revenueFor = (id: string) => {
    const productIds = new Set(
      products.filter((p) => p.categoryId === id).map((p) => p.id),
    );
    return stats
      .filter((entry) => productIds.has(entry.productId))
      .reduce((sum, entry) => sum + entry.revenue, 0);
  };

  const handleDelete = (category: Category) => {
    const count = countFor(category.id);
    if (count > 0) {
      pushToast({
        level: "warning",
        title: "Category in use",
        message: `Reassign ${count} product(s) before deleting "${category.name}".`,
      });
      return;
    }
    deleteCategory(category.id);
    pushToast({ level: "success", title: "Category deleted", message: category.name });
  };

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise your beverages into clear groups."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add category
          </Button>
        }
      />

      {categories.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tags}
            title="No categories yet"
            description="Create categories such as Soft Drinks, Water or Juice."
            action={
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Add category
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                    style={{ background: category.color }}
                  >
                    <Tags className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {category.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {countFor(category.id)} products
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${category.name}`}
                    onClick={() => {
                      setEditing(category);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${category.name}`}
                    className="text-danger hover:bg-danger-soft"
                    onClick={() => setDeleting(category)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                {category.description || "No description provided."}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">30-day revenue</span>
                <span className="font-bold text-foreground">
                  {formatCurrency(revenueFor(category.id), settings.currencySymbol, {
                    compact: true,
                  })}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <CategoryFormModal
          category={editing}
          onClose={() => setFormOpen(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete category"
        message={`Delete "${deleting?.name}"? Products must be reassigned first.`}
        confirmLabel="Delete category"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) handleDelete(deleting);
        }}
      />
    </>
  );
}
