import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Sparkles } from "lucide-react";

export function MirrorGlow(){ return <div className="mirror-glow" aria-hidden="true"/> }
export function MirrorIcon({children}:{children?:ReactNode}){ return <span className="mirror-icon">{children ?? <Sparkles/>}</span> }
export function MirrorCard({className="",children,...props}:HTMLAttributes<HTMLDivElement>){ return <div className={`mirror-card ${className}`} {...props}>{children}</div> }
export function MirrorButton({variant="primary",className="",children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:"primary"|"secondary"|"ghost"}){ return <button className={`mirror-button ${variant} ${className}`} {...props}>{children}</button> }
export function MirrorTile({nameFa,nameEn,icon,selected=false,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{nameFa:string;nameEn:string;icon?:ReactNode;selected?:boolean}){ return <button className={`mirror-tile ${selected?"selected":""}`} {...props}>{icon&&<MirrorIcon>{icon}</MirrorIcon>}<span><b>{nameFa}</b><small dir="ltr">{nameEn}</small></span><i aria-hidden>✦</i></button> }
export function MirrorProgress({value}:{value:number}){ return <div className="mirror-progress" aria-label={`پیشرفت ${value} درصد`}><i style={{width:`${value}%`}}/></div> }
export function MirrorFrame({children,className=""}:{children:ReactNode;className?:string}){ return <div className={`mirror-frame ${className}`}>{children}</div> }
export function MirrorModal({children,onClose}:{children:ReactNode;onClose:()=>void}){ return <div className="mirror-modal-backdrop" role="dialog" aria-modal="true"><MirrorCard className="mirror-modal"><button className="modal-close" onClick={onClose} aria-label="بستن">×</button>{children}</MirrorCard></div> }
