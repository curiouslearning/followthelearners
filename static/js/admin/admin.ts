import { Helpers } from '../helpers';
import { Config } from '../config';
import { AdminConfig } from './adminConfig';
import { StreetViewController } from './streetViewController';
import { Modal } from '../modal';
import { TabSelector } from '../tabSelector';
import { AdminStoplightChart }  from './adminStoplightChart';

/**
* A top level controller-of-controllers for the Admin Screen
*/
export class AdminApp {
  private config: AdminConfig;
  private tabSelector: TabSelector;
  private streetViewController: StreetViewController;
  private stoplightChart: AdminStoplightChart;
  private activeButtonId: string;
  private dropdown: HTMLSelectElement;
  private businessIframes: Array<string>;
  private dashIframes: Array<string>;
  private tabClickMap: Array<any>;

  constructor() {
    this.config = new AdminConfig();
    this.tabSelector = new TabSelector(this.config);
    this.streetViewController = new StreetViewController(this.config);
    this.stoplightChart = new AdminStoplightChart(this.config);
    this.activeButtonId = this.config.activeButtonId;
    this.businessIframes = this.config.businessIframes;
    this.dashIframes = this.config.dashIframes;
    this.dropdown = <HTMLSelectElement>Helpers.getElement(
        this.config.dropdownParent
      )!;
    this.tabClickMap = this.config.tabButtonTabClickMap;
  }

  init(): void {
    this.stoplightChart.init();
    if (this.tabSelector) {
      this.tabSelector.addEventListener('preTabToggle', (tabId) => {
        console.log(`switching to ${tabId} from ${this.activeButtonId}`);
        if (this.activeButtonId !== tabId) {
          const activeRef =
            Helpers.getElement(this.activeButtonId)! as HTMLElement;
          activeRef.classList.toggle(this.config.activeClass);
          const selectedRef = Helpers.getElement(tabId)! as HTMLElement;
          selectedRef.classList.toggle(this.config.activeClass);
          this.activeButtonId = tabId;
        }
        // reload iFrames to prevent sizing issues
        // if frame was loaded on inactive tag
        console.log(`tabId is ${tabId}`);
        switch (tabId) {
          case '#business-metrics-btn':
            this.reloadIFrames(this.businessIframes);
            break;
          case '#dashboard-metrics-btn':
            this.reloadIFrames(this.dashIframes);
            break;
        }
      });
    }
    // gets data and updates stoplight chart
    if (this.dropdown !== null) {
      this.dropdown!.addEventListener('click', (event: Event) => {
        event.stopPropagation();
        this.dropdown!.classList.toggle(this.config.activeClass);
      });
      this.dropdown!.addEventListener('focusout', (event: Event) => {
        event.stopPropagation();
        this.dropdown!.classList.remove(this.config.activeClass);
      });
    }
  }

  public initMaps(): void {
    // this.streetViewController.init();
  }

  public reloadIFrames(frameList: string[]): void {
    frameList.forEach((frame) => {
      let frameElement = <HTMLIFrameElement> Helpers.getElement(frame);
      frameElement.src = frameElement.src;
    });
  }
}

let app: AdminApp | null = null;
let googleMapsLoaded: boolean = false;

function initGoogleMaps(): void {
  if (app !== null) {
    app.initMaps();
  }
  googleMapsLoaded = true;
}

(window as any).initGoogleMaps = initGoogleMaps;

window.onload = (): void =>{
  let app = new AdminApp();
  app.init();
  if (googleMapsLoaded) {
    app.initMaps();
  }
};
