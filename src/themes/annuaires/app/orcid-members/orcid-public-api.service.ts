import { isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable, makeStateKey, PLATFORM_ID, StateKey, TransferState } from '@angular/core';
import { isbot } from 'isbot';
import { forkJoin, from, NEVER, Observable, of, throwError, timer } from 'rxjs';
import { catchError, finalize, map, mergeMap, retry, shareReplay, switchMap, tap, toArray } from 'rxjs/operators';

import { REQUEST } from '../../../../express.tokens';

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

/** Lien externe déclaré sur le profil ORCID (ex. page personnelle). */
export interface OrcidResearcherUrl {
  name: string;
  url: string;
}

/** Entrée d'affiliation : distinction, diplôme, adhésion, qualification ou service (même forme côté ORCID). */
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
  /** Pays de résidence, nom localisé (ex. "Canada"). */
  country?: string;
  keywords: string[];
  researcherUrls: OrcidResearcherUrl[];
  /** Triés du plus récent au plus ancien. */
  fundings: OrcidFunding[];
  /** Triées par année de publication décroissante. */
  works: OrcidWork[];
  worksTotal: number;
  distinctions: OrcidAffiliationEntry[];
  /** Section "educations" d'ORCID. */
  educations: OrcidAffiliationEntry[];
  memberships: OrcidAffiliationEntry[];
  qualifications: OrcidAffiliationEntry[];
  /** Fourre-tout ORCID (comités, bénévolat, etc.). */
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

/** Date ORCID `{ year: { value: "2024" } }`, commune à tous les endpoints. */
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

/** Modèle "Affiliations" v3, commun aux 5 catégories (distinctions, educations, memberships, qualifications, services). */
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

/** Réponse de /activities : toutes les sections d'activités en un seul appel. */
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

/** API publique ORCID (sans authentification). */
const API_BASE = 'https://pub.orcid.org/v3.0';

const HEADERS = new HttpHeaders({ Accept: 'application/vnd.orcid+json' });

/** 30 min : les profils ORCID changent rarement, on limite les appels à l'API publique. */
const CACHE_TTL_MS = 30 * 60 * 1000;

const SERVER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 3000;

const STORAGE_PREFIX = 'papyrus-annuaires:orcid-cache:';

/** Pause après un 429 quand ORCID ne précise pas Retry-After. */
const RATE_LIMIT_PAUSE_MS = 2 * 60 * 1000;

const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 500;
const SEARCH_CONCURRENCY = 4;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// État partagé
// ══════════════════════════════════════════════════════════════════════════════
// Niveau module : en SSR, chaque requête a sa propre instance du service ; cet état est partagé
// entre toutes les requêtes pour protéger le quota ORCID de l'IP du serveur.

const sharedCache = new Map<string, CacheEntry<unknown>>();

/** Disjoncteur : aucun appel ORCID avant cette date (ms). */
let orcidPausedUntil = 0;

/** Membres UdeM : les deux variantes couvrent les enregistrements avec et sans accents. */
const AFFIL_QUERY =
  '(affiliation-org-name:"Université de Montréal" OR affiliation-org-name:"Universite de Montreal")';

