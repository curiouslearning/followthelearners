import { Helpers } from '../helpers';
import { Config } from '../config';
import { StreetViewController } from './streetViewController';
import { Modal } from '../modal';
import { TabSelector } from '../tabSelector';
import { AdminStoplightChart }  from './adminStoplightChart';


export class AdminApp {
  private config: Config;
  private tabSelector: TabSelector;
  private streetViewController: StreetViewController;
  private stoplightChart: AdminStoplightChart;
  private activeButtonId: string;
  private dropdown: HTMLSelectElement;
  private businessIframes: string[];
  private dashIframes: string[];

  constructor() {
    this.config = new Config();
    this.tabSelector = new TabSelector(this.config);
    this.streetViewController = new StreetViewController(this.config);
    this.stoplightChart = new AdminStoplightChart(this.config);
    this.activeButtonId = this.config.activeButtonId;
    this.businessIframes = this.config.businessIframes;
    this.dashIframes = this.config.dashIframes;
    this.dropdown = <HTMLSelectElement>Helpers.getElement(
        this.config.dropdownParent
      )!;
  }

  init(): void {
    // gets data and update stoplight chart
    this.OnTabButtonClicked(this.activeButtonId);
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
    this.streetViewController.init();
    this.stoplightChart.init();
  }

  public OnTabButtonClicked (tabId: string): void {
    if (this.tabSelector) {
      this.tabSelector.addEventListener('preTabToggle', (tabId) => {
        const selectedBtn: string = `${tabId}-btn`;
        if (this.activeButtonId !== selectedBtn) {
          const activeRef =
            Helpers.getElement(this.config.activeButtonId)! as HTMLElement;
          activeRef.classList.toggle(this.config.activeClass);
          const selectedRef = Helpers.getElement(selectedBtn)! as HTMLElement;
          selectedRef.classList.toggle(this.config.activeClass);
          this.activeButtonId = selectedBtn;
        }
        // reload iFrames to prevent sizing issues
        // if frame was loaded on inactive tag
        switch (tabId) {
          case 'business-metrics':
            this.reloadIFrames(this.businessIframes);
            break;
          case 'dashboard-metrics':
            this.reloadIFrames(this.dashIframes);
            break;
        }
      });
    }
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
    app.init();
  }
  googleMapsLoaded = true;
}
(window as any).initGoogleMaps = initGoogleMaps;
window.onload = (): void =>{
  let app = new AdminApp();
  if (googleMapsLoaded) {
    app.init();
  }
};
