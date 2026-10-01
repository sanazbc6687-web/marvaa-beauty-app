import { demoTenant } from "@/lib/tenant";
export function Brand({admin=false}:{admin?:boolean}){return <div className="brand"><span className="brand-mark">✦</span><span><b>{demoTenant.consultant.englishName}</b><small>{admin?"Mirror Control Room":demoTenant.consultant.title}</small></span><small className="sano-micro">Powered by SANO</small></div>}
