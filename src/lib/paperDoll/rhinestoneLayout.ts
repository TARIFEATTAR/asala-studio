export interface RhinestoneRecipePoint {
  id: string;
  angleDeg: number;
  heightRatio: number;
  scaleRatio: number;
}

export interface RhinestoneLayoutPoint extends RhinestoneRecipePoint {
  order: number;
  xRatio: number;
}

export function buildRhinestoneLayout(
  recipe: RhinestoneRecipePoint[],
): RhinestoneLayoutPoint[] {
  const ids = new Set<string>();
  return recipe.map((point, order) => {
    if (!point.id) throw new Error("Rhinestone ID is required.");
    if (ids.has(point.id)) throw new Error(`Duplicate rhinestone ID: ${point.id}.`);
    ids.add(point.id);
    if (point.heightRatio < 0 || point.heightRatio > 1) {
      throw new Error(`Rhinestone height ratio must be between 0 and 1: ${point.id}.`);
    }
    if (point.angleDeg < -90 || point.angleDeg > 90) {
      throw new Error(`Rhinestone angle must remain on the visible cap face: ${point.id}.`);
    }
    if (point.scaleRatio <= 0 || point.scaleRatio > 0.25) {
      throw new Error(`Rhinestone scale ratio is invalid: ${point.id}.`);
    }
    return {
      ...point,
      order,
      xRatio: Number((0.5 + Math.sin(point.angleDeg * Math.PI / 180) * 0.42).toFixed(6)),
    };
  });
}