// ══════════════════════════════════════════════════════════════════════════════
// Service
// ══════════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class OrcidPublicApiService {
  /**
   * HttpClient construit sur HttpBackend pour contourner les intercepteurs DSpace :
   * le token Bearer DSpace ajouté par auth.interceptor provoque des 401 sur pub.orcid.org.
   */
  private readonly http = new HttpClient(inject(HttpBackend));

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Transmet au navigateur les réponses obtenues en SSR, pour éviter un second appel après l'hydratation. */
  private readonly transferState = inject(TransferState);

  private readonly request = inject(REQUEST, { optional: true });

  /** Robot en SSR : cache seulement, aucun appel ORCID depuis l'IP du serveur. */
  private readonly isServerSideBot =
    !this.isBrowser && isbot(this.request?.headers?.['user-agent'] as string | undefined);

  /** Requêtes en cours, partagées pour éviter les appels réseau en double. */
  private readonly inflight = new Map<string, Observable<unknown>>();

  // ── Méthodes publiques ────────────────────────────────────────────────────

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
   * Profil complet d'un chercheur (/person + /activities en parallèle).
   *
   * @param orcidId Identifiant ORCID au format 0000-0000-0000-0000.
   */
  getResearcherProfile(orcidId: string): Observable<OrcidResearcherProfile> {
    const key = `profile|${orcidId}`;
    return this.getCachedOrFetch<OrcidResearcherProfile>(key, () =>
      this.fetchProfile(orcidId),
    );
  }

  // ── Cache ─────────────────────────────────────────────────────────────────

  /**
   * Ordre de lecture : TransferState (SSR) → mémoire → localStorage → requête en vol → appel HTTP.
   */
  private getCachedOrFetch<T>(key: string, factory: () => Observable<T>): Observable<T> {
    // Lue une seule fois : le cache mémoire/localStorage prend ensuite le relais.
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
        // Remonte en mémoire pour éviter de reparser le JSON de localStorage à chaque appel.
        this.setCached(key, cached);
        if (!this.isBrowser) {
          // Sinon le navigateur refait l'appel après l'hydratation.
          this.transferState.set(transferKey, cached);
        }
        return of(cached.data);
      }
      // Entrée périmée : nettoyage pour que localStorage ne grossisse pas indéfiniment.
      sharedCache.delete(key);
      this.removePersisted(key);
    }

    if (this.isServerSideBot) {
      return NEVER;
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Observable<T>;
    }

    const req$ = factory().pipe(
      tap((data) => {
        const ttl = this.isBrowser ? CACHE_TTL_MS : SERVER_CACHE_TTL_MS;
        const entry = { data, expiresAt: Date.now() + ttl };
        this.setCached(key, entry);
        this.writePersisted(key, entry);
        if (!this.isBrowser) {
          this.transferState.set(transferKey, entry);
        }
      }),
      finalize(() => this.inflight.delete(key)),
      shareReplay(1),
    );

    this.inflight.set(key, req$);
    return req$;
  }

  /** LRU simple : la Map garde l'ordre d'insertion, la première clé est la plus ancienne. */
  private setCached<T>(key: string, entry: CacheEntry<T>): void {
    sharedCache.delete(key);
    if (sharedCache.size >= CACHE_MAX_ENTRIES) {
      sharedCache.delete(sharedCache.keys().next().value);
    }
    sharedCache.set(key, entry);
  }

  /** localStorage est un bonus de performance : toute erreur (SSR, navigation privée, JSON corrompu) est ignorée. */
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
      // Quota dépassé ou stockage indisponible : le cache mémoire suffit.
    }
  }

  private removePersisted(key: string): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      // Sans conséquence : l'entrée périmée sera ignorée à la prochaine lecture.
    }
  }

  private transferStateKey<T>(key: string): StateKey<{ data: T; expiresAt: number }> {
    return makeStateKey<{ data: T; expiresAt: number }>(`orcid:${key}`);
  }

  // ── Requêtes ORCID ────────────────────────────────────────────────────────

  /** GET ORCID avec disjoncteur sur 429 ; seules les erreurs réseau / 5xx sont retentées. */
  private orcidGet<T>(url: string, params?: HttpParams): Observable<T> {
    if (Date.now() < orcidPausedUntil) {
      return throwError(() => new Error('[ORCID] Appels suspendus après un 429'));
    }

    return this.http.get<T>(url, { headers: HEADERS, params }).pipe(
      retry({
        count: RETRY_COUNT,
        delay: (err: unknown) => {
          const status = (err as HttpErrorResponse)?.status;
          return status === 0 || status >= 500 ? timer(RETRY_DELAY_MS) : throwError(() => err);
        },
      }),
      tap({
        error: (err: HttpErrorResponse) => {
          if (err.status === 429) {
            const retryAfterSec = Number(err.headers?.get('Retry-After'));
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
      tap({ error: (err) => console.warn('[ORCID] Échec de la recherche', err) }),
      switchMap(({ result, 'num-found': totalResults }) => {
        const ids = (result ?? []).map((r) => r['orcid-identifier'].path);

        if (ids.length === 0) return of({ members: [], totalResults });

        // Concurrence bornée ; l'index rétablit l'ordre des résultats.
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

  /** Chaque requête échoue silencieusement (null) pour ne pas bloquer l'autre. */
  private fetchProfile(orcidId: string): Observable<OrcidResearcherProfile> {
    return forkJoin({
      person: this.fetchPersonRaw(orcidId),
      activities: this.fetchActivitiesRaw(orcidId),
    }).pipe(
      map(({ person, activities }) => this.mapProfile(orcidId, person, activities)),
    );
  }

  /** Version allégée (nom + bio) pour la liste paginée. */
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
   * /person, mis en cache et partagé entre la liste et la fiche complète.
   * Le catchError reste hors de getCachedOrFetch pour ne pas mémoriser un échec pendant 30 min.
   */
  private fetchPersonRaw(orcidId: string): Observable<OrcidPersonResponse | null> {
    return this.getCachedOrFetch<OrcidPersonResponse>(`person|${orcidId}`, () =>
      this.orcidGet<OrcidPersonResponse>(`${API_BASE}/${orcidId}/person`),
    ).pipe(
      catchError((err) => {
        console.warn(`[ORCID] /person inaccessible pour ${orcidId}`, err);
        return of(null);
      }),
    );
  }

  /** Même stratégie de cache/catchError que fetchPersonRaw. */
  private fetchActivitiesRaw(orcidId: string): Observable<OrcidActivitiesResponse | null> {
    return this.getCachedOrFetch<OrcidActivitiesResponse>(`activities|${orcidId}`, () =>
      this.orcidGet<OrcidActivitiesResponse>(`${API_BASE}/${orcidId}/activities`),
    ).pipe(
      catchError((err) => {
        console.warn(`[ORCID] /activities inaccessible pour ${orcidId}`, err);
        return of(null);
      }),
    );
  }

  // ── Mapping des modèles ───────────────────────────────────────────────────

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

  /** Code pays ISO 3166-1 (ex. "CA") → nom localisé en français (ex. "Canada"). */
  private mapCountry(person: OrcidPersonResponse | null): string | undefined {
    const code = person?.addresses?.address?.[0]?.country?.value;
    if (!code) return undefined;
    try {
      return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  }

  /** Certains profils mettent une liste séparée par des virgules dans un seul mot-clé : on l'éclate. */
  private mapKeywords(person: OrcidPersonResponse | null): string[] {
    return (person?.keywords?.keyword ?? [])
      .flatMap((k) => (k.content ?? '').split(','))
      .map((kw) => kw.trim())
      .filter(Boolean);
  }

  private mapResearcherUrls(person: OrcidPersonResponse | null): OrcidResearcherUrl[] {
    return (person?.['researcher-urls']?.['researcher-url'] ?? [])
      .filter((u) => !!u.url?.value)
      .map((u) => ({ name: u['url-name']?.trim() || u.url.value, url: u.url.value }));
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
          startYear: this.parseYear(summary['start-date']),
          endYear: this.parseYear(summary['end-date']),
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

  /**
   * Mapping commun aux 5 catégories d'affiliation.
   * @param summaryKey Clé de résumé propre à la catégorie (ex. "education-summary").
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
          startYear: this.parseYear(summary['start-date']),
          endYear: this.parseYear(summary['end-date']),
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
        year: this.parseYear(summary['completion-date']),
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
        startYear: this.parseYear(proposal['start-date']),
        endYear: this.parseYear(proposal['end-date']),
      }))
      .sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────

  private parseYear(date: OrcidDateParts | null | undefined): number | undefined {
    return date?.year?.value ? parseInt(date.year.value, 10) : undefined;
  }

  private buildQuery(nameFilter: string): string {
    const safe = nameFilter.trim().replace(/["\\]/g, '');
    if (!safe) return AFFIL_QUERY;
    return `${AFFIL_QUERY} AND (given-names:${safe}* OR family-name:${safe}*)`;
  }
}
