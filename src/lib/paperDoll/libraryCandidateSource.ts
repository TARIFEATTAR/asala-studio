export interface ImageLibraryCandidateSelection {
  url: string;
  name?: string;
}

function fileName(name: string | undefined, contentType: string): string {
  const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
  if (!name) return `image-library-candidate.${extension}`;
  return /\.[a-z0-9]+$/i.test(name) ? name : `${name}.${extension}`;
}

/** Converts a chosen Image Library record into the established manual-upload File contract. */
export async function downloadImageLibraryCandidate(
  selection: ImageLibraryCandidateSelection,
  fetchImpl: typeof fetch = fetch,
): Promise<File> {
  const response = await fetchImpl(selection.url);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].toLowerCase() ?? "";
  if (!response.ok || !contentType.startsWith("image/")) {
    throw new Error("The selected Image Library asset could not be downloaded as an image.");
  }
  const bytes = await response.arrayBuffer();
  return new File([bytes], fileName(selection.name, contentType), { type: contentType });
}
