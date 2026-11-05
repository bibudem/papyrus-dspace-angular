import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  distinctUntilChanged,
  map,
} from 'rxjs/operators';

import { RemoteData } from '../../../../../app/core/data/remote-data';
import { Item } from '../../../../../app/core/shared/item.model';
import { ThemedItemAlertsComponent } from '../../../../../app/item-page/alerts/themed-item-alerts.component';
import { AccessByTokenNotificationComponent } from '../../../../../app/item-page/simple/access-by-token-notification/access-by-token-notification.component';
import { ItemPageComponent as BaseComponent } from '../../../../../app/item-page/simple/item-page.component';
import { NotifyRequestsStatusComponent } from '../../../../../app/item-page/simple/notify-requests-status/notify-requests-status-component/notify-requests-status.component';
import { QaEventNotificationComponent } from '../../../../../app/item-page/simple/qa-event-notification/qa-event-notification.component';
import { ItemVersionsComponent } from '../../../../../app/item-page/versions/item-versions.component';
import { ItemVersionsNoticeComponent } from '../../../../../app/item-page/versions/notice/item-versions-notice.component';
import { fadeInOut } from '../../../../../app/shared/animations/fade';
import { ErrorComponent } from '../../../../../app/shared/error/error.component';
import { ThemedLoadingComponent } from '../../../../../app/shared/loading/themed-loading.component';
import { ListableObjectComponentLoaderComponent } from '../../../../../app/shared/object-collection/shared/listable-object/listable-object-component-loader.component';
import { VarDirective } from '../../../../../app/shared/utils/var.directive';

/**
 * Même page item que DSpace, sans recréer la fiche quand seuls les paramètres d'URL changent.
 *
 * La route item relance son resolver à chaque navigation (`runGuardsAndResolvers: 'always'`) et fournit
 * alors un nouvel objet Item, même identique. Le chargeur de composant recrée la fiche pour tout nouvel
 * objet : changer d'onglet (`?tab=`) ou de page de résultats rechargeait toute la page. On garde l'item
 * précédent tant que c'est le même et qu'il n'a pas été modifié.
 */
@Component({
  selector: 'ds-themed-item-page',
  styleUrls: ['../../../../../app/item-page/simple/item-page.component.scss'],
  templateUrl: '../../../../../app/item-page/simple/item-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeInOut],
  imports: [
    AccessByTokenNotificationComponent,
    AsyncPipe,
    ErrorComponent,
    ItemVersionsComponent,
    ItemVersionsNoticeComponent,
    ListableObjectComponentLoaderComponent,
    NotifyRequestsStatusComponent,
    QaEventNotificationComponent,
    ThemedItemAlertsComponent,
    ThemedLoadingComponent,
    TranslateModule,
    VarDirective,
  ],
})
export class ItemPageComponent extends BaseComponent implements OnInit {

  ngOnInit(): void {
    super.ngOnInit();
    this.itemRD$ = this.route.data.pipe(
      map((data) => data.dso as RemoteData<Item>),
      distinctUntilChanged(isSameItemVersion),
    );
  }
}

/** Même item, même date de modification : rien à réafficher. */
function isSameItemVersion(previous: RemoteData<Item>, current: RemoteData<Item>): boolean {
  const before = previous?.hasSucceeded ? previous.payload : null;
  const after = current?.hasSucceeded ? current.payload : null;
  return !!before && !!after
    && before.uuid === after.uuid
    && before.lastModified?.valueOf() === after.lastModified?.valueOf();
}
