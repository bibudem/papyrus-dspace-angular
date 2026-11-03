import { DSpaceObject } from '../../../../../app/core/shared/dspace-object.model';
import { MetadataMapInterface } from '../../../../../app/core/shared/metadata.models';
import { Metadata } from '../../../../../app/core/shared/metadata.utils';

/**
 * « Prénom Nom » d'une Person, ou null s'il manque le prénom ou le nom.
 * `hitHighlights` conserve le surlignage de la recherche ; `escapeHTML` est requis pour [innerHTML].
 */
export function getPersonDisplayName(
  dso: DSpaceObject | undefined,
  hitHighlights?: MetadataMapInterface,
  escapeHTML = false,
): string | null {
  if (!dso) {
    return null;
  }
  const givenName = Metadata.firstValue(dso.metadata, 'person.givenName', hitHighlights, undefined, escapeHTML);
  const familyName = Metadata.firstValue(dso.metadata, 'person.familyName', hitHighlights, undefined, escapeHTML);
  return givenName && familyName ? `${givenName} ${familyName}` : null;
}

/** Remet en ordre « Prénom Nom » un libellé déjà calculé par DSpace sous la forme « Nom, Prénom ». */
export function toGivenFamilyOrder(name: string): string {
  const separator = name.indexOf(', ');
  if (separator < 0) {
    return name;
  }
  return `${name.slice(separator + 2)} ${name.slice(0, separator)}`;
}
