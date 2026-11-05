import { OrcidResearcherProfile } from './orcid-public-api.service';

/*
 * Détection du français dans la biographie, sans librairie : mots-outils, élisions et densité d'accents,
 * comparés aux mots-outils anglais. Les marqueurs faibles existent aussi dans d'autres langues romanes,
 * d'où leur faible poids.
 */
const STRONG_FRENCH_MARKERS = new Set([
  'etre', 'ete', 'avec', 'dans', 'nous', 'vous', 'qui', 'tres', 'ou', 'deja', 'ainsi',
  'cependant', 'egalement', 'toujours', 'donc', 'aussi', 'pour', 'chez', 'sans', 'mais',
  'pas', 'ne', 'sont', 'ont', 'fait', 'leur', 'leurs', 'depuis', 'entre', 'comme', 'alors',
  'ses', 'cette', 'ces', 'quelque', 'lorsque', 'puisque', 'neanmoins', 'voila', 'hui',
  'notre', 'votre', 'celui', 'celle', 'ceux', 'plusieurs', 'chaque', 'tant', 'et',
]);
const WEAK_FRENCH_MARKERS = new Set(['de', 'des', 'du', 'un', 'une', 'le', 'la', 'les', 'au', 'aux', 'en']);
const STRONG_ENGLISH_MARKERS = new Set([
  'the', 'and', 'of', 'is', 'this', 'that', 'with', 'for', 'are', 'have', 'to', 'it',
  'in', 'on', 'which', 'who', 'about', 'these', 'those', 'because', 'as', 'was', 'were',
  'been', 'will', 'would', 'can', 'could', 'should', 'not', 'from', 'by', 'an', 'at',
  'but', 'or', 'if', 'so', 'than', 'then', 'when', 'where', 'what', 'how', 'my', 'your',
  'his', 'her', 'their', 'our', 'its',
]);
const FRENCH_ELISION_RE = /\b(?:qu|jusqu|puisqu|lorsqu|quoiqu)['’]|\b[ldnsjmct]['’]/gi;
// Exclut volontairement les trémas allemands et les accents espagnols.
const FRENCH_ACCENT_RE = /[éèêàâçîïôû]/gi;

const FRENCH_SCORE_THRESHOLD = 0.26;
const WEAK_MARKER_WEIGHT = 0.2;
const ELISION_WEIGHT = 2.5;
const ACCENT_DENSITY_COEFFICIENT = 3;
const ACCENT_BONUS_CAP = 1;

/** Heuristique, pas une détection fiable : sert à masquer les biographies dans une autre langue. */
export function isFrenchText(text: string): boolean {
  const normalized = text.toLowerCase()
    .replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u').replace(/ç/g, 'c').replace(/[ïî]/g, 'i');
  const words = normalized.match(/[a-z]+/g) ?? [];
  if (words.length === 0) {
    return false;
  }

  const elisionCount = (text.match(FRENCH_ELISION_RE) ?? []).length;
  const strongHits = words.filter((word) => STRONG_FRENCH_MARKERS.has(word)).length;
  const weakHits = words.filter((word) => WEAK_FRENCH_MARKERS.has(word)).length;
  const englishHits = words.filter((word) => STRONG_ENGLISH_MARKERS.has(word)).length;
  const accentCount = (text.match(FRENCH_ACCENT_RE) ?? []).length;

  const accentBonus = Math.min((accentCount / words.length) * ACCENT_DENSITY_COEFFICIENT, ACCENT_BONUS_CAP);
  const frenchScore = (strongHits * 2 + weakHits * WEAK_MARKER_WEIGHT + elisionCount * ELISION_WEIGHT) / words.length + accentBonus;
  const englishScore = (englishHits * 2) / words.length;

  return frenchScore >= FRENCH_SCORE_THRESHOLD && frenchScore > englishScore;
}

/** Biographie affichée : seulement si elle est rédigée en français. */
export function hasFrenchBiography(profile: OrcidResearcherProfile): boolean {
  return !!profile.biography && isFrenchText(profile.biography);
}

/** Vrai si l'onglet Présentation a quelque chose à montrer au-delà du lien vers ORCID. */
export function hasPresentationContent(profile: OrcidResearcherProfile | null): boolean {
  if (!profile) {
    return false;
  }
  return hasFrenchBiography(profile) || [
    profile.distinctions,
    profile.invitedPositions,
    profile.memberships,
    profile.services,
    profile.educations,
  ].some((entries) => entries?.length > 0);
}
