async function loadBible(){
  const res = await fetch(BOOKS_INDEX_URL, { cache:"no-store" });
  if(!res.ok) throw new Error(`Index introuvable: ${BOOKS_INDEX_URL} (HTTP ${res.status})`);

  const idx = await res.json();

  // ✅ aceita: [ ... ] OU { books: [ ... ] }
  const booksArr = Array.isArray(idx) ? idx : idx.books;

  if(!Array.isArray(booksArr) || !booksArr.length){
    throw new Error("books.json invalide (array attendu ou {books:[...]}).");
  }

  state.bible = {
    meta: {
      name: (idx && !Array.isArray(idx) && idx.version) ? idx.version : "LSG1910",
      title: (idx && !Array.isArray(idx) && idx.title) ? idx.title : "LSG1910",
      language: (idx && !Array.isArray(idx) && idx.language) ? idx.language : "fr"
    },
    books: booksArr.map((b,i)=>({
      id: b.id || b.slug || b.code || String(i),
      name: b.name || b.title || b.nom || `Livre ${i+1}`,
      file: b.file || null,              // ✅ usa file se existir
      abbr: Array.isArray(b.abbr) ? b.abbr : (Array.isArray(b.abbrev) ? b.abbrev : [])
    }))
  };

  initSelectors();
  restoreLastRef();

  $("#bookSelect").value = String(state.current.book);
  await ensureBookLoaded(state.current.book);
  refreshChapterSelect();
  renderReading();

  await computeVerseOfDay();
}