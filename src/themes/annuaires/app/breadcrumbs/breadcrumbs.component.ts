import {
  AsyncPipe,
  NgFor,
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
 * Fil d'Ariane du thème "annuaires" : identique à celui du cœur, avec un bandeau sous le fil
 * d'Ariane signalant la zone « annuaire des chercheurs » et le bouton "Retour aux résultats"
 * intégré sur la même ligne (à droite). Ce composant n'est chargé (via ThemedComponent) que
 * sur les pages de la communauté 1acd99a0-6ffb-42f8-a261-30b96f3f2405 (cf.
 * config/config.papyrus.yml) — sa seule présence dans le DOM suffit donc à signaler la zone,
 * sans condition supplémentaire à gérer ici.
 *
 * La logique show/hide + navigation du bouton retour est reprise telle quelle de
 * ItemComponent (src/app/item-page/simple/item-types/shared/item.component.ts) : elle ne
 * dépend d'aucune donnée d'item, seulement de l'URL précédente — on peut donc la dupliquer
 * ici pour l'afficher sur toutes les pages de la zone (communauté, Person, OrgUnit), au lieu
 * de la limiter aux seules fiches Person/OrgUnit comme dans le cœur.
 */
@Component({
  selector: 'ds-themed-breadcrumbs',
  templateUrl: 'breadcrumbs.component.html',
  styleUrls: ['breadcrumbs.component.scss'],
  standalone: true,
  imports: [
    VarDirective,
    NgIf,
    NgTemplateOutlet,
    NgFor,
    RouterLink,
    NgbTooltipModule,
    AsyncPipe,
    TranslateModule,
    ThemedResultsBackButtonComponent,
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

  /** Retourne à la page de résultats précédente (URL stockée) ou à l'historique du navigateur. */
  back = () => {
    this.router.navigateByUrl(this.storedPreviousUrl);
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
