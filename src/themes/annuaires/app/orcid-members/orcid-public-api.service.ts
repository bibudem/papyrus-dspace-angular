import { isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
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
  /** Triés du plus récent au plus ancien. */
  fundings: OrcidFunding[];
  /** Triées par année de publication décroissante. */
  works: OrcidWork[];
  worksTotal: number;
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
}

interface OrcidFundingsResponse {
  group: Array<{
    'funding-summary': Array<{
      'put-code': number;
      title: { title: { value: string } };
      type: string;
      organization?: { name: string } | null;
      'start-date'?: { year?: { value: string } } | null;
      'end-date'?: { year?: { value: string } } | null;
    }>;
  }> | null;
}

interface OrcidWorksResponse {
  group: Array<{
    'work-summary': Array<{
      'put-code': number;
      title: { title: { value: string } };
      type: string;
      'publication-date'?: { year?: { value: string } } | null;
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
   * Retourne la valeur mise en cache si elle est valide (mémoire, puis localStorage),
   * partage la requête en vol si elle est déjà en cours,
   * sinon déclenche un nouvel appel HTTP.
   */
  private getCachedOrFetch<T>(key: string, factory: () => Observable<T>): Observable<T> {
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
   * Combine trois requêtes parallèles (person, fundings, works)
   * pour construire le profil complet du chercheur.
   * Chaque requête échoue silencieusement pour ne pas bloquer les autres.
   */
  private fetchProfile(orcidId: string): Observable<OrcidResearcherProfile> {
    return forkJoin({
      person: this.fetchPersonRaw(orcidId),
      fundings: this.http
        .get<OrcidFundingsResponse>(`${API_BASE}/${orcidId}/fundings`, { headers: HEADERS })
        .pipe(
          retry(1),
          catchError((err) => {
            console.warn(`[ORCID] /fundings inaccessible pour ${orcidId}`, err);
            return of(null);
          }),
        ),
      works: this.http
        .get<OrcidWorksResponse>(`${API_BASE}/${orcidId}/works`, { headers: HEADERS })
        .pipe(
          retry(1),
          catchError((err) => {
            console.warn(`[ORCID] /works inaccessible pour ${orcidId}`, err);
            return of(null);
          }),
        ),
    }).pipe(
      map(({ person, fundings, works }) =>
        this.mapProfile(orcidId, person, fundings, works),
      ),
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
    fundingsResp: OrcidFundingsResponse | null,
    worksResp: OrcidWorksResponse | null,
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
      fundings: this.mapFundings(fundingsResp),
      works: this.mapWorks(worksResp),
      worksTotal: this.countWorks(worksResp),
    };
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
