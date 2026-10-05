import type { Equipment, Exercise, MuscleGroup } from '../types/training';

/** Demonstration media are generated neutral illustrations — not validated medical or coaching guidance. */
export const exercises: Exercise[] = [
{
  id: 'dumbbell-curl',
  name: 'Dumbbell Curl',
  muscles: ['biceps'],
  equipment: 'dumbbell',
  image: "/cb6bfc78-1635-4151-98b8-22d9cec6a2bd.jpg",
  mediaCredit: 'FormLog demo illustration',
  instructions: [
  'Stand tall with a dumbbell in each hand, palms facing forward.',
  'Keep elbows close to your sides and curl the weights toward your shoulders.',
  'Pause briefly at the top, then lower under control to full extension.']

},
{
  id: 'lat-pulldown',
  name: 'Lat Pulldown',
  muscles: ['back', 'biceps'],
  equipment: 'cable',
  image: "/5749119f-cc19-4a6c-b92e-f27befb7ee0e.jpg",
  mediaCredit: 'FormLog demo illustration',
  instructions: [
  'Sit with thighs secured under the pad and grip the bar slightly wider than shoulders.',
  'Pull the bar toward your upper chest, leading with the elbows.',
  'Return the bar upward slowly until your arms are straight.']

},
{
  id: 'goblet-squat',
  name: 'Goblet Squat',
  muscles: ['quads', 'glutes', 'core'],
  equipment: 'dumbbell',
  image: "/929c2b50-e527-431c-9ce7-8959c2282023.jpg",
  mediaCredit: 'FormLog demo illustration',
  instructions: [
  'Hold one dumbbell vertically against your chest, feet about shoulder-width apart.',
  'Sit your hips down and back while keeping your chest up.',
  'Drive through your whole foot to stand back up.']

},
{
  id: 'bench-press',
  name: 'Bench Press',
  muscles: ['chest', 'triceps', 'shoulders'],
  equipment: 'barbell',
  image: "/96881bc5-0c99-45e6-9d6d-3ecd86ad553c.jpg",
  mediaCredit: 'FormLog demo illustration',
  instructions: [
  'Lie on the bench with eyes under the bar and feet planted.',
  'Lower the bar with control to your mid-chest.',
  'Press the bar back up until your arms are straight.']

},
{
  id: 'romanian-deadlift',
  name: 'Romanian Deadlift',
  muscles: ['hamstrings', 'glutes', 'back'],
  equipment: 'barbell',
  image: "/4accd241-989c-499a-9555-8e4b9330f40e.jpg",
  mediaCredit: 'FormLog demo illustration',
  instructions: [
  'Stand holding the bar at hip height with soft knees.',
  'Hinge at the hips, sliding the bar down your thighs with a flat back.',
  'Stop when you feel a stretch, then push your hips forward to stand.']

},
{
  id: 'overhead-press',
  name: 'Overhead Press',
  muscles: ['shoulders', 'triceps'],
  equipment: 'dumbbell',
  image: "/a795464f-a285-46d7-acfc-9c85796102d3.jpg",
  mediaCredit: 'FormLog demo illustration',
  instructions: [
  'Hold dumbbells at shoulder height with palms facing forward.',
  'Brace your core and press the weights overhead.',
  'Lower them back to your shoulders with control.']

},
{
  id: 'seated-cable-row',
  name: 'Seated Cable Row',
  muscles: ['back', 'biceps'],
  equipment: 'cable',
  image: "/9decce05-ea18-4339-a0d1-7d26a6dece4e.jpg",
  mediaCredit: 'FormLog demo illustration',
  instructions: [
  'Sit upright with feet on the platform and a slight bend in the knees.',
  'Pull the handle toward your stomach, squeezing your shoulder blades together.',
  'Extend your arms forward slowly without rounding your back.']

},
{
  id: 'walking-lunge',
  name: 'Walking Lunge',
  muscles: ['quads', 'glutes', 'hamstrings'],
  equipment: 'dumbbell',
  image: "/f5675be9-c68e-4646-a6ad-f8e487825632.jpg",
  mediaCredit: 'FormLog demo illustration',
  instructions: [
  'Hold dumbbells at your sides and step forward into a lunge.',
  'Lower until both knees are bent at about 90 degrees.',
  'Push off the front foot and step through into the next lunge.']

}];


export const muscleGroups: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'core'];
export const equipmentTypes: Equipment[] = ['dumbbell', 'barbell', 'cable', 'machine', 'bodyweight'];