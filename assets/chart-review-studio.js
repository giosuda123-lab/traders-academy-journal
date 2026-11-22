/* Trader's Academy Chart Review Studio — original canvas tools.
   All annotations use image-pixel coordinates. No remote editor dependencies. */
(function(){
'use strict';
const PALETTE=['#E6B94D','#65B8FF','#52D5A3','#FF6F76','#D89AFF','#FFFFFF','#111111'];
const COPY_LIMIT=1200,MAX_MM_LEVELS=16;
const DEFAULT_MM=[1,.5,0].map(value=>({value,visible:true,color:null}));
const cleanLevel=x=>({value:Number.isFinite(Number(typeof x==='number'?x:x?.value))?Math.max(-5,Math.min(5,Number(typeof x==='number'?x:x?.value))):0,visible:typeof x==='number'?true:x?.visible!==false,color:typeof x==='number'?null:(/^#[0-9a-fA-F]{6}$/.test(x?.color||'')?x.color:null)});
const mmLevelList=xs=>Array.isArray(xs)&&xs.length?xs.slice(0,MAX_MM_LEVELS).map(cleanLevel):clone(DEFAULT_MM);
let current=null;
function node(tag,cls,text){
 const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;
}
const clone=value=>JSON.parse(JSON.stringify(value));
function normalize(objects){
 if(!Array.isArray(objects))return [];
 return objects.filter(x=>x&&['pen','line','rect','arrow','mm','text'].includes(x.type)).slice(0,COPY_LIMIT).map(x=>clone(x));
}
function open(options){
 if(current)current.destroy();
 let storedMM=null;
 try{storedMM=JSON.parse(localStorage.getItem('ta-chart-mm-settings-v1')||'null')}catch{}
 const host=options.mount;
 host.replaceChildren();
 host.style.cssText='flex:1;min-height:200px;display:flex;flex-direction:column;min-width:0;overflow:hidden';
 const root=node('div','tce');
 host.append(root);
 const bar=node('div','tce-bar');
 const heading=node('div','tce-brand');
 heading.append(node('strong','','CHART REVIEW'),node('span','','STUDIO'));
 const toolbar=node('div','tce-tools');
 bar.append(heading);
 const right=node('div','tce-right');
 const stage=node('div','tce-stage');
 stage.tabIndex=0;stage.setAttribute('aria-label','ინტერაქტიული ჩარტის რედაქტორი');
 const canvas=document.createElement('canvas');
 stage.append(canvas);
 const bottombar=node('div','tce-footer');
 const workbench=node('div','tce-workbench');
 const toolRail=node('div','tce-rail');toolRail.append(toolbar);
 workbench.append(toolRail,stage);
 root.append(bar,right,workbench,bottombar);
 const image=new Image();
 const state={objects:normalize(options.objects),tool:'hand',color:PALETTE[0],width:3,
   selected:-1,zoom:1,ox:0,oy:0,active:null,preview:null,undo:[],redo:[],
   mmLevels:mmLevelList(options.mmLevels||storedMM?.levels),
   fontSize:20,zoomSensitivity:.00052,
   mmOpacity:typeof storedMM?.opacity==='number'?storedMM.opacity:.10,keysDown:new Set(),pointers:new Map(),pinch:null,dirty:false,disposed:false};
 const ctx=canvas.getContext('2d',{alpha:false});
 const writable=!options.readOnly&&typeof options.onSave==='function';
 let imageReady=false, resize=null;
 function action(label,fn,tip,cls){
   const b=node('button',cls||'tce-button',label);b.type='button';b.title=tip||label;b.onclick=fn;return b;
 }
 function tool(name,label,tip){
   const b=action(label,()=>{state.tool=name;state.selected=-1;state.active=null;sync();draw()},tip,'tce-tool');
   b.dataset.tool=name;
   const captions={hand:'ხელი',select:'არჩევა',pen:'ფანქარი',line:'ტრენდი',arrow:'ისარი',rect:'ზონა',mm:'MM',text:'ტექსტი'};
   b.textContent='';b.append(node('span','tce-tool-icon',label),node('span','tce-tool-label',captions[name]||name));
   b.setAttribute('aria-label',tip||label);toolbar.append(b);return b;
 }
 tool('hand','✋','გადაადგილება (H ან Space)');
 tool('select','↖','ობიექტის არჩევა/გადაწევა (V)');
 tool('pen','✎','ფანქარი (P)');
 tool('line','╱','ტრენდლაინი (L)');
 tool('arrow','➜','ისარი (A)');
 tool('rect','▭','მართკუთხედი (R)');
 tool('mm','MM','MM — მრავალი დონე (M)');
 tool('text','T','ტექსტის დამატება (T)');
 const colors=node('div','tce-colors');bar.append(colors);
 PALETTE.forEach(color=>{
   const b=node('button','tce-color');b.type='button';b.style.background=color;b.title='ფერი: '+color;
   b.dataset.color=color;
   b.onclick=()=>{state.color=color;if(state.selected>=0&&writable){record();state.objects[state.selected].color=color;state.dirty=true}sync();draw()};
   colors.append(b);
 });
 const customColor=document.createElement('input');customColor.type='color';customColor.value=PALETTE[0];customColor.title='ნებისმიერი ფერი';customColor.className='tce-customcolor';
 customColor.oninput=()=>{state.color=customColor.value;if(state.selected>=0&&writable){record();state.objects[state.selected].color=state.color;state.dirty=true}sync();draw()};
 colors.append(customColor);
 const stroke=node('label','tce-width','ხაზი ');
 const strokeInput=document.createElement('input');strokeInput.type='range';strokeInput.min='1';strokeInput.max='12';strokeInput.value='3';
 strokeInput.oninput=()=>{state.width=Number(strokeInput.value);strokeValue.textContent=strokeInput.value;if(state.selected>=0&&writable){state.objects[state.selected].width=state.width;state.dirty=true;draw()}};
 const strokeValue=node('span','', '3');stroke.append(strokeInput,strokeValue);right.append(stroke);
 const fontSizeControl=node('label','tce-width','ტექსტი ');
 const fontSizeInput=document.createElement('input');fontSizeInput.type='number';fontSizeInput.min='12';fontSizeInput.max='64';fontSizeInput.value='20';fontSizeInput.className='tce-font-size';fontSizeInput.title='ტექსტის ზომა';
 fontSizeInput.onchange=()=>{const n=Number(fontSizeInput.value);state.fontSize=Math.max(12,Math.min(64,Number.isFinite(n)?n:20));fontSizeInput.value=state.fontSize;if(state.selected>=0&&state.objects[state.selected]?.type==='text'&&writable){record();state.objects[state.selected].fontSize=state.fontSize;state.dirty=true;draw()}};
 fontSizeControl.append(fontSizeInput);right.append(fontSizeControl);
 const settings=action('⚙ MM პარამეტრები',()=>{if(mmPanel.hidden&&state.selected>=0&&state.objects[state.selected]?.type==='mm'){state.mmLevels=mmLevelList(state.objects[state.selected].levels);renderLevels()}mmPanel.hidden=!mmPanel.hidden});
 right.append(settings);
 const mmPanel=node('div','tce-mmsettings');mmPanel.hidden=true;
 const mmHelp=node('p','','MM — დონის დამატება/ამოღება, ხილვადობა და ფერი. რიცხვები ჩარტზე არ გამოისახება.');
 mmPanel.append(mmHelp);
 const levelList=node('div','tce-level-list');
 mmPanel.append(levelList);
 function editMMLevels(next){
   state.mmLevels=mmLevelList(next);persistMM();
   if(state.selected>=0&&state.objects[state.selected]?.type==='mm'&&writable){
     record();state.objects[state.selected].levels=clone(state.mmLevels);state.dirty=true;draw();
   }
   renderLevels();
 }
 function renderLevels(){
   levelList.replaceChildren();
   state.mmLevels.forEach((item,i)=>{
     const row=node('div','tce-mm-row');
     const visible=document.createElement('input');visible.type='checkbox';visible.checked=item.visible;visible.title='დონის ჩვენება';
     visible.onchange=()=>{const levels=clone(state.mmLevels);levels[i].visible=visible.checked;editMMLevels(levels)};
     const input=document.createElement('input');input.type='number';input.step='.05';input.min='-5';input.max='5';input.value=String(item.value);input.title='დონის კოეფიციენტი';
     input.onchange=()=>{const n=Number(input.value);if(!Number.isFinite(n)||n < -5||n>5){input.value=item.value;return}const levels=clone(state.mmLevels);levels[i].value=n;editMMLevels(levels)};
     const color=document.createElement('input');color.type='color';color.value=item.color||state.color;color.title='დონის ხაზის ფერი';
     color.onchange=()=>{const levels=clone(state.mmLevels);levels[i].color=color.value;editMMLevels(levels)};
     const remove=action('×',()=>{if(state.mmLevels.length===1)return;const levels=clone(state.mmLevels);levels.splice(i,1);editMMLevels(levels)},'დონის წაშლა');
     remove.disabled=state.mmLevels.length<=1;
     row.append(visible,input,color,remove);levelList.append(row);
   });
 }
 const addLevel=action('＋ დონის დამატება',()=>{
   if(state.mmLevels.length>=MAX_MM_LEVELS){message('მაქსიმუმ '+MAX_MM_LEVELS+' დონეა');return}
   const levels=clone(state.mmLevels);levels.push({value:0,visible:true,color:null});editMMLevels(levels);
 },'ახალი MM დონე','tce-button tce-add-level');
 mmPanel.append(addLevel);
 renderLevels();
 const opacity=node('label','tce-field','ფონის გამჭვირვალობა');
 const opacityInput=document.createElement('input');opacityInput.type='range';opacityInput.min='0';opacityInput.max='45';opacityInput.value=String(Math.round(state.mmOpacity*100));
 opacityInput.oninput=()=>{state.mmOpacity=Number(opacityInput.value)/100;persistMM();if(state.selected>=0&&state.objects[state.selected].type==='mm'&&writable){record();state.objects[state.selected].opacity=state.mmOpacity;state.dirty=true;draw()}};
 opacity.append(opacityInput);mmPanel.append(opacity);right.append(mmPanel);
 function persistMM(){try{localStorage.setItem('ta-chart-mm-settings-v1',JSON.stringify({levels:state.mmLevels,opacity:state.mmOpacity}))}catch{}}
 const spacer=node('div','tce-spacer');right.append(spacer);
 const fit=action('⊡ მორგება',fitImage,'სრული ჩარტი');
 const zoomOut=action('−',()=>zoomAt(.89,stage.clientWidth/2,stage.clientHeight/2),'შეამცირე');
 const zoomIn=action('+',()=>zoomAt(1.12,stage.clientWidth/2,stage.clientHeight/2),'გაადიდე');
 const zoomVal=node('span','tce-zoom','100%');
 const zoomSpeed=node('select','tce-speed');zoomSpeed.title='ზუმის სიჩქარე';
 [['slow','ნელი'],['medium','საშუალო'],['fast','სწრაფი']].forEach(([value,title])=>{const option=node('option','',title);option.value=value;zoomSpeed.append(option)});
 zoomSpeed.value='medium';zoomSpeed.onchange=()=>{state.zoomSensitivity={slow:.00028,medium:.00052,fast:.0009}[zoomSpeed.value]};
 const undoBtn=action('↶',undo,'Undo (Ctrl+Z)');
 const redoBtn=action('↷',redo,'Redo (Ctrl+Shift+Z)');
 const duplicateBtn=action('⧉','', '');duplicateBtn.onclick=duplicate;
 const deleteBtn=action('⌫',removeSelected,'არჩეულის წაშლა');
 const copyImageBtn=action('⧉ PNG',copyImage,'სურათის დაკოპირება');
 const downloadBtn=action('↓ PNG',download,'ჩამოტვირთე');
 right.append(fit,zoomOut,zoomIn,zoomVal,zoomSpeed,undoBtn,redoBtn,duplicateBtn,deleteBtn,copyImageBtn,downloadBtn);
 let saveBtn=null;
 if(writable){saveBtn=action('შენახვა',save,'შეინახე მონიშვნები','tce-save');right.append(saveBtn)}
 const hint=node('span','tce-hint','მაუსის ბორბალი — რბილი ზუმი · ფიგურაზე დაჭერა — გადატანა · მარჯვენა ღილაკი — მოქმედებები');
 bottombar.append(hint);
 const notice=node('span','tce-notice','');bottombar.append(notice);
 function message(text){notice.textContent=text;}
 function snapshot(){return clone(state.objects)}
 function record(){if(!writable)return;state.undo.push(snapshot());if(state.undo.length>60)state.undo.shift();state.redo=[]}
 function undo(){hideContext();if(!writable||!state.undo.length)return;state.redo.push(snapshot());state.objects=state.undo.pop();state.selected=-1;state.dirty=true;sync();draw()}
 function redo(){hideContext();if(!writable||!state.redo.length)return;state.undo.push(snapshot());state.objects=state.redo.pop();state.selected=-1;state.dirty=true;sync();draw()}
 function removeSelected(){hideContext();if(!writable||state.selected<0)return;record();state.objects.splice(state.selected,1);state.selected=-1;state.dirty=true;sync();draw()}
 function duplicate(){hideContext();if(!writable||state.selected<0)return;record();const copied=clone(state.objects[state.selected]);translate(copied,18,18);state.objects.push(copied);state.selected=state.objects.length-1;state.dirty=true;sync();draw()}
 function translate(shape,dx,dy){
   if(shape.points){for(const p of shape.points){p.x+=dx;p.y+=dy}}
   else if(shape.type==='text'){shape.a.x+=dx;shape.a.y+=dy}
   else {shape.a.x+=dx;shape.a.y+=dy;shape.b.x+=dx;shape.b.y+=dy}
 }
 function fitImage(){
   if(!imageReady)return;
   state.zoom=Math.min(stage.clientWidth/image.naturalWidth,stage.clientHeight/image.naturalHeight)*.96;
   state.zoom=Math.max(.03,state.zoom);
   state.ox=(stage.clientWidth-image.naturalWidth*state.zoom)/2;
   state.oy=(stage.clientHeight-image.naturalHeight*state.zoom)/2;
   sync();draw();
 }
 function zoomAt(factor,cx,cy){
   if(!imageReady)return;
   const previous=state.zoom;
   state.zoom=Math.max(.03,Math.min(18,state.zoom*factor));
   const ratio=state.zoom/previous;
   state.ox=cx-(cx-state.ox)*ratio;state.oy=cy-(cy-state.oy)*ratio;
   sync();draw();
 }
 function coords(e){const r=stage.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
 function world(screen){return {x:(screen.x-state.ox)/state.zoom,y:(screen.y-state.oy)/state.zoom}}
 function distToSegment(p,a,b){
   const dx=b.x-a.x,dy=b.y-a.y, d=dx*dx+dy*dy;
   const t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;
   return Math.hypot(p.x-(a.x+dx*t),p.y-(a.y+dy*t));
 }
 function hit(p,shape){
   const tolerance=18/state.zoom;
   if(shape.type==='text'){
     const metrics=measureTextShape(shape);
     return p.x>=shape.a.x-tolerance&&p.x<=shape.a.x+metrics.width+tolerance&&p.y>=shape.a.y-metrics.lineHeight-tolerance&&p.y<=shape.a.y+(metrics.rows-1)*metrics.lineHeight+tolerance;
   }
   if(shape.type==='pen')return shape.points.some((a,i)=>i>0&&distToSegment(p,shape.points[i-1],a)<tolerance);
   const a=shape.a,b=shape.b;
   if(shape.type==='line'||shape.type==='arrow')return distToSegment(p,a,b)<tolerance;
   const l=Math.min(a.x,b.x),r=Math.max(a.x,b.x),t=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
   if(shape.type==='rect')return Math.abs(p.x-l)<tolerance&&p.y>=t-tolerance&&p.y<=bottom+tolerance||
     Math.abs(p.x-r)<tolerance&&p.y>=t-tolerance&&p.y<=bottom+tolerance||
     Math.abs(p.y-t)<tolerance&&p.x>=l-tolerance&&p.x<=r+tolerance||
     Math.abs(p.y-bottom)<tolerance&&p.x>=l-tolerance&&p.x<=r+tolerance;
   if(shape.type==='mm'){
     const levels=mmLevelList(shape.levels);
     return p.x>=l-tolerance&&p.x<=r+tolerance&&levels.some(level=>level.visible&&Math.abs(p.y-(a.y+(b.y-a.y)*(1-level.value)))<tolerance)
       ||(p.x>=l&&p.x<=r&&p.y>=t&&p.y<=bottom);
   }
   return false;
 }
 function pick(p){for(let i=state.objects.length-1;i>=0;i--)if(hit(p,state.objects[i]))return i;return -1}
 function pickHandle(p,shape){
   if(!shape||shape.points||shape.type==='text')return null;
   const t=12/state.zoom;
   if(Math.hypot(p.x-shape.a.x,p.y-shape.a.y)<t)return 'a';
   if(Math.hypot(p.x-shape.b.x,p.y-shape.b.y)<t)return 'b';
   return null;
 }
 function measureTextShape(shape){
   const fontSize=Math.max(12,Math.min(64,Number(shape.fontSize)||20));
   const lines=String(shape.text||'').split('\n');
   const measure=ctx;
   measure.save();measure.font='600 '+fontSize+'px Inter,Arial,sans-serif';
   const width=Math.max(18,...lines.map(line=>measure.measureText(line).width));
   measure.restore();
   return {width,lineHeight:fontSize*1.35,rows:lines.length,fontSize,lines};
 }
 function drawShape(c,shape,selected){
   c.strokeStyle=shape.color||PALETTE[0];c.lineWidth=Number(shape.width)||3;c.lineCap='round';c.lineJoin='round';
   const a=shape.a,b=shape.b;
   if(shape.type==='text'){
     const m=measureTextShape(shape);
     c.save();c.font='600 '+m.fontSize+'px Inter,Arial,sans-serif';c.textBaseline='alphabetic';
     c.lineWidth=Math.max(2,m.fontSize/6);c.strokeStyle='rgba(12,10,8,.9)';
     m.lines.forEach((line,i)=>{const y=a.y+i*m.lineHeight;c.strokeText(line,a.x,y);c.fillStyle=shape.color||PALETTE[0];c.fillText(line,a.x,y)});
     if(selected){c.strokeStyle='#fff';c.lineWidth=1.5;c.setLineDash([5,5]);c.strokeRect(a.x-5,a.y-m.lineHeight-5,m.width+10,m.lineHeight*m.rows+10)}
     c.restore();return;
   }
   if(shape.type==='pen'){
     const ps=shape.points;if(!ps?.length)return;
     c.beginPath();c.moveTo(ps[0].x,ps[0].y);for(let i=1;i<ps.length;i++)c.lineTo(ps[i].x,ps[i].y);
     if(ps.length===1)c.lineTo(ps[0].x+.1,ps[0].y+.1);c.stroke();
   }else if(shape.type==='line'||shape.type==='arrow'){
     c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
     if(shape.type==='arrow'){
       const angle=Math.atan2(b.y-a.y,b.x-a.x),len=16;
       c.beginPath();c.moveTo(b.x,b.y);
       c.lineTo(b.x-len*Math.cos(angle-.5),b.y-len*Math.sin(angle-.5));
       c.moveTo(b.x,b.y);c.lineTo(b.x-len*Math.cos(angle+.5),b.y-len*Math.sin(angle+.5));c.stroke();
     }
   }else if(shape.type==='rect'){
     c.save();c.globalAlpha=.09;c.fillStyle=shape.color||PALETTE[0];c.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);c.restore();
     c.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);
   }else if(shape.type==='mm'){
     // MM is a chart-image measurement tool, not a Fibonacci calculation.
     const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x);
     const values=mmLevelList(shape.levels).filter(level=>level.visible);
     const ys=values.map(level=>a.y+(b.y-a.y)*(1-level.value));
     if(ys.length){
       const top=Math.min(...ys),bottom=Math.max(...ys);
       c.save();c.globalAlpha=Number.isFinite(shape.opacity)?shape.opacity:.1;
       c.fillStyle=shape.color||PALETTE[0];c.fillRect(left,top,right-left,bottom-top);c.restore();
       values.forEach((level,i)=>{c.beginPath();c.strokeStyle=level.color||shape.color||PALETTE[0];c.moveTo(left,ys[i]);c.lineTo(right,ys[i]);c.stroke()});
     }
     // Intentionally never render numeric level captions.
   }
   if(selected){
     c.save();c.strokeStyle='#FFFFFF';c.lineWidth=1.4;c.setLineDash([6,5]);
     if(shape.points){
       const xs=shape.points.map(x=>x.x),ys=shape.points.map(x=>x.y);
       c.strokeRect(Math.min(...xs)-7,Math.min(...ys)-7,Math.max(...xs)-Math.min(...xs)+14,Math.max(...ys)-Math.min(...ys)+14);
     }else {
       c.strokeRect(Math.min(a.x,b.x)-7,Math.min(a.y,b.y)-7,Math.abs(b.x-a.x)+14,Math.abs(b.y-a.y)+14);
       c.setLineDash([]);c.fillStyle='#fff';c.strokeStyle=shape.color||PALETTE[0];c.lineWidth=2;
       for(const handle of [a,b]){c.beginPath();c.arc(handle.x,handle.y,5.5,0,Math.PI*2);c.fill();c.stroke()}
     }
     c.restore();
   }
 }
 const contextMenu=node('div','tce-contextmenu');
 contextMenu.hidden=true;stage.append(contextMenu);
 function hideContext(){contextMenu.hidden=true;contextMenu.replaceChildren()}
 function showContext(x,y){
   hideContext();
   contextMenu.style.left=Math.max(7,Math.min(stage.clientWidth-210,x))+'px';
   contextMenu.style.top=Math.max(7,Math.min(stage.clientHeight-220,y))+'px';
   const add=(title,icon,fn,disabled)=>{
     const b=node('button','tce-context-action');
     b.type='button';b.disabled=Boolean(disabled);
     b.append(node('span','tce-context-icon',icon),node('span','',title));
     b.addEventListener('click',()=>{hideContext();fn()});
     contextMenu.append(b);
   };
   if(state.selected>=0){
     add('გადაადგილება','↖',()=>{state.tool='select';sync();draw()});
     add('დუბლირება','⧉',duplicate,!writable);
     add('ფერის შეცვლა','◉',()=>customColor.click(),!writable);
     if(state.objects[state.selected].type==='text')add('ტექსტის შეცვლა','T',()=>editText(state.selected),!writable);
     if(state.objects[state.selected].type==='mm')add('MM დონეები','≋',()=>{state.mmLevels=mmLevelList(state.objects[state.selected].levels);renderLevels();mmPanel.hidden=false},!writable);
     const separator=node('div','tce-context-separator');contextMenu.append(separator);
     add('წაშლა','⌫',removeSelected,!writable);
   }else{
     add('აქ ტექსტის დამატება','T',()=>createText(world({x,y})),!writable);
     add('ჩარტის მორგება','⊡',fitImage);
     add('გაზრდა','+',()=>zoomAt(1.12,x,y));
     add('შემცირება','−',()=>zoomAt(.89,x,y));
   }
   contextMenu.hidden=false;
 }
 stage.addEventListener('contextmenu',e=>{
   if(!imageReady)return;
   e.preventDefault();
   const at=coords(e),p=world(at);
   const i=pick(p);
   if(i>=0)state.selected=i;
   else state.selected=-1;
   state.active=null;state.preview=null;
   showContext(at.x,at.y);sync();draw();
 });
 const editor=node('div','tce-text-editor');editor.hidden=true;stage.append(editor);
 let editTarget=null;
 const textInput=node('textarea','tce-text-input');textInput.rows=3;textInput.maxLength=1500;
 textInput.placeholder='შეიყვანე ტექსტი ჩარტზე...';
 const textActions=node('div','tce-text-actions');
 const textSave=action('დამატება',()=>commitText(),'ტექსტის შენახვა','tce-save');
 const textCancel=action('გაუქმება',closeTextEditor);
 textActions.append(textCancel,textSave);editor.append(textInput,textActions);
 function closeTextEditor(){editor.hidden=true;editTarget=null;stage.focus({preventScroll:true})}
 function createText(at){if(!writable)return;editTarget={at,index:-1};showTextEditor('',at)}
 function editText(index){
   if(!writable||index<0||state.objects[index]?.type!=='text')return;
   const shape=state.objects[index];editTarget={at:shape.a,index};showTextEditor(shape.text,shape.a);
 }
 function showTextEditor(value,at){
   hideContext();
   textInput.value=value||'';
   textSave.textContent=editTarget.index>=0?'შენახვა':'დამატება';
   const sx=at.x*state.zoom+state.ox,sy=at.y*state.zoom+state.oy;
   editor.style.left=Math.max(8,Math.min(stage.clientWidth-320,sx))+'px';
   editor.style.top=Math.max(8,Math.min(stage.clientHeight-160,sy-28))+'px';
   editor.hidden=false;textInput.focus();textInput.select();
 }
 function commitText(){
   if(!editTarget)return;
   const value=textInput.value.trim();
   if(!value){closeTextEditor();return}
   record();
   if(editTarget.index>=0){
     state.objects[editTarget.index].text=value;state.selected=editTarget.index;
   }else{
     if(state.objects.length>=COPY_LIMIT)return;
     state.objects.push({type:'text',a:editTarget.at,text:value,color:state.color,fontSize:state.fontSize});
     state.selected=state.objects.length-1;
   }
   state.dirty=true;closeTextEditor();state.tool='select';sync();draw();
 }
 textInput.addEventListener('keydown',e=>{
   if(e.key==='Escape'){e.stopPropagation();closeTextEditor()}
   if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();commitText()}
 });
 stage.addEventListener('dblclick',e=>{
   const i=pick(world(coords(e)));
   if(i>=0&&state.objects[i].type==='text')editText(i);
 });
 stage.addEventListener('pointerdown',e=>{if(!contextMenu.hidden&&!contextMenu.contains(e.target))hideContext()},true);
 function imageCanvas(includeSelection){
   const result=document.createElement('canvas');result.width=image.naturalWidth;result.height=image.naturalHeight;
   const c=result.getContext('2d');c.drawImage(image,0,0);
   state.objects.forEach((shape,i)=>drawShape(c,shape,!!includeSelection&&i===state.selected));
   return result;
 }
 function draw(){
   if(!imageReady||state.disposed)return;
   const dpr=window.devicePixelRatio||1,w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px'}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#090909';ctx.fillRect(0,0,w,h);
   ctx.save();ctx.translate(state.ox,state.oy);ctx.scale(state.zoom,state.zoom);
   ctx.drawImage(image,0,0);
   state.objects.forEach((shape,i)=>drawShape(ctx,shape,i===state.selected));
   if(state.preview)drawShape(ctx,state.preview,false);
   ctx.restore();
 }
 function sync(){
   toolbar.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===state.tool));
   colors.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('active',b.dataset.color===state.color));
   zoomVal.textContent=Math.round(state.zoom*100)+'%';
   undoBtn.disabled=!writable||!state.undo.length;redoBtn.disabled=!writable||!state.redo.length;
   deleteBtn.disabled=duplicateBtn.disabled=!writable||state.selected<0;
   canvas.style.cursor=state.tool==='hand'?'grab':state.tool==='select'?'default':'crosshair';
   if(!writable)toolbar.querySelectorAll('[data-tool]').forEach(b=>{if(b.dataset.tool!=='hand'&&b.dataset.tool!=='select')b.disabled=true});
   fontSizeControl.style.display=state.tool==='text'||state.objects[state.selected]?.type==='text'?'flex':'none';
 }
 async function copyImage(){
   try{
     if(!navigator.clipboard?.write||!window.ClipboardItem)throw Error('not supported');
     const blob=await new Promise(done=>imageCanvas(false).toBlob(done,'image/png'));
     if(!blob)throw Error('PNG failed');
     await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
     message('PNG დაკოპირებულია ✓');
   }catch{message('ბრაუზერმა ფოტოს კოპირება დაბლოკა — გამოიყენე ↓ PNG')}
 }
 function download(){
   const a=document.createElement('a');a.href=imageCanvas(false).toDataURL('image/png');a.download='traders-academy-chart-review.png';a.click();
 }
 async function save(){
   if(!writable)return;
   if(!state.dirty){message('ცვლილებები არ არის');return}
   saveBtn.disabled=true;saveBtn.textContent='ინახება…';
   try{
     const ok=await options.onSave(clone(state.objects));
     if(ok!==false){message('შენახულია ✓');state.dirty=false;options.afterSave?.()}
     else message('შენახვა ვერ მოხერხდა');
   }catch(e){message('შენახვა ვერ მოხერხდა')}
   finally{saveBtn.disabled=false;saveBtn.textContent='შენახვა'}
 }
 const wheel=e=>{
   e.preventDefault();
   const pos=coords(e);
   // Normalized, damped zoom centered at the pointer, including trackpads.
   const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?stage.clientHeight:1);
   const bounded=Math.max(-120,Math.min(120,delta));
   zoomAt(Math.exp(-bounded*state.zoomSensitivity),pos.x,pos.y);
 };
 stage.addEventListener('wheel',wheel,{passive:false});
 stage.addEventListener('pointerdown',e=>{
   if(!imageReady||e.button===2||e.target!==canvas||!editor.hidden)return;
   hideContext();
   stage.focus({preventScroll:true});
   const screen=coords(e);const p=world(screen);
   state.pointers.set(e.pointerId,screen);
   stage.setPointerCapture(e.pointerId);
   if(state.pointers.size===2){
     const pts=[...state.pointers.values()];
     state.pinch={distance:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),zoom:state.zoom,
       center:{x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2}};
     state.active=null;state.preview=null;draw();return;
   }
   const isPan=state.keysDown.has(' ')||e.button===1;
   const oldSelected=state.selected;
   const handle=oldSelected>=0?pickHandle(p,state.objects[oldSelected]):null;
   const hitIndex=handle?oldSelected:pick(p);
   // Drag any existing drawing directly. Alt bypasses picking for overlapping shapes.
   if(!isPan&&writable&&hitIndex>=0&&!e.altKey){
     state.selected=hitIndex;
     state.active={kind:handle?'resize':'move',handle,screen,start:clone(state.objects[hitIndex]),recorded:false};
     state.tool='select';sync();draw();return;
   }
   if(state.tool==='text'&&!isPan&&writable){
     state.pointers.delete(e.pointerId);
     try{stage.releasePointerCapture(e.pointerId)}catch{}
     createText(p);return;
   }
   if(isPan||state.tool==='hand'||!writable){
     state.active={kind:'pan',screen};
   }else if(state.tool==='select'){
     state.selected=-1;state.active=null;sync();draw();
   }else{
     record();
     state.active={kind:'draw',start:p};
     const base={type:state.tool,color:state.color,width:state.width};
     state.preview=state.tool==='pen'?{...base,points:[p]}:{...base,a:p,b:p};
     if(state.tool==='mm'){state.preview.levels=clone(state.mmLevels);state.preview.opacity=state.mmOpacity}
     draw();
   }
 });
 stage.addEventListener('pointermove',e=>{
   if(!imageReady)return;
   const screen=coords(e);
   if(state.pointers.has(e.pointerId))state.pointers.set(e.pointerId,screen);
   if(state.pointers.size>=2&&state.pinch){
     const pts=[...state.pointers.values()];
     const center={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
     const distance=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
     const prev=state.zoom;state.zoom=Math.max(.03,Math.min(18,state.pinch.zoom*distance/Math.max(1,state.pinch.distance)));
     const factor=state.zoom/prev;
     state.ox=center.x-(center.x-state.ox)*factor;state.oy=center.y-(center.y-state.oy)*factor;
     draw();sync();return;
   }
   if(!state.active)return;
   if(state.active.kind==='pan'){
     state.ox+=screen.x-state.active.screen.x;state.oy+=screen.y-state.active.screen.y;
     state.active.screen=screen;draw();
   }else if(state.active.kind==='draw'){
     const p=world(screen);
     if(state.preview.type==='pen')state.preview.points.push(p);else state.preview.b=p;
     draw();
   }else if(state.active.kind==='move'||state.active.kind==='resize'){
     const selected=state.selected;if(selected<0)return;
     const dx=(screen.x-state.active.screen.x)/state.zoom,dy=(screen.y-state.active.screen.y)/state.zoom;
     if(!state.active.recorded&&(Math.abs(dx)+Math.abs(dy)>1)){record();state.active.recorded=true}
     state.objects[selected]=clone(state.active.start);
     if(state.active.kind==='resize'){
       const p=world(screen);state.objects[selected][state.active.handle]=p;
     }else translate(state.objects[selected],dx,dy);
     if(state.active.recorded)state.dirty=true;
     draw();
   }
 });
 function endPointer(e){
   state.pointers.delete(e.pointerId);
   if(state.pointers.size<2)state.pinch=null;
   if(state.pointers.size>0)return;
   if(state.active?.kind==='resize'||state.active?.kind==='move'){
     // The resize/move is already persisted in the vector model; it can be undone.
   }
   if(state.active?.kind==='draw'&&state.preview){
     const shape=state.preview;
     const distance=shape.points?shape.points.length:Math.hypot(shape.a.x-shape.b.x,shape.a.y-shape.b.y);
     if(distance>1&&state.objects.length<COPY_LIMIT){state.objects.push(shape);state.selected=state.objects.length-1;state.dirty=true}
     else state.undo.pop();
   }
   state.preview=null;state.active=null;sync();draw();
 }
 stage.addEventListener('pointerup',endPointer);
 stage.addEventListener('pointercancel',endPointer);
 function keydown(e){
   if(current!==api||!document.contains(root))return;
   const tag=e.target?.tagName;
   if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;
   const key=e.key.toLowerCase();
   if(e.ctrlKey||e.metaKey){
     if(key==='z'){e.preventDefault();e.shiftKey?redo():undo()}
     if(key==='y'){e.preventDefault();redo()}
     if(key==='c'&&state.selected>=0){e.preventDefault();state.copied=clone(state.objects[state.selected]);message('ობიექტი დაკოპირებულია')}
     if(key==='v'&&state.copied&&writable){e.preventDefault();record();const shape=clone(state.copied);translate(shape,18,18);state.objects.push(shape);state.selected=state.objects.length-1;state.dirty=true;sync();draw()}
     return;
   }
   if(key===' '){e.preventDefault();state.keysDown.add(' ');stage.style.cursor='grab';return}
   if(key==='escape'){hideContext();if(!editor.hidden)closeTextEditor();else{state.selected=-1;state.tool='hand';sync();draw()}return}
   if(key==='delete'||key==='backspace'){e.preventDefault();removeSelected();return}
   const shortcuts={h:'hand',v:'select',p:'pen',l:'line',a:'arrow',r:'rect',m:'mm',t:'text'};
   if(shortcuts[key]){state.tool=shortcuts[key];state.selected=-1;sync();draw()}
 }
 function keyup(e){if(e.key===' '){state.keysDown.delete(' ');sync()}}
 window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);
 const api={destroy(){
   state.disposed=true;
   window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);
   resize?.disconnect();if(current===api)current=null;
 },state};
 current=api;
 image.onload=()=>{
   imageReady=true;
   resize=new ResizeObserver(()=>{if(!state.active){draw()}});
   resize.observe(stage);
   fitImage();sync();message(writable?'ფიგურები რედაქტირებადია · შეინახე ცვლილებები':'მხოლოდ სანახავი რეჟიმი');
 };
 image.onerror=()=>message('ჩარტის ფოტო ვერ გაიხსნა');
 image.src=options.image;
 sync();
 return api;
}
window.TAChartEditor={open,close(){current?.destroy()}};
})();
