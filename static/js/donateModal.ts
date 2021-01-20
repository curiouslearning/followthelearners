import { getJSDocThisTag } from "typescript";
import { Config } from "./config";
import { Helpers } from "./helpers"
import { Modal } from "./modal";

export class DonateModal extends Modal {

  constructor(config: Config) {
    super(config);
    this.modalId = this.config.donateModalId;
    this.closeButtonId = this.config.donateModalCloseButtonId;
    this.overlayId = this.config.donateModalOverlayId;
  }

}