export type ReadinessInput = { supabaseUrl?: string; serviceRole?: string; signingSecret?: string; openAi?: string; tenantConfigValid: boolean; hostnameMapped: boolean; schema: boolean; bucketExists: boolean; bucketPrivate: boolean };
export function assessReadiness(input: ReadinessInput) {
  const checks = { supabaseUrl:Boolean(input.supabaseUrl),serviceRole:Boolean(input.serviceRole),openAi:Boolean(input.openAi),signingSecret:Boolean(input.signingSecret&&input.signingSecret.length>=32),tenantConfig:input.tenantConfigValid,hostnameMapped:input.hostnameMapped,schema:input.schema,customerBucketExists:input.bucketExists,customerBucketPrivate:input.bucketPrivate };
  return {ready:Object.values(checks).every(Boolean),checks,codes:Object.entries(checks).filter(([,ok])=>!ok).map(([code])=>code.toUpperCase())};
}
