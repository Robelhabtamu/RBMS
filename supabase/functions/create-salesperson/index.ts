import { createClient } from 'npm:@supabase/supabase-js@2.55.0'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
}
const response=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return response({error:'Method not allowed.'},405)
  const url=Deno.env.get('SUPABASE_URL');const anon=Deno.env.get('SUPABASE_ANON_KEY');const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!anon||!serviceRole)return response({code:'SERVER_CONFIGURATION_ERROR',error:'Server configuration is incomplete.'},500)
  const authorization=req.headers.get('Authorization')
  if(!authorization)return response({code:'AUTHORIZATION_MISSING',error:'Authorization header is required.'},401)
  const match=authorization.match(/^Bearer\s+(.+)$/i)
  if(!match)return response({code:'AUTHORIZATION_INVALID',error:'Authorization must contain a Bearer user access token.'},401)
  const accessToken=match[1].trim()
  const service=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
  const callerClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${accessToken}`}},auth:{persistSession:false,autoRefreshToken:false}})
  const{data:userData,error:userError}=await callerClient.auth.getUser(accessToken)
  console.log({caller_user_id:userData.user?.id??null})
  if(userError||!userData.user)return response({code:'USER_JWT_INVALID',error:'The signed-in user session is invalid or expired.'},401)
  // Read only the caller's own profile through normal authenticated RLS. The
  // service role is deliberately not used for this authorization decision.
  const{data:caller,error:profileError}=await callerClient.from('profiles').select('role,status').eq('id',userData.user.id).maybeSingle()
  console.log({caller_user_id:userData.user.id,profile_found:Boolean(caller),profile_role:caller?.role??null,profile_status:caller?.status??null})
  if(profileError)return response({code:'PROFILE_LOOKUP_FAILED',error:'The caller profile could not be verified.'},500)
  if(!caller)return response({code:'PROFILE_NOT_FOUND',error:'No caller profile exists for this authenticated user.'},403)
  if(caller.status!=='ACTIVE')return response({code:'PROFILE_INACTIVE',error:'The caller account is inactive.'},403)
  if(caller.role!=='ADMIN')return response({code:'ADMIN_REQUIRED',error:'The caller is not authorized as an Admin.'},403)
  let input:{fullName?:unknown;email?:unknown;password?:unknown;status?:unknown}
  try{input=await req.json()}catch{return response({error:'Invalid request.'},400)}
  const fullName=typeof input.fullName==='string'?input.fullName.trim():'';const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';const password=typeof input.password==='string'?input.password:'';const status=input.status==='INACTIVE'?'INACTIVE':'ACTIVE'
  if(!fullName||!/^\S+@\S+\.\S+$/.test(email)||password.length<8)return response({error:'Full name, valid email, and a password of at least 8 characters are required.'},400)
  const{data:created,error:createError}=await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName}})
  if(createError||!created.user)return response({code:createError?.code==='email_exists'?'EMAIL_EXISTS':'AUTH_USER_CREATION_FAILED',error:createError?.code==='email_exists'?'An account with this email already exists.':'Supabase Auth could not create the salesperson account.'},400)
  const{error:profileSetupError}=await service.from('profiles').update({full_name:fullName,email_snapshot:email,role:'SALESPERSON',status}).eq('id',created.user.id)
  if(profileSetupError){await service.auth.admin.deleteUser(created.user.id);return response({error:'Unable to create salesperson profile.'},500)}
  await service.from('audit_logs').insert({actor_user_id:userData.user.id,entity_type:'salesperson_accounts',entity_id:created.user.id,action:'ACCOUNT_CREATED',new_values:{email,full_name:fullName,role:'SALESPERSON',status}})
  return response({salesperson:{id:created.user.id,email,fullName,status}},201)
})
