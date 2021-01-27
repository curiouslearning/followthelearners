import { Config } from "./config";
import { Helpers } from "./helpers";

/**
 * Navbar Scroll class enables the navbar to change size when scrolling the page
 */
export class Navbar {
  protected config: Config;

  private navbarId: string = '';
  private navbar: HTMLElement | null = null;
  private mailchimpButtonId: string = '';
  private mailchimpButton : HTMLButtonElement | null = null;

  public mailchimpButtonClickCallback : { (): void } = () => {};

  constructor(config: Config) {
    this.config = config;
    this.navbarId = this.config.navbarId;
    this.mailchimpButtonId = this.config.mailchimpButtonId;
  }

  /**
   * Initialize navbar elements and add on scroll event listener
   */
  public init(): void {
    this.navbar = this.navbarId === '' ? null :
      Helpers.getElement(this.navbarId) as HTMLElement;
    this.mailchimpButton = this.mailchimpButtonId === '' ? null :
      Helpers.getElement(this.mailchimpButtonId) as HTMLButtonElement;

    if (this.mailchimpButton) {
      this.mailchimpButton.addEventListener('click', () => {
        this.mailchimpButtonClickCallback();
      });
    }

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

  public setMailChimpButtonClickListener(callback: { (): void }) {
    this.mailchimpButtonClickCallback = callback;
  }
}