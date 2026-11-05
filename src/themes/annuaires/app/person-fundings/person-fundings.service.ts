import { isPlatformBrowser } from '@angular/common';
import {
  HttpBackend,
  HttpClient,
} from '@angular/common/http';
import {
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  TransferState,
} from '@angular/core';
import {
  Observable,
  of,
} from 'rxjs';
import {
  catchError,
  map,
  shareReplay,
  tap,
  timeout,
} from 'rxjs/operators';

const FUNDINGS_API_URL = 'https://api2.bib.umontreal.ca/financement/';

const REQUEST_TIMEOUT_MS = 5000;

// Code interne en tête du programme, ex. « PVX50399- »
const PROGRAM_CODE_PREFIX = /^PV[\dX]+-\s*/i;

interface FundingResearcherResponse {
  nom: string;
  courriel?: string;
}

interface FundingResponse {
  anneeDebut: number | null;
  anneeFin: number | null;
  titre: string | null;
  chercheursPrincipaux: FundingResearcherResponse[] | null;
  coChercheurs: FundingResearcherResponse[] | null;
  source: string | null;
  programme: string | null;
}

interface FundingsResponse {
  miseAJour: string | null;
  financements: FundingResponse[] | null;
}

export interface PersonFunding {
  title: string;
  startYear: number | null;
  endYear: number | null;
  source: string | null;
  program: string | null;
  principalInvestigators: string[];
  coInvestigators: string[];
}

export interface PersonFundings {
  updatedAt: string | null;
  fundings: PersonFunding[];
}

export const NO_FUNDINGS: PersonFundings = { updatedAt: null, fundings: [] };

/**
 * Service de récupération des financements d'une personne (Synchro Recherche), par courriel
 */
@Injectable({ providedIn: 'root' })
export class PersonFundingsService {

  // Sans les intercepteurs DSpace : l'API est publique
  private readonly http = new HttpClient(inject(HttpBackend));

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly transferState = inject(TransferState);

  private readonly cache = new Map<string, Observable<PersonFundings>>();

  getFundings(email: string): Observable<PersonFundings> {
    const key = email.trim().toLowerCase();
    if (!key) {
      return of(NO_FUNDINGS);
    }

    const stateKey = makeStateKey<PersonFundings>(`person-fundings|${key}`);
    if (this.isBrowser && this.transferState.hasKey(stateKey)) {
      this.cache.set(key, of(this.transferState.get(stateKey, NO_FUNDINGS)));
      this.transferState.remove(stateKey);
    }

    if (!this.cache.has(key)) {
      this.cache.set(key, this.http.get<FundingsResponse>(FUNDINGS_API_URL + encodeURIComponent(key)).pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map((response) => this.toPersonFundings(response)),
        tap((fundings) => {
          if (!this.isBrowser) {
            this.transferState.set(stateKey, fundings);
          }
        }),
        catchError(() => {
          this.cache.delete(key);
          return of(NO_FUNDINGS);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      ));
    }
    return this.cache.get(key);
  }

  private toPersonFundings(response: FundingsResponse | null): PersonFundings {
    return {
      updatedAt: response?.miseAJour ?? null,
      fundings: (response?.financements ?? [])
        .filter((entry) => !!entry?.titre?.trim())
        .map((entry): PersonFunding => ({
          title: entry.titre.trim(),
          startYear: entry.anneeDebut ?? null,
          endYear: entry.anneeFin ?? null,
          source: entry.source?.trim() || null,
          program: entry.programme?.replace(PROGRAM_CODE_PREFIX, '').trim() || null,
          principalInvestigators: this.names(entry.chercheursPrincipaux),
          coInvestigators: this.names(entry.coChercheurs),
        })),
    };
  }

  private names(researchers: FundingResearcherResponse[] | null): string[] {
    return (researchers ?? []).map((researcher) => researcher?.nom?.trim()).filter(Boolean);
  }
}
