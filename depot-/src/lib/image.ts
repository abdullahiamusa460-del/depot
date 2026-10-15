/**
 * Local product-image handling.
 *
 * Images picked on the device are downscaled in the browser and stored as a
 * data URL inside IndexedDB (`Product.imageUrl`), so a product photo is part
 * of the local database: it survives restarts, needs no server and works with
 * no network. Nothing here touches the network.
 */

/** Largest source file accepted from the picker (10 MB). */
export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;

/** Longest edge kept after downscaling; plenty for a POS thumbnail. */
export const MAX_IMAGE_EDGE = 1024;

/** Longest stored data URL (~1.2 MB of base64, ~900 KB of image data). */
export const MAX_IMAGE_DATA_URL_CHARS = 1_200_000;

const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "avif",
  "bmp",
  "svg",
];

export function isImageFile(file: Pick<File, "type" | "name">): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.includes(extension);
}

/**
 * True for values the app may persist as a product image:
 * an uploaded photo (`data:image/…` within the size cap), an absolute URL, or
 * a self-hosted asset path such as `/images/products/coca-cola.jpg`.
 */
export function isAcceptableImageUrl(value: string): boolean {
  if (!value) return true;
  if (value.startsWith("data:image/")) {
    return value.length <= MAX_IMAGE_DATA_URL_CHARS;
  }
  if (/^https?:\/\/\S+$/i.test(value)) return true;
  if (value.startsWith("/") && value.length <= 2048) return true;
  return false;
}

function decodeWithImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    image.src = url;
  });
}

function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(
      () => createImageBitmap(file).catch(() => decodeWithImageElement(file)),
    );
  }
  return decodeWithImageElement(file);
}

function preferredType(canvas: HTMLCanvasElement): string {
  try {
    if (canvas.toDataURL("image/webp").startsWith("data:image/webp")) {
      return "image/webp";
    }
  } catch {
    /* fall through to JPEG */
  }
  return "image/jpeg";
}

/**
 * Reads an image file picked by the user, downscales it to at most
 * `MAX_IMAGE_EDGE` pixels on its longest edge and returns a compact data URL
 * ready to be stored in IndexedDB. Throws an `Error` with a message suitable
 * for showing in the UI.
 */
export async function fileToStoredImage(file: File): Promise<string> {
  if (!isImageFile(file)) {
    throw new Error("Choose an image file (PNG, JPEG or WebP).");
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    throw new Error("That image is larger than 10 MB. Choose a smaller one.");
  }

  const decoded = await decodeImage(file);
  const width =
    decoded instanceof HTMLImageElement ? decoded.naturalWidth : decoded.width;
  const height =
    decoded instanceof HTMLImageElement ? decoded.naturalHeight : decoded.height;
  if (!width || !height) {
    throw new Error("That image could not be decoded.");
  }

  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot process images.");
  }
  context.drawImage(decoded, 0, 0, canvas.width, canvas.height);
  if (!(decoded instanceof HTMLImageElement)) decoded.close();

  const type = preferredType(canvas);
  const baseQuality = type === "image/webp" ? 0.85 : 0.86;

  for (const quality of [baseQuality, 0.7, 0.55, 0.4]) {
    const dataUrl = canvas.toDataURL(type, quality);
    if (dataUrl.length <= MAX_IMAGE_DATA_URL_CHARS) return dataUrl;
  }

  throw new Error("That image is too large to store. Try a smaller photo.");
}
