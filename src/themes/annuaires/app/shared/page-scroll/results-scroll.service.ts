import { isPlatformBrowser } from '@angular/common';
import {
  inject,
  Injectable,
  PLATFORM_ID,
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  Scroll,
} from '@angular/router';

/** Premier élément présent dans la page : onglets « Parcourir », puis recherche intégrée, puis liste de parcours. */
const RESULTS_ANCHORS = [
  'ds-comcol-page-browse-by',
  'ds-configuration-search-page',
  'ds-search',
  'ds-browse-by',
];

const SCROLL_OFFSET_PX = 16;

/** Onglet actif : onglets de la fiche Person et sous-onglets de ds-tabbed-related-entities-search. */
const TAB_PARAM = 'tab';

/**
 * Défilement du répertoire quand les paramètres changent sur la même page :
 * - recherche, filtre ou pagination : on arrive au début des résultats, plutôt qu'en haut de la page ;
 * - changement d'onglet (fiche Person, rôles des publications) : la page ne bouge pas.
 *
 * Service unique plutôt que composant : le fil d'Ariane qui l'affichait est recréé à chaque navigation,
 * ce qui perdait l'URL et la position précédentes.
 */
@Injectable({ providedIn: 'root' })
export class ResultsScrollService {
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private started = false;
  private previousUrl: string;

  /** Sans effet après le premier appel, et côté serveur. */
  start(): void {
    if (this.started || !this.isBrowser) {
      return;
    }
    this.started = true;
    this.previousUrl = this.router.url;

    this.router.events.subscribe((event) => {
      if (event instanceof Scroll && event.routerEvent instanceof NavigationEnd) {
        this.onScroll(event, event.routerEvent.urlAfterRedirects);
      }
    });
  }

  private onScroll(event: Scroll, url: string): void {
    const previousUrl = this.previousUrl;
    this.previousUrl = url;

    // Seulement quand les paramètres changent sur la même page, et sans ancre (gérée par le routeur).
    if (this.path(previousUrl) !== this.path(url) || event.anchor) {
      return;
    }
    // Cet abonné passe avant celui du routeur, qui remonte ensuite la page en haut dans la même tâche :
    // on relit la position maintenant, puis on la rétablit en microtâche, avant l'affichage.
    const position = window.scrollY;
    const tabSwitch = this.isTabSwitch(previousUrl, url);
    queueMicrotask(() => {
      window.scrollTo({ top: position, behavior: 'instant' });
      if (!tabSwitch) {
        setTimeout(() => this.scrollToResults());
      }
    });
  }

  private scrollToResults(): void {
    const anchor = RESULTS_ANCHORS
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .find((element) => !!element);
    if (!anchor) {
      return;
    }
    const top = anchor.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET_PX;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  /** Vrai si l'onglet a changé ; les paramètres de recherche de l'ancien onglet sont alors abandonnés. */
  private isTabSwitch(previousUrl: string, url: string): boolean {
    const previous = this.router.parseUrl(previousUrl).queryParams;
    const current = this.router.parseUrl(url).queryParams;
    return previous[TAB_PARAM] !== current[TAB_PARAM];
  }

  private path(url: string): string {
    return url.split(/[?#]/)[0];
  }
}
