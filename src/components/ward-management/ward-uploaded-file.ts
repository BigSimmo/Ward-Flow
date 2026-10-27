// H-0049: reading a chosen file's type and showing a recorded file. Kept apart from the model
// vocabulary, which declares no numbers (the legal-figure guard), because a size label divides by 1024.
import {
  UPLOADED_FILE_TYPES,
  type MovementUploadedForm,
  type UploadedFileType,
} from "@/components/ward-management/ward-model-vocabulary";

export function isUploadedFileType(value: unknown): value is UploadedFileType {
  return UPLOADED_FILE_TYPES.some((type) => type === value);
}

/** The fixed file-type label for a chosen file. The name is read here and never kept. */
export function uploadedFileTypeOf(name: unknown, mimeType?: unknown): UploadedFileType {
  const mime = typeof mimeType === "string" ? mimeType.toLowerCase() : "";
  const extension = typeof name === "string" ? (/\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase() ?? "") : "";
  if (mime === "application/pdf" || extension === "pdf") return "PDF";
  if (mime === "image/jpeg" || extension === "jpg" || extension === "jpeg") return "JPEG";
  if (mime === "image/png" || extension === "png") return "PNG";
  return "Other";
}

/** What screens show for a recorded file: its type and size, never a name ("PDF · 12 KB"). */
export function uploadedFileLabel(form: Pick<MovementUploadedForm, "fileType" | "sizeBytes">): string {
  const type = form.fileType ?? "File";
  const size = form.sizeBytes;
  return typeof size === "number" && Number.isFinite(size) && size > 0
    ? `${type} · ${Math.max(1, Math.round(size / 1024))} KB`
    : type;
}
