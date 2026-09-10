import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeNewsComponent } from './app/home-page/home-news/home-news.component';
import { TopLevelCommunityListComponent } from './app/home-page/top-level-community-list/top-level-community-list.component';
import { NavbarComponent } from './app/navbar/navbar.component';
import { HeaderComponent } from './app/header/header.component';
import { HeaderNavbarWrapperComponent } from './app/header-nav-wrapper/header-navbar-wrapper.component';
import { RootModule } from '../../app/root.module';
import { BreadcrumbsComponent } from './app/breadcrumbs/breadcrumbs.component';
import { FooterComponent } from './app/footer/footer.component';
import { UntypedItemComponent } from './app/item-page/simple/item-types/untyped-item/untyped-item.component';
import { ItemSearchResultListElementComponent } from './app/shared/object-list/search-result-list-element/item-search-result/item-types/item/item-search-result-list-element.component';
import { StartsWithTextComponent } from './app/shared/starts-with/text/starts-with-text.component';
import { StartsWithDateComponent } from './app/shared/starts-with/date/starts-with-date.component';
import { FeedbackFormComponent } from './app/info/feedback/feedback-form/feedback-form.component';
import { HomePageComponent } from './app/home-page/home-page.component';
import { FeedbackComponent } from './app/info/feedback/feedback.component';
import { AdminSidebarComponent } from './app/admin/admin-sidebar/admin-sidebar.component';
import { EndUserAgreementComponent } from './app/info/end-user-agreement/end-user-agreement.component';
import { PrivacyComponent } from './app/info/privacy/privacy.component';

/**
 * Add components that use a custom decorator to ENTRY_COMPONENTS as well as DECLARATIONS.
 * This will ensure that decorator gets picked up when the app loads
 *
 * NOTE (Papyrus) : PersonComponent (fiche Person + enrichissement ORCID) a été déplacé vers
 * le thème "orcid" (voir src/themes/orcid/eager-theme.module.ts) — il ne doit pas être
 * réintroduit ici lors des prochaines fusions depuis les branches DSpace amont.
 */
const ENTRY_COMPONENTS = [
  UntypedItemComponent,
  ItemSearchResultListElementComponent,
];

const DECLARATIONS = [
  ...ENTRY_COMPONENTS,
  HeaderComponent,
  BreadcrumbsComponent,
  HomeNewsComponent,
  TopLevelCommunityListComponent,
  HeaderNavbarWrapperComponent,
  NavbarComponent,
  FooterComponent,
  StartsWithDateComponent,
  StartsWithTextComponent,
  FeedbackFormComponent,
  HomePageComponent,
  FeedbackComponent,
  AdminSidebarComponent,
  EndUserAgreementComponent,
  PrivacyComponent,
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
/**
 * This module is included in the main bundle that gets downloaded at first page load. So it should
 * contain only the themed components that have to be available immediately for the first page load,
 * and the minimal set of imports required to make them work. Anything you can cut from it will make
 * the initial page load faster, but may cause the page to flicker as components that were already
 * rendered server side need to be lazy-loaded again client side
 *
 * Themed EntryComponents should also be added here
 */
export class EagerThemeModule {
}
