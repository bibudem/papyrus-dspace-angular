import { DSpaceObject } from '../../../../../app/core/shared/dspace-object.model';

/**
 * « Prénom Nom » d'une Person pour sa fiche, ou null s'il manque le prénom ou le nom.
 * Les listes de résultats gardent « Nom, Prénom », cohérent avec le tri par nom de famille.
 */
export function getPersonDisplayName(dso: DSpaceObject | undefined): string | null {
  const givenName = dso?.firstMetadataValue('person.givenName');
  const familyName = dso?.firstMetadataValue('person.familyName');
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
