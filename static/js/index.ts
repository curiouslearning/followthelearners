import { TabSelector } from "./tabSelector";
import { Config } from "./config";

export class App {
  private config: Config;
  public TabSelector: TabSelector;

  constructor() {
    this.config = new Config();
    this.TabSelector = new TabSelector(this.config);
    this.init();
  }

  init(): void {
    if (!this.TabSelector.isInitialized()) {
      return;
    }
    this.TabSelector.addEventListener('preTabToggle', (tabId: string) => {
      console.log(`WOW TOGGLING TAB: ${tabId}`);
    });
  }
}

/* Initialization */
window.onload = () => {
  let app = new App();
}
