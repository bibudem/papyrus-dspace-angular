import {
  DOCUMENT,
  isPlatformBrowser,
} from '@angular/common';
import {
  inject,
  Injectable,
  PLATFORM_ID,
} from '@angular/core';
import {
  NavigationStart,
  Router,
} from '@angular/router';

/** Classe posée sur <html> pendant une navigation qui reste sur la même page. */
export const SAME_PAGE_NAVIGATION_CLASS = 'same-page-navigation';

/**
 * DSpace masque le contenu pendant chaque navigation pour afficher un indicateur de chargement. Quand seuls
 * les paramètres changent (onglet `?tab=`, recherche, pagination), cela fait un flash blanc : la classe
 * permet au thème de garder le contenu affiché, chaque composant montrant son propre chargement.
 *
 * Le composant racine n'est pas thémable ici : il est choisi au démarrage, avant que le thème soit connu.
 */
@Injectable({ providedIn: 'root' })
export class SamePageNavigationService {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private started = false;

  /** Sans effet après le premier appel, et côté serveur. */
  start(): void {
    if (this.started || !this.isBrowser) {
      return;
    }
    this.started = true;

    // Router.url vaut encore l'URL de départ au NavigationStart. La classe reste jusqu'à la navigation
    // suivante : hors navigation, DSpace ne masque rien et elle est sans effet.
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        const samePage = pathOf(event.url) === pathOf(this.router.url);
        this.document.documentElement.classList.toggle(SAME_PAGE_NAVIGATION_CLASS, samePage);
      }
    });
  }
}

function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}
