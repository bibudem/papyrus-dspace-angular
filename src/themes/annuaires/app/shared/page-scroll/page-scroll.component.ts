import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  Scroll,
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';

/** Premier élément présent dans la page : onglets « Parcourir », puis recherche intégrée, puis liste de parcours. */
const RESULTS_ANCHORS = [
  'ds-comcol-page-browse-by',
  'ds-configuration-search-page',
  'ds-search',
  'ds-browse-by',
];

const SCROLL_OFFSET_PX = 16;
const BACK_TO_TOP_THRESHOLD_PX = 600;

/** Paramètres d'un changement de sous-onglet (ds-tabbed-related-entities-search) : la page ne bouge pas. */
const TAB_SWITCH_PARAMS = ['tab', 'spc.page'];

/**
 * Défilement dans le répertoire :
 * - après une recherche, un filtre ou un changement de page, on arrive au début des résultats
 *   plutôt qu'en haut de la page (en-tête et description de la communauté) ;
 * - un changement de sous-onglet (ex. rôles des publications d'une fiche) garde la position ;
 * - bouton « Haut de page » quand on est descendu assez bas.
 */
@Component({
  selector: 'ds-annuaires-page-scroll',
  templateUrl: './page-scroll.component.html',
  styleUrls: ['./page-scroll.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
  ],
})
export class PageScrollComponent implements OnInit {
  showBackToTop = false;

  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private previousUrl: string | null = null;

  /** Position avant la navigation : l'événement scroll du routeur n'est traité qu'à la tâche suivante. */
  private lastScrollY = 0;

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }

    this.previousUrl = this.router.url;

    // L'événement Scroll arrive après NavigationEnd, une fois que le routeur a remonté la page en haut.
    this.router.events.pipe(
      filter((event): event is Scroll => event instanceof Scroll && event.routerEvent instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((event) => {
      const previousUrl = this.previousUrl;
      const url = (event.routerEvent as NavigationEnd).urlAfterRedirects;
      this.previousUrl = url;

      // Seulement quand les paramètres changent sur la même page, et sans ancre (gérée par le routeur).
      if (previousUrl === null || this.path(previousUrl) !== this.path(url) || event.anchor) {
        return;
      }
      // Le routeur vient de remonter la page en haut : on l'annule dans la même tâche, sans image intermédiaire.
      window.scrollTo({ top: this.lastScrollY, behavior: 'instant' });
      if (!this.isTabSwitch(previousUrl, url)) {
        setTimeout(() => this.scrollToResults());
      }
    });
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.lastScrollY = window.scrollY;
    const visible = window.scrollY > BACK_TO_TOP_THRESHOLD_PX;
    if (visible !== this.showBackToTop) {
      this.showBackToTop = visible;
      this.cdr.markForCheck();
    }
  }

  backToTop(): void {
    window.scrollTo({ top: 0, behavior: this.scrollBehavior() });
  }

  private scrollToResults(): void {
    const anchor = RESULTS_ANCHORS
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .find((element) => !!element);
    if (!anchor) {
      return;
    }
    const top = anchor.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET_PX;
    window.scrollTo({ top, behavior: this.scrollBehavior() });
  }

  private scrollBehavior(): ScrollBehavior {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  /** Vrai si seuls les paramètres de sous-onglet ont changé. */
  private isTabSwitch(previousUrl: string, url: string): boolean {
    const previous = this.router.parseUrl(previousUrl).queryParams;
    const current = this.router.parseUrl(url).queryParams;
    const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    const changed = [...keys].filter((key) => previous[key] !== current[key]);
    return changed.length > 0 && changed.every((key) => TAB_SWITCH_PARAMS.includes(key)) && changed.includes('tab');
  }

  private path(url: string): string {
    return url.split(/[?#]/)[0];
  }
}
