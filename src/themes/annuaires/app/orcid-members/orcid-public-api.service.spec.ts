import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import {
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';

import { REQUEST } from '../../../../express.tokens';
import {
  OrcidPublicApiService,
  OrcidResearcherProfile,
  resetOrcidSharedState,
} from './orcid-public-api.service';

const ORCID_ID = '0000-0001-2345-6789';
const PERSON_URL = `https://pub.orcid.org/v3.0/${ORCID_ID}/person`;
const RECORD_URL = `https://pub.orcid.org/v3.0/${ORCID_ID}/record`;

describe('OrcidPublicApiService', () => {
  let http: HttpTestingController;

  // Plateforme serveur, donc sans localStorage.
  function setup(userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0'): OrcidPublicApiService {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: REQUEST, useValue: { headers: { 'user-agent': userAgent } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(OrcidPublicApiService);
  }

  // Équivaut à une autre requête SSR.
  function newInstance(): OrcidPublicApiService {
    return TestBed.runInInjectionContext(() => new OrcidPublicApiService());
  }

  beforeEach(() => resetOrcidSharedState());

  afterEach(() => http.verify());

  it('charge le profil en un seul appel à /record', () => {
    const service = setup();
    let profile: OrcidResearcherProfile | undefined;
    service.getResearcherProfile(ORCID_ID).subscribe((p) => (profile = p));
    http.expectOne(RECORD_URL).flush({
      person: { biography: { content: ' Biographie ' } },
      'activities-summary': { works: { group: [] } },
    });

    http.expectNone(PERSON_URL);
    expect(profile?.biography).toBe('Biographie');
  });

  it('partage le profil en cache entre les instances (requêtes SSR)', () => {
    const service = setup();
    service.getResearcherProfile(ORCID_ID).subscribe();
    http.expectOne(RECORD_URL).flush({});

    let profile: OrcidResearcherProfile | undefined;
    newInstance().getResearcherProfile(ORCID_ID).subscribe((p) => (profile = p));

    http.expectNone(RECORD_URL);
    expect(profile?.orcidId).toBe(ORCID_ID);
  });

  it('ne met pas en cache un profil incomplet (échec 5xx après les nouveaux essais)', fakeAsync(() => {
    const service = setup();
    let profile: OrcidResearcherProfile | undefined;
    service.getResearcherProfile(ORCID_ID).subscribe((p) => (profile = p));

    for (let attempt = 0; attempt < 3; attempt++) {
      http.expectOne(RECORD_URL).flush(null, { status: 503, statusText: 'Unavailable' });
      tick(500);
    }
    expect(profile).toBeDefined();

    newInstance().getResearcherProfile(ORCID_ID).subscribe();
    http.expectOne(RECORD_URL).flush({});
  }));

  it('suspend tous les appels après un 429, sans nouvel essai', () => {
    const service = setup();
    service.getResearcherProfile(ORCID_ID).subscribe();
    http.expectOne(RECORD_URL).flush(null, { status: 429, statusText: 'Too Many Requests' });

    let profile: OrcidResearcherProfile | undefined;
    newInstance().getResearcherProfile(ORCID_ID).subscribe((p) => (profile = p));

    http.expectNone(RECORD_URL);
    expect(profile?.orcidId).toBe(ORCID_ID);
  });

  it('mémorise un 404 sans rappeler ORCID', () => {
    const service = setup();
    (service as any).fetchPersonRaw(ORCID_ID).subscribe();
    http.expectOne(PERSON_URL).flush(null, { status: 404, statusText: 'Not Found' });

    let result: unknown = 'non émis';
    (newInstance() as any).fetchPersonRaw(ORCID_ID).subscribe((person: unknown) => (result = person));
    http.expectNone(PERSON_URL);
    expect(result).toBeNull();
  });

  it('abandonne une requête trop lente sans nouvel essai', fakeAsync(() => {
    const service = setup();
    let profile: OrcidResearcherProfile | undefined;
    service.getResearcherProfile(ORCID_ID).subscribe((p) => (profile = p));

    const slow = http.expectOne(RECORD_URL);
    tick(5000);

    expect(slow.cancelled).toBeTrue();
    http.expectNone(RECORD_URL);
    expect(profile).toBeDefined();
  }));

  it("n'appelle jamais ORCID pour un robot en rendu serveur", () => {
    const service = setup('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
    let emitted = false;
    let completed = false;
    service.getResearcherProfile(ORCID_ID).subscribe({
      next: () => (emitted = true),
      complete: () => (completed = true),
    });

    http.expectNone(RECORD_URL);
    expect(emitted).toBeFalse();
    expect(completed).toBeTrue();
  });

  it('sert un robot depuis le cache rempli par un visiteur humain', () => {
    const service = setup();
    service.getResearcherProfile(ORCID_ID).subscribe();
    http.expectOne(RECORD_URL).flush({});

    TestBed.resetTestingModule();
    let profile: OrcidResearcherProfile | undefined;
    setup('Googlebot/2.1').getResearcherProfile(ORCID_ID).subscribe((p) => (profile = p));

    expect(profile?.orcidId).toBe(ORCID_ID);
  });
});
