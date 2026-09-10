import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { RootModule } from '../../app/root.module';
import { CommunityPageComponent } from './app/community-page/community-page.component';
import { PersonComponent } from './app/entity-groups/research-entities/item-pages/person/person.component';
import { PersonSearchResultListElementComponent } from './app/entity-groups/research-entities/item-list-elements/search-result-list-elements/person/person-search-result-list-element.component';
import { OrgUnitSearchResultListElementComponent } from './app/entity-groups/research-entities/item-list-elements/search-result-list-elements/org-unit/org-unit-search-result-list-element.component';

/**
 * Thème "orcid" : annuaire des chercheurs et chercheuses de l'UdeM
 * (communauté 1acd99a0-6ffb-42f8-a261-30b96f3f2405, cf. config/config.papyrus.yml).
 *
 * Ce thème étend "montreal" (header/footer/navbar/etc. hérités, rien à redéclarer ici).
 * Seuls les composants qui utilisent le décorateur @listableObjectComponent doivent être
 * ajoutés à ENTRY_COMPONENTS, pour que ce décorateur soit bien exécuté au chargement du bundle.
 *
 * IMPORTANT : tsconfig.app.json ne "include" que "src/themes/**\/*.module.ts" (pas tout src/**\/*.ts).
 * Un composant thémé chargé dynamiquement (via ThemedComponent, ex. CommunityPageComponent) n'est
 * donc jamais compilé/inclus dans le bundle s'il n'est pas AUSSI importé ici de façon statique.
 */
const ENTRY_COMPONENTS = [
  PersonSearchResultListElementComponent,
  OrgUnitSearchResultListElementComponent,
  PersonComponent,
];

const DECLARATIONS = [
  ...ENTRY_COMPONENTS,
  CommunityPageComponent,
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
