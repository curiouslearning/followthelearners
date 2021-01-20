import { Config } from "./config";
import { Helpers } from "./helpers";

/** Modal base class */
export class Modal {
  protected config: Config;
  protected activeClass: string = '';
  protected modalId: string = '';
  protected modal: HTMLElement | null = null;
  protected closeButtonId: string = '';
  protected closeButton: HTMLButtonElement | null = null;
  protected overlayId: string | string = '';
  protected overlay: HTMLElement | null = null;

  constructor(config: Config) {
    this.config = config;
    this.activeClass = this.config.activeClass;
  }

  /**
   * Initialize the modal elements and assign listeners
   */
  public init(): void {
    this.modal = Helpers.getElement(this.modalId) as HTMLElement;
    this.closeButton = Helpers.getElement(this.closeButtonId) as HTMLButtonElement;
    this.overlay = Helpers.getElement(this.overlayId) as HTMLElement;

    if (this.closeButton) {
      this.closeButton.addEventListener('click', (event) => {
        this.close();
      });
    }

    if (this.overlay) {
      this.overlay.addEventListener('click', (event) => {
        this.close();
      });
    }
  }

  /**
   * Open the modal
   */
  public open(): void {
    if (this.modal && !this.isOpen()) {
      this.modal.classList.add(this.activeClass);
    }
  }

  /**
   * Close the modal
   */
  public close(): void {
    if (this.modal && this.isOpen()) {
      this.modal.classList.remove(this.activeClass);
    }
  }

  /**
   * Check to see if the modal is open
   */
  public isOpen(): boolean {
    if (this.modal) {
      return this.modal.classList.contains(this.activeClass);
    } else {
      return false;
    }
  }
}