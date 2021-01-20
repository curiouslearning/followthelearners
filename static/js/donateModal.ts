import { getJSDocThisTag } from "typescript";
import { Config } from "./config";
import { Modal } from "./modal";

/**
 * Class for opening and closing the Donate Modal
 */
export class DonateModal extends Modal {

  constructor(config: Config) {
    super(config);
    this.modalId = this.config.donateModalId;
    this.closeButtonId = this.config.donateModalCloseButtonId;
    this.overlayId = this.config.donateModalOverlayId;
  }

}