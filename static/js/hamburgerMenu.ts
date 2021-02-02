import { Config } from "./config";
import { Helpers } from "./helpers";

/** Hamburger menu class */
export class HamburgerMenu {
  private config: Config;

  private activeClass: string;
  private menuClass: string;
  private colorTransparent: string;

  constructor(config: Config) {
    this.config = config;
    this.activeClass = this.config.activeClass;
    this.menuClass = this.config.hamburgerMenuClass;
    this.colorTransparent = this.config.colorTransparent;
  }

  public init(): void {
    const $navbarBurgers = Array.prototype.slice.call(
      document.querySelectorAll(this.menuClass), 0);

    if ($navbarBurgers.length > 0) {
      $navbarBurgers.forEach((el: HTMLElement) => {
        el.addEventListener('click', () => {
          const targetId = el.dataset.target;
          const target = Helpers.getElement('#' + targetId) as HTMLElement;

          el.classList.toggle(this.activeClass);
          target!.classList.toggle(this.activeClass);
          target.style.backgroundColor =
            target.classList.contains(this.activeClass) ? '#FFF' : 'rgba(0,0,0,0)';
        });
      });
    }
  }

  public isHamburgerIconShown() {
    const $navbarBurgers = Array.prototype.slice.call(
      document.querySelectorAll(this.menuClass), 0);
    if ($navbarBurgers.length === 1) {
      return getComputedStyle($navbarBurgers[0]).display === 'block';
    }
    return false;
  }

  /**
   * Close the hamburger menu if active
   */
  public close(): void {
    const navbarBurgers = Array.prototype.slice.call(
      document.querySelectorAll(this.menuClass), 0);
    if (navbarBurgers.length > 0) {
      navbarBurgers.forEach((nb) => {
        const targetId = nb.dataset.target;
        const target = Helpers.getElement('#' + targetId) as HTMLElement;
        nb.classList.remove(this.activeClass);
        target!.classList.remove(this.activeClass);
        target!.style.backgroundColor = this.colorTransparent;
      });
    }
  }

}