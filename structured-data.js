// structured-data.js — JSON-LD (SEO) LaBible.app
(function () {
  try {
    const data = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "LaBible.app",
      "url": "https://labible.app/",
      "description": "Lire la Bible en ligne gratuitement – Louis Segond 1910 (LSG). Recherche rapide, favoris et plan de lecture.",
      "inLanguage": "fr",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://labible.app/?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
  } catch (e) {
    console.log("structured-data error", e);
  }
})();