import { isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable, makeStateKey, PLATFORM_ID, StateKey, TransferState } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map, retry, shareReplay, switchMap, tap } from 'rxjs/operators';

// ══════════════════════════════════════════════════════════════════════════════
// Modèles publics
// ══════════════════════════════════════════════════════════════════════════════

/** Chercheur UdeM (version légère, utilisée dans la liste paginée). */
export interface OrcidMember {
  orcidId: string;
  orcidUri: string;
  givenName: string;
  familyName: string;
  creditName?: string;
  biography?: string;
}

/** Résultat paginé d'une recherche de membres UdeM sur ORCID. */
export interface OrcidMembersPage {
  members: OrcidMember[];
  totalResults: number;
}

/** Financement (bourse, subvention) déclaré sur ORCID. */
export interface OrcidFunding {
  putCode: number;
  title: string;
  type: string;
  organizationName?: string;
  startYear?: number;
  endYear?: number;
}

/** Lien externe déclaré par le chercheur sur son profil ORCID (ex. page personnelle). */
export interface OrcidResearcherUrl {
  name: string;
  url: string;
}

/**
 * Entrée d'affiliation ORCID (distinction, diplôme, adhésion, qualification ou service) — ces
 * 5 catégories partagent la même forme de données côté API ORCID (modèle "Affiliations" v3).
 */
export interface OrcidAffiliationEntry {
  putCode: number;
  roleTitle?: string;
  departmentName?: string;
  organizationName?: string;
  city?: string;
  country?: string;
  startYear?: number;
  endYear?: number;
}

/** Activité de révision par les pairs déclarée sur ORCID. */
export interface OrcidPeerReview {
  reviewerRole?: string;
  reviewType?: string;
  organizationName?: string;
  year?: number;
}

/** Ressource de recherche (infrastructure, équipement) utilisée, déclarée sur ORCID. */
export interface OrcidResearchResource {
  title?: string;
  organizationName?: string;
  startYear?: number;
  endYear?: number;
}

/** Publication enregistrée dans la liste de travaux ORCID. */
export interface OrcidWork {
  putCode: number;
  title: string;
  type: string;
  publicationYear?: number;
  journalTitle?: string;
  doi?: string;
  /** URL résolue du DOI ou URL déclarée sur le travail ORCID. */
  doiUrl?: string;
  workUrl?: string;
}

/** Profil complet d'un chercheur (page de détail). */
export interface OrcidResearcherProfile {
  orcidId: string;
  orcidUri: string;
  givenName: string;
  familyName: string;
  creditName?: string;
  biography?: string;
  /** Pays de résidence déclaré sur ORCID (nom localisé, ex. "Canada"), s'il est renseigné. */
  country?: string;
  keywords: string[];
  researcherUrls: OrcidResearcherUrl[];
  /** Triés du plus récent au plus ancien. */
  fundings: OrcidFunding[];
  /** Triées par année de publication décroissante. */
  works: OrcidWork[];
  worksTotal: number;
  distinctions: OrcidAffiliationEntry[];
  /** "Diplômes" — correspond à la section "educations" d'ORCID. */
  educations: OrcidAffiliationEntry[];
  memberships: OrcidAffiliationEntry[];
  qualifications: OrcidAffiliationEntry[];
  /** Champ fourre-tout côté ORCID (comités, bénévolat, etc.). */
  services: OrcidAffiliationEntry[];
  peerReviews: OrcidPeerReview[];
  researchResources: OrcidResearchResource[];
}

// ══════════════════════════════════════════════════════════════════════════════
// Types internes — contrats des endpoints ORCID v3.0
// ══════════════════════════════════════════════════════════════════════════════

interface OrcidSearchResponse {
  result: Array<{ 'orcid-identifier': { uri: string; path: string } }> | null;
  'num-found': number;
}

interface OrcidPersonResponse {
  name: {
    'given-names'?: { value: string };
    'family-name'?: { value: string };
    'credit-name'?: { value: string };
  } | null;
  biography?: { content: string | null } | null;
  keywords?: { keyword: Array<{ content: string }> | null } | null;
  addresses?: {
    address: Array<{ country?: { value: string } | null }> | null;
  } | null;
  'researcher-urls'?: {
    'researcher-url': Array<{ 'url-name'?: string | null; url: { value: string } }> | null;
  } | null;
}

/** Année ORCID au format `{ year: { value: "2024" } }`, commune à tous les endpoints. */
interface OrcidDateParts {
  year?: { value: string } | null;
}

interface OrcidFundingsResponse {
  group: Array<{
    'funding-summary': Array<{
      'put-code': number;
      title: { title: { value: string } };
      type: string;
      organization?: { name: string } | null;
      'start-date'?: OrcidDateParts | null;
      'end-date'?: OrcidDateParts | null;
    }>;
  }> | null;
}

interface OrcidWorksResponse {
  group: Array<{
    'work-summary': Array<{
      'put-code': number;
      title: { title: { value: string } };
      type: string;
      'publication-date'?: OrcidDateParts | null;
      'journal-title'?: { value: string } | null;
      'external-ids'?: {
        'external-id': Array<{
          'external-id-type': string;
          'external-id-value': string;
          'external-id-url'?: { value: string } | null;
        }> | null;
      } | null;
      url?: { value: string } | null;
    }>;
  }> | null;
}

/**
 * Forme commune aux 5 catégories d'affiliation ORCID (distinctions, educations,
 * memberships, qualifications, services) — modèle "Affiliations" v3 unifié, vérifié contre
 * l'API réelle (ex. employment-summary, qui a la même forme).
 */
interface OrcidAffiliationSummaryRaw {
  'put-code': number;
  'department-name'?: string | null;
  'role-title'?: string | null;
  'start-date'?: OrcidDateParts | null;
  'end-date'?: OrcidDateParts | null;
  organization?: {
    name: string;
    address?: { city?: string | null; country?: string | null } | null;
  } | null;
}

/** Enveloppe commune aux endpoints d'affiliation (ex. /distinctions, /memberships...). */
interface OrcidAffiliationGroupResponse {
  'affiliation-group': Array<{
    summaries: Array<Record<string, OrcidAffiliationSummaryRaw>>;
  }> | null;
}

interface OrcidPeerReviewsResponse {
  group: Array<{
    'peer-review-group': Array<{
      'peer-review-summary': Array<{
        'reviewer-role'?: string | null;
        'review-type'?: string | null;
        'completion-date'?: OrcidDateParts | null;
        'convening-organization'?: { name: string } | null;
      }>;
    }> | null;
  }> | null;
}

/**
 * Section ORCID récente et peu répandue — forme best-effort (non vérifiée sur un profil réel
 * faute d'exemple public disponible), tolérante aux champs manquants comme le reste du mapping.
 */
interface OrcidResearchResourcesResponse {
  group: Array<{
    'research-resource-summary'?: Array<{
      proposal?: {
        title?: { title?: { value: string } | null } | null;
        hosts?: { organization?: Array<{ name: string }> | null } | null;
        'start-date'?: OrcidDateParts | null;
        'end-date'?: OrcidDateParts | null;
      } | null;
    }> | null;
  }> | null;
}

/**
 * Réponse de /activities : regroupe en un seul appel toutes les sections d'activités (au lieu
 * d'un appel par section), y compris travaux et financements — remplace les anciens appels
 * séparés /works et /fundings.
 */
interface OrcidActivitiesResponse {
  distinctions?: OrcidAffiliationGroupResponse | null;
  educations?: OrcidAffiliationGroupResponse | null;
  memberships?: OrcidAffiliationGroupResponse | null;
  qualifications?: OrcidAffiliationGroupResponse | null;
  services?: OrcidAffiliationGroupResponse | null;
  'peer-reviews'?: OrcidPeerReviewsResponse | null;
  'research-resources'?: OrcidResearchResourcesResponse | null;
  fundings?: OrcidFundingsResponse | null;
  works?: OrcidWorksResponse | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Constantes
// ══════════════════════════════════════════════════════════════════════════════

/** URL de base de l'API publique ORCID (sans authentification requise). */
const API_BASE = 'https://pub.orcid.org/v3.0';

/** En-tête Accept pour les réponses au format JSON ORCID. */
const HEADERS = new HttpHeaders({ Accept: 'application/vnd.orcid+json' });

/**
 * Durée de vie du cache : 30 minutes. Les profils ORCID (bio, travaux, financements) changent
 * rarement d'une minute à l'autre ; une fenêtre plus large que la précédente (5 min) réduit
 * nettement le nombre d'appels à l'API publique ORCID sans sacrifier la fraîcheur perçue.
 */
const CACHE_TTL_MS = 30 * 60 * 1000;

/** Préfixe des clés localStorage, pour ne pas entrer en collision avec d'autres usages. */
const STORAGE_PREFIX = 'papyrus-annuaires:orcid-cache:';

/**
 * Requête Lucene de base pour les membres UdeM.
 * Les deux variantes couvrent les enregistrements avec et sans accents.
 */
const AFFIL_QUERY =
  '(affiliation-org-name:"Université de Montréal" OR affiliation-org-name:"Universite de Montreal")';

// ══════════════════════════════════════════════════════════════════════════════
// Service
// ══════════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class OrcidPublicApiService {
  /**
   * HttpClient instancié depuis HttpBackend pour contourner TOUS les intercepteurs DSpace.
   * Raison : auth.interceptor.ts injecte un token Bearer DSpace sur toutes les requêtes.
   * Ce token est invalide pour pub.orcid.org et provoque des erreurs 401.
   */
  private readonly http = new HttpClient(inject(HttpBackend));

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Transmet au navigateur les données déjà récupérées pendant le rendu serveur (SSR), pour
   * qu'il n'ait pas à rappeler l'API ORCID une seconde fois juste après l'hydratation — sans
   * ça, le même code s'exécute une fois sur le serveur Node puis une seconde fois dans le
   * navigateur, qui ignore que le serveur a déjà fait l'appel.
   */
  private readonly transferState = inject(TransferState);

  /**
   * Cache générique : clé → { données + expiry }.
   * Stocke indifféremment les pages de recherche et les profils complets.
   * Doublé d'une copie dans localStorage (voir readPersisted/writePersisted) pour survivre
   * aux rechargements de page et aux rendus SSR successifs, qui recréent sinon ce service (et
   * donc cette Map) à chaque fois.
   */
  private readonly cache = new Map<string, { data: unknown; expiresAt: number }>();

  /**
   * Table des requêtes en cours.
   * Évite les doublons de requêtes réseau pour des clés identiques.
   */
  private readonly inflight = new Map<string, Observable<unknown>>();

  // ── Méthodes publiques ────────────────────────────────────────────────────

  /**
   * Recherche les membres UdeM enregistrés sur ORCID, avec pagination et filtre nom.
   *
   * @param page       Page 0-indexée.
   * @param pageSize   Résultats par page.
   * @param nameFilter Filtre optionnel prénom/nom (recherche préfixe).
   */
  searchUdeMMembers(page: number, pageSize: number, nameFilter = ''): Observable<OrcidMembersPage> {
    const key = `search|${page}|${pageSize}|${nameFilter}`;
    return this.getCachedOrFetch<OrcidMembersPage>(key, () =>
      this.fetchSearchPage(page, pageSize, nameFilter),
    );
  }

  /**
   * Récupère le profil complet d'un chercheur : infos personnelles, financements
   * et liste de publications. Combine trois endpoints ORCID en parallèle.
   *
   * @param orcidId Identifiant ORCID au format 0000-0000-0000-0000.
   */
  getResearcherProfile(orcidId: string): Observable<OrcidResearcherProfile> {
    const key = `profile|${orcidId}`;
    return this.getCachedOrFetch<OrcidResearcherProfile>(key, () =>
      this.fetchProfile(orcidId),
    );
  }

  // ── Cache générique ───────────────────────────────────────────────────────

  /**
   * Retourne la valeur mise en cache si elle est valide (TransferState en provenance du SSR,
   * puis mémoire, puis localStorage), partage la requête en vol si elle est déjà en cours,
   * sinon déclenche un nouvel appel HTTP.
   */
  private getCachedOrFetch<T>(key: string, factory: () => Observable<T>): Observable<T> {
    // Donnée transmise par le rendu SSR pour cette même clé : le serveur l'a déjà récupérée
    // il y a quelques instants, pas besoin que le navigateur la redemande. Lue une seule fois
    // (removeKey) : le cache mémoire/localStorage prend ensuite le relais normalement pour le
    // reste de la session (navigation vers d'autres fiches, etc.).
    const transferKey = this.transferStateKey<T>(key);
    if (this.isBrowser && this.transferState.hasKey(transferKey)) {
      const transferred = this.transferState.get(transferKey, null);
      this.transferState.remove(transferKey);
      if (transferred) {
        this.cache.set(key, transferred);
        this.writePersisted(key, transferred);
        return of(transferred.data);
      }
    }

    const cached = this.cache.get(key) ?? this.readPersisted<T>(key);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        // Remonte en mémoire une entrée trouvée seulement dans localStorage, pour éviter de
        // reparser le JSON à chaque appel tant qu'elle reste valide.
        this.cache.set(key, cached);
        return of(cached.data as T);
      }
      // Entrée périmée : nettoyage opportuniste pour que localStorage ne grossisse pas
      // indéfiniment au fil des profils consultés au cours de nombreuses sessions.
      this.removePersisted(key);
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Observable<T>;
    }

    const req$ = factory().pipe(
      tap((data) => {
        const entry = { data, expiresAt: Date.now() + CACHE_TTL_MS };
        this.cache.set(key, entry);
        this.writePersisted(key, entry);
        if (!this.isBrowser) {
          // Rendu SSR : transmet le résultat au navigateur pour lui éviter de refaire cet
          // appel juste après l'hydratation (voir le commentaire au-dessus).
          this.transferState.set(transferKey, entry);
        }
      }),
      finalize(() => this.inflight.delete(key)),
      shareReplay(1),
    );

    this.inflight.set(key, req$);
    return req$;
  }

  /**
   * Lit une entrée de cache persistée dans localStorage. Repli silencieux sur `undefined` en
   * SSR (pas de localStorage côté serveur), en navigation privée, ou si le JSON est corrompu —
   * cette couche est un bonus de performance, jamais une dépendance bloquante.
   */
  private readPersisted<T>(key: string): { data: T; expiresAt: number } | undefined {
    if (!this.isBrowser) {
      return undefined;
    }
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? (JSON.parse(raw) as { data: T; expiresAt: number }) : undefined;
    } catch {
      return undefined;
    }
  }

  /** Écrit une entrée de cache dans localStorage ; échoue silencieusement (quota dépassé,
   * navigation privée, SSR) sans jamais bloquer le flux applicatif. */
  private writePersisted<T>(key: string, entry: { data: T; expiresAt: number }): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // Quota dépassé ou stockage indisponible : le cache mémoire reste fonctionnel.
    }
  }

  private removePersisted(key: string): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      // Sans conséquence : l'entrée périmée sera simplement ignorée à la prochaine lecture.
    }
  }

  private transferStateKey<T>(key: string): StateKey<{ data: T; expiresAt: number }> {
    return makeStateKey<{ data: T; expiresAt: number }>(`orcid:${key}`);
  }

  // ── Récupération de la page de recherche ─────────────────────────────────

  private fetchSearchPage(page: number, pageSize: number, nameFilter: string): Observable<OrcidMembersPage> {
    const query = this.buildQuery(nameFilter);
    const params = new HttpParams()
      .set('q', query)
      .set('start', String(page * pageSize))
      .set('rows', String(pageSize));

    return this.http
      .get<OrcidSearchResponse>(`${API_BASE}/search`, { headers: HEADERS, params })
      .pipe(
        tap({ error: (err) => console.warn('[ORCID] Échec de la recherche (retry en cours)', err) }),
        retry(2),
        switchMap(({ result, 'num-found': totalResults }) => {
          const ids = (result ?? []).map((r) => r['orcid-identifier'].path);

          if (ids.length === 0) return of({ members: [], totalResults });

          // Récupération parallèle des noms/biographies de la page
          return forkJoin(ids.map((id) => this.fetchPersonLight(id))).pipe(
            map((members) => ({ members, totalResults })),
          );
        }),
      );
  }

  // ── Récupération du profil complet ────────────────────────────────────────

  /**
   * Combine deux requêtes parallèles (person, activities) pour construire le profil complet du
   * chercheur. /activities regroupe en un seul appel travaux, financements, distinctions,
   * diplômes, adhésions, qualifications, services, revues par les pairs et ressources de
   * recherche — un seul appel au lieu d'un par section. Chaque requête échoue silencieusement
   * pour ne pas bloquer l'autre.
   */
  private fetchProfile(orcidId: string): Observable<OrcidResearcherProfile> {
    return forkJoin({
      person: this.fetchPersonRaw(orcidId),
      activities: this.fetchActivitiesRaw(orcidId),
    }).pipe(
      map(({ person, activities }) => this.mapProfile(orcidId, person, activities)),
    );
  }

  /** Même raisonnement de cache/catchError que fetchPersonRaw (voir son commentaire). */
  private fetchActivitiesRaw(orcidId: string): Observable<OrcidActivitiesResponse | null> {
    return this.getCachedOrFetch<OrcidActivitiesResponse>(`activities|${orcidId}`, () =>
      this.http
        .get<OrcidActivitiesResponse>(`${API_BASE}/${orcidId}/activities`, { headers: HEADERS })
        .pipe(retry(2)),
    ).pipe(
      catchError((err) => {
        console.warn(`[ORCID] /activities inaccessible pour ${orcidId}`, err);
        return of(null);
      }),
    );
  }

  // ── Mapping des modèles ───────────────────────────────────────────────────

  /** Version allégée du profil : juste nom + bio, pour la liste paginée. */
  private fetchPersonLight(orcidId: string): Observable<OrcidMember> {
    return this.fetchPersonRaw(orcidId).pipe(
      map((p) => this.mapPersonLight(orcidId, p)),
      catchError((err) => {
        console.warn(`[ORCID] Profil allégé inaccessible — ${orcidId}`, {
          status: (err as any)?.status,
          message: (err as any)?.message,
        });
        return of({ orcidId, orcidUri: `https://orcid.org/${orcidId}`, givenName: '', familyName: '' });
      }),
    );
  }

  /**
   * Appel brut à /person, partagé (et mis en cache, voir getCachedOrFetch) entre la liste de
   * résultats de recherche (fetchPersonLight) et la fiche complète (fetchProfile) : consulter
   * un profil déjà vu dans une liste ne redéclenche pas d'appel réseau.
   *
   * Le catchError reste HORS de getCachedOrFetch : sinon un échec serait mémorisé comme une
   * valeur `null` "valide" pendant toute la durée du cache (30 min), empêchant tout nouvel
   * essai avant l'expiration même si ORCID redevient disponible entre-temps.
   */
  private fetchPersonRaw(orcidId: string): Observable<OrcidPersonResponse | null> {
    return this.getCachedOrFetch<OrcidPersonResponse>(`person|${orcidId}`, () =>
      this.http
        .get<OrcidPersonResponse>(`${API_BASE}/${orcidId}/person`, { headers: HEADERS })
        .pipe(retry(2)),
    ).pipe(
      catchError((err) => {
        console.warn(`[ORCID] /person inaccessible pour ${orcidId}`, err);
        return of(null);
      }),
    );
  }

  private mapPersonLight(orcidId: string, p: OrcidPersonResponse | null): OrcidMember {
    return {
      orcidId,
      orcidUri: `https://orcid.org/${orcidId}`,
      givenName: p?.name?.['given-names']?.value ?? '',
      familyName: p?.name?.['family-name']?.value ?? '',
      creditName: p?.name?.['credit-name']?.value ?? undefined,
      biography: p?.biography?.content ?? undefined,
    };
  }

  private mapProfile(
    orcidId: string,
    person: OrcidPersonResponse | null,
    activities: OrcidActivitiesResponse | null,
  ): OrcidResearcherProfile {
    return {
      orcidId,
      orcidUri: `https://orcid.org/${orcidId}`,
      givenName: person?.name?.['given-names']?.value ?? '',
      familyName: person?.name?.['family-name']?.value ?? '',
      creditName: person?.name?.['credit-name']?.value ?? undefined,
      biography: person?.biography?.content ?? undefined,
      country: this.mapCountry(person),
      keywords: this.mapKeywords(person),
      researcherUrls: this.mapResearcherUrls(person),
      fundings: this.mapFundings(activities?.fundings ?? null),
      works: this.mapWorks(activities?.works ?? null),
      worksTotal: this.countWorks(activities?.works ?? null),
      distinctions: this.mapAffiliationGroup(activities?.distinctions, 'distinction-summary'),
      educations: this.mapAffiliationGroup(activities?.educations, 'education-summary'),
      memberships: this.mapAffiliationGroup(activities?.memberships, 'membership-summary'),
      qualifications: this.mapAffiliationGroup(activities?.qualifications, 'qualification-summary'),
      services: this.mapAffiliationGroup(activities?.services, 'service-summary'),
      peerReviews: this.mapPeerReviews(activities?.['peer-reviews']),
      researchResources: this.mapResearchResources(activities?.['research-resources']),
    };
  }

  private mapResearcherUrls(person: OrcidPersonResponse | null): OrcidResearcherUrl[] {
    return (person?.['researcher-urls']?.['researcher-url'] ?? [])
      .filter((u) => !!u.url?.value)
      .map((u) => ({ name: u['url-name']?.trim() || u.url.value, url: u.url.value }));
  }

  /**
   * Mapping générique pour les 5 catégories d'affiliation ORCID (même forme de données, voir
   * OrcidAffiliationSummaryRaw) : distinctions, diplômes, adhésions, qualifications, services.
   * @param summaryKey Nom de la clé de résumé propre à la catégorie (ex. "education-summary").
   */
  private mapAffiliationGroup(
    resp: OrcidAffiliationGroupResponse | null | undefined,
    summaryKey: string,
  ): OrcidAffiliationEntry[] {
    if (!resp?.['affiliation-group']) return [];

    return resp['affiliation-group']
      .map((group) => {
        const summary = group.summaries?.[0]?.[summaryKey];
        if (!summary) return null;

        return {
          putCode: summary['put-code'],
          roleTitle: summary['role-title'] ?? undefined,
          departmentName: summary['department-name'] ?? undefined,
          organizationName: summary.organization?.name ?? undefined,
          city: summary.organization?.address?.city ?? undefined,
          country: summary.organization?.address?.country ?? undefined,
          startYear: summary['start-date']?.year?.value
            ? parseInt(summary['start-date'].year.value, 10)
            : undefined,
          endYear: summary['end-date']?.year?.value
            ? parseInt(summary['end-date'].year.value, 10)
            : undefined,
        } as OrcidAffiliationEntry;
      })
      .filter((e): e is OrcidAffiliationEntry => e !== null)
      .sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
  }

  private mapPeerReviews(resp: OrcidPeerReviewsResponse | null | undefined): OrcidPeerReview[] {
    if (!resp?.group) return [];

    return resp.group
      .flatMap((group) => group['peer-review-group'] ?? [])
      .map((prGroup) => prGroup['peer-review-summary']?.[0])
      .filter((summary): summary is NonNullable<typeof summary> => !!summary)
      .map((summary) => ({
        reviewerRole: summary['reviewer-role'] ?? undefined,
        reviewType: summary['review-type'] ?? undefined,
        organizationName: summary['convening-organization']?.name ?? undefined,
        year: summary['completion-date']?.year?.value
          ? parseInt(summary['completion-date'].year.value, 10)
          : undefined,
      }))
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  }

  private mapResearchResources(
    resp: OrcidResearchResourcesResponse | null | undefined,
  ): OrcidResearchResource[] {
    if (!resp?.group) return [];

    return resp.group
      .map((group) => group['research-resource-summary']?.[0]?.proposal)
      .filter((proposal): proposal is NonNullable<typeof proposal> => !!proposal)
      .map((proposal) => ({
        title: proposal.title?.title?.value ?? undefined,
        organizationName: proposal.hosts?.organization?.[0]?.name ?? undefined,
        startYear: proposal['start-date']?.year?.value
          ? parseInt(proposal['start-date'].year.value, 10)
          : undefined,
        endYear: proposal['end-date']?.year?.value
          ? parseInt(proposal['end-date'].year.value, 10)
          : undefined,
      }))
      .sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
  }

  /** Convertit le code pays ISO 3166-1 (ex. "CA") en nom localisé (ex. "Canada"). */
  private mapCountry(person: OrcidPersonResponse | null): string | undefined {
    const code = person?.addresses?.address?.[0]?.country?.value;
    if (!code) return undefined;
    try {
      return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  }

  /**
   * ORCID permet un seul mot-clé par entrée, mais certains profils y mettent une liste
   * séparée par des virgules (ex. "bioethics, public health ethics, ..."). On éclate donc
   * chaque entrée sur les virgules pour afficher une pastille par mot-clé individuel.
   */
  private mapKeywords(person: OrcidPersonResponse | null): string[] {
    return (person?.keywords?.keyword ?? [])
      .flatMap((k) => (k.content ?? '').split(','))
      .map((kw) => kw.trim())
      .filter(Boolean);
  }

  private mapFundings(resp: OrcidFundingsResponse | null): OrcidFunding[] {
    if (!resp?.group) return [];

    return resp.group
      .map((group) => {
        const summary = group['funding-summary']?.[0];
        if (!summary || !summary.title?.title?.value) return null;

        return {
          putCode: summary['put-code'],
          title: summary.title.title.value,
          type: summary.type ?? 'other',
          organizationName: summary.organization?.name ?? undefined,
          startYear: summary['start-date']?.year?.value
            ? parseInt(summary['start-date'].year.value, 10)
            : undefined,
          endYear: summary['end-date']?.year?.value
            ? parseInt(summary['end-date'].year.value, 10)
            : undefined,
        } as OrcidFunding;
      })
      .filter((f): f is OrcidFunding => f !== null)
      .sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
  }

  private mapWorks(resp: OrcidWorksResponse | null): OrcidWork[] {
    if (!resp?.group) return [];

    return resp.group
      .map((group) => {
        const summary = group['work-summary']?.[0];
        if (!summary || !summary.title?.title?.value) return null;

        const doi = summary['external-ids']?.['external-id']?.find(
          (id) => id['external-id-type'] === 'doi',
        );

        return {
          putCode: summary['put-code'],
          title: summary.title.title.value,
          type: summary.type ?? 'other',
          publicationYear: summary['publication-date']?.year?.value
            ? parseInt(summary['publication-date'].year.value, 10)
            : undefined,
          journalTitle: summary['journal-title']?.value ?? undefined,
          doi: doi?.['external-id-value'] ?? undefined,
          doiUrl:
            doi?.['external-id-url']?.value ??
            (doi ? `https://doi.org/${doi['external-id-value']}` : undefined),
          workUrl: summary.url?.value ?? undefined,
        } as OrcidWork;
      })
      .filter((w): w is OrcidWork => w !== null)
      .sort((a, b) => (b.publicationYear ?? 0) - (a.publicationYear ?? 0));
  }

  private countWorks(resp: OrcidWorksResponse | null): number {
    return resp?.group?.length ?? 0;
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────

  private buildQuery(nameFilter: string): string {
    const safe = nameFilter.trim().replace(/["\\]/g, '');
    if (!safe) return AFFIL_QUERY;
    return `${AFFIL_QUERY} AND (given-names:${safe}* OR family-name:${safe}*)`;
  }
}
