import { publicRequest, publicStorageUrl } from "@/lib/supabase/client";

export type PublicPortfolioItem={id:string;serviceId:string;titleFa:string;titleEn?:string;description?:string;imageUrl:string;sortOrder:number};
type Row={id:string;service_category_id:string;service_categories:{slug:string}|null;title_fa:string;title_en?:string;description_fa?:string;sort_order:number;portfolio_images:Array<{storage_path:string;is_cover:boolean;sort_order:number}>};

export async function getPublicPortfolio(tenantId:string):Promise<PublicPortfolioItem[]>{
 try{
  const query=new URLSearchParams({select:"id,service_category_id,service_categories(slug),title_fa,title_en,description_fa,sort_order,portfolio_images(storage_path,is_cover,sort_order)",tenant_id:`eq.${tenantId}`,active:"eq.true",order:"sort_order.asc"});
  const rows=await publicRequest<Row[]>(`/rest/v1/portfolio_items?${query}`);
  return rows.flatMap(row=>{const image=[...row.portfolio_images].sort((a,b)=>Number(b.is_cover)-Number(a.is_cover)||a.sort_order-b.sort_order)[0];return image?[{id:row.id,serviceId:row.service_categories?.slug||row.service_category_id,titleFa:row.title_fa,titleEn:row.title_en,description:row.description_fa,imageUrl:publicStorageUrl("salon-portfolio",image.storage_path),sortOrder:row.sort_order}]:[]});
 }catch{return[]}
}
