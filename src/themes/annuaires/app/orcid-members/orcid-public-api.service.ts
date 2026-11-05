import { isPlatformBrowser } from '@angular/common';
import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import {
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  StateKey,
  TransferState,
} from '@angular/core';
import { isbot } from 'isbot';
import {
  EMPTY,
  from,
  Observable,
  of,
  throwError,
  timer,
} from 'rxjs';
import {
  catchError,
  finalize,
  map,
  mergeMap,
  retry,
  shareReplay,
  switchMap,
  tap,
  timeout,
  toArray,
} from 'rxjs/operators';

import { REQUEST } from '../../../../express.tokens';

/** Membre UdeM affiché dans la liste paginée. */
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

/** Identifiant externe d'une activité (ISSN, DOI, etc.). */
export interface OrcidExternalId {
  type: string;
  value: string;
  url?: string;
}

/** Distinction, poste invité, formation, adhésion, qualification ou service (même structure dans ORCID). */
export interface OrcidAffiliationEntry {
  putCode: number;
  roleTitle?: string;
  departmentName?: string;
  organizationName?: string;
  city?: string;
  region?: string;
  /** Nom du pays en français. */
  country?: string;
  /** Date partielle, comme sur orcid.org : AAAA, AAAA-MM ou AAAA-MM-JJ. */
  startDate?: string;
  endDate?: string;
  url?: string;
  externalIds: OrcidExternalId[];
}

/** Activité de révision par les pairs déclarée sur ORCID. */
export interface OrcidPeerReview {
  reviewerRole?: string;
  reviewType?: string;
  organizationName?: string;
  year?: number;
}

/** Ressource de recherche (infrastructure, équipement) déclarée sur ORCID. */
export interface OrcidResearchResource {
  title?: string;
  organizationName?: string;
  startYear?: number;
  endYear?: number;
}

/** Publication de la liste de travaux ORCID. */
export interface OrcidWork {
  putCode: number;
  title: string;
  type: string;
  publicationYear?: number;
  journalTitle?: string;
  doi?: string;
  /** URL résolue du DOI. */
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
  keywords: string[];
  /** Triés du plus récent au plus ancien. */
  fundings: OrcidFunding[];
  /** Triées par année de publication décroissante. */
  works: OrcidWork[];
  worksTotal: number;
  distinctions: OrcidAffiliationEntry[];
  invitedPositions: OrcidAffiliationEntry[];
  educations: OrcidAffiliationEntry[];
  memberships: OrcidAffiliationEntry[];
  qualifications: OrcidAffiliationEntry[];
  /** Comités, bénévolat, etc. */
  services: OrcidAffiliationEntry[];
  peerReviews: OrcidPeerReview[];
  researchResources: OrcidResearchResource[];
}

// Réponses de l'API ORCID v3.0
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
}

/** Date ORCID `{ year: { value: "2024" } }`, commune à tous les endpoints. */
interface OrcidDateParts {
  year?: { value: string } | null;
  month?: { value: string } | null;
  day?: { value: string } | null;
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

/** Modèle "Affiliations" v3, commun aux 6 catégories (distinctions, invited-positions, educations, memberships, qualifications, services). */
interface OrcidAffiliationSummaryRaw {
  'put-code': number;
  'department-name'?: string | null;
  'role-title'?: string | null;
  'start-date'?: OrcidDateParts | null;
  'end-date'?: OrcidDateParts | null;
  organization?: {
    name: string;
    address?: { city?: string | null; region?: string | null; country?: string | null } | null;
  } | null;
  url?: { value: string } | null;
  'external-ids'?: {
    'external-id': Array<{
      'external-id-type': string;
      'external-id-value': string;
      'external-id-url'?: { value: string } | null;
    }> | null;
  } | null;
}

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

/** Forme best-effort : non vérifiée sur un profil réel (section rare), d'où la tolérance aux champs manquants. */
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

/** Sections d'activités du dossier ORCID. */
interface OrcidActivitiesResponse {
  distinctions?: OrcidAffiliationGroupResponse | null;
  'invited-positions'?: OrcidAffiliationGroupResponse | null;
  educations?: OrcidAffiliationGroupResponse | null;
  memberships?: OrcidAffiliationGroupResponse | null;
  qualifications?: OrcidAffiliationGroupResponse | null;
  services?: OrcidAffiliationGroupResponse | null;
  'peer-reviews'?: OrcidPeerReviewsResponse | null;
  'research-resources'?: OrcidResearchResourcesResponse | null;
  fundings?: OrcidFundingsResponse | null;
  works?: OrcidWorksResponse | null;
}

/** Réponse de /record : identité et activités en un seul appel. */
interface OrcidRecordResponse {
  person?: OrcidPersonResponse | null;
  'activities-summary'?: OrcidActivitiesResponse | null;
}

/** API publique ORCID (sans authentification). */
const API_BASE = 'https://pub.orcid.org/v3.0';

const HEADERS = new HttpHeaders({ Accept: 'application/vnd.orcid+json' });

// Serveur (partagé entre les visiteurs) et navigateur : les profils ORCID changent rarement.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 2000;                 // environ 2 entrées par chercheur

const STORAGE_PREFIX = 'papyrus-annuaires:orcid-cache:';

const RATE_LIMIT_PAUSE_MS = 2 * 60 * 1000; // après un 429 sans Retry-After
const NOT_FOUND_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;           // par tentative
const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 500;
const SEARCH_CONCURRENCY = 4;

/** Du plus récent au plus ancien ; les dates partielles ISO se comparent comme des chaînes. */
export function compareByStartDateDesc(a: OrcidAffiliationEntry, b: OrcidAffiliationEntry): number {
  return (b.startDate ?? '').localeCompare(a.startDate ?? '');
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Partagé entre les requêtes SSR (chaque requête a sa propre instance du service)
// pour ne pas dépasser le quota ORCID de l'IP du serveur.
const sharedCache = new Map<string, CacheEntry<unknown>>();
const notFoundUntil = new Map<string, number>();

// Profils vides après une erreur (hors 404) : affichés, mais jamais mis en cache.
const incompleteProfiles = new WeakSet<OrcidResearcherProfile>();

// Disjoncteur après un 429.
let orcidPausedUntil = 0;

/** Pour les tests unitaires. */
export function resetOrcidSharedState(): void {
  sharedCache.clear();
  notFoundUntil.clear();
  orcidPausedUntil = 0;
}

// LRU simple : une Map conserve l'ordre d'insertion.
function setBounded<V>(target: Map<string, V>, key: string, value: V): void {
  target.delete(key);
  if (target.size >= CACHE_MAX_ENTRIES) {
    target.delete(target.keys().next().value);
  }
  target.set(key, value);
}

// Avec et sans accents, selon la saisie de l'affiliation.
const AFFIL_QUERY =
  '(affiliation-org-name:"Université de Montréal" OR affiliation-org-name:"Universite de Montreal")';

@Injectable({ providedIn: 'root' })
export class OrcidPublicApiService {
  // Sans les intercepteurs DSpace : le jeton Bearer ajouté par auth.interceptor provoque des 401 chez ORCID.
  private readonly http = new HttpClient(inject(HttpBackend));

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly transferState = inject(TransferState);

  private readonly request = inject(REQUEST, { optional: true });

  // Robot (rendu serveur ou navigateur) : on sert le cache, sans appeler ORCID ; sinon le flux se termine sans valeur.
  private readonly isBot = isbot(this.isBrowser
    ? navigator.userAgent
    : this.request?.headers?.['user-agent'] as string | undefined);

  private readonly inflight = new Map<string, Observable<unknown>>();

  /**
   * Recherche paginée des membres UdeM sur ORCID.
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
   * Profil complet d'un chercheur, en un seul appel à /record.
   *
   * @param orcidId Identifiant ORCID au format 0000-0000-0000-0000.
   */
  getResearcherProfile(orcidId: string): Observable<OrcidResearcherProfile> {
    // Version à incrémenter quand la forme du profil change, pour ignorer les profils déjà en cache.
    const key = `profile|v2|${orcidId}`;
    return this.getCachedOrFetch<OrcidResearcherProfile>(key, () =>
      this.fetchProfile(orcidId),
    { cacheIf: (profile) => !incompleteProfiles.has(profile) });
  }

  /**
   * Lit dans l'ordre : TransferState, mémoire, localStorage, requête en cours, puis appel HTTP.
   * `cache: false` : dédoublonnage seulement. `cacheIf` : condition pour mettre le résultat en cache.
   */
  private getCachedOrFetch<T>(
    key: string,
    factory: () => Observable<T>,
    { cache = true, cacheIf }: { cache?: boolean; cacheIf?: (data: T) => boolean } = {},
  ): Observable<T> {
    if (!cache) {
      return this.isBot ? EMPTY : this.dedupe(key, factory);
    }

    const transferKey = this.transferStateKey<T>(key);
    if (this.isBrowser && this.transferState.hasKey(transferKey)) {
      const transferred = this.transferState.get(transferKey, null);
      this.transferState.remove(transferKey);
      if (transferred) {
        this.setCached(key, transferred);
        this.writePersisted(key, transferred);
        return of(transferred.data);
      }
    }

    const cached = (sharedCache.get(key) as CacheEntry<T> | undefined) ?? this.readPersisted<T>(key);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        this.setCached(key, cached);
        if (!this.isBrowser) {
          // sinon le navigateur refait l'appel après l'hydratation
          this.transferState.set(transferKey, cached);
        }
        return of(cached.data);
      }
      sharedCache.delete(key);
      this.removePersisted(key);
    }

    if (this.isBot) {
      return EMPTY;
    }

    return this.dedupe(key, () => factory().pipe(
      tap((data) => {
        if (cacheIf && !cacheIf(data)) {
          return;
        }
        const entry = { data, expiresAt: Date.now() + CACHE_TTL_MS };
        this.setCached(key, entry);
        this.writePersisted(key, entry);
        if (!this.isBrowser) {
          this.transferState.set(transferKey, entry);
        }
      }),
    ));
  }

  private dedupe<T>(key: string, factory: () => Observable<T>): Observable<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Observable<T>;
    }

    const req$ = factory().pipe(
      finalize(() => this.inflight.delete(key)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.inflight.set(key, req$);
    return req$;
  }

  private setCached<T>(key: string, entry: CacheEntry<T>): void {
    setBounded(sharedCache, key, entry);
  }

  // localStorage est optionnel : les erreurs (navigation privée, JSON invalide) sont ignorées.
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

  private writePersisted<T>(key: string, entry: { data: T; expiresAt: number }): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // quota dépassé : le cache mémoire suffit
    }
  }

  private removePersisted(key: string): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      // sans conséquence
    }
  }

  private transferStateKey<T>(key: string): StateKey<{ data: T; expiresAt: number }> {
    return makeStateKey<{ data: T; expiresAt: number }>(`orcid:${key}`);
  }

  // Nouvel essai seulement sur erreur réseau ou 5xx. Un 429 suspend les appels, un 404 est mémorisé.
  private orcidGet<T>(url: string, params?: HttpParams): Observable<T> {
    if (Date.now() < orcidPausedUntil) {
      return throwError(() => new Error('[ORCID] Appels suspendus après un 429'));
    }
    if ((notFoundUntil.get(url) ?? 0) > Date.now()) {
      return throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found (cache)', url }));
    }

    return this.http.get<T>(url, { headers: HEADERS, params }).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      retry({
        count: RETRY_COUNT,
        delay: (err: unknown) => {
          const status = (err as HttpErrorResponse)?.status;
          return status === 0 || status >= 500 ? timer(RETRY_DELAY_MS) : throwError(() => err);
        },
      }),
      tap({
        error: (err: unknown) => {
          const httpErr = err as HttpErrorResponse;
          if (httpErr?.status === 404) {
            setBounded(notFoundUntil, url, Date.now() + NOT_FOUND_TTL_MS);
          } else if (httpErr?.status === 429) {
            const retryAfterSec = Number(httpErr.headers?.get('Retry-After'));
            const pauseMs = retryAfterSec > 0 ? retryAfterSec * 1000 : RATE_LIMIT_PAUSE_MS;
            orcidPausedUntil = Date.now() + pauseMs;
            console.warn(`[ORCID] 429 reçu : appels suspendus ${Math.round(pauseMs / 1000)} s`);
          }
        },
      }),
    );
  }

  private fetchSearchPage(page: number, pageSize: number, nameFilter: string): Observable<OrcidMembersPage> {
    const query = this.buildQuery(nameFilter);
    const params = new HttpParams()
      .set('q', query)
      .set('start', String(page * pageSize))
      .set('rows', String(pageSize));

    return this.orcidGet<OrcidSearchResponse>(`${API_BASE}/search`, params).pipe(
      tap({ error: (err: unknown) => console.warn('[ORCID] Échec de la recherche', err) }),
      switchMap(({ result, 'num-found': totalResults }) => {
        const ids = (result ?? []).map((r) => r['orcid-identifier'].path);

        if (ids.length === 0) {

          return of({ members: [], totalResults });

        }

        // mergeMap ne garde pas l'ordre : on retrie sur l'index.
        return from(ids).pipe(
          mergeMap((id, index) => this.fetchPersonLight(id).pipe(map((member) => ({ index, member }))), SEARCH_CONCURRENCY),
          toArray(),
          map((results) => ({
            members: results.sort((a, b) => a.index - b.index).map((r) => r.member),
            totalResults,
          })),
        );
      }),
    );
  }

  // Réponse lourde, pas mise en cache : le profil construit à partir d'elle l'est déjà.
  // En erreur, profil vide ; hors 404, il n'est pas mis en cache.
  private fetchProfile(orcidId: string): Observable<OrcidResearcherProfile> {
    return this.getCachedOrFetch<OrcidRecordResponse>(`record|${orcidId}`, () =>
      this.orcidGet<OrcidRecordResponse>(`${API_BASE}/${orcidId}/record`),
    { cache: false }).pipe(
      map((record) => this.mapProfile(orcidId, record?.person ?? null, record?.['activities-summary'] ?? null)),
      catchError((err: unknown) => {
        console.warn(`[ORCID] /record inaccessible pour ${orcidId}`, err);
        const profile = this.mapProfile(orcidId, null, null);
        if ((err as HttpErrorResponse)?.status !== 404) {
          incompleteProfiles.add(profile);
        }
        return of(profile);
      }),
    );
  }

  // Nom et biographie seulement, pour la liste.
  private fetchPersonLight(orcidId: string): Observable<OrcidMember> {
    return this.fetchPersonRaw(orcidId).pipe(
      map((p) => this.mapPersonLight(orcidId, p)),
    );
  }

  private fetchPersonRaw(orcidId: string): Observable<OrcidPersonResponse | null> {
    return this.personRaw$(orcidId).pipe(
      catchError((err: unknown) => {
        console.warn(`[ORCID] /person inaccessible pour ${orcidId}`, err);
        return of(null);
      }),
    );
  }

  // Liste des chercheurs : identité seulement. Les erreurs remontent : un échec ne va jamais en cache.
  private personRaw$(orcidId: string): Observable<OrcidPersonResponse> {
    return this.getCachedOrFetch<OrcidPersonResponse>(`person|${orcidId}`, () =>
      this.orcidGet<OrcidPersonResponse>(`${API_BASE}/${orcidId}/person`),
    );
  }

  private mapPersonLight(orcidId: string, p: OrcidPersonResponse | null): OrcidMember {
    return {
      orcidId,
      orcidUri: `https://orcid.org/${orcidId}`,
      givenName: p?.name?.['given-names']?.value ?? '',
      familyName: p?.name?.['family-name']?.value ?? '',
      creditName: p?.name?.['credit-name']?.value ?? undefined,
      biography: p?.biography?.content?.trim() || undefined,
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
      biography: person?.biography?.content?.trim() || undefined,
      keywords: this.mapKeywords(person),
      fundings: this.mapFundings(activities?.fundings ?? null),
      works: this.mapWorks(activities?.works ?? null),
      worksTotal: this.countWorks(activities?.works ?? null),
      distinctions: this.mapAffiliationGroup(activities?.distinctions, 'distinction-summary'),
      invitedPositions: this.mapAffiliationGroup(activities?.['invited-positions'], 'invited-position-summary'),
      educations: this.mapAffiliationGroup(activities?.educations, 'education-summary'),
      memberships: this.mapAffiliationGroup(activities?.memberships, 'membership-summary'),
      qualifications: this.mapAffiliationGroup(activities?.qualifications, 'qualification-summary'),
      services: this.mapAffiliationGroup(activities?.services, 'service-summary'),
      peerReviews: this.mapPeerReviews(activities?.['peer-reviews']),
      researchResources: this.mapResearchResources(activities?.['research-resources']),
    };
  }

  // Code ISO (CA) vers le nom en français (Canada).
  private countryName(code: string | null | undefined): string | undefined {
    if (!code) {
      return undefined;
    }
    try {
      return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  }

  // Certains profils regroupent plusieurs mots-clés séparés par des virgules.
  private mapKeywords(person: OrcidPersonResponse | null): string[] {
    return (person?.keywords?.keyword ?? [])
      .flatMap((k) => (k.content ?? '').split(','))
      .map((kw) => kw.trim())
      .filter(Boolean);
  }

  private mapFundings(resp: OrcidFundingsResponse | null): OrcidFunding[] {
    if (!resp?.group) {
      return [];
    }

    return resp.group
      .map((group) => {
        const summary = group['funding-summary']?.[0];
        if (!summary || !summary.title?.title?.value) {
          return null;
        }

        return {
          putCode: summary['put-code'],
          title: summary.title.title.value,
          type: summary.type ?? 'other',
          organizationName: summary.organization?.name ?? undefined,
          startYear: this.parseYear(summary['start-date']),
          endYear: this.parseYear(summary['end-date']),
        } as OrcidFunding;
      })
      .filter((f): f is OrcidFunding => f !== null)
      .sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
  }

  private mapWorks(resp: OrcidWorksResponse | null): OrcidWork[] {
    if (!resp?.group) {
      return [];
    }

    return resp.group
      .map((group) => {
        const summary = group['work-summary']?.[0];
        if (!summary || !summary.title?.title?.value) {
          return null;
        }

        const doi = summary['external-ids']?.['external-id']?.find(
          (id) => id['external-id-type'] === 'doi',
        );

        return {
          putCode: summary['put-code'],
          title: summary.title.title.value,
          type: summary.type ?? 'other',
          publicationYear: this.parseYear(summary['publication-date']),
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

  // Même structure pour les 6 catégories d'affiliation ; seule la clé du résumé change.
  private mapAffiliationGroup(
    resp: OrcidAffiliationGroupResponse | null | undefined,
    summaryKey: string,
  ): OrcidAffiliationEntry[] {
    if (!resp?.['affiliation-group']) {
      return [];
    }

    return resp['affiliation-group']
      .map((group) => {
        const summary = group.summaries?.[0]?.[summaryKey];
        if (!summary) {
          return null;
        }

        const address = summary.organization?.address;
        return {
          putCode: summary['put-code'],
          roleTitle: summary['role-title'] ?? undefined,
          departmentName: summary['department-name'] ?? undefined,
          organizationName: summary.organization?.name ?? undefined,
          city: address?.city ?? undefined,
          region: address?.region ?? undefined,
          country: this.countryName(address?.country),
          startDate: this.formatDate(summary['start-date']),
          endDate: this.formatDate(summary['end-date']),
          url: summary.url?.value ?? undefined,
          externalIds: (summary['external-ids']?.['external-id'] ?? []).map((id) => ({
            type: id['external-id-type'],
            value: id['external-id-value'],
            url: id['external-id-url']?.value ?? undefined,
          })),
        } as OrcidAffiliationEntry;
      })
      .filter((e): e is OrcidAffiliationEntry => e !== null)
      .sort(compareByStartDateDesc);
  }

  private mapPeerReviews(resp: OrcidPeerReviewsResponse | null | undefined): OrcidPeerReview[] {
    if (!resp?.group) {
      return [];
    }

    return resp.group
      .flatMap((group) => group['peer-review-group'] ?? [])
      .map((prGroup) => prGroup['peer-review-summary']?.[0])
      .filter((summary): summary is NonNullable<typeof summary> => !!summary)
      .map((summary) => ({
        reviewerRole: summary['reviewer-role'] ?? undefined,
        reviewType: summary['review-type'] ?? undefined,
        organizationName: summary['convening-organization']?.name ?? undefined,
        year: this.parseYear(summary['completion-date']),
      }))
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  }

  private mapResearchResources(
    resp: OrcidResearchResourcesResponse | null | undefined,
  ): OrcidResearchResource[] {
    if (!resp?.group) {
      return [];
    }

    return resp.group
      .map((group) => group['research-resource-summary']?.[0]?.proposal)
      .filter((proposal): proposal is NonNullable<typeof proposal> => !!proposal)
      .map((proposal) => ({
        title: proposal.title?.title?.value ?? undefined,
        organizationName: proposal.hosts?.organization?.[0]?.name ?? undefined,
        startYear: this.parseYear(proposal['start-date']),
        endYear: this.parseYear(proposal['end-date']),
      }))
      .sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
  }

  private parseYear(date: OrcidDateParts | null | undefined): number | undefined {
    return date?.year?.value ? parseInt(date.year.value, 10) : undefined;
  }

  // AAAA, AAAA-MM ou AAAA-MM-JJ selon la précision saisie.
  private formatDate(date: OrcidDateParts | null | undefined): string | undefined {
    const year = date?.year?.value;
    if (!year) {
      return undefined;
    }
    const month = date.month?.value;
    return [year, month, month ? date.day?.value : undefined].filter(Boolean).join('-');
  }

  private buildQuery(nameFilter: string): string {
    const safe = nameFilter.trim().replace(/["\\]/g, '');
    if (!safe) {
      return AFFIL_QUERY;
    }
    return `${AFFIL_QUERY} AND (given-names:${safe}* OR family-name:${safe}*)`;
  }
}
