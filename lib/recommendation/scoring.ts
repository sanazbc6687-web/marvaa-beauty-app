import { CandidateScores } from "./analysis-types";
export const clampScore=(value:number)=>Math.max(0,Math.min(100,Math.round(value)));
export function weightedScore(s:CandidateScores){return clampScore(s.harmony*.3+s.preference*.3+s.feasibility*.2+s.changeIntensity*.1+s.confidence*.1)}
