export type CopyablePayload = {
  value: string;
  title: string;
  previewPrefix: string;
};

export function getCopyablePayload(element: HTMLElement): CopyablePayload | null {
  const value = element.dataset.copyable;
  if (!value) {
    return null;
  }

  return {
    value,
    title: element.dataset.copyTitle ?? "Copy Value",
    previewPrefix: element.dataset.copyPreviewPrefix ?? "",
  };
}
