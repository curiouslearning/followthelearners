import { Config } from './config';
import { Helpers } from "./helpers";

/**
 * Class that contains logic for sections/tabs selection using buttons
 */
export class TabSelector
{ 
  private config: Config;
  private tabButtonsParentId: string;
  private tabsParentId: string;

  private activeTabClass: string;
  private hiddenTabClass: string;
  private activeTabButtonClass: string;

  private preToggleListeners: { (btnId: string, tabId: string): void; } [] = [];
  private onToggleListeners: { (btnId: string, tabId: string): void; } [] = [];

  private tabButtonsParentElement: HTMLElement | null;
  private tabsParentElement: HTMLElement | null;

  private initializedSuccessfully: boolean;
  private preventDefaultAction: boolean;
  
  constructor(config: Config) {
    this.config = config;
    this.tabButtonsParentId = this.config.tabButtonsId;
    this.tabsParentId = this.config.tabsParentId;
    this.activeTabClass = this.config.activeClass;
    this.hiddenTabClass = this.config.hiddenClass;
    this.activeTabButtonClass = this.config.darkClass;
    this.preventDefaultAction = false;

    this.tabButtonsParentElement = Helpers.getElement(this.tabButtonsParentId) as HTMLElement;
    this.tabsParentElement = Helpers.getElement(this.tabsParentId) as HTMLElement;

    if (!this.tabButtonsParentElement || !this.tabsParentElement) {
      console.log("TabSelector: Failed to initialize values. Please check given element IDs.");
      this.initializedSuccessfully = false;
      return;
    }

    this.initializedSuccessfully = true;

    this.initTabButtons();
  }

  /**
   * Initialize tab button click
   */
  initTabButtons(): void {
    if (!this.initializedSuccessfully) {
      return;
    }
    if (this.config.tabButtonTabClickMap.length === 0) {
      return;
    }
    for (let i: number = 0; i < this.config.tabButtonTabClickMap.length; i++) {
      let btn: HTMLElement | null = Helpers.getElement(this.config.tabButtonTabClickMap[i].btnId!) as HTMLElement;
      if (btn !== null) {
        btn.addEventListener('click', (event) => {
          this.toggleTab(this.config.tabButtonTabClickMap[i].btnId, this.config.tabButtonTabClickMap[i].tabId);
        });
      }
    } 
  }

  /**
   * Returns true if the TabSelector is successfully initialized and false otherwise
   */
  public isInitialized(): boolean {
    return this.initializedSuccessfully;
  }

  /**
   * Add event listener with give eventName and listener
   * @param event is the name of the event ('preTabToggle' | 'tabToggle')
   * @param callback method that's getting called upon event occurence
   * ('preTabToggle' event passes DOM tab element ID |
   * 'tabToggle' event passes DOM tab element ID)
   */
  public addEventListener(event: string, callback: { (btnId: string, tabId: string): void; }) {
    if (event === 'tabToggle') {
      this.onToggleListeners.push(callback);
    } else if (event === 'preTabToggle') {
      this.preToggleListeners.push(callback);
    }
  }


  public toggleWithName(tab: string): void {
    for (let i: number = 0; i < this.config.tabButtonTabClickMap.length; i++) {
      if (this.config.tabButtonTabClickMap[i].tabId.substring(1) === tab) {
        this.toggleTab(this.config.tabButtonTabClickMap[i].btnId, 
          this.config.tabButtonTabClickMap[i].tabId);
        return;
      }
    }
  }

  /**
   * Toggles the tab with given tabIndex & updates the button selection state
   * @param {String} tabID is the id of the button and the tab that should
   * be toggled
   */
  public toggleTab(btnId: string, tabId: string): void {
    this.preventDefaultAction = false;
    if (this.initializedSuccessfully) {
      const tabButtons: HTMLCollection = this.tabButtonsParentElement?.children!;
      const tabs: HTMLCollection = this.tabsParentElement?.children!;
      let tabIndex: number = 0;

      this.preToggleListeners.forEach((listener) => {
        listener(btnId, tabId);
      });

      // Toggle calls
      if (!this.preventDefaultAction) {
        const tabMap: any = this.config.tabButtonTabClickMap
          .find((el: any) => el.btnId === btnId);

        for (let i: number = 0; i < tabButtons.length; i++) {
          tabButtons[i].classList.remove(this.activeTabButtonClass);
        }

        for (let i: number = 0; i < tabs.length; i++) {
          tabs[i].classList.add(this.hiddenTabClass);
          tabs[i].classList.remove(this.activeTabClass);
        }

        const tab = Helpers.getElement(tabMap.tabId) as HTMLElement;
        const btn = Helpers.getElement(tabMap.btnId) as HTMLElement;

        tab.classList.add(this.activeTabClass);
        tab.classList.remove(this.hiddenTabClass);
        btn.classList.add(this.activeTabButtonClass);

        this.onToggleListeners.forEach((listener) => {
          listener(btnId, tabId);
        });
      }
    }
  }

  /** Prevent default click action */
  public preventDefault(): void {
    this.preventDefaultAction = true;
  }

}