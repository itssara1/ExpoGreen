(() => {
  "use strict";
  const root = document.getElementById("expo-live-map");
  if (!root) return;
  const parse = id => { const e=document.getElementById(id);try{return e?JSON.parse(e.textContent):[];}catch{return [];} };
  const points = parse("expo-map-points");
  const stops = parse("expo-map-route");
  const NS="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(NS,"svg");
  svg.setAttribute("viewBox","0 0 1000 700");
  svg.setAttribute("role","img");
  svg.setAttribute("aria-label","مخطط تصوري لمناطق إكسبو ونقاط جمع النفايات");
  const image=document.createElementNS(NS,"image");
  image.setAttribute("href",root.dataset.mapSrc);
  image.setAttribute("width","1000");image.setAttribute("height","700");
  svg.appendChild(image);
  const routeLayer=document.createElementNS(NS,"g"),pointLayer=document.createElementNS(NS,"g"),stopLayer=document.createElementNS(NS,"g");
  svg.append(routeLayer,pointLayer,stopLayer);root.appendChild(svg);
  // Existing view data uses demo GPS coordinates derived from x_percent/y_percent.
  // Convert the demo projection back into relative site-map coordinates.
  const loc=p=>{
    const x=50+(Number(p.lng)-46.70826)/.00026;
    const y=50-(Number(p.lat)-24.88487)/.00024;
    return {x:Math.max(85,Math.min(915,x*10)),y:Math.max(60,Math.min(640,y*7))};
  };
  const el=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=String(text);return n;};
  const colors={full:"#c94646",warning:"#d6a035",normal:"#28835e"};
  const tooltip=document.createElement("div");tooltip.className="ops-map-tooltip";tooltip.hidden=true;root.appendChild(tooltip);
  const show=(p)=>{
    tooltip.replaceChildren();const title=document.createElement("strong");title.textContent=p.code+" — "+p.name;
    const info=document.createElement("div");info.textContent=`الحاويات: ${p.total} | أعلى امتلاء: ${p.max_fill}% | ممتلئة: ${p.full}`;
    const link=document.createElement("a");link.href="#point-"+p.id;link.textContent="عرض تفاصيل المحطة";
    tooltip.append(title,info,link);tooltip.hidden=false;
  };
  points.forEach((p,i)=>{
    const {x,y}=loc(p),g=el("g",{class:"ops-point-pin",tabindex:0,role:"button","aria-label":`${p.name}: ${p.max_fill}%`});
    g.append(el("circle",{cx:x,cy:y,r:21,fill:colors[p.status]||colors.normal}),el("text",{x,y:y+5},p.total));
    pointLayer.append(g,el("text",{class:"ops-point-label",x,y:y+40},p.code));
    g.addEventListener("click",()=>show(p));g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();show(p);}});
  });
  const positions=stops.map(loc);
  if(positions.length>=2)routeLayer.appendChild(el("polyline",{class:"ops-route-line",points:positions.map(p=>`${p.x},${p.y}`).join(" ")}));
  positions.forEach((p,i)=>{
    const g=el("g",{class:"ops-route-pin"});g.append(el("circle",{cx:p.x,cy:p.y,r:15}),el("text",{x:p.x,y:p.y+5},i<26?String.fromCharCode(65+i):i+1));stopLayer.appendChild(g);
  });
  let box={x:0,y:0,w:1000,h:700},drag=null;
  const draw=()=>svg.setAttribute("viewBox",`${box.x} ${box.y} ${box.w} ${box.h}`);
  function zoom(factor){const nw=Math.max(220,Math.min(1000,box.w*factor)),nh=nw*.7;box.x+=(box.w-nw)/2;box.y+=(box.h-nh)/2;box.w=nw;box.h=nh;clamp();draw();}
  function clamp(){box.x=Math.max(0,Math.min(1000-box.w,box.x));box.y=Math.max(0,Math.min(700-box.h,box.y));}
  root.addEventListener("pointerdown",e=>{if(e.target.closest(".ops-map-controls,.ops-map-tooltip"))return;drag={x:e.clientX,y:e.clientY,bx:box.x,by:box.y};root.setPointerCapture(e.pointerId);root.classList.add("is-dragging");});
  root.addEventListener("pointermove",e=>{if(!drag)return;box.x=drag.bx-(e.clientX-drag.x)*box.w/root.clientWidth;box.y=drag.by-(e.clientY-drag.y)*box.h/root.clientHeight;clamp();draw();});
  const end=()=>{drag=null;root.classList.remove("is-dragging");};root.addEventListener("pointerup",end);root.addEventListener("pointercancel",end);
  document.getElementById("ops-zoom-in")?.addEventListener("click",()=>zoom(.75));
  document.getElementById("ops-zoom-out")?.addEventListener("click",()=>zoom(1.33));
  document.getElementById("ops-zoom-reset")?.addEventListener("click",()=>{box={x:0,y:0,w:1000,h:700};tooltip.hidden=true;draw();});
  root.addEventListener("wheel",e=>{if(!e.ctrlKey)return;e.preventDefault();zoom(e.deltaY<0?.88:1.12);},{passive:false});
})();
