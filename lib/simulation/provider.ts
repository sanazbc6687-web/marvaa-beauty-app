import { BeautyProfile,RecommendationMode } from "../recommendation/analysis-types";import { ImageAsset,StyleReference,StyleReferenceImage } from "../types";
export type BeautyImageRequest={primaryImage:ImageAsset;detailImages:ImageAsset[];selectedReferenceImages:StyleReferenceImage[];selectedReferences:StyleReference[];recommendationMode:RecommendationMode;beautyProfile:BeautyProfile;identityPreservationRules:string[];generationPrompt:string};
export type BeautyImageResponse={imageUrl:string;provider:string};
export interface BeautyImageProvider{generate(input:BeautyImageRequest):Promise<BeautyImageResponse>}
export class MockBeautyImageProvider implements BeautyImageProvider{async generate(input:BeautyImageRequest){return{imageUrl:input.primaryImage.dataUrl,provider:"mock"}}}
