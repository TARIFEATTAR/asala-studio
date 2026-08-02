export async function prepareCandidateCanvasSwap<TInput, TOutput>(
  items: readonly TInput[],
  load: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  return Promise.all(items.map((item) => load(item)));
}
