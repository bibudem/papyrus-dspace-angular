import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { RootModule } from '../../app/root.module';
import { AdminSidebarComponent } from './app/admin/admin-sidebar/admin-sidebar.component';
import { BreadcrumbsComponent } from './app/breadcrumbs/breadcrumbs.component';
import { FooterComponent } from './app/footer/footer.component';
import { HeaderNavbarWrapperComponent } from './app/header-nav-wrapper/header-navbar-wrapper.component';
import { HeaderComponent } from './app/header/header.component';
import { HomeNewsComponent } from './app/home-page/home-news/home-news.component';
import { HomePageComponent } from './app/home-page/home-page.component';
import { TopLevelCommunityListComponent } from './app/home-page/top-level-community-list/top-level-community-list.component';
import { EndUserAgreementComponent } from './app/info/end-user-agreement/end-user-agreement.component';
import { FeedbackFormComponent } from './app/info/feedback/feedback-form/feedback-form.component';
import { FeedbackComponent } from './app/info/feedback/feedback.component';
import { PrivacyComponent } from './app/info/privacy/privacy.component';
import { UntypedItemComponent } from './app/item-page/simple/item-types/untyped-item/untyped-item.component';
import { NavbarComponent } from './app/navbar/navbar.component';
import { ItemSearchResultListElementComponent } from './app/shared/object-list/search-result-list-element/item-search-result/item-types/item/item-search-result-list-element.component';

const ENTRY_COMPONENTS = [
  UntypedItemComponent,
  ItemSearchResultListElementComponent,
  TopLevelCommunityListComponent,
];

const DECLARATIONS = [
  ...ENTRY_COMPONENTS,
  HeaderComponent,
  FooterComponent,
  NavbarComponent,
  HeaderNavbarWrapperComponent,
  BreadcrumbsComponent,
  HomeNewsComponent,
  HomePageComponent,
  AdminSidebarComponent,
  EndUserAgreementComponent,
  FeedbackComponent,
  FeedbackFormComponent,
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
export class EagerThemeModule {
}
