import { Helpers } from '../helpers';
import { Config } from '../config';
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

  constructor(config: Config) {
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
          this.activateDeepDive(row);
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

  }

}
