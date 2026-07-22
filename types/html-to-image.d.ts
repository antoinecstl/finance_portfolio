declare module 'html-to-image' {
  export function toBlob(node: HTMLElement, options?: { pixelRatio?: number; cacheBust?: boolean; backgroundColor?: string }): Promise<Blob | null>;
}
