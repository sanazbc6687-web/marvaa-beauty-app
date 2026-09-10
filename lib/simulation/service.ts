import { GenerationImageInputs, RecommendationMode, StyleReference } from "../types";
import { buildBeautyPrompt, IDENTITY_RULES } from "./prompt-builder";
import {logSupabaseError, publicRequest, publicUpload} from "../supabase/client";
import {getOrCreatePublicSession} from "./public-session";
export type SimulationInput={images:GenerationImageInputs;tenantId:string;serviceCategory:string;selectedOptions:Record<string,string>;selectedReferences:(StyleReference|string)[];recommendationMode?:RecommendationMode;identityPreservationInstructions?:string[]};
export type SimulationResult={generationId:string;sessionId:string;generatedImageUrl:string;status:"completed"|"failed";metadata:{provider:"mock";prompt:string;tenantId:string;createdAt:string};referencesUsed:string[]};
export async function generateBeautySimulation(input:SimulationInput):Promise<SimulationResult>{
 const hydrated=input.selectedReferences.filter((x):x is StyleReference=>typeof x!=="string");
 const metadata={provider:"mock" as const,tenantId:input.tenantId,prompt:buildBeautyPrompt({serviceCategory:input.serviceCategory,selectedOptions:input.selectedOptions,selectedReferences:hydrated,recommendationMode:input.recommendationMode,identityPreservationInstructions:input.identityPreservationInstructions||IDENTITY_RULES}),createdAt:new Date().toISOString()};
 const sessionId=await getOrCreatePublicSession(input.tenantId);
 const categoryId=await resolveCategory(input.tenantId,input.serviceCategory);
 const choiceId=crypto.randomUUID(),generationId=crypto.randomUUID();
 try{await publicRequest("/rest/v1/user_choices",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({id:choiceId,tenant_id:input.tenantId,session_id:sessionId,category_id:categoryId,path:input.recommendationMode?"consult":"self",selections:input.selectedOptions})})}catch(error){logSupabaseError("create public simulation choice",error);throw error}
 const image=dataUrlToBlob(input.images.primaryImage.dataUrl),extension=image.type==="image/png"?"png":image.type==="image/webp"?"webp":"jpg";
 const inputPath=`${input.tenantId}/${sessionId}/input/${crypto.randomUUID()}.${extension}`;
 try{await publicUpload("customer-simulations",inputPath,image)}catch(error){logSupabaseError("upload public simulation input image",error);throw error}
 // The mock has no generated asset. Keeping output_path null avoids treating the input as an AI result.
 try{await publicRequest("/rest/v1/image_generations",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({id:generationId,tenant_id:input.tenantId,session_id:sessionId,choice_id:choiceId,input_path:inputPath,status:"completed",metadata:{...metadata,mockOutput:true}})})}catch(error){logSupabaseError("create public image generation",error);throw error}
 await new Promise(r=>setTimeout(r,2200));
 return{generationId,sessionId,generatedImageUrl:input.images.primaryImage.dataUrl,status:"completed",metadata,referencesUsed:input.selectedReferences.map(x=>typeof x==="string"?x:x.id)}
}

async function resolveCategory(tenantId:string,slug:string){
 if(slug==="recommendation")return null;
 const query=new URLSearchParams({select:"id",tenant_id:`eq.${tenantId}`,slug:`eq.${slug}`,enabled:"eq.true",limit:"1"});
 const rows=await publicRequest<{id:string}[]>(`/rest/v1/service_categories?${query}`);
 return rows[0]?.id||null;
}

function dataUrlToBlob(dataUrl:string){
 const match=/^data:([^;,]+);base64,(.+)$/.exec(dataUrl);if(!match)throw new Error("INVALID_SIMULATION_IMAGE");
 const bytes=Uint8Array.from(atob(match[2]),character=>character.charCodeAt(0));return new Blob([bytes],{type:match[1]});
}

export async function favoriteBeautySimulation(tenantId:string,sessionId:string,generationId:string){
 try{
  const liked=await publicRequest<boolean>("/rest/v1/rpc/like_demo_public_generation",{method:"POST",body:JSON.stringify({requested_tenant_id:tenantId,requested_session_id:sessionId,requested_generation_id:generationId})});
  if(!liked)throw new Error("FAVORITE_NOT_ALLOWED");
 }catch(error){logSupabaseError("favorite public image generation",error);throw error}
}
