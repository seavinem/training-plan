export type DayId = "A" | "B" | "C";

export type RampSet = {
  reps: number;
  weightKg: number;
};

export type Exercise = {
  id: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  weightKg: number;
  rir: string;
  restSec: number;
  incrementKg: number;
  clusterPair?: string;
  clusterAfterPair?: boolean;
};

export type DayProgram = {
  ramp?: {
    exerciseId: string;
    sets: RampSet[];
    restSec: number;
  };
  exercises: Exercise[];
};

export type Program = {
  cycle: number;
  warmup: { bikeMin: number; hyper: string };
  days: Record<DayId, DayProgram>;
};

export type Weights = Record<string, number>;

export type LoggedSet = {
  weightKg: number;
  reps: number;
  ramp?: boolean;
};

export type ExerciseLog = {
  id: string;
  sets: LoggedSet[];
};

export type Session = {
  date: string;
  day: DayId;
  cycle: number;
  exercises: ExerciseLog[];
  completedAt?: string;
  durationSec?: number;
};

export type QueueWarmup = { type: "warmup" };

export type QueueSet = {
  type: "set";
  exerciseId: string;
  name: string;
  setNumber: number;
  totalSets: number;
  kind: "ramp" | "work";
  targetWeightKg: number;
  repsMin: number;
  repsMax: number;
  rir?: string;
  restAfterSec: number;
};

export type QueueItem = QueueWarmup | QueueSet;

export type View = "home" | "workout" | "rest" | "summary" | "chat";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  state?: "sending" | "sent" | "failed";
};

export type DraftSession = {
  date: string;
  day: DayId;
  cycle: number;
  startedAt?: number;
  queueIndex: number;
  logs: ExerciseLog[];
  currentWeightKg: number;
  currentReps: number;
  phase: "workout" | "rest" | "summary";
  restEndsAt?: number;
  restTotalSec?: number;
  restDoneIndex?: number;
  confirmedWeights: Weights;
  weightsTouched?: string[];
};

export type PendingRemote = {
  program: Program | null;
  weights: Weights | null;
};

export type ActiveRun = {
  agentId: string;
  runId: string;
  startedAt: number;
  baseSha?: string;
  messageId?: string;
};
