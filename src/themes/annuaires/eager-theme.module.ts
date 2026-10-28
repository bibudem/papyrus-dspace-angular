import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { RootModule } from '../../app/root.module';
import { BreadcrumbsComponent } from './app/breadcrumbs/breadcrumbs.component';
import { CommunityPageComponent } from './app/community-page/community-page.component';
import { OrgUnitSearchResultGridElementComponent } from './app/entity-groups/research-entities/item-grid-elements/search-result-grid-elements/org-unit/org-unit-search-result-grid-element.component';
import { PersonSearchResultGridElementComponent } from './app/entity-groups/research-entities/item-grid-elements/search-result-grid-elements/person/person-search-result-grid-element.component';
import { OrgUnitListElementComponent } from './app/entity-groups/research-entities/item-list-elements/org-unit/org-unit-list-element.component';
import { PersonListElementComponent } from './app/entity-groups/research-entities/item-list-elements/person/person-list-element.component';
import { OrgUnitSearchResultListElementComponent } from './app/entity-groups/research-entities/item-list-elements/search-result-list-elements/org-unit/org-unit-search-result-list-element.component';
import { PersonSearchResultListElementComponent } from './app/entity-groups/research-entities/item-list-elements/search-result-list-elements/person/person-search-result-list-element.component';
import { OrgUnitComponent } from './app/entity-groups/research-entities/item-pages/org-unit/org-unit.component';
import { PersonComponent } from './app/entity-groups/research-entities/item-pages/person/person.component';
import { ConfigurationSearchPageComponent } from './app/search-page/configuration-search-page.component';
import { ComcolPageBrowseByComponent } from './app/shared/comcol/comcol-page-browse-by/comcol-page-browse-by.component';
import { SearchFiltersComponent } from './app/shared/search/search-filters/search-filters.component';
import { SearchSettingsComponent } from './app/shared/search/search-settings/search-settings.component';

/**
 * Thème "annuaires" (annuaire des chercheurs UdeM), étend "montreal".
 * tsconfig.app.json ne compile que les *.module.ts des thèmes : tout composant thémé doit être importé ici.
 */
const ENTRY_COMPONENTS = [
  PersonSearchResultListElementComponent,
  OrgUnitSearchResultListElementComponent,
  PersonSearchResultGridElementComponent,
  OrgUnitSearchResultGridElementComponent,
  PersonComponent,
  OrgUnitComponent,
  OrgUnitListElementComponent,
  PersonListElementComponent,
];

const DECLARATIONS = [
  ...ENTRY_COMPONENTS,
  BreadcrumbsComponent,
  CommunityPageComponent,
  SearchFiltersComponent,
  SearchSettingsComponent,
  ComcolPageBrowseByComponent,
  ConfigurationSearchPageComponent,
];

@NgModule({
  imports: [
    CommonModule,
    RootModule,
    ...DECLARATIONS,
  ],
  providers: [
    ...ENTRY_COMPONENTS.map((component) => ({ provide: component })),
  ],
})
export class EagerThemeModule {
}
