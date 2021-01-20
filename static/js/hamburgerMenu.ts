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

  public close(): void {
    const navbarBurgers = Array.prototype.slice.call(
      document.querySelectorAll('.navbar-burger'), 0);
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