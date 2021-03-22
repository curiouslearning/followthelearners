import { getJSDocThisTag } from "typescript";
import { Config } from "./config";
import { Modal } from "./modal";
import { Helpers } from "./helpers";

/**
 * Class New Donor Modal
 */
export class NewDonorModal extends Modal {

  private donateNowButtonId: string = '';
  private donateNowButton: HTMLButtonElement | null = null;
  private signOutButtonId: string = '';
  private signOutButton: HTMLButtonElement | null = null;

  private onDonateNowButtonClickListener: {(): void } | null = null;
  private onSignOutButtonClickListener: {(): void} | null = null;

  constructor(config: Config) {
    super(config);
    this.modalId = this.config.newDonorModalId;
    this.closeButtonId = this.config.newDonorModalCloseButtonId;
    this.overlayId = this.config.newDonorModalOverlayId;

    this.donateNowButtonId = this.config.newDonorModalDonateNowButtonId;
    this.donateNowButton = this.donateNowButtonId === '' ? null :
      Helpers.getElement(this.donateNowButtonId) as HTMLButtonElement;
    this.signOutButtonId = this.config.newDonorModalSignOutButtonId;
    this.signOutButton = this.signOutButtonId === '' ? null :
      Helpers.getElement(this.signOutButtonId) as HTMLButtonElement;
  }

  public init(): void {
    super.init();
    if (this.donateNowButton) {
      this.donateNowButton.addEventListener('click', () => {
        if (this.onDonateNowButtonClickListener) {
          this.onDonateNowButtonClickListener();
        }
      });
    }
    if (this.signOutButton) {
      this.signOutButton.addEventListener('click', () => {
        if (this.onSignOutButtonClickListener) {
          this.onSignOutButtonClickListener();
        }
      });
    }
  }

  public SetOnDonateNowButtonClickListener(callback: {(): void}): void {
    this.onDonateNowButtonClickListener = callback;
  }

  public SetOnSignOutButtonClickListener(callback: {(): void}): void {
    this.onSignOutButtonClickListener = callback;
  }

}