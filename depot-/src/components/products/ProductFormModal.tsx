import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useApp } from "../../hooks/useApp";
import type { Product, Unit } from "../../types";
import { UNITS } from "../../types";
import { fileToStoredImage } from "../../lib/image";
import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { ProductThumb } from "../ui/ProductThumb";
import { Switch } from "../ui/Switch";

interface FormState {
  name: string;
  brand: string;
  categoryId: string;
  unit: Unit;
  price: string;
  cost: string;
  stock: string;
  minStock: string;
  sku: string;
  barcode: string;
  description: string;
  image: string;
  active: boolean;
}

function emptyState(defaultCategoryId: string, defaultMinStock: number): FormState {
  return {
    name: "",
    brand: "",
    categoryId: defaultCategoryId,
    unit: "Bottle",
    price: "",
    cost: "",
    stock: "0",
    minStock: String(defaultMinStock),
    sku: "",
    barcode: "",
    description: "",
    image: "",
    active: true,
  };
}

function fromProduct(product: Product): FormState {
  return {
    name: product.name,
    brand: product.brand,
    categoryId: product.categoryId,
    unit: product.unit,
    price: String(product.price),
    cost: String(product.cost),
    stock: String(product.stock),
    minStock: String(product.minStock),
    sku: product.sku,
    barcode: product.barcode,
    description: product.description,
    image: product.image ?? "",
    active: product.active,
  };
}

export interface ProductFormModalProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductFormModal({ product, onClose }: ProductFormModalProps) {
  const { categories, settings, addProduct, updateProduct, pushToast } = useApp();
  const [form, setForm] = useState<FormState>(() =>
    product
      ? fromProduct(product)
      : emptyState(categories[0]?.id ?? "", settings.lowStockDefault),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageBusy, setImageBusy] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleImage = async (file: File | undefined) => {
    if (!file) return;
    setImageBusy(true);
    try {
      const dataUrl = await fileToStoredImage(file);
      update("image", dataUrl);
      setErrors((current) => ({ ...current, image: "" }));
    } catch (err) {
      pushToast({
        level: "danger",
        title: "Could not add image",
        message:
          err instanceof Error ? err.message : "That image could not be read.",
      });
    } finally {
      setImageBusy(false);
      if (imageRef.current) imageRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Product name is required.";
    if (!form.categoryId) nextErrors.categoryId = "Choose a category.";
    if (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0)
      nextErrors.price = "Enter a selling price greater than zero.";
    if (!Number.isFinite(Number(form.cost)) || Number(form.cost) < 0)
      nextErrors.cost = "Cost price cannot be negative.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      categoryId: form.categoryId,
      description: form.description.trim(),
      sku: form.sku.trim() || form.name.trim().slice(0, 6).toUpperCase(),
      barcode: form.barcode.trim(),
      unit: form.unit,
      price: Number(form.price),
      cost: Number(form.cost) || 0,
      stock: Math.max(0, Math.floor(Number(form.stock) || 0)),
      minStock: Math.max(0, Math.floor(Number(form.minStock) || 0)),
      image: form.image,
      active: form.active,
    };

    if (product) {
      await updateProduct(product.id, input);
      pushToast({ level: "success", title: "Product updated", message: input.name });
    } else {
      const created = await addProduct(input);
      if (!created) {
        pushToast({
          level: "danger",
          title: "Product not added",
          message: "You do not have permission to manage products.",
        });
        return;
      }
      pushToast({ level: "success", title: "Product added", message: input.name });
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={product ? "Edit product" : "Add product"}
      description={
        product
          ? "Update the product details below."
          : "Create a new beverage product for your shop."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()}>
            {product ? "Save changes" : "Add product"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" required error={errors.name}>
            <Input
              value={form.name}
              invalid={Boolean(errors.name)}
              onChange={(event) => update("name", event.target.value)}
              placeholder="e.g. Coca-Cola 50cl Bottle"
            />
          </Field>
          <Field label="Brand">
            <Input
              value={form.brand}
              onChange={(event) => update("brand", event.target.value)}
              placeholder="e.g. Coca-Cola"
            />
          </Field>
          <Field label="Category" required error={errors.categoryId}>
            <Select
              value={form.categoryId}
              invalid={Boolean(errors.categoryId)}
              onChange={(event) => update("categoryId", event.target.value)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Selling unit">
            <Select
              value={form.unit}
              onChange={(event) => update("unit", event.target.value as Unit)}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Selling price (${settings.currencySymbol})`} required error={errors.price}>
            <Input
              type="number"
              min={0}
              value={form.price}
              invalid={Boolean(errors.price)}
              onChange={(event) => update("price", event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label={`Cost price (${settings.currencySymbol})`} error={errors.cost}>
            <Input
              type="number"
              min={0}
              value={form.cost}
              invalid={Boolean(errors.cost)}
              onChange={(event) => update("cost", event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Stock quantity">
            <Input
              type="number"
              min={0}
              value={form.stock}
              onChange={(event) => update("stock", event.target.value)}
            />
          </Field>
          <Field label="Minimum stock level" hint="Alerts when stock reaches this level">
            <Input
              type="number"
              min={0}
              value={form.minStock}
              onChange={(event) => update("minStock", event.target.value)}
            />
          </Field>
          <Field label="SKU">
            <Input
              value={form.sku}
              onChange={(event) => update("sku", event.target.value)}
              placeholder="CC-50CL"
            />
          </Field>
          <Field label="Barcode">
            <Input
              value={form.barcode}
              onChange={(event) => update("barcode", event.target.value)}
              placeholder="8800…"
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Optional short description"
          />
        </Field>
        <Field
          label="Product image"
          hint="Stored on this device and shown offline at the POS"
        >
          <div className="flex items-center gap-4">
            <ProductThumb
              name={form.name.trim() || "Product"}
              image={form.image || undefined}
              size="lg"
            />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={imageBusy}
                  onClick={() => imageRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  {imageBusy
                    ? "Processing…"
                    : form.image
                      ? "Replace image"
                      : "Choose image"}
                </Button>
                {form.image ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update("image", "")}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPEG or WebP · resized and saved in the local database
              </p>
            </div>
          </div>
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleImage(event.target.files?.[0])}
          />
        </Field>
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Active product</p>
            <p className="text-xs text-muted-foreground">
              Inactive products cannot be sold at the POS.
            </p>
          </div>
          <Switch
            checked={form.active}
            onChange={(value) => update("active", value)}
            label="Active product"
          />
        </div>
      </div>
    </Modal>
  );
}
