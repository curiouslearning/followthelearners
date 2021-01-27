import { getJSDocThisTag } from "typescript";
import { Config } from "./config";
import { Modal } from "./modal";

/**
 * Class for opening and closing the Donate Modal
 */
export class MailchimpModal extends Modal {

  constructor(config: Config) {
    super(config);
    this.modalId = this.config.mailchimpModalId;
    this.closeButtonId = this.config.mailchimpModalCloseButtonId;
    this.overlayId = this.config.mailchimpModalOverlayId;
  }

}