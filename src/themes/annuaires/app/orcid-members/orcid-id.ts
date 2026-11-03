import { Item } from '../../../../app/core/shared/item.model';

/** Champs DSpace qui portent l'ORCID iD, par ordre de priorité. */
const ORCID_METADATA_KEYS = ['dspace.author.orcid', 'person.identifier.orcid'];

/** ORCID iD de l'item (identifiant seul ou URL orcid.org acceptés), ou null. */
export function getOrcidId(item: Item | undefined): string | null {
  for (const key of ORCID_METADATA_KEYS) {
    const raw = item?.firstMetadataValue(key);
    if (raw) {
      const id = raw.replace(/^(https?:\/\/)?orcid\.org\//, '').trim();
      return id || null;
    }
  }
  return null;
}
