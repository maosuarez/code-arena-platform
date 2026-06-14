
export interface User {
  id: string
  username: string
  email: string
  teamCode: string
  leetcode_username: string
  is_admin: boolean
}

export interface Submission {
  id: string;
  problem: string;
  status: "AC" | "WA" | "TLE";
  time: string;
  member: string;
  points: number
}

export interface TeamCode {
  id: string
  code: string
  teamName: string
  avatar: string
  color: string
  maxMembers: number
  currentMembers: number
  submissions: Submission[]
  points: number
}

export interface Problem {
  id: string
  title: string
  difficulty: "easy" | "medium" | "hard"
  statement: string
  language_ids: number[]
  time_limit?: number
  memory_limit?: number
  hidden_instructions?: string
}

export interface Competition {
  id: string;
  title: string;
  description: string;
  date: Date;
  status: "active" | "inactive" | "completed" | "upcoming";
  duration: number;
  teams: string[];
  maxTeamSize: number
  problems: Problem[];
  rules: string[];
  scoring: {
    easy: number;
    medium: number;
    hard: number;
  };
  start_time?: string;
  end_time?: string;
}

export const LANGUAGE_NAMES: Record<number, string> = {
  71: "Python 3",
  62: "Java",
  54: "C++",
  63: "JavaScript",
}

// Maze types
export interface MazeNode {
  id: string
  label: string
  x: number
  y: number
}

export interface MazeDoor {
  id: string
  from_node: string
  to_node: string
  cost: number
  label: string
}

export interface MazeConfig {
  competitionId: string
  nodes: MazeNode[]
  doors: MazeDoor[]
  startNodeId: string
  goalNodeId: string
}

export interface TeamMazeState {
  teamCode: string
  teamName: string
  avatar: string
  currentNodeId: string
  unlockedDoors: string[]
  spentPoints: number
  earnedPoints: number
  availablePoints: number
}

export interface MazeState {
  config: MazeConfig
  teams: TeamMazeState[]
}
