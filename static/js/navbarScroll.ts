import { Config } from "./config";
import { Helpers } from "./helpers";

/**
 * Navbar Scroll class enables the navbar to change size when scrolling the page
 */
export class NavbarScroll {
  protected config: Config;

  private navbarId: string = '';
  private navbar: HTMLElement | null = null;

  constructor(config: Config) {
    this.config = config;
    this.navbarId = this.config.navbarId;
  }

  /**
   * Initialize navbar elements and add on scroll event listener
   */
  public init(): void {
    this.navbar = this.navbarId === '' ? null :
      Helpers.getElement(this.navbarId) as HTMLElement;

    window.onscroll = () => {
      if (document.body.scrollTop > 60 || document.documentElement.scrollTop > 60) {
        this.navbar!.style.boxShadow = '2px 2px 8px #808080';
        this.navbar!.style.maxHeight = '80px';
      } else {
        this.navbar!.style.boxShadow = '0px 0px 0px #808080';
        this.navbar!.style.maxHeight = '120px';
      }
    };
  }
}