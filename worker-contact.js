/**
 * LaBible.app — Worker du formulaire de contact
 * =============================================
 *
 * Route :   labible.app/api/contact   (POST, JSON)
 * Binding : « EMAIL » — type « Email send » (Email Routing), avec pour
 *           destination une adresse DEJA VERIFIEE dans Email Routing.
 *
 * POURQUOI UN WORKER ET PAS UNE PAGES FUNCTION
 * Les Pages Functions ne supportent pas le binding « send_email » (confirme
 * par Cloudflare). Il faut donc un Worker autonome, place sur une route du
 * meme domaine : labible.app/api/contact
 *
 * CE QUI N'EST PAS DANS CE FICHIER, ET NE DOIT PAS Y ETRE
 * Aucune adresse e-mail en clair. La destination vient du binding, cote
 * Cloudflare. C'est la meme regle que partout ailleurs dans le projet :
 * rien de sensible dans un fichier qui peut etre lu.
 *
 * DEUX API POSSIBLES SELON LE BINDING
 * Cloudflare a deux generations de binding d'envoi :
 *   - recente  : env.EMAIL.send({ to, from, subject, text, html })
 *   - ancienne : new EmailMessage(from, to, mimeBrut) + env.EMAIL.send(...)
 * Le code detecte laquelle est disponible et construit le MIME lui-meme si
 * besoin — sans dependance externe, donc deployable par simple copier-coller
 * dans l'editeur du tableau de bord.
 */

const ORIGINE = "https://labible.app";
const EXPEDITEUR = "contact@labible.app";   // doit appartenir au domaine
const SUJET_PREFIXE = "[LaBible.app] Message du site";

const MAX_NOM = 80;
const MAX_MAIL = 160;
const MAX_MSG = 4000;
const MIN_MSG = 10;
const DELAI_MIN_MS = 3000;   // moins de 3 s entre ouverture et envoi = robot

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return preflight();
    if (request.method !== "POST") return json(405, { erreur: "Méthode non autorisée." });

    // Le formulaire est servi par labible.app : tout envoi venant d'ailleurs
    // est soit un test, soit un robot. On refuse sans explication utile.
    const origine = request.headers.get("Origin") || "";
    if (origine && origine !== ORIGINE) return json(403, { erreur: "Origine non autorisée." });

    let d;
    try {
      d = await request.json();
    } catch {
      return json(400, { erreur: "Requête illisible." });
    }

    const nom = txt(d.nom, MAX_NOM);
    const mail = txt(d.email, MAX_MAIL);
    const message = txt(d.message, MAX_MSG);
    const piege = txt(d.site, 200);
    const t0 = Number(d.t0) || 0;

    // --- Les deux filtres anti-robot, cote serveur cette fois -------------
    // Reponse 200 volontairement : un robot qui recoit une erreur reessaie
    // en changeant de tactique ; un robot qui recoit « envoye » s'en va.
    if (piege) return json(200, { ok: true });
    if (!t0 || Date.now() - t0 < DELAI_MIN_MS) return json(200, { ok: true });

    // --- Validation ------------------------------------------------------
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
      return json(400, { erreur: "Adresse e-mail invalide." });
    }
    if (message.length < MIN_MSG) {
      return json(400, { erreur: "Message trop court." });
    }

    // --- Composition -----------------------------------------------------
    // L'adresse du visiteur va en Reply-To, JAMAIS en From : un From qui ne
    // correspond pas au domaine expediteur casse SPF/DKIM et fait tomber le
    // message en indesirable. En Reply-To, « Repondre » fonctionne quand meme.
    const sujet = `${SUJET_PREFIXE}${nom ? " — " + nom : ""}`;
    const corps =
      `De      : ${nom || "(sans nom)"} <${mail}>\n` +
      `Recu le : ${new Date().toISOString()}\n` +
      `${"-".repeat(56)}\n\n` +
      `${message}\n`;

    try {
      await envoyer(env, { sujet, corps, replyTo: mail });
    } catch (e) {
      // Le detail part dans les logs du Worker, jamais vers le visiteur.
      console.error("Envoi impossible :", e && e.message ? e.message : e);
      return json(502, { erreur: "L'envoi a échoué. Réessayez dans un instant." });
    }

    return json(200, { ok: true });
  },
};

/* ---------------------------------------------------------------------- */

async function envoyer(env, { sujet, corps, replyTo }) {
  const binding = env.EMAIL;
  if (!binding) throw new Error("Binding EMAIL absent");

  // Le destinataire est fixe par le binding cote Cloudflare. Certaines
  // versions exigent quand meme un « to » : on lit celui declare dans la
  // variable DESTINATAIRE si elle existe, sinon on laisse le binding decider.
  const to = env.DESTINATAIRE || undefined;

  // --- API recente : un objet simple ------------------------------------
  try {
    await binding.send({
      to,
      from: EXPEDITEUR,
      replyTo,
      subject: sujet,
      text: corps,
    });
    return;
  } catch (e) {
    // Une API absente leve TypeError ; une vraie erreur d'envoi, non.
    // On ne retombe sur le MIME que dans le premier cas.
    if (!(e instanceof TypeError)) throw e;
  }

  // --- API ancienne : message MIME complet ------------------------------
  const { EmailMessage } = await import("cloudflare:email");
  if (!to) throw new Error("DESTINATAIRE requis par l'ancienne API");
  const brut = mime({ from: EXPEDITEUR, to, replyTo, sujet, corps });
  await binding.send(new EmailMessage(EXPEDITEUR, to, brut));
}

/** MIME minimal, texte seul, UTF-8. Sans dependance. */
function mime({ from, to, replyTo, sujet, corps }) {
  const id = `<${crypto.randomUUID()}@labible.app>`;
  return [
    `From: LaBible.app <${from}>`,
    `To: <${to}>`,
    `Reply-To: <${replyTo}>`,
    `Message-ID: ${id}`,
    `Date: ${new Date().toUTCString()}`,
    `Subject: ${encodeEntete(sujet)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="utf-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64(corps),
  ].join("\r\n");
}

/** Un sujet accentue doit etre encode (RFC 2047), sinon il arrive casse. */
function encodeEntete(s) {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
}

function b64(s) {
  const o = new TextEncoder().encode(s);
  let bin = "";
  for (const x of o) bin += String.fromCharCode(x);
  return btoa(bin);
}

function txt(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function entetes() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ORIGINE,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
  };
}

function json(code, obj) {
  return new Response(JSON.stringify(obj), { status: code, headers: entetes() });
}

function preflight() {
  return new Response(null, { status: 204, headers: entetes() });
}
