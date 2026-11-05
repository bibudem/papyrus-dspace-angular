import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  makeStateKey,
  PLATFORM_ID,
  TransferState,
} from '@angular/core';
import {
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';

import {
  NO_FUNDINGS,
  PersonFundings,
  PersonFundingsService,
} from './person-fundings.service';

const EMAIL = 'adriana.di.polo@umontreal.ca';
const API_URL = `https://api2.bib.umontreal.ca/financement/${encodeURIComponent(EMAIL)}`;

const RESPONSE = {
  miseAJour: '2026-10-30T12:37:52-04:00',
  financements: [
    {
      anneeDebut: 2026,
      anneeFin: 2033,
      titre: ' Canada Research Chair in Glaucoma ',
      chercheursPrincipaux: [{ nom: 'Adriana Di Polo', courriel: EMAIL }],
      coChercheurs: [{ nom: 'Brad Fortune' }],
      source: 'SPIIE/Secrétariat des programmes interorganismes à l’intention des établissements',
      programme: 'PVX50399-Chaires de recherche du Canada - IRSC',
    },
    {
      anneeDebut: 2023,
      anneeFin: 2026,
      titre: 'Disease-modifying mitochondrial uncouplers',
      chercheursPrincipaux: null,
      coChercheurs: [],
      source: 'BrightFocus Foundation',
      programme: null,
    },
    {
      anneeDebut: 2020,
      anneeFin: 2021,
      titre: '  ',
      chercheursPrincipaux: [],
      coChercheurs: [],
      source: null,
      programme: null,
    },
  ],
};

describe('PersonFundingsService', () => {
  let http: HttpTestingController;
  let transferState: TransferState;

  function setup(platform: 'browser' | 'server' = 'browser'): PersonFundingsService {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    transferState = TestBed.inject(TransferState);
    return TestBed.inject(PersonFundingsService);
  }

  afterEach(() => http.verify());

  it('should map the API response', () => {
    const service = setup();
    let result: PersonFundings;
    service.getFundings(EMAIL).subscribe((fundings) => (result = fundings));
    http.expectOne(API_URL).flush(RESPONSE);

    expect(result.updatedAt).toBe('2026-10-30T12:37:52-04:00');
    expect(result.fundings.length).toBe(2);
    expect(result.fundings[0]).toEqual({
      title: 'Canada Research Chair in Glaucoma',
      startYear: 2026,
      endYear: 2033,
      source: 'SPIIE/Secrétariat des programmes interorganismes à l’intention des établissements',
      program: 'Chaires de recherche du Canada - IRSC',
      principalInvestigators: ['Adriana Di Polo'],
      coInvestigators: ['Brad Fortune'],
    });
    expect(result.fundings[1].program).toBeNull();
    expect(result.fundings[1].principalInvestigators).toEqual([]);
  });

  it('should send a single request per email', () => {
    const service = setup();
    const results: PersonFundings[] = [];
    service.getFundings(EMAIL).subscribe((fundings) => results.push(fundings));
    service.getFundings(` ${EMAIL.toUpperCase()} `).subscribe((fundings) => results.push(fundings));
    http.expectOne(API_URL).flush(RESPONSE);

    service.getFundings(EMAIL).subscribe((fundings) => results.push(fundings));
    http.expectNone(API_URL);
    expect(results.length).toBe(3);
  });

  it('should not send a request without an email', () => {
    const service = setup();
    let result: PersonFundings;
    service.getFundings('  ').subscribe((fundings) => (result = fundings));

    http.expectNone(() => true);
    expect(result).toBe(NO_FUNDINGS);
  });

  it('should return no fundings on error and retry on the next call', () => {
    const service = setup();
    let result: PersonFundings;
    service.getFundings(EMAIL).subscribe((fundings) => (result = fundings));
    http.expectOne(API_URL).flush('', { status: 500, statusText: 'Server Error' });
    expect(result).toBe(NO_FUNDINGS);

    service.getFundings(EMAIL).subscribe((fundings) => (result = fundings));
    http.expectOne(API_URL).flush(RESPONSE);
    expect(result.fundings.length).toBe(2);
  });

  it('should return no fundings after the timeout', fakeAsync(() => {
    const service = setup();
    let result: PersonFundings;
    service.getFundings(EMAIL).subscribe((fundings) => (result = fundings));
    const request = http.expectOne(API_URL);

    tick(5000);

    expect(request.cancelled).toBeTrue();
    expect(result).toBe(NO_FUNDINGS);
  }));

  it('should store the fundings in the transfer state on the server', () => {
    const service = setup('server');
    service.getFundings(EMAIL).subscribe();
    http.expectOne(API_URL).flush(RESPONSE);

    const stored = transferState.get(makeStateKey<PersonFundings>(`person-fundings|${EMAIL}`), null);
    expect(stored?.fundings.length).toBe(2);
  });

  it('should use the transfer state in the browser', () => {
    const service = setup();
    const transferred: PersonFundings = { updatedAt: null, fundings: [] };
    transferState.set(makeStateKey<PersonFundings>(`person-fundings|${EMAIL}`), transferred);

    let result: PersonFundings;
    service.getFundings(EMAIL).subscribe((fundings) => (result = fundings));

    http.expectNone(API_URL);
    expect(result).toEqual(transferred);
  });
});
