import { BeautyProfile } from "./analysis-types";
export function nextFollowUp(profile:BeautyProfile,keys:(keyof BeautyProfile)[]){for(const key of keys){const observation=profile[key];if(!observation||observation.value==="unknown"||observation.confidence<.55)return observation?.followUpQuestion||`برای پیشنهاد دقیق‌تر، درباره ${String(key)} چه ترجیحی دارید؟`}return undefined}
