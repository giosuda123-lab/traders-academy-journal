// Trader's Academy: signed Bunny Stream player URLs for enrolled students.
// Deploy as a Supabase Edge Function named "course-playback".
// Requires BUNNY_STREAM_TOKEN_KEY in Supabase Function Secrets.
// NEVER paste this key into GitHub, HTML, or browser JavaScript.
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = "https://tradersacademy.ge";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8",
};
function response(message: string, status=200){
  return new Response(JSON.stringify({ message }), { status, headers: cors });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST") return response("Method not allowed",405);
  const origin=req.headers.get("origin");
  if(origin && origin!==allowedOrigin && origin!=="https://www.tradersacademy.ge") return response("Origin not allowed",403);
  try {
    const authHeader=req.headers.get("authorization")||"";
    if(!authHeader.startsWith("Bearer "))return response("Login required",401);
    const jwt=authHeader.slice(7);
    const url=Deno.env.get("SUPABASE_URL");
    const publicKey=Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const signingKey=Deno.env.get("BUNNY_STREAM_TOKEN_KEY");
    if(!url || !publicKey || !signingKey) return response("Server is not configured",503);
    const userClient=createClient(url,publicKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:auth,error:authError}=await userClient.auth.getUser(jwt);
    if(authError || !auth.user)return response("Invalid login",401);
    const body=await req.json().catch(()=>null);
    const lessonId=body?.lesson_id;
    if(typeof lessonId!=="string" || !/^[0-9a-f-]{36}$/i.test(lessonId))return response("Invalid lesson",400);
    const {data:lesson,error:lessonError}=await userClient.from("course_lessons").select("id,module_id").eq("id",lessonId).maybeSingle();
    if(lessonError||!lesson)return response("Lesson is not available",403);
    // Authenticated RPC checks enrollment inside Postgres, without relying on
    // service-role API credentials or exposing the private mapping table.
    const {data:videoId,error:videoError}=await userClient.rpc("ta_course_video_id",{p_lesson_id:lessonId});
    if(videoError){
      console.error("Video RPC lookup error:",videoError.message);
      return response("Video lookup failed",500);
    }
    if(!videoId)return response("Video is not attached or access is denied",404);
    const expires=Math.floor(Date.now()/1000)+3600;
    const toSign=new TextEncoder().encode(signingKey+videoId+String(expires));
    const digest=await crypto.subtle.digest("SHA-256",toSign);
    const token=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,"0")).join("");
    const library="813673";
    const playerUrl=new URL("https://player.mediadelivery.net/embed/"+library+"/"+videoId);
    playerUrl.searchParams.set("token",token);
    playerUrl.searchParams.set("expires",String(expires));
    playerUrl.searchParams.set("autoplay","false");
    playerUrl.searchParams.set("showSpeed","true");
    playerUrl.searchParams.set("rememberPosition","true");
    return new Response(JSON.stringify({url:playerUrl.toString(),expires}),{status:200,headers:{...cors,"Cache-Control":"no-store"}});
  } catch(e){
    console.error("course-playback request failed",e instanceof Error?e.message:"unknown");
    return response("Playback temporarily unavailable",500);
  }
});
