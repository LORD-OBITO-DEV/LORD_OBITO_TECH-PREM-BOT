import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const locales = {};

// Corriger le chemin pour ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin vers le dossier locales
const localesPath = path.join(__dirname, 'locales');

// Charger les fichiers de langue
fs.readdirSync(localesPath).forEach(file => {
  if (file.endsWith('.json')) {
    const lang = file.replace('.json', '');
    try {
      const content = JSON.parse(fs.readFileSync(path.join(localesPath, file), 'utf8'));
      locales[lang] = content;
    } catch (err) {
      console.error(`Erreur de chargement langue "${lang}" :`, err.message);
    }
  }
});

/**
 * Fonction de traduction
 * @param {string} lang - Langue (ex: 'fr', 'en')
 * @param {string} key - Clé de la traduction (ex: 'welcome')
 * @returns {string} - Texte traduit ou la clé si manquante
 */
export function t(lang, key) {
  if (locales[lang] && locales[lang][key]) {
    return locales[lang][key];
  }
  // fallback en français
  if (locales['fr'] && locales['fr'][key]) {
    return locales['fr'][key];
  }
  return key;
}