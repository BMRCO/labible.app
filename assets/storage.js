export const STORAGE_KEYS = {
  schema: "labible:schema",
  settings: "labible:settings",
  lastRead: "labible:lastRead",
  favorites: "labible:favorites",
  planDone: "labible:planDone",
  cachePlan: "labible:cachePlan",
  cacheVdd: "labible:cacheVdd",
};

const SCHEMA_VERSION = 3;

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function migrateIfNeeded() {
  const v = Number(localStorage.getItem(STORAGE_KEYS.schema) || "0");
  if (v >= SCHEMA_VERSION) return;

  if (!localStorage.getItem(STORAGE_KEYS.settings)) {
    saveJSON(STORAGE_KEYS.settings, { theme: "system", fontScale: 100 });
  }
  if (!localStorage.getItem(STORAGE_KEYS.favorites)) {
    saveJSON(STORAGE_KEYS.favorites, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.planDone)) {
    saveJSON(STORAGE_KEYS.planDone, {});
  }

  localStorage.setItem(STORAGE_KEYS.schema, String(SCHEMA_VERSION));
}

export function getSettings() {
  return loadJSON(STORAGE_KEYS.settings, { theme: "system", fontScale: 100 });
}

export function setSettings(partial) {
  const cur = getSettings();
  const next = { ...cur, ...partial };
  saveJSON(STORAGE_KEYS.settings, next);
  return next;
}

export function resetSettings() {
  const def = { theme: "system", fontScale: 100 };
  saveJSON(STORAGE_KEYS.settings, def);
  return def;
}
