const $ = id => document.getElementById(id);

let DB = null;
let books = [];
let chapters = new Map();

function normalize(s){
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"");
}

function slugify(name){
  return normalize(name)
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-|-$/g,"");
}

async function load(){
  DB = await fetch("/data/segond_1910.json").then(r=>r.json());

  const map = new Map();
  DB.verses.forEach(v=>{
    if(!map.has(v.book)){
      map.set(v.book,v.book_name);
    }
    if(!chapters.has(v.book)){
      chapters.set(v.book,new Set());
    }
    chapters.get(v.book).add(v.chapter);
  });

  books = Array.from(map.entries())
    .map(([book,name])=>({book,name,slug:slugify(name)}))
    .sort((a,b)=>a.book-b.book);

  $("book").innerHTML =
    books.map(b=>`<option value="${b.book}">${b.name}</option>`).join("");

  $("book").onchange = ()=> updateChapters();
  updateChapters();

  parseUrl();
}

function updateChapters(){
  const b = Number($("book").value);
  const ch = Array.from(chapters.get(b)).sort((a,b)=>a-b);

  $("chap").innerHTML =
    ch.map(c=>`<option value="${c}">${c}</option>`).join("");

  $("chap").onchange = ()=> render();
  render();
}

function render(){
  const b = Number($("book").value);
  const c = Number($("chap").value);

  const bookObj = books.find(x=>x.book===b);
  history.replaceState(null,"",`/${bookObj.slug}/${c}`);

  $("title").textContent = `${bookObj.name} ${c}`;

  const verses = DB.verses
    .filter(v=>v.book===b && v.chapter===c)
    .sort((a,b)=>a.verse-b.verse);

  $("content").innerHTML = verses.map(v=>`
    <p id="v${v.verse}">
      <b>${v.verse}</b> ${v.text}
      <button onclick="share('${bookObj.name}',${c},${v.verse},\`${v.text.replace(/`/g,"")}\`)" class="sharebtn">🔗</button>
    </p>
  `).join("");
}

function share(book,chap,verse,text){
  const url = `${location.origin}/${slugify(book)}/${chap}#v${verse}`;
  const full = `${book} ${chap}:${verse}\n\n${text}\n\n${url}`;

  if(navigator.share){
    navigator.share({title:"La Bible",text:full,url});
  }else{
    navigator.clipboard.writeText(full);
    alert("Copié ✅");
  }
}

function parseUrl(){
  const parts = location.pathname.split("/").filter(Boolean);
  if(parts.length>=2){
    const slug = parts[0];
    const chap = Number(parts[1]);
    const bookObj = books.find(b=>b.slug===slug);
    if(bookObj){
      $("book").value = bookObj.book;
      updateChapters();
      $("chap").value = chap;
      render();
    }
  }
}

document.addEventListener("DOMContentLoaded",load);