(()=>{
 "use strict";
 const root=document.getElementById('expo-zones-map');if(!root)return;
 const list=document.getElementById('expo-zone-data');
 let zones=[];try{zones=JSON.parse(list.textContent)}catch(e){console.warn('Zone data unavailable',e)}
 const byId=Object.fromEntries(zones.map(z=>[z.id,z]));
 const overview=document.getElementById('zone-overview'),detail=document.getElementById('zone-detail'),img=document.getElementById('zone-detail-image'),map=document.getElementById('zone-detail-map'),pins=document.getElementById('zone-station-pins'),line=document.getElementById('zone-route-overlay'),title=document.getElementById('zone-title'),summary=document.getElementById('zone-summary'),info=document.getElementById('zone-station-details'),stops=document.getElementById('zone-stop-list');
 const popup=document.getElementById('zone-map-popup');const popupClose=document.getElementById('zone-popup-close');
 const crop={kingdom:['-36%','-17%'],technology:['-66%','-24%'],prosperity:['-23%','-63%'],collaboration:['-66%','-64%']};
 const labels={kingdom:'منطقة المملكة',sustainability:'الحلول المستدامة',technology:'التقنيات التحولية',prosperity:'الازدهار',collaboration:'التعاون العالمي'};
 const labelStatus={full:'ممتلئة',warning:'قريبة من الامتلاء',normal:'طبيعية'};
 let current=null;
 const tag=(name,cls,text)=>{const e=document.createElement(name);if(cls)e.className=cls;e.textContent=text;return e};
 function details(p,x,y){info.replaceChildren();popup.hidden=false;popup.style.left='';popup.style.top='';popup.classList.remove('zone-popup-unassigned');
  if(Number.isFinite(x)&&Number.isFinite(y)){popup.style.left=Math.min(72,Math.max(4,x+3))+'%';popup.style.top=Math.min(53,Math.max(12,y-2))+'%';}else{popup.style.left='50%';popup.style.top='50%';}const a=tag('article','', '');a.appendChild(tag('h4','',p.code+' — '+p.name));
  if(!p.bins.length)a.appendChild(tag('p','','لا توجد حاويات مرتبطة بهذه المحطة.'));
  for(const b of p.bins){const row=tag('p','','');row.appendChild(tag('strong',b.status,b.name+' — '+b.fill+'% '));row.appendChild(document.createTextNode('('+b.type+')'));a.appendChild(row)}
  const link=tag('a','','عرض المحطة في قائمة الإدارة');link.href='#point-'+p.id;a.appendChild(link);info.appendChild(a);
 }
 function showZone(id){const z=byId[id]||{id,name:labels[id],points:[]};current=id;
  overview.hidden=true;detail.hidden=false;title.textContent=z.name||labels[id];map.classList.toggle('zone-crop',id!=='sustainability');
  img.src=id==='sustainability'?root.dataset.sustainability:root.dataset.overview;
  const offsets=crop[id]||['0%','0%'];map.style.setProperty('--crop-x',offsets[0]);map.style.setProperty('--crop-y',offsets[1]);
  pins.replaceChildren();line.replaceChildren();info.replaceChildren();stops.replaceChildren();summary.replaceChildren();popup.hidden=true;popup.classList.remove('zone-popup-unassigned');
  const ps=z.points||[],loose=z.loose_bins||[];
  const allBins=[...ps.flatMap(p=>p.bins),...loose];
  summary.append(tag('span','','المحطات: '+ps.length),tag('span','','الحاويات: '+allBins.length),tag('span','','الممتلئة: '+allBins.filter(b=>b.fill>=90).length),tag('span','','قريبة من الامتلاء: '+allBins.filter(b=>b.fill>=70&&b.fill<90).length));
  if(loose.length){popup.hidden=false;popup.classList.add('zone-popup-unassigned');popup.style.left='50%';popup.style.top='50%';const block=tag('article','');block.appendChild(tag('h4','','الحاويات الموجودة في قاعدة البيانات بدون محطة/زون'));
   for(const b of loose){const row=tag('p','');row.appendChild(tag('strong',b.status,b.name+' — '+b.fill+'% '));row.appendChild(document.createTextNode('('+b.type+'، رقم الجهاز: '+b.hardware_id+')'));block.appendChild(row)}
   block.appendChild(tag('p','','اربطي هذه الحاويات بمحطة CollectionPoint من Django Admin لتظهر على خريطة الزون.'));info.appendChild(block)}
  if(!ps.length){if(!loose.length)info.appendChild(tag('p','zone-empty','لا توجد محطات مرتبطة بهذه المنطقة حاليًا. لا يتم توليد بيانات أو نقاط وهمية.'));return}
  const coords=[];
  ps.forEach((p,i)=>{ // Actual fill readings are from DB. Locations are conceptual placement only.
   const x=Math.min(95,Math.max(5,Number(p.x))),y=Math.min(95,Math.max(5,Number(p.y)));coords.push([x,y]);
   const btn=tag('button','zone-pin '+p.status,'');btn.type='button';btn.style.left=x+'%';btn.style.top=y+'%';btn.title=p.code+' — '+p.name+' ('+p.fill+'%)';btn.setAttribute('aria-label',btn.title);btn.appendChild(tag('span','',String(i+1)));btn.addEventListener('click',()=>details(p,x,y));pins.appendChild(btn);
  });
  if(coords.length>1){const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');poly.setAttribute('points',coords.map(([x,y])=>x+','+y).join(' '));poly.setAttribute('fill','none');poly.setAttribute('stroke','#f9d878');poly.setAttribute('stroke-width','.75');poly.setAttribute('stroke-dasharray','1.5 1');poly.setAttribute('vector-effect','non-scaling-stroke');line.appendChild(poly)}
  stops.appendChild(tag('strong','','محطات المنطقة: '+ps.map(p=>p.code).join(' ← ')));
  root.scrollIntoView({block:'nearest',behavior:'smooth'});
 }
 const unc=document.getElementById('unassigned-count');if(unc){const unassigned=byId.unassigned;unc.textContent='(' + ((unassigned?.loose_bins?.length||0)+(unassigned?.points?.reduce((n,p)=>n+p.bins.length,0)||0)) + ')'}
 root.querySelectorAll('[data-zone]').forEach(b=>b.addEventListener('click',()=>showZone(b.dataset.zone)));
 popupClose.addEventListener('click',()=>{popup.hidden=true});
 document.getElementById('zone-return').addEventListener('click',()=>{current=null;detail.hidden=true;overview.hidden=false;});
})();