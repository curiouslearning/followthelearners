import { Helpers } from '../helpers';
import { AdminConfig } from './adminConfig';
import { Modal } from '../modal';


interface Cell {
  r: number;
  c: number;
}
export class StoplightChart {
  private deepDiveModalId: string;
  private deepDiveTitleId: string;
  private currentActiveDeepDive: string;
  private hiddenClass: string;
  private activeClass: string;
  private stoplightRows: Array<string>;

  constructor(config: AdminConfig) {
    this.deepDiveModalId = config.deepDiveModalId;
    this.deepDiveTitleId = config.deepDiveTitleId;
    this.currentActiveDeepDive = config.currentActiveDeepDive;
    this.hiddenClass = config.hiddenClass;
    this.activeClass = config.activeClass
    this.stoplightRows = config.stoplightRows;
  }

  public init(): void {
    for (let row in this.stoplightRows) {
      console.log(`getting row of ${row}`)
      const rowElem =
        Helpers.getElement(`#${this.stoplightRows[row]}-row`)as HTMLElement;
      rowElem.addEventListener(
        'click', () => {
          this.activateDeepDive(this.stoplightRows[row]);
        });
    }
  }
/**
 * Configure the Deep Dive Modal based on which service was selected
 * @param {String} service The service selected by the user
 */
  public activateDeepDive (service: string): void {
    const deepDiveModal = <HTMLElement>Helpers.getElement(this.deepDiveModalId);
    if (deepDiveModal) {
      deepDiveModal.classList.add(this.activeClass);
    }
    const deepDiveTitle = <HTMLElement>Helpers.getElement(this.deepDiveTitleId);
    if (deepDiveTitle) {
      deepDiveTitle.innerHTML = `Deep Dive: ${service}`;
    }
    if (this.currentActiveDeepDive !== `#${service}-console`) {
      let activeDive = <HTMLElement>Helpers.getElement(this.currentActiveDeepDive)
      if (activeDive) {
        activeDive.classList.add(this.hiddenClass);
        this.currentActiveDeepDive = `#${service}-console`;
        activeDive = <HTMLElement>Helpers.getElement(this.currentActiveDeepDive);
        if (activeDive) {
          activeDive.classList.remove(this.hiddenClass);
        }
      }
    }
  }

  protected updateStoplightCell(cell: string, status: string): void {
    console.log('nyello');
    const cls = [
      'fa-check',
      'fa-exclamation-triangle',
      'fa-exclamation-circle',
    ];
    const elemId = `#${cell}-icon`;
    let element = Helpers.getElement(elemId) as HTMLElement;
    element!.classList.remove(...cls);
    switch(status) {
      case 'good':
        console.log('good');
        element!.classList.add('fa-check');
        break;
      case 'error':
        console.log('error');
        element!.classList.add('fa-exclamation-triangle');
        break;
      case 'outage':
        console.log('outage');
        element!.classList.add('fa-exclamation-circle');
        break;
    }
  }

}
