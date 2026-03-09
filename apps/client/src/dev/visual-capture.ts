function copyComputedStyles(source: Element, target: Element): void {
  const computedStyle = window.getComputedStyle(source);
  for (const propertyName of computedStyle) {
    target.setAttribute(
      "style",
      `${target.getAttribute("style") ?? ""}${propertyName}:${computedStyle.getPropertyValue(propertyName)};`,
    );
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  sourceChildren.forEach((child, index) => {
    const targetChild = targetChildren[index];
    if (targetChild) {
      copyComputedStyles(child, targetChild);
    }
  });
}

async function renderElementToBlob(element: HTMLElement): Promise<Blob> {
  const rect = element.getBoundingClientRect();
  const clone = element.cloneNode(true);
  if (!(clone instanceof HTMLElement)) {
    throw new Error("Failed to clone capture target.");
  }

  copyComputedStyles(element, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(rect.width)}" height="${Math.ceil(rect.height)}" viewBox="0 0 ${Math.ceil(rect.width)} ${Math.ceil(rect.height)}">
      <foreignObject width="100%" height="100%">${serialized}</foreignObject>
    </svg>
  `;
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Failed to render visual capture image."));
      nextImage.src = svgUrl;
    });

    const scale = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(rect.width) * scale;
    canvas.height = Math.ceil(rect.height) * scale;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is unavailable.");
    }

    context.scale(scale, scale);
    context.drawImage(image, 0, 0, rect.width, rect.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Failed to encode PNG."));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export async function captureElementAsPng(element: HTMLElement, fileName: string): Promise<void> {
  const blob = await renderElementToBlob(element);
  const blobUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    link.click();
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
