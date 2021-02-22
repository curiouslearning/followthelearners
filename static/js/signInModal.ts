import { getJSDocThisTag } from "typescript";
import { AuthController } from "./authController";
import { Config } from "./config";
import { Helpers } from "./helpers"
import { Modal } from "./modal";

/* Sign in modal */
export class SignInModal extends Modal {
  private hiddenClass: string = '';
  private formId: string = '';
  private form: HTMLFormElement | null = null;
  private donorInfoTextId: string = '';
  private donorInfoText: HTMLElement | null = null;
  private instructionTextId: string = '';
  private instructionText: HTMLElement | null = null;
  private emailInputId: string = '';
  private emailInput: HTMLInputElement | null = null;
  private submitButtonId: string = '';
  private submitButon: HTMLButtonElement | null = null;
  private goToDonateButtonId: string = '';
  private goToDonateButton: HTMLButtonElement | null = null;

  private authController: AuthController | null = null;

  private onAuthenticatedSubmitClick: { (email: string): void } = () => {};
  private onGoToDonateButtonClick: { (): void } = () => {};

  constructor(config: Config, authController: AuthController) {
    super(config);
    this.modalId = this.config.signInModalId;
    this.authController = authController;
    this.formId = this.config.singInModalFormId;
    this.closeButtonId = this.config.signInModalCloseButtonId;
    this.overlayId = this.config.signInModalOverlayId;
    this.instructionTextId = this.config.signInModalInstructionTextId;
    this.emailInputId = this.config.signInModalDonorEmailInputId;
    this.submitButtonId = this.config.signInModalSubmitButtonId;
    this.donorInfoTextId = this.config.signInModalDonorInfoTextId;
    this.goToDonateButtonId = this.config.signInModalGoToDonateButtonId;
    this.hiddenClass = this.config.hiddenClass;
  }

  /**
   * Initialize the modal elements and add control listeners
   */
  public init(): void {
    super.init();
    this.form = this.formId === '' ? null :
      Helpers.getElement(this.formId) as HTMLFormElement;
    this.donorInfoText = this.donorInfoTextId === '' ? null :
      Helpers.getElement(this.donorInfoTextId) as HTMLElement;
    this.instructionText = this.instructionTextId === '' ? null :
      Helpers.getElement(this.instructionTextId) as HTMLElement;
    this.emailInput = this.emailInputId === '' ? null :
      Helpers.getElement(this.emailInputId) as HTMLInputElement;
    this.submitButon = this.submitButtonId === '' ? null :
      Helpers.getElement(this.submitButtonId) as HTMLButtonElement;
    this.goToDonateButton = this.goToDonateButtonId === '' ? null :
      Helpers.getElement(this.goToDonateButtonId) as HTMLButtonElement;

    this.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.onFormSubmit();
    });

    this.emailInput?.addEventListener('keyup', (event) => {
      if (Helpers.isKeyCodeSpecial(event.keyCode)) {
        return;
      }

      if (Helpers.isValidEmail(this.emailInput!.value)) {
        this.submitButon!.disabled = false;
        this.donorInfoText?.classList.add(this.hiddenClass);
      } else {
        this.submitButon!.disabled = true;
        this.donorInfoText!.innerHTML = 'Please enter a valid email address';
        this.donorInfoText?.classList.remove(this.hiddenClass);
      }
    });

    this.submitButon?.addEventListener('click', () => {
      this.onFormSubmit();
    });

    this.goToDonateButton?.addEventListener('click', () => {
      this.onGoToDonateButtonClick();
      this.close();
    });
  }

  /**
   * Authenticated submit click listener assignment
   * @param callback Callback
   */
  public SetOnAuthenticatedSubmitClickListener(callback: { (email: string): void }) {
    this.onAuthenticatedSubmitClick = callback;
  }

  /**
   * Go to donate button click listener assignment
   * @param callback Callback
   */
  public SetOnGoToDonateButtonClickListener(callback: { (): void }) {
    this.onGoToDonateButtonClick = callback;
  }

  /**
   * Called when the form submission is initiated
   */
  public onFormSubmit(): void {
    if (this.authController?.isAuthenticated()) {
       let email = this.authController.getEmail();
       if (email === null || email === '') {
         email = this.emailInput!.value;
       }
       this.onAuthenticatedSubmitClick(email);
       return;
    } else if (this.submitButon?.disabled) {
      return;
    }
    let emailValue = this.emailInput?.value;

    Helpers.getXHR(`/isUser/?email=${emailValue}`, {}, (data) => {
      if (data.isUser) {
        this.authController?.sendMagicLink(emailValue!, () => {
          window.localStorage.setItem('emailForSignIn', emailValue!);
          this.donorInfoText!.innerHTML = 'Success! Please follow the link we sent to your email to authenticate! You can now safely close this window.';
          this.donorInfoText?.classList.remove(this.hiddenClass);
          this.emailInput!.value = '';
        });
      } else {
        this.donorInfoText?.classList.remove(this.hiddenClass);
        this.donorInfoText!.innerHTML = data.displayText;
        this.instructionText?.classList.add(this.hiddenClass);
      }
    });

  }

  /**
   * Close the modal
   */
  public close(): void {
    this.instructionText?.classList.remove(this.hiddenClass);
    super.close();
  }

}
