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
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const signingKey=Deno.env.get("BUNNY_STREAM_TOKEN_KEY");
    if(!url || !publicKey || !serviceKey || !signingKey) return response("Server is not configured",503);
    const userClient=createClient(url,publicKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:auth,error:authError}=await userClient.auth.getUser(jwt);
    if(authError || !auth.user)return response("Invalid login",401);
    const body=await req.json().catch(()=>null);
    const lessonId=body?.lesson_id;
    if(typeof lessonId!=="string" || !/^[0-9a-f-]{36}$/i.test(lessonId))return response("Invalid lesson",400);
    const {data:lesson,error:lessonError}=await userClient.from("course_lessons").select("id,module_id").eq("id",lessonId).maybeSingle();
    if(lessonError){console.error("Lesson lookup error:",lessonError.message);return response("Lesson lookup failed",500);}
    if(!lesson)return response("Lesson is not available",403);
    // The authenticated user already has RLS-limited visibility of the curriculum.
    // Avoid a separate privileged client for the module read.
    const {data:module,error:moduleError}=await userClient.from("course_modules").select("course_id").eq("id",lesson.module_id).maybeSingle();
    if(moduleError){console.error("Module lookup error:",moduleError.message);return response("Module lookup failed",500);}
    if(!module)return response("Course module is not available",403);
    const {data:grant,error:grantError}=await userClient.from("course_enrollments")
      .select("course_id").eq("course_id",module.course_id).eq("user_id",auth.user.id).maybeSingle();
    if(grantError){console.error("Enrollment lookup error:",grantError.message);return response("Enrollment lookup failed",500);}
    if(!grant)return response("No course access",403);
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:video,error:videoError}=await admin.from("course_lesson_videos")
      .select("bunny_video_id").eq("lesson_id",lessonId).maybeSingle();
    if(videoError){console.error("Video lookup error:",videoError.message);return response("Video lookup failed",500);}
    if(!video)return response("Video is not attached",404);
    const videoId=video.bunny_video_id;
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
