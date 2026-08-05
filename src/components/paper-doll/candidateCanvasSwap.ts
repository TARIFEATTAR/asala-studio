export async function prepareCandidateCanvasSwap<TInput, TOutput>(
  items: readonly TInput[],
  load: (item: TInput) => Promise<TOutput>,
): Promise<Array<NonNullable<TOutput>>> {
  const loaded = await Promise.all(items.map((item) => load(item)));
  if (loaded.some((item) => item == null)) {
    throw new Error("A private layer failed to load; the previous complete canvas must remain mounted.");
  }
  return loaded as Array<NonNullable<TOutput>>;
}
