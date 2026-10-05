import { subDays } from 'date-fns';
import { toDateKey } from '../utils/dates';
import type { DayLog, NutrientValues, NutritionState, Targets } from '../types/nutrition';

/** Illustrative values entered by a demo user — not dietary recommendations. */
export const seedTargets: Targets = { calories: 2500, protein: 150, carbs: 300, fat: 70 };

interface SeedFood {
  name: string;
  weightGrams: number | null;
  nutrients: NutrientValues;
  brand?: string;
}

const n = (calories: number | null, protein: number | null, carbs: number | null, fat: number | null): NutrientValues => ({
  calories,
  protein,
  carbs,
  fat
});

/** Days before today → foods logged. `[]` means the log was opened but nothing recorded. Missing day = no log. */
export const seedDays: {daysAgo: number;foods: SeedFood[];}[] = [
{ daysAgo: 0, foods: [{ name: 'Greek yogurt with berries', weightGrams: 250, nutrients: n(200, 20, 15, 7), brand: 'Homemade' }] },
{
  daysAgo: 1,
  foods: [
  { name: 'Oats with milk', weightGrams: 280, nutrients: n(420, 18, 62, 10) },
  { name: 'Chicken rice bowl', weightGrams: 450, nutrients: n(780, 52, 88, 18), brand: 'Office canteen' },
  { name: 'Protein shake', weightGrams: 330, nutrients: n(240, 40, 9, 4) },
  { name: 'Pasta bolognese', weightGrams: 400, nutrients: n(820, 38, 96, 28) },
  { name: 'Dates', weightGrams: 60, nutrients: n(170, 1, 45, 0) },
  { name: 'Almonds', weightGrams: 30, nutrients: n(175, 6, 6, 15) }]

},
{
  daysAgo: 2,
  foods: [
  { name: 'Eggs and toast', weightGrams: 210, nutrients: n(420, 24, 38, 18) },
  { name: 'Tuna salad', weightGrams: 320, nutrients: n(380, 36, 14, 20) },
  { name: 'Salmon with potatoes', weightGrams: 420, nutrients: n(650, 42, 55, 26) },
  { name: 'Greek yogurt', weightGrams: 170, nutrients: n(150, 15, 10, 4) }]

},
{
  daysAgo: 4,
  foods: [
  { name: 'Overnight oats', weightGrams: 300, nutrients: n(380, 20, 52, 9) },
  { name: 'Lentil soup', weightGrams: 400, nutrients: n(310, 18, 45, 6) },
  { name: 'Beef burrito', weightGrams: 380, nutrients: n(720, 40, 78, 26) }]

},
{ daysAgo: 5, foods: [] },
{
  daysAgo: 6,
  foods: [
  { name: 'Banana smoothie', weightGrams: 400, nutrients: n(300, 22, 40, 6) },
  { name: 'Chicken shawarma wrap', weightGrams: 350, nutrients: n(650, 35, 60, null) },
  { name: 'Rice and grilled chicken', weightGrams: 420, nutrients: n(700, 45, 85, 16) }]

}];


export function createSeedState(now: Date = new Date()): NutritionState {
  const logs: Record<string, DayLog> = {};
  const stamp = now.toISOString();
  for (const day of seedDays) {
    const date = toDateKey(subDays(now, day.daysAgo));
    logs[date] = {
      date,
      targets: { ...seedTargets },
      createdAt: stamp,
      entries: day.foods.map((food, i) => ({
        id: `seed-${date}-${i}`,
        date,
        name: food.name,
        weightGrams: food.weightGrams,
        nutrients: food.nutrients,
        brand: food.brand ?? '',
        notes: '',
        status: Object.values(food.nutrients).some((v) => v === null) ? 'draft' : 'complete',
        createdAt: stamp,
        updatedAt: stamp
      }))
    };
  }
  return { version: 1, defaultTargets: { ...seedTargets }, logs };
}