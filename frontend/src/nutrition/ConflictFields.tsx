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

export function nutritionConflictMessage(
  code: string | undefined,
  language: Language,
) {
  const messages: Record<string, Record<Language, string>> = {
    effective_date_exists: {
      en: "A schedule already exists for this date. Your values remain saved. Recover this version as a draft, then open the existing schedule to make an explicit correction.",
      ar: "يوجد جدول أهداف لهذا التاريخ. تبقى قيمك محفوظة. استعد هذه النسخة كمسودة ثم افتح الجدول الموجود لتصحيحه صراحةً.",
    },
    future_day: {
      en: "Future food dates are outside this release. Recover your saved values as a draft for an eligible date.",
      ar: "تواريخ الطعام المستقبلية خارج هذا الإصدار. استعد القيم المحفوظة كمسودة لتاريخ مسموح.",
    },
    invalid_payload: {
      en: "Some fields need correction. Your local values remain recoverable as a draft.",
      ar: "تحتاج بعض الحقول إلى تصحيح. تبقى قيمك المحلية قابلة للاستعادة كمسودة.",
    },
    invalid_day: {
      en: "The selected day is unavailable. Recover the saved food as a new draft on an active day.",
      ar: "اليوم المحدد غير متاح. استعد الطعام المحفوظ كمسودة جديدة في يوم متاح.",
    },
  };
  return code ? messages[code]?.[language] : undefined;
}
