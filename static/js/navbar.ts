import { Config } from "./config";
import { HamburgerMenu } from "./hamburgerMenu";
import { Helpers } from "./helpers";

/**
 * Navbar Scroll class enables the navbar to change size when scrolling the page
 */
export class Navbar {
  protected config: Config;

  private hiddenClass: string = '';
  private navbarId: string = '';
  private navbar: HTMLElement | null = null;
  private mailchimpButtonId: string = '';
  private mailchimpButton : HTMLButtonElement | null = null;
  private mailchimpHamburgerButtonId: string = '';
  private mailchimpHamburgerButton: HTMLButtonElement | null = null;
  private underTitleSocialIconsId: string = '';
  private underTitleSocialIconsElement: HTMLElement | null = null;
  private hamburgerMenuSocialIconsId: string = '';
  private hamburgerMenuSocialIcondsElement: HTMLElement | null = null;

  private scrollTopValue: number = 0;
  private maxHeightLowValue: string = '';
  private boxShadowLowValue: string = '';
  private maxHeightHighValue: string = '';
  private boxShadowHighValue: string = '';

  public mailchimpButtonClickCallback : { (): void } = () => {};

  private hamburgerMenu: HamburgerMenu | null = null;

  constructor(config: Config, hamburgerMenu: HamburgerMenu) {
    this.config = config;
    this.navbarId = this.config.navbarId;
    this.mailchimpButtonId = this.config.mailchimpButtonId;
    this.mailchimpHamburgerButtonId = this.config.mailchimpHamburgerButtonId;
    this.hamburgerMenu = hamburgerMenu;
    this.underTitleSocialIconsId = this.config.underTitleSocialIconsId;
    this.hamburgerMenuSocialIconsId = this.config.hamburgerMenuSocialIconsId;
    this.hiddenClass = this.config.hiddenClass;
    this.scrollTopValue = this.config.navbarScrollTopValue;
    this.maxHeightLowValue = this.config.navbarMaxHeightLowValue;
    this.maxHeightHighValue = this.config.navbarMaxHeightHighValue;
    this.boxShadowLowValue = this.config.navbarBoxShadowLowValue;
    this.boxShadowHighValue = this.config.navbarBoxShadowHighValue;
  }

  /**
   * Initialize navbar elements and add on scroll event listener
   */
  public init(): void {
    this.navbar = this.navbarId === '' ? null :
      Helpers.getElement(this.navbarId) as HTMLElement;
    this.mailchimpButton = this.mailchimpButtonId === '' ? null :
      Helpers.getElement(this.mailchimpButtonId) as HTMLButtonElement;
      this.mailchimpHamburgerButton = this.mailchimpHamburgerButtonId === '' ? null :
      Helpers.getElement(this.mailchimpHamburgerButtonId) as HTMLButtonElement;
    this.underTitleSocialIconsElement = this.underTitleSocialIconsId === '' ? null :
      Helpers.getElement(this.underTitleSocialIconsId) as HTMLButtonElement;
    this.hamburgerMenuSocialIcondsElement = this.hamburgerMenuSocialIconsId === '' ? null :
      Helpers.getElement(this.hamburgerMenuSocialIconsId) as HTMLButtonElement;

    if (this.mailchimpButton) {
      this.mailchimpButton.addEventListener('click', () => {
        this.mailchimpButtonClickCallback();
      });
    }

    if (this.mailchimpHamburgerButton) {
      this.mailchimpHamburgerButton.addEventListener('click', () => {
        this.mailchimpButtonClickCallback();
      });
    }

    this.updateSocialIconsPlacement();

    window.onresize = () => {
      this.updateSocialIconsPlacement();
    }

    window.onscroll = () => {
      if (document.body.scrollTop > this.scrollTopValue || document.documentElement.scrollTop > this.scrollTopValue) {
        this.navbar!.style.boxShadow = this.boxShadowLowValue;
        this.navbar!.style.maxHeight = this.maxHeightLowValue;
      } else {
        this.navbar!.style.boxShadow = this.boxShadowHighValue;
        this.navbar!.style.maxHeight = this.maxHeightHighValue;
      }
    };
  }

  private updateSocialIconsPlacement() {
    if (this.hamburgerMenu) {
      if (this.hamburgerMenu.isHamburgerIconShown()) {
        this.underTitleSocialIconsElement?.classList.add(this.hiddenClass);
        this.hamburgerMenuSocialIcondsElement?.classList.remove(this.hiddenClass);
      } else {
        this.underTitleSocialIconsElement?.classList.remove(this.hiddenClass);
        this.hamburgerMenuSocialIcondsElement?.classList.add(this.hiddenClass);
      }
    }
  }

  public setMailChimpButtonClickListener(callback: { (): void }) {
    this.mailchimpButtonClickCallback = callback;
  }
}
