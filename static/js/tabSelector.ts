import { Config } from './config';

/**
 * Class that contains logic for sections/tabs selection using buttons
 */
export class TabSelector
{ 
  private config: Config;
  private tabButtonsParentId: string;
  private tabsParentId: string;

  private activeTabClass: string;
  private activeTabButtonClass: string;

  private preToggleListeners: { (tabId: string): void; } [] = [];
  private onToggleListeners: { (tabId: string): void; } [] = [];

  private tabButtonsParentElement: HTMLElement | null;
  private tabsParentElement: HTMLElement | null;

  private initializedSuccessfully: boolean;
  private preventDefaultAction: boolean;
  
  /**
   * Initialize class with config
   * @param config Global config
   */
  constructor(config: Config) {
    this.config = config;
    this.tabButtonsParentId = this.config.tabButtonsId;
    this.tabsParentId = this.config.tabsParentId;
    this.activeTabClass = this.config.activeClass;
    this.activeTabButtonClass = this.config.darkClass;
    this.preventDefaultAction = false;

    this.tabButtonsParentElement = document.getElementById(this.tabButtonsParentId);
    this.tabsParentElement = document.getElementById(this.tabsParentId);

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
    console.log(this.config.tabButtonTabClickMap);
    for (let i: number = 0; i < this.config.tabButtonTabClickMap.length; i++) {
      let btn: HTMLElement | null = document.getElementById(this.config.tabButtonTabClickMap[i].btnId!);
      if (btn !== null) {
        btn.addEventListener('click', (event) => {
          this.toggleTab(this.config.tabButtonTabClickMap[i].tabId);
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
  public addEventListener(event: string, callback: { (tabId: string): void; }) {
    if (event === 'tabToggle') {
      this.onToggleListeners.push(callback);
    } else if (event === 'preTabToggle') {
      this.preToggleListeners.push(callback);
    }
  }

  /**
   * Toggles the tab with given tabIndex & updates the button selection state
   * @param {String} tabID is the id of the button and the tab that should
   * be toggled
   */
  public toggleTab(tabId: string) {
    this.preventDefaultAction = false;
    if (this.initializedSuccessfully) {
      const tabButtons: HTMLCollection = this.tabButtonsParentElement?.children!;
      const tabs: HTMLCollection = this.tabsParentElement?.children!;
      let tabIndex: number = 0;

      // Pre toggle calls
      for (let i: number = 0; i < tabs.length; i++) {
        if (tabs[i].id === tabId) {
          tabIndex = i;
          this.preToggleListeners.forEach((listener) => {
            listener(tabs[i].id);
          });
        }
      }

      // Toggle calls
      if (!this.preventDefaultAction) {
        for (let i: number = 0; i < tabButtons.length; i++) {
          if (tabs[i] === null || tabs[i] === undefined) {
            continue;
          }
          if (i === tabIndex) {
            tabButtons[i].classList.add(this.activeTabButtonClass);
            tabs[i].classList.remove(this.activeTabClass);
            this.onToggleListeners.forEach((listener) => {
              listener(tabs[i].id);
            });
          } else {
            tabButtons[i].classList.remove(this.activeTabButtonClass);
            tabs[i].classList.add(this.activeTabClass);
          }
        }
      }
    }
  }

}