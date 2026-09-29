import type { ReactNode } from "react";

export type NavItem = {
  title: string;
  href?: string;
  disabled?: boolean;
  isDesktopOnly?: boolean;
  subLinks?: { title: string; description: string; href: string }[];
};
export type MenuItem = NavItem & {
  image?: string;
  description?: string;
  launched?: boolean;
  external?: boolean;
  forceReload?: boolean;
};

export type MainNavItem = NavItem;
export type Model = {
  title: string;
  logo: ReactNode;
};

export type SidebarNavItem = {
  title: string;
  disabled?: boolean;
  external?: boolean;
} & (
  | {
      href: string;
      items?: never;
    }
  | {
      href?: string;
      items: MenuItem[];
    }
);

export type SiteConfig = {
  name: string;
  description: string;
  url: string;
  ogImage: string;
  links: {
    github: string;
  };
};

export type DocsConfig = {
  sidebarNav: SidebarNavItem[];
};

export type MarketingConfig = {
  mainNav: MainNavItem[];
  models: Model[];
};

export type NavMenuConfig = {
  pagesNav: SidebarNavItem[];
  examplesNav: SidebarNavItem[];
  links: MenuItem[];
};

export type DashboardConfig = {
  mainNav: MainNavItem[];
  sidebarNav: SidebarNavItem[];
};

export type Media = {
  id: number;
  title: Title;
  coverImage: CoverImage;
  isAdult: boolean;
};

type Title = {
  userPreferred: string;
};

type CoverImage = {
  extraLarge: string;
  large: string;
};
