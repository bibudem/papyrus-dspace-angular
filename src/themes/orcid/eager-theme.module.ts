import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { RootModule } from '../../app/root.module';
import { CommunityPageComponent } from './app/community-page/community-page.component';
import { PersonComponent } from './app/entity-groups/research-entities/item-pages/person/person.component';
import { PersonSearchResultListElementComponent } from './app/entity-groups/research-entities/item-list-elements/search-result-list-elements/person/person-search-result-list-element.component';
import { OrgUnitSearchResultListElementComponent } from './app/entity-groups/research-entities/item-list-elements/search-result-list-elements/org-unit/org-unit-search-result-list-element.component';
import { PersonSearchResultGridElementComponent } from './app/entity-groups/research-entities/item-grid-elements/search-result-grid-elements/person/person-search-result-grid-element.component';
import { OrgUnitSearchResultGridElementComponent } from './app/entity-groups/research-entities/item-grid-elements/search-result-grid-elements/org-unit/org-unit-search-result-grid-element.component';
import { SearchFiltersComponent } from './app/shared/search/search-filters/search-filters.component';
import { SearchSettingsComponent } from './app/shared/search/search-settings/search-settings.component';
import { ComcolPageBrowseByComponent } from './app/shared/comcol/comcol-page-browse-by/comcol-page-browse-by.component';

/**
 * Thème "orcid" : annuaire des chercheurs et chercheuses de l'UdeM
 * (communauté 1acd99a0-6ffb-42f8-a261-30b96f3f2405, cf. config/config.papyrus.yml).
 * Étend "montreal" (header/footer/navbar hérités, rien à redéclarer ici).
 *
 * IMPORTANT : tsconfig.app.json n'inclut que "src/themes/**\/*.module.ts", pas tout src/.
 * Un composant thémé chargé dynamiquement (ThemedComponent, ex. CommunityPageComponent)
 * doit donc être importé ici pour être compilé — sinon il est absent du bundle.
 */
const ENTRY_COMPONENTS = [
  PersonSearchResultListElementComponent,
  OrgUnitSearchResultListElementComponent,
  PersonSearchResultGridElementComponent,
  OrgUnitSearchResultGridElementComponent,
  PersonComponent,
];

const DECLARATIONS = [
  ...ENTRY_COMPONENTS,
  CommunityPageComponent,
  SearchFiltersComponent,
  SearchSettingsComponent,
  ComcolPageBrowseByComponent,
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
