import { HttpBackend, HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
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

/** Affiliation professionnelle déclarée sur ORCID. */
export interface OrcidEmployment {
  organizationName: string;
  department?: string;
  roleTitle?: string;
  startYear?: number;
  endYear?: number;
  /** Vrai si le poste est toujours actif (end-date absent dans ORCID). */
  isCurrent: boolean;
}

/** Lien externe déclaré par le chercheur sur son profil ORCID. */
export interface OrcidResearcherUrl {
  name: string;
  url: string;
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
  keywords: string[];
  researcherUrls: OrcidResearcherUrl[];
  /** Triés du plus récent au plus ancien. */
  employments: OrcidEmployment[];
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
  'researcher-urls'?: {
    'researcher-url': Array<{ 'url-name': string; url: { value: string } }> | null;
  } | null;
}

interface OrcidEmploymentsResponse {
  'affiliation-group': Array<{
    summaries: Array<{
      'employment-summary': {
        organization: { name: string };
        'department-name'?: string | null;
        'role-title'?: string | null;
        'start-date'?: { year?: { value: string } } | null;
        'end-date'?: { year?: { value: string } } | null;
      };
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

/** Durée de vie du cache local : 5 minutes. */
const CACHE_TTL_MS = 5 * 60 * 1000;

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

  /**
   * Cache générique : clé → { données + expiry }.
   * Stocke indifféremment les pages de recherche et les profils complets.
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
   * Récupère le profil complet d'un chercheur : infos personnelles, affiliations
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
   * Retourne la valeur mise en cache si elle est valide,
   * partage la requête en vol si elle est déjà en cours,
   * sinon déclenche un nouvel appel HTTP.
   */
  private getCachedOrFetch<T>(key: string, factory: () => Observable<T>): Observable<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      console.log('[ORCID] Cache hit — clé:', key);
      return of(cached.data as T);
    }

    const existing = this.inflight.get(key);
    if (existing) {
      console.log('[ORCID] Requête en vol partagée — clé:', key);
      return existing as Observable<T>;
    }

    const req$ = factory().pipe(
      tap((data) => {
        console.log('[ORCID] Mise en cache — clé:', key);
        this.cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      }),
      finalize(() => this.inflight.delete(key)),
      shareReplay(1),
    );

    this.inflight.set(key, req$);
    return req$;
  }

  // ── Récupération de la page de recherche ─────────────────────────────────

  private fetchSearchPage(page: number, pageSize: number, nameFilter: string): Observable<OrcidMembersPage> {
    const query = this.buildQuery(nameFilter);
    const params = new HttpParams()
      .set('q', query)
      .set('start', String(page * pageSize))
      .set('rows', String(pageSize));

    console.group('[ORCID] Recherche membres UdeM');
    console.log('Paramètres :', { q: query, start: page * pageSize, rows: pageSize });
    console.groupEnd();

    return this.http
      .get<OrcidSearchResponse>(`${API_BASE}/search`, { headers: HEADERS, params })
      .pipe(
        tap({ error: (err) => console.warn('[ORCID] Échec de la recherche (retry en cours)', err) }),
        retry(2),
        switchMap(({ result, 'num-found': totalResults }) => {
          const ids = (result ?? []).map((r) => r['orcid-identifier'].path);
          console.log('[ORCID] Résultats :', totalResults, '— IDs page :', ids);

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
   * Combine trois requêtes parallèles (person, employments, works)
   * pour construire le profil complet du chercheur.
   * Chaque requête échoue silencieusement pour ne pas bloquer les autres.
   */
  private fetchProfile(orcidId: string): Observable<OrcidResearcherProfile> {
    console.group(`[ORCID] Chargement profil ${orcidId}`);
    console.log('Requêtes : /person + /employments + /works');
    console.groupEnd();

    return forkJoin({
      person: this.http
        .get<OrcidPersonResponse>(`${API_BASE}/${orcidId}/person`, { headers: HEADERS })
        .pipe(
          retry(2),
          catchError((err) => {
            console.warn(`[ORCID] /person inaccessible pour ${orcidId}`, err);
            return of(null);
          }),
        ),
      employments: this.http
        .get<OrcidEmploymentsResponse>(`${API_BASE}/${orcidId}/employments`, { headers: HEADERS })
        .pipe(
          retry(1),
          catchError((err) => {
            console.warn(`[ORCID] /employments inaccessible pour ${orcidId}`, err);
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
      map(({ person, employments, works }) =>
        this.mapProfile(orcidId, person, employments, works),
      ),
      tap((p) =>
        console.log(
          `[ORCID] Profil prêt — ${p.givenName} ${p.familyName}, ` +
          `${p.employments.length} affiliation(s), ${p.works.length} publication(s)`,
        ),
      ),
    );
  }

  // ── Mapping des modèles ───────────────────────────────────────────────────

  /** Version allégée du profil : juste nom + bio, pour la liste paginée. */
  private fetchPersonLight(orcidId: string): Observable<OrcidMember> {
    return this.http
      .get<OrcidPersonResponse>(`${API_BASE}/${orcidId}/person`, { headers: HEADERS })
      .pipe(
        retry(1),
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
    empResp: OrcidEmploymentsResponse | null,
    worksResp: OrcidWorksResponse | null,
  ): OrcidResearcherProfile {
    return {
      orcidId,
      orcidUri: `https://orcid.org/${orcidId}`,
      givenName: person?.name?.['given-names']?.value ?? '',
      familyName: person?.name?.['family-name']?.value ?? '',
      creditName: person?.name?.['credit-name']?.value ?? undefined,
      biography: person?.biography?.content ?? undefined,
      keywords: (person?.keywords?.keyword ?? []).map((k) => k.content).filter(Boolean),
      researcherUrls: (person?.['researcher-urls']?.['researcher-url'] ?? []).map((u) => ({
        name: u['url-name'] ?? '',
        url: u.url?.value ?? '',
      })).filter((u) => u.url),
      employments: this.mapEmployments(empResp),
      works: this.mapWorks(worksResp),
      worksTotal: this.countWorks(worksResp),
    };
  }

  private mapEmployments(resp: OrcidEmploymentsResponse | null): OrcidEmployment[] {
    if (!resp?.['affiliation-group']) return [];

    // flatMap n'est pas disponible avant ES2019 — on utilise une boucle explicite
    const result: OrcidEmployment[] = [];
    for (const group of resp['affiliation-group']) {
      for (const s of group.summaries) {
        const summary = s['employment-summary'];
        const startYear = summary['start-date']?.year?.value
          ? parseInt(summary['start-date'].year.value, 10)
          : undefined;
        const endYear = summary['end-date']?.year?.value
          ? parseInt(summary['end-date'].year.value, 10)
          : undefined;
        result.push({
          organizationName: summary.organization?.name ?? '',
          department: summary['department-name'] ?? undefined,
          roleTitle: summary['role-title'] ?? undefined,
          startYear,
          endYear,
          // Poste actif si end-date est absent dans la réponse ORCID
          isCurrent: !summary['end-date'],
        });
      }
    }

    // Postes actuels d'abord, puis par année de début décroissante
    return result.sort((a: OrcidEmployment, b: OrcidEmployment) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return (b.startYear ?? 0) - (a.startYear ?? 0);
    });
  }

  private mapWorks(resp: OrcidWorksResponse | null): OrcidWork[] {
    if (!resp?.group) return [];

    return resp.group
      .map((group) => {
        // Premier résumé du groupe = source préférée (ex : Crossref)
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
      // Tri par année de publication décroissante (publications récentes en tête)
      .sort((a, b) => (b.publicationYear ?? 0) - (a.publicationYear ?? 0));
  }

  private countWorks(resp: OrcidWorksResponse | null): number {
    return resp?.group?.length ?? 0;
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────

  /**
   * Construit la requête Lucene ORCID.
   * Caractère générique de préfixe (*) pour la recherche partielle par nom.
   * Guillemets et barres obliques retirés pour éviter toute injection Lucene.
   */
  private buildQuery(nameFilter: string): string {
    const safe = nameFilter.trim().replace(/["\\]/g, '');
    if (!safe) return AFFIL_QUERY;
    return `${AFFIL_QUERY} AND (given-names:${safe}* OR family-name:${safe}*)`;
  }
}
