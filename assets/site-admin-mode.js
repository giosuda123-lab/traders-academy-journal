/* Trader's Academy inline administrator mode.
 * Public text overrides are stored under admin RLS; no HTML is injected.
 * Course lesson editing is handled by Learning Terminal's own authenticated editor. */
(function(){
'use strict';
if(window.TAInlineAdmin)return;
const DB_URL='https://wodwjidgyztutjmopjga.supabase.co';
const DB_KEY='sb_publishable_rcMEGjuzhrugF4UiMmfr8g_5ciBAbu-';
let db=null,enabled=false,verified=false,working=false;
const isCourse=location.pathname.startsWith('/learn/');
const isJournal=location.pathname.startsWith('/journal/');
const isAdminPage=location.pathname.startsWith('/admin/');
const excluded=/\/(account|login)(\/|\.html|$)/;
const state={edits:new Map(),elements:new Map(),saveQueue:Promise.resolve()};
const getDb=()=>db||(db=(window.TA?.sb||window.supabase.createClient(DB_URL,DB_KEY)));
const pathKey=()=>location.pathname.replace(/\/$/,'/index.html');
const msg=text=>{const el=document.getElementById('ta-inline-admin-status');if(el)el.textContent=text};
function emit(){window.dispatchEvent(new CustomEvent('ta-admin-mode-change',{detail:{enabled,verified}}))}
function button(text,handler){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',handler);return b}
function getCandidates(){
 if(isCourse||isJournal||isAdminPage||excluded.test(location.pathname))return [];
 const main=document.querySelector('main');if(!main)return [];
 return [...main.querySelectorAll('h1,h2,h3,p,.eyebrow')]
 .filter(el=>!el.closest('a,button,form,.count-up,.ticker-wrap,.ta-inline-admin')&&!el.parentElement?.closest('[contenteditable="true"]')&&el.children.length===0&&el.textContent.trim().length>0&&el.textContent.trim().length<=1800);
}
function labelTargets(){
 state.elements.clear();
 const elements=getCandidates();
 elements.forEach((el,i)=>{
   const key='text-'+i;
   state.elements.set(key,el);
   el.dataset.taInlineKey=key;
   if(state.edits.has(key)&&document.activeElement!==el)el.textContent=state.edits.get(key);
   el.contentEditable=String(enabled);
   el.spellcheck=enabled;
   el.classList.toggle('ta-inline-editable',enabled);
   if(enabled&&!el.dataset.taEditBound){
     el.dataset.taEditBound='yes';
     el.addEventListener('focus',()=>{el.dataset.taOld=el.textContent;msg('ტექსტის შესაცვლელად აკრიფე ცვლილება. შენახვა — ზედა ღილაკით.')});
     el.addEventListener('input',()=>{el.dataset.taDirty='yes';msg('შესანახი ცვლილებებია')});
     el.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();el.textContent=el.dataset.taOld||'';delete el.dataset.taDirty;el.blur()}});
   }
 });
}
async function loadPublicTexts(){
 if(isCourse||isJournal||isAdminPage||excluded.test(location.pathname))return;
 try{
   const {data,error}=await getDb().from('site_inline_content').select('element_key,content').eq('page_path',pathKey());
   if(error){console.warn('Inline content unavailable:',error.message);return}
   state.edits=new Map((data||[]).map(x=>[x.element_key,x.content]));
   labelTargets();
 }catch(e){console.warn('Inline content read failed',e)}
}
async function savePublicTexts(){
 if(!enabled)return;
 const candidates=[...state.elements.entries()].filter(([,el])=>el.dataset.taDirty==='yes');
 if(!candidates.length){msg('შესანახი ცვლილებები არ არის');return}
 working=true;msg('ინახება...');
 try{
   for(const [key,el] of candidates){
     const value=el.textContent.trim();
     if(value.length>1800)throw new Error('ტექსტი მეტისმეტად გრძელია (მაქსიმუმ 1800 სიმბოლო)');
     const {error}=await getDb().from('site_inline_content').upsert({
       page_path:pathKey(),element_key:key,content:value,updated_at:new Date().toISOString()
     },{onConflict:'page_path,element_key'});
     if(error)throw error;
     state.edits.set(key,value);delete el.dataset.taDirty;
   }
   msg('საიტზე შენახულია ✓');
 }catch(e){msg('შენახვა ვერ მოხერხდა: '+e.message)}
 finally{working=false}
}
function toggle(){
 if(!verified||working)return;
 enabled=!enabled;
 try{sessionStorage.setItem('ta-admin-edit-mode',enabled?'1':'0')}catch{}
 document.documentElement.classList.toggle('ta-edit-mode',enabled);
 labelTargets();
 const b=document.getElementById('ta-inline-admin-toggle');
 if(b){b.textContent=enabled?'✓ რედაქტირების დასრულება':'✎ ადმინ რეჟიმი';b.setAttribute('aria-pressed',String(enabled))}
 const save=document.getElementById('ta-inline-admin-save');if(save)save.hidden=!enabled||isJournal||isAdminPage;
 msg(enabled?(isJournal||isAdminPage?'ადმინ რეჟიმი ჩართულია — სრული მართვა ხელმისაწვდომია ადმინისტრირებაში.':'ადმინ რეჟიმი ჩართულია. ცვლილებები უნდა შეინახო.'):'ადმინ რეჟიმი გამორთულია');
 emit();
}
function toolbar(){
 if(document.getElementById('ta-inline-admin'))return;
 const host=document.createElement('aside');host.id='ta-inline-admin';host.className='ta-inline-admin';
 host.setAttribute('aria-label','ადმინისტრატორის სწრაფი კონტროლი');
 const toggleBtn=button('✎ ადმინ რეჟიმი',toggle);toggleBtn.id='ta-inline-admin-toggle';toggleBtn.setAttribute('aria-pressed','false');
 const saveBtn=button('✓ შენახვა',()=>isCourse?window.dispatchEvent(new CustomEvent('ta-inline-admin-save-course')):savePublicTexts());
 saveBtn.id='ta-inline-admin-save';saveBtn.hidden=true;
 const adminLink=document.createElement('a');adminLink.href='/admin/';adminLink.textContent='⚙ ადმინისტრირება';adminLink.title='სრული ადმინისტრირება';
 const status=document.createElement('span');status.id='ta-inline-admin-status';status.setAttribute('role','status');
 host.append(toggleBtn,saveBtn,adminLink,status);document.body.append(host);
}
async function init(){
 if(!window.supabase?.createClient)return;
 // Public visitors must see admin-published text even without login.
 await loadPublicTexts();
 try{
   const {data,error}=await getDb().auth.getUser();
   if(error||!data?.user)return;
   const {data:profile,error:profileError}=await getDb().from('profiles').select('is_admin').eq('id',data.user.id).maybeSingle();
   if(profileError||!profile?.is_admin)return;
   verified=true;toolbar();
   try{if(!enabled&&sessionStorage.getItem('ta-admin-edit-mode')==='1')toggle()}catch{}
 }catch(e){console.warn('Admin toolbar unavailable:',e)}
}
window.TAInlineAdmin={init,loadPublicTexts,active:()=>enabled};
function start(){
 init();
 // Supports login on the same page, not only a full reload.
 try{getDb().auth.onAuthStateChange((event)=>{
   if(event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(()=>{
     if(event==='SIGNED_OUT'){
       verified=false;enabled=false;try{sessionStorage.removeItem('ta-admin-edit-mode')}catch{}document.getElementById('ta-inline-admin')?.remove();
       document.documentElement.classList.remove('ta-edit-mode');
       labelTargets();
     }else init();
   },0);
 })}catch{}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
