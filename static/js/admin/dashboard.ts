import { Helpers } from '../helpers';
import { AdminConfig } from './adminConfig';

/**
* A top level controller-of-controllers for the Admin Screen
*/
export class DashboardApp {
  private config: AdminConfig;
  private dashIframes: Array<string>;

  constructor() {
    this.config = new AdminConfig();
    this.dashIframes = this.config.dashIframes;
  }

  init(): void {
    this.reloadIFrames(this.dashIframes); 
  }

  public reloadIFrames(frameList: string[]): void {
    frameList.forEach((frame) => {
      let frameElement = <HTMLIFrameElement> Helpers.getElement(frame);
      frameElement.src = frameElement.src;
    });
  }
}

let app: DashboardApp = new DashboardApp();
app.init();