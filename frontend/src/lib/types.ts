
export interface User {
  id: string
  username: string
  email: string
  teamCode: string
  leetcode_username: string
}

export interface Submission {
  id: string;
  problem: string;
  status: "AC" | "WA" | "TLE"; // Puedes extender con más estados si lo necesitas
  time: string;
  member: string;
  points: number
};

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

export interface Competition {
  id: string;
  title: string;
  description: string;
  date: Date;
  status: "active" | "inactive" | "completed" | "upcoming"; // Puedes ajustar los estados válidos
  duration: number; // Ej: "2 horas", o puedes normalizarlo a minutos si prefieres
  teams: string[]; // Número total de equipos participantes
  maxTeamSize: number
  problems: Problem[]; // Número total de problemas en la competencia
  rules: string[]; // Lista de reglas como texto plano
  scoring: {
    easy: number;
    medium: number;
    hard: number;
  };
}

export interface Problem {
  id: string
  title: string
  difficulty: "easy" | "medium" | "hard"
  url: string
  slug: string
  isValid: boolean
  isValidating: boolean
}