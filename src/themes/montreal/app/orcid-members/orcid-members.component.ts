import { AsyncPipe, DOCUMENT, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, combineLatest, Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';

import { OrcidMember, OrcidPublicApiService } from './orcid-public-api.service';
import { OrcidMemberCardComponent } from './orcid-member-card/orcid-member-card.component';

// ── Modèle de vue ────────────────────────────────────────────────────────────

/**
 * État complet de la page transmis au template via AsyncPipe.
 * Un seul Observable (`vm$`) pilote l'affichage : chargement, données ou erreur.
 */
interface ViewModel {
  /** Phase courante du cycle de chargement. */
  status: 'loading' | 'loaded' | 'error';
  members: OrcidMember[];
  totalResults: number;
  /** Page courante (0-indexée, pour l'API ORCID). */
  page: number;
  totalPages: number;
}

// ── Composant ────────────────────────────────────────────────────────────────

/**
 * Page listant les chercheurs de l'UdeM enregistrés sur ORCID.
 * Thème Montréal — fonctionnalité propre à Papyrus.
 *
 * Stratégie de détection : OnPush — le template ne se rafraîchit que
 * lorsque `vm$` émet une nouvelle valeur, ce qui évite les vérifications inutiles.
 */
@Component({
  selector: 'ds-orcid-members',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, NgbPaginationModule, TranslateModule, OrcidMemberCardComponent],
  templateUrl: './orcid-members.component.html',
  styleUrls: ['./orcid-members.component.scss'],
})
export class OrcidMembersComponent {
  /** Nombre de cartes affichées par page. */
  readonly PAGE_SIZE = 12;

  /** Tableau d'indices utilisé pour générer les squelettes de chargement dans le template. */
  readonly skeletons = Array.from({ length: this.PAGE_SIZE }, (_, i) => i);

  private readonly service = inject(OrcidPublicApiService);

  /** Jeton DOCUMENT injecté pour un accès SSR-compatible à `window.scrollTo`. */
  private readonly document = inject(DOCUMENT);

  /**
   * Flux brut de l'input de recherche.
   * Les frappes transitent par ici avant d'être debouncées dans `searchQuery$`.
   */
  private readonly rawQuery$ = new Subject<string>();

  /** Valeur de recherche stabilisée (après debounce de 400 ms). */
  private readonly searchQuery$ = new BehaviorSubject<string>('');

  /** Page courante (0-indexée). Remise à zéro lors d'une nouvelle recherche. */
  private readonly currentPage$ = new BehaviorSubject<number>(0);

  /**
   * Observable unique exposé au template.
   * Combine la recherche et la page, puis orchestre les trois états :
   * `loading` (startWith) → `loaded` (succès) ou `error` (catchError).
   */
  readonly vm$: Observable<ViewModel>;

  constructor() {
    // Abonnement debounce : chaque saisie déclenche une nouvelle recherche
    // après 400 ms d'inactivité et remet la pagination à la première page.
    this.rawQuery$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((query) => {
        this.searchQuery$.next(query);
        this.currentPage$.next(0);
      });

    // Construction du flux principal de données.
    // `switchMap` annule automatiquement la requête précédente si l'utilisateur
    // change de page ou de filtre avant la fin du chargement.
    this.vm$ = combineLatest([this.searchQuery$, this.currentPage$]).pipe(
      switchMap(([query, page]) =>
        this.service.searchUdeMMembers(page, this.PAGE_SIZE, query).pipe(
          map(({ members, totalResults }) => ({
            status: 'loaded' as const,
            members,
            totalResults,
            page,
            totalPages: Math.ceil(totalResults / this.PAGE_SIZE),
          })),
          // Tout échec non géré au niveau du service produit l'état `error`
          catchError((err) => {
            console.error('[ORCID] Erreur fatale — affichage du message d\'erreur à l\'utilisateur', {
              page,
              query,
              status: (err as any)?.status,
              statusText: (err as any)?.statusText,
              url: (err as any)?.url,
              message: (err as any)?.message,
              errorObject: err,
            });
            return of({
              status: 'error' as const,
              members: [] as OrcidMember[],
              totalResults: 0,
              page,
              totalPages: 0,
            });
          }),
          // Émission immédiate de l'état `loading` avant l'arrivée des données
          startWith({
            status: 'loading' as const,
            members: [] as OrcidMember[],
            totalResults: 0,
            page,
            totalPages: 0,
          }),
        ),
      ),
      // Désabonnement automatique à la destruction du composant
      takeUntilDestroyed(),
    );
  }

  /** Transmet la saisie utilisateur au flux de recherche debouncé. */
  onSearchInput(value: string): void {
    this.rawQuery$.next(value);
  }

  /**
   * Change de page à la demande du composant de pagination NgBootstrap.
   * NgbPagination utilise un index 1-based ; l'API ORCID attend un index 0-based.
   */
  goToPage(ngbPage: number): void {
    this.currentPage$.next(ngbPage - 1);
    // Retour en haut de page — `defaultView` est null côté serveur (SSR)
    this.document.defaultView?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Fonction d'identité pour `*ngFor` — évite le re-rendu des cartes inchangées. */
  trackByOrcidId(_index: number, member: OrcidMember): string {
    return member.orcidId;
  }
}
