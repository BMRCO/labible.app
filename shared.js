const LB={
  get theme(){return localStorage.getItem("theme")||"dark"},
  set theme(v){localStorage.setItem("theme",v)},
  get fontSize(){return parseInt(localStorage.getItem("fontSize")||"19",10)},
  set fontSize(v){localStorage.setItem("fontSize",v)},
  get poetic(){return localStorage.getItem("poetic")==="1"},
  set poetic(v){localStorage.setItem("poetic",v?"1":"0")},
  get lastRef(){return localStorage.getItem("lastRef")||"Genèse 1:1"},
  set lastRef(v){localStorage.setItem("lastRef",v)},
  get favs(){return JSON.parse(localStorage.getItem("favs")||"[]")},
  set favs(v){localStorage.setItem("favs",JSON.stringify(v))},
  get planDone(){return JSON.parse(localStorage.getItem("planDone")||"[]")},
  set planDone(v){localStorage.setItem("planDone",JSON.stringify(v))},
  get tab(){return localStorage.getItem("tab")||"today"},
  set tab(v){localStorage.setItem("tab",v)},
  applyTheme(){
    document.documentElement.setAttribute("data-theme",this.theme);
    const b=document.getElementById("themeBtn"); if(b) b.textContent=this.theme==="dark"?"☀️":"🌙";
    const m=document.getElementById("themeColorMeta"); if(m) m.content=this.theme==="dark"?"#0d0b09":"#fdf8f0";
    const t=document.getElementById("darkToggle"); if(t) t.checked=this.theme==="dark";
  },
  toggleTheme(){this.theme=this.theme==="dark"?"light":"dark";this.applyTheme();},
  applyFontSize(){
    document.documentElement.style.setProperty("--font-size",this.fontSize+"px");
    const s=document.getElementById("fontSlider"); if(s) s.value=this.fontSize;
    const l=document.getElementById("fontSizeLabel"); if(l) l.textContent=`Taille actuelle : ${this.fontSize}px`;
  }
};

let _tt;
function toast(msg,at,af){
  const t=document.getElementById("toast"),tm=document.getElementById("toastMsg"),ta=document.getElementById("toastAction");
  if(!t)return; tm.textContent=msg;
  if(at&&af){ta.style.display="";ta.textContent=at;ta.onclick=()=>{af();hideToast();};}else ta.style.display="none";
  t.classList.add("show"); clearTimeout(_tt); _tt=setTimeout(hideToast,4500);
}
function hideToast(){document.getElementById("toast")?.classList.remove("show");}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}

function initFontPanel(){
  const btn=document.getElementById("fontBtn"),panel=document.getElementById("fontPanel");
  if(!btn||!panel)return;
  btn.onclick=e=>{e.stopPropagation();panel.classList.toggle("open");};
  document.addEventListener("click",()=>panel.classList.remove("open"));
  panel.addEventListener("click",e=>e.stopPropagation());
  document.getElementById("fontMinus")?.addEventListener("click",()=>{LB.fontSize=Math.max(15,LB.fontSize-1);LB.applyFontSize();});
  document.getElementById("fontReset")?.addEventListener("click",()=>{LB.fontSize=19;LB.applyFontSize();});
  document.getElementById("fontPlus")?.addEventListener("click",()=>{LB.fontSize=Math.min(26,LB.fontSize+1);LB.applyFontSize();});
}

function initInstallBtn(){
  const btn=document.getElementById("installBtn"); if(!btn)return;
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();window._dp=e;btn.style.display="inline-flex";});
  btn.onclick=async()=>{
    if(!window._dp){toast("iPhone : Partager → Ajouter à l'écran d'accueil","OK",()=>{});return;}
    window._dp.prompt(); const{outcome}=await window._dp.userChoice;
    if(outcome==="accepted")toast("Application installée ✓"); window._dp=null;
  };
}

function initOnline(){
  const b=document.getElementById("offlineBadge"); if(!b)return;
  const upd=()=>b.classList.toggle("show",!navigator.onLine);
  window.addEventListener("online",upd);window.addEventListener("offline",upd);upd();
}

async function registerSW(){
  if(!("serviceWorker"in navigator))return;
  try{
    const reg=await navigator.serviceWorker.register("sw.js");
    reg.addEventListener("updatefound",()=>{
      const sw=reg.installing; if(!sw)return;
      sw.addEventListener("statechange",()=>{if(sw.state==="installed"&&navigator.serviceWorker.controller)toast("Mise à jour disponible.","Recharger",()=>location.reload());});
    });
  }catch(_){}
}

function bootShared(){
  LB.applyTheme(); LB.applyFontSize();
  initFontPanel(); initInstallBtn(); initOnline();
  document.getElementById("themeBtn")?.addEventListener("click",()=>LB.toggleTheme());
  document.getElementById("toastClose")?.addEventListener("click",hideToast);
  registerSW();
}
