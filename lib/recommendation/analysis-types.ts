export type Observation<T=string>={value:T|"unknown";confidence:number;followUpQuestion?:string};
export type RecommendationMode="subtle"|"enhanced"|"bold";
export const recommendationModes={subtle:{fa:"طبیعی",intensity:25},enhanced:{fa:"متعادل",intensity:55},bold:{fa:"جسورانه",intensity:82}} as const;
export type BeautyProfile=Partial<Record<"faceShape"|"faceLengthWidthRatio"|"foreheadProfile"|"jawProfile"|"skinVisualDepth"|"skinUndertone"|"naturalContrast"|"eyeShape"|"eyeSpacing"|"outerCornerDirection"|"lidSpace"|"browDensity"|"browShape"|"browGaps"|"browAsymmetry"|"lipShape"|"lipNaturalTone"|"lipSymmetry"|"hairCurrentColor"|"hairLength"|"hairTexture"|"hairDensity"|"nailBedWidth"|"nailCurrentLength"|"fingerProportion"|"userGoal"|"preferredIntensity"|"maintenanceTolerance",Observation>>;
export type CandidateScores={harmony:number;preference:number;feasibility:number;changeIntensity:number;confidence:number};
