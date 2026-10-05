export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'glutes' | 'core';
export type Equipment = 'dumbbell' | 'barbell' | 'cable' | 'machine' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  muscles: MuscleGroup[];
  equipment: Equipment;
  instructions: string[];
  image: string;
  mediaCredit: string;
}

export interface PlannedSet {
  id: string;
  weight: number | null;
  reps: number | null;
}

export interface FolderExercise {
  id: string;
  exerciseId: string;
  sets: PlannedSet[];
}

export interface WorkoutFolder {
  id: string;
  name: string;
  items: FolderExercise[];
  updatedAt: string;
}

/** An actual dated record. `referenceOnly` marks values noted without claiming they were performed. */
export interface SetRecord {
  id: string;
  exerciseId: string;
  date: string;
  weight: number;
  reps: number;
  note: string;
  referenceOnly: boolean;
}

export interface TrainingState {
  version: 1;
  folders: WorkoutFolder[];
  records: SetRecord[];
  /** Private per-user tutorial links keyed by exercise id. */
  tutorialLinks: Record<string, string>;
}