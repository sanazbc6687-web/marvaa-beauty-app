import { BeautyProfile,RecommendationMode } from "../recommendation/analysis-types";import { ImageAsset,StyleReference,StyleReferenceImage } from "../types";
export type BeautyImageRequest={primaryImage:ImageAsset;detailImages:ImageAsset[];selectedReferenceImages:StyleReferenceImage[];selectedReferences:StyleReference[];recommendationMode:RecommendationMode;beautyProfile:BeautyProfile;identityPreservationRules:string[];generationPrompt:string};
export type BeautyImageResponse={imageUrl:string;provider:string};
export interface BeautyImageProvider{generate(input:BeautyImageRequest):Promise<BeautyImageResponse>}
export class MockBeautyImageProvider implements BeautyImageProvider{async generate(input:BeautyImageRequest){return{imageUrl:input.primaryImage.dataUrl,provider:"mock"}}}

/** The current state-of-the-art GPT Image model documented by OpenAI. */
export const OPENAI_IMAGE_MODEL="gpt-image-2" as const;

type OpenAIImagesEditResponse={data?:Array<{b64_json?:string}>;error?:{message?:string}};

/**
 * Server-side provider for the Images API edit operation.
 *
 * The image ordering is intentional: the customer's primary image remains the
 * identity source, followed by optional treatment close-ups and then Marvaa's
 * active style references. The prompt builder is responsible for describing
 * the role of each group and for applying recommendation/identity rules.
 */
export class OpenAIBeautyImageProvider implements BeautyImageProvider{
 constructor(private readonly apiKey:string,private readonly fetcher:typeof fetch=fetch){if(!apiKey)throw new Error("OPENAI_API_KEY is required")}
 async generate(input:BeautyImageRequest):Promise<BeautyImageResponse>{
  const form=new FormData();
  form.set("model",OPENAI_IMAGE_MODEL);
  form.set("prompt",input.generationPrompt);
  form.set("input_fidelity","high");
  form.set("quality","high");
  form.set("output_format","png");
  form.append("image[]",dataUrlToFile(input.primaryImage.dataUrl,"customer-identity"));
  input.detailImages.forEach((image,index)=>form.append("image[]",dataUrlToFile(image.dataUrl,`customer-detail-${index+1}`)));
  for(const [index,reference] of input.selectedReferenceImages.entries())form.append("image[]",await urlToFile(reference.imageUrl,`marvaa-reference-${index+1}`,this.fetcher));
  const response=await this.fetcher("https://api.openai.com/v1/images/edits",{method:"POST",headers:{Authorization:`Bearer ${this.apiKey}`},body:form});
  const payload=await response.json() as OpenAIImagesEditResponse;
  if(!response.ok)throw new Error(payload.error?.message||`OpenAI image edit failed (${response.status})`);
  const base64=payload.data?.[0]?.b64_json;
  if(!base64)throw new Error("OpenAI image edit response did not contain data[0].b64_json");
  return{imageUrl:`data:image/png;base64,${base64}`,provider:"openai"};
 }
}

function dataUrlToFile(dataUrl:string,name:string){
 const match=/^data:([^;,]+);base64,(.+)$/.exec(dataUrl);if(!match)throw new Error("INVALID_SIMULATION_IMAGE");
 const bytes=Uint8Array.from(atob(match[2]),character=>character.charCodeAt(0));return new File([bytes],`${name}.${extensionFor(match[1])}`,{type:match[1]});
}
async function urlToFile(url:string,name:string,fetcher:typeof fetch){
 if(url.startsWith("data:"))return dataUrlToFile(url,name);
 const response=await fetcher(url);if(!response.ok)throw new Error(`Unable to load Marvaa reference image (${response.status})`);
 const blob=await response.blob(),type=blob.type||"image/png";return new File([blob],`${name}.${extensionFor(type)}`,{type});
}
function extensionFor(type:string){return type==="image/jpeg"?"jpg":type==="image/webp"?"webp":"png"}
