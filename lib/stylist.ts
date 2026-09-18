import type { Item, Weather, Preferences, Fit } from './wardrobe';
export const styles=['Clean minimal','Oversized casual','Skate-inspired','Workwear','Elevated streetwear'];
const neutral=new Set(['black','white','cream','grey','navy','olive','brown']);
const layerCats=['hoodie','crewneck'];
export const slot=(i:Item)=>layerCats.includes(i.category)?'layer':i.category;
export const signature=(ids:string[])=>[...ids].sort().join('|');
export function effectiveTemperature(w:Weather,p:Preferences){return (p.plan==='Indoors'?21:w.feels)+(p.comfort==='Runs cold'?-3:p.comfort==='Runs warm'?3:0);}
export function needsLayer(w:Weather,p:Preferences){return effectiveTemperature(w,p)<18 || (p.plan==='Mixed'&&p.comfort==='Runs cold');}
export function supportForStyle(items:Item[],style:string){if(style==='Oversized casual'&&!items.some(i=>i.category==='tee'&&['relaxed','oversized'].includes(i.silhouette)))return 'Add a relaxed or oversized tee to support this direction.';if(style==='Workwear'&&!items.some(i=>i.category==='pants'&&['olive','brown'].includes(i.color)))return 'Add utility-inspired pants to support this direction.';return '';}
export function assess(items:Item[],w:Weather,p:Preferences,locked:string[]=[]){
const notes:string[]=[];const gaps:string[]=[];const outdoor=p.plan!=='Indoors';const layer=items.find(i=>slot(i)==='layer');const outer=items.find(i=>i.category==='outerwear');const shoe=items.find(i=>i.category==='shoes');const t=effectiveTemperature(w,p);
if(needsLayer(w,p)&&!layer&&!outer)gaps.push('A warmer layer is missing. A tee alone is not enough for your selected comfort and conditions.');
if(outdoor&&w.feels<8&&!outer?.insulated)gaps.push('Cold-weather protection is missing: add a confirmed insulated outer layer. This outfit is only a base.');
if(outdoor&&w.feels<0&&!shoe?.insulated)gaps.push('Freezing conditions: footwear insulation and ice grip are unverified. Add suitable winter footwear.');
if(outdoor&&w.rain>0&&!outer?.waterproof)gaps.push('Wet-weather protection is missing: add a confirmed waterproof outer layer or carry an umbrella.');
if(outdoor&&w.rain>0&&!shoe?.waterproof)gaps.push('These shoes have no confirmed waterproofing. Choose verified rain footwear for outdoor use.');
if(outdoor&&w.wind>=30)gaps.push('Strong wind: wind resistance is unverified. Bring a verified wind-blocking shell.');
if(t>=24&&layer)notes.push((locked.includes(layer.id)?'Locked layer conflict: ':'Layer caution: ')+layer.name+' may feel too warm. Carry it or unlock it.');
if(outdoor&&w.humidity>=75&&w.feels>=23)notes.push('Humid and warm: favor your roomier, lowest-warmth pieces; breathability is not confirmed.');
if((p.time==='Evening'||!w.isDay)&&outdoor)notes.push('Evening plans: carry a removable layer and check the forecast closer to departure.');
if(p.time==='Evening'&&w.source==='live')notes.push('This is current weather, not an evening forecast. Use manual evening conditions if they differ.');
if(p.occasion==='Smart casual'){const casual=items.filter(i=>i.graphic==='statement'||i.silhouette==='slim'&&i.texture==='washed'||i.category==='cap');if(casual.length)notes.push('Smart-casual compromise: '+casual.map(i=>i.name).join(', ')+' keeps this look casual'+(casual.some(i=>locked.includes(i.id))?' and includes a locked piece.':'.'));}
if(layer)notes.push('A removable '+layer.category+' adds warmth; keep the tee hem just visible rather than bunching it.');else notes.push(t>=18?'Keep the base light; add a layer only if your plans or comfort change.':'Warmth is estimated from photos. Confirm how these pieces feel in person.');
if(w.season==='Winter'&&outdoor&&w.feels>=8)notes.push('Winter context: check the full-day forecast; this assessment uses the entered temperature.');
return {notes,gaps};}
function score(items:Item[],p:Preferences,w:Weather,history:Fit[]){
let s=0;const top=items.find(i=>slot(i)==='layer')||items.find(i=>i.category==='tee');const pants=items.find(i=>i.category==='pants');const shoe=items.find(i=>i.category==='shoes');
const visible=items.filter(i=>!(slot(top!)==='layer'&&i.category==='tee'));const statements=visible.filter(i=>i.graphic==='statement').length;const logos=visible.filter(i=>i.graphic==='logo').length;
s-=Math.max(0,statements-1)*9+Math.max(0,logos-2)*2;
const loud=new Set(visible.filter(i=>!neutral.has(i.color)).map(i=>i.color));s-=Math.max(0,loud.size-1)*6;
for(const i of visible)if(i.accent&&visible.some(j=>j.id!==i.id&&(j.color===i.accent||j.accent===i.accent)))s+=1.5;
if(top?.color===pants?.color)s+=3;if(shoe&&['cream','white','black','grey'].includes(shoe.color))s+=2;
if(top?.silhouette==='relaxed'&&pants?.silhouette==='tapered')s+=3;
if(p.style==='Clean minimal'||p.style==='Elevated streetwear'){s+=visible.filter(i=>i.graphic==='quiet').length*4;s-=statements*6;s+=pants?.texture==='smooth'?2:-2;}
if(p.style==='Oversized casual'){s+=top&&['relaxed','oversized'].includes(top.silhouette)?7:-4;s+=pants?.silhouette==='relaxed'?6:-1;}
if(p.style==='Skate-inspired'){s+=pants?.silhouette==='relaxed'?5:0;s+=statements===1?5:0;s+=shoe?.silhouette==='low-top'?2:0;}
if(p.style==='Workwear'){s+=pants&&['olive','brown'].includes(pants.color)?8:-4;s+=top?.graphic==='quiet'?3:0;}
if(p.occasion==='Smart casual')s-=statements*5+items.filter(i=>i.category==='cap').length*4;
if(w.rain>0&&p.plan!=='Indoors'&&shoe?.waterproof)s+=15;
if(effectiveTemperature(w,p)>=23)s-=items.reduce((n,i)=>n+i.warmth,0);
if(needsLayer(w,p))s+=(top?.warmth||0)*2;
for(const fit of history.filter(f=>f.worn.length).slice(0,8))s-=items.filter(i=>fit.items.includes(i.id)).length*.5;
return s;}
export function describe(items:Item[],p:Preferences){const top=items.find(i=>slot(i)==='layer')||items.find(i=>i.category==='tee');const pants=items.find(i=>i.category==='pants');const shoe=items.find(i=>i.category==='shoes');if(!top||!pants||!shoe)return {name:'Incomplete rotation',rationale:'A complete look needs a tee, pants and shoes.',tips:[]};const statement=items.find(i=>i.graphic==='statement');const repeated=items.find(i=>i.accent&&items.some(j=>i.id!==j.id&&(j.color===i.accent||j.accent===i.accent)));
const names:Record<string,string>={'Clean minimal':'Quiet confidence','Oversized casual':'Room to move','Skate-inspired':'Off the clock','Workwear':'Utility, considered','Elevated streetwear':'After-hours uniform'};
const rationale=[`${top.color[0].toUpperCase()+top.color.slice(1)} up top with ${pants.color} pants ${top.color===pants.color?'creates a tonal line':'gives the palette a grounded contrast'}.`,`${top.silhouette[0].toUpperCase()+top.silhouette.slice(1)} volume meets a ${pants.silhouette} leg, finished with ${shoe.color} ${shoe.silhouette} shoes.`,statement?`Let the ${statement.name.toLowerCase()} be the focal point.`:'Small details keep this combination understated.',repeated?`The ${repeated.accent} accents tie the pieces together.`:''].filter(Boolean).join(' ');
const tips=[pants.silhouette==='tapered'?'Let the tapered hem sit above the shoe; avoid excess stacking.':pants.silhouette==='relaxed'?'Keep the relaxed hem clear of the ground; cuff once if needed.':'Keep the slimmer leg clean at the ankle.',top.silhouette==='relaxed'?'Try a shallow front tuck to define the waist while keeping volume.':'Wear the tee untucked for ease, or tuck slightly to shorten the torso.',items.some(i=>i.texture==='washed')?'The washed surface adds contrast against the smoother pieces.':'Use the contrast between paneled footwear and smooth tops for texture.'];return {name:names[p.style]||'Your daily rotation',rationale,tips};}
export function generate(items:Item[],p:Preferences,w:Weather,lockedIds:string[]=[],history:Fit[]=[],exclude:string[]=[],random= Math.random){
const locked=lockedIds.map(id=>items.find(i=>i.id===id));if(locked.some(i=>!i))throw Error('A locked item is no longer in your wardrobe. Clear that lock.');const fixed=locked as Item[];if(new Set(fixed.map(slot)).size!==fixed.length)throw Error('Lock only one item per outfit slot.');for(const c of ['tee','pants','shoes'])if(!items.some(i=>i.category===c))throw Error('Add at least one '+c+' to generate a complete outfit.');
const unsupported=supportForStyle(items,p.style);if(unsupported)throw Error(unsupported);
const wantLayer=needsLayer(w,p);const wantOuter=p.plan!=='Indoors'&&(w.rain>0||w.feels<8||w.wind>=30);const slots=['tee','pants','shoes',...(wantLayer||fixed.some(i=>slot(i)==='layer')?['layer']:[]),...(p.cap||fixed.some(i=>i.category==='cap')?['cap']:[]),...(wantOuter||fixed.some(i=>i.category==='outerwear')?['outerwear']:[])];
const pools=slots.map(c=>{const f=fixed.find(i=>slot(i)===c);return f?[f]:items.filter(i=>slot(i)===c);});const candidates=new Map<string,{items:Item[];score:number}>();
for(let n=0;n<700;n++){const chosen=pools.filter(a=>a.length).map(a=>a[Math.floor(random()*a.length)]);const key=signature(chosen.map(i=>i.id));if(exclude.includes(key))continue;candidates.set(key,{items:chosen,score:score(chosen,p,w,history)+random()*4});}
const ranked=[...candidates.values()].sort((a,b)=>b.score-a.score);const picks:Item[][]=[];while(ranked.length&&picks.length<3){ranked.sort((a,b)=>(b.score-picks.reduce((n,x)=>n+x.filter(i=>b.items.some(j=>j.id===i.id)&&!lockedIds.includes(i.id)).length*4,0))-(a.score-picks.reduce((n,x)=>n+x.filter(i=>a.items.some(j=>j.id===i.id)&&!lockedIds.includes(i.id)).length*4,0)));picks.push(ranked.shift()!.items);}return picks;
}
