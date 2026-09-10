import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { StoreModule } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';

import { RootModule } from '../../app/root.module';
import { PersonSearchResultListElementComponent } from './app/entity-groups/research-entities/item-list-elements/search-result-list-elements/person/person-search-result-list-element.component';
import { OrgUnitSearchResultListElementComponent } from './app/entity-groups/research-entities/item-list-elements/search-result-list-elements/org-unit/org-unit-search-result-list-element.component';

const DECLARATIONS = [
  PersonSearchResultListElementComponent,
  OrgUnitSearchResultListElementComponent,
];

@NgModule({
  imports: [
    RootModule,
    CommonModule,
    FormsModule,
    HttpClientModule,
    NgbModule,
    RouterModule,
    StoreModule,
    StoreRouterConnectingModule,
    TranslateModule,
    ...DECLARATIONS,
  ],
})
class LazyThemeModule {
}
