import { nutritionCopy } from "./copy";
import type { Language } from "../types/accounts";
export function NutritionConflictFields({
  data,
  language,
}: {
  data: Record<string, unknown>;
  language: Language;
}) {
  const c = nutritionCopy[language];
  const labels: Record<string, string> = {
    name: c.name,
    portion_g: c.portion,
    local_date: c.date,
    effective_date: c.effective,
    goal: c.goal,
    goal_snapshot: c.goal,
    calories_kcal: c.calories_kcal,
    protein_g: c.protein_g,
    carbs_g: c.carbs_g,
    fat_g: c.fat_g,
    calorie_target: c.calories_kcal,
    protein_target: c.protein_g,
    carb_target: c.carbs_g,
    fat_target: c.fat_g,
    brand_source: c.source,
    notes: c.notes,
    status: c.status,
  };
  return (
    <dl className="version-fields">
      {Object.entries(labels)
        .filter(([key]) => key in data)
        .map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {data[key] == null
                ? c.unknown
                : key === "status"
                  ? data[key] === "draft"
                    ? c.draft
                    : c.complete
                  : key === "goal" || key === "goal_snapshot"
                    ? data[key] === "cutting"
                      ? c.cutting
                      : c.bulking
                    : String(data[key])}
            </dd>
          </div>
        ))}
    </dl>
  );
}
