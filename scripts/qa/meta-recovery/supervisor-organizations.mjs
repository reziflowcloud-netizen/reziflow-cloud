// Migration 20260110000000 creates this configuration-only organization even
// in an empty synthetic database. It is not a second permitted customer tenant.
export const EMPTY_DEFAULT_MODELS=Object.freeze(['user','client','case','task','lead','employee','metaLeadAdsBinding','notification','metaLeadAdsDelivery','notificationPreference','notificationPushDelivery','leadChannelRoute','leadChannelRouteMember'])
export function evaluateTenantIsolation({organizationCount,qaMatches,defaultMatches,defaultCounts}){
 if(!Number.isSafeInteger(organizationCount)||organizationCount<0||!defaultCounts||EMPTY_DEFAULT_MODELS.some(key=>!Number.isSafeInteger(defaultCounts[key])||defaultCounts[key]<0))throw Error('QA_TENANT_ISOLATION_REFUSED')
 const defaultOperationalRecords=EMPTY_DEFAULT_MODELS.reduce((sum,key)=>sum+defaultCounts[key],0)
 return Object.freeze({status:organizationCount===2&&qaMatches===true&&defaultMatches===true&&defaultOperationalRecords===0?'PASS':'BLOCKED',organizations:organizationCount,qaOrganizations:qaMatches===true?1:0,migrationDefaultOrganizations:defaultMatches===true?1:0,defaultOperationalRecords})
}
export async function assertQaTenantIsolation(db,qaOrganizationId){
 if(typeof qaOrganizationId!=='string'||!qaOrganizationId||qaOrganizationId==='org_default')throw Error('QA_TENANT_ISOLATION_REFUSED')
 const [organizationCount,qa,defaultOrg]=await Promise.all([
  db.organization.count(),
  db.organization.findUnique({where:{id:qaOrganizationId},select:{name:true}}),
  db.organization.findUnique({where:{id:'org_default'},select:{name:true,slug:true}}),
 ])
 const defaultCounts=Object.fromEntries(await Promise.all(EMPTY_DEFAULT_MODELS.map(async model=>[model,await db[model].count({where:{organizationId:'org_default'}})])))
 const result=evaluateTenantIsolation({organizationCount,qaMatches:qa?.name==='LegalHub Internal QA',defaultMatches:defaultOrg?.name==='ReziFlow Cloud'&&defaultOrg?.slug==='default',defaultCounts})
 if(result.status!=='PASS')throw Error('QA_TENANT_ISOLATION_REFUSED')
 return result
}
