function normalizeBook(raw, fallback){
  // 0) Se o JSON vier como { "Ésaïe": { ...capítulos... } }
  // pega a única chave do topo como "nome do livro" e usa o objeto interno como capítulos
  let detectedName = null;
  let payload = raw;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const keys = Object.keys(raw);

    // Caso típico: 1 única chave no topo (nome do livro)
    if (keys.length === 1) {
      const k0 = keys[0];
      const v0 = raw[k0];

      // e o valor parece ser um mapa de capítulos "1","2","3"...
      if (v0 && typeof v0 === "object" && !Array.isArray(v0)) {
        const chapKeys = Object.keys(v0).filter(k => /^\d+$/.test(k));
        if (chapKeys.length) {
          detectedName = k0;
          payload = v0; // agora payload é "capítulos"
        }
      }
    }
  }

  const name = fallback?.name || detectedName || raw?.name || raw?.title || raw?.nom || "Livre";
  const abbr = Array.isArray(raw?.abbr) ? raw.abbr
            : (Array.isArray(raw?.abbrev) ? raw.abbrev
            : (fallback?.abbr || []));

  // 1) tenta apanhar capítulos em vários campos comuns
  let chapters =
    payload?.chapters || payload?.chapter || payload?.capitres || payload?.contents || payload?.text;

  // 2) se payload é mapa { "1": {...}, "2": {...} } (capítulos)
  if (!chapters && payload && typeof payload === "object" && !Array.isArray(payload)) {
    const keys = Object.keys(payload);
    const looksLikeChapters = keys.length && keys.every(k => /^\d+$/.test(k));
    if (looksLikeChapters) chapters = payload;
  }

  // 3) converter mapa de capítulos -> array
  if (chapters && !Array.isArray(chapters) && typeof chapters === "object") {
    const cKeys = Object.keys(chapters).filter(k => /^\d+$/.test(k)).sort((a,b)=>+a-+b);
    chapters = cKeys.map(k => chapters[k]);
  }

  if (!Array.isArray(chapters)) chapters = [];

  // 4) converter cada capítulo para array de versículos
  chapters = chapters.map(ch => {
    // formato do teu: { "1":"texto", "2":"texto"... }
    if (ch && typeof ch === "object" && !Array.isArray(ch)) {
      const vKeys = Object.keys(ch).filter(k => /^\d+$/.test(k)).sort((a,b)=>+a-+b);
      return vKeys.map(k => String(ch[k] ?? ""));
    }

    // array simples ["texto","texto"...]
    if (Array.isArray(ch)) {
      // array de objetos [{text:""}]
      if (ch.length && typeof ch[0] === "object") {
        return ch.map(v => String(v.text ?? v.t ?? v.value ?? v.val ?? v.verseText ?? ""));
      }
      return ch.map(v => String(v ?? ""));
    }

    return [];
  });

  return { id: fallback.id, name, abbr, chapters };
}
