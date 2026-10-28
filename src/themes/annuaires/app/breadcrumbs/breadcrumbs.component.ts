import {
  AsyncPipe,
  NgIf,
  NgTemplateOutlet,
} from '@angular/common';
import {
  Component,
  inject,
  OnInit,
} from '@angular/core';
import {
  Router,
  RouterLink,
} from '@angular/router';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import {
  map,
  take,
} from 'rxjs/operators';

import { BreadcrumbsComponent as BaseComponent } from '../../../../app/breadcrumbs/breadcrumbs.component';
import { RouteService } from '../../../../app/core/services/route.service';
import { ThemedResultsBackButtonComponent } from '../../../../app/shared/results-back-button/themed-results-back-button.component';
import { VarDirective } from '../../../../app/shared/utils/var.directive';

/**
 * Fil d'Ariane du thème "annuaires" : bandeau « Répertoire » + bouton "Retour aux résultats" sur la même ligne.
 * Chargé seulement dans la zone de l'annuaire (cf. config.papyrus.yml) ; la logique du bouton retour
 * reprend celle d'ItemComponent pour l'offrir sur toutes les pages de la zone.
 */
@Component({
  selector: 'ds-themed-breadcrumbs',
  templateUrl: 'breadcrumbs.component.html',
  styleUrls: ['breadcrumbs.component.scss'],
  imports: [
    AsyncPipe,
    NgbTooltipModule,
    NgIf,
    NgTemplateOutlet,
    RouterLink,
    ThemedResultsBackButtonComponent,
    TranslateModule,
    VarDirective,
  ],
})
export class BreadcrumbsComponent extends BaseComponent implements OnInit {
  private readonly routeService = inject(RouteService);
  private readonly router = inject(Router);

  private readonly PREVIOUS_URL_SESSION_KEY = 'annuaire-previous-url';

  /** Chemins depuis lesquels le bouton "Retour aux résultats" a du sens. */
  private readonly previousRoute = /^(\/home|\/search|\/browse|\/collections|\/communities|\/admin\/search|\/mydspace)/;

  private storedPreviousUrl: string;

  /** Affiche ou masque le bouton "Retour aux résultats". */
  showBackButton$: Observable<boolean>;

  /** Retourne à la page de résultats mémorisée (passée en @Input au bouton, d'où la fonction fléchée). */
  back = () => {
    void this.router.navigateByUrl(this.storedPreviousUrl);
  };

  ngOnInit(): void {
    this.showBackButton$ = this.routeService.getPreviousUrl().pipe(
      take(1),
      map((url) => {
        const fromRoute = this.pickAllowedPrevious(url);

        if (fromRoute) {
          this.routeService.storeUrlInSession(this.PREVIOUS_URL_SESSION_KEY, fromRoute);
          this.storedPreviousUrl = fromRoute;
          return true;
        }

        // Page précédente hors résultats (navigation entre fiches, rechargement) : dernière URL mémorisée.
        const storedUrl = this.routeService.getUrlFromSession(this.PREVIOUS_URL_SESSION_KEY);
        if (this.pickAllowedPrevious(storedUrl)) {
          this.storedPreviousUrl = storedUrl;
          return true;
        }

        return false;
      }),
    );
  }

  private pickAllowedPrevious(url: string): string | null {
    return url && this.previousRoute.test(url) ? url : null;
  }
}
