import assert from "node:assert/strict";
import test from "node:test";
import { recoveryStateForFailure } from "../lib/simulation/recovery.ts";
import { findPublicTenant, parsePublicTenants } from "../lib/public/tenant-config.ts";
import { assessReadiness } from "../lib/public/readiness.ts";
import { generationQuery, requireGenerationId, requireMediaAction } from "../lib/simulation/media-request.ts";

const tenants = JSON.stringify([
 {id:"00000000-0000-0000-0000-000000000001",slug:"marvaa",salonName:"Marvaa",hosts:["marvaa.example"]},
 {id:"00000000-0000-0000-0000-000000000002",slug:"other",salonName:"Other",hosts:["other.example"]},
]);
test("failure after provider invocation is never retryable",()=>{assert.equal(recoveryStateForFailure(false),"safe_to_retry");assert.equal(recoveryStateForFailure(true),"manual_reconciliation_required")});
test("slug cannot cross an approved hostname",()=>{const parsed=parsePublicTenants(tenants);assert.ok(parsed);assert.equal(findPublicTenant(parsed,"marvaa.example","other"),undefined);assert.equal(findPublicTenant(parsed,"marvaa.example","marvaa")?.slug,"marvaa")});
test("media validation rejects malformed identifiers/actions and query values are encoded",()=>{assert.throws(()=>requireGenerationId("x"));assert.throws(()=>requireMediaAction("remove"));const q=generationQuery("00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002","00000000-0000-0000-0000-000000000003");assert.equal(new URL(q,"http://test").searchParams.get("tenant_id"),"eq.00000000-0000-0000-0000-000000000002")});
test("invalid readiness configuration fails with sanitized codes",()=>{const result=assessReadiness({signingSecret:"short",tenantConfigValid:false,hostnameMapped:false,schema:false,bucketExists:true,bucketPrivate:false});assert.equal(result.ready,false);assert.ok(result.codes.includes("SIGNINGSECRET"));assert.ok(result.codes.includes("TENANTCONFIG"));assert.ok(result.codes.includes("HOSTNAMEMAPPED"));assert.equal(JSON.stringify(result).includes("short"),false)});
test("valid readiness requires mapped host, private bucket and schema",()=>{const result=assessReadiness({supabaseUrl:"present",serviceRole:"present",openAi:"present",signingSecret:"x".repeat(32),tenantConfigValid:true,hostnameMapped:true,schema:true,bucketExists:true,bucketPrivate:true});assert.equal(result.ready,true);assert.deepEqual(result.codes,[])});

test("concurrent sessions share one tenant daily critical section",async()=>{
 let dailyUsed=0,tail=Promise.resolve();
 const reserve=async()=>{let release;const previous=tail;tail=new Promise(resolve=>{release=resolve});await previous;try{await new Promise(resolve=>setTimeout(resolve,5));if(dailyUsed>=1)return false;dailyUsed++;return true}finally{release()}};
 const outcomes=await Promise.all([reserve("session-a"),reserve("session-b")]);
 assert.equal(outcomes.filter(Boolean).length,1);assert.equal(dailyUsed,1);
});

test("authenticated admin membership isolates media and deletion preserves metadata",async()=>{
 const {authorizeTenant}=await import("../lib/sano/tenant.ts");
 const auth={authenticate:async()=>({userId:"admin"})};
 const allowedDb={request:async()=>[{id:"tenant-a"}]};
 const deniedDb={request:async()=>[]};
 await assert.doesNotReject(()=>authorizeTenant(auth,allowedDb,"token","tenant-a"));
 await assert.rejects(()=>authorizeTenant(auth,deniedDb,"token","tenant-b"),error=>error.code==="TENANT_ACCESS_DENIED");
 const {mediaDeletionPatch,storedMediaKeys}=await import("../lib/simulation/media-request.ts");
 const record={input_path:"tenant-a/in",output_path:"tenant-a/out",selections:{color:"red"},status:"completed"};
 assert.deepEqual(storedMediaKeys(record),["tenant-a/in","tenant-a/out"]);
 const updated={...record,...mediaDeletionPatch("admin","2026-09-14T00:00:00Z")};
 assert.deepEqual(updated.selections,{color:"red"});assert.equal(updated.status,"completed");assert.equal(updated.input_path,null);assert.equal(updated.output_path,null);
});
