import { Helpers } from "./helpers";
import { Config } from "./config";
import { AuthController } from "./authController";
import { TabSelector } from "./tabSelector";
import { AllLearnersDisplayController } from "./allLearnersDisplayController";
import { YourLearnersDisplayController } from "./yourLearnersDisplayController";
import { HamburgerMenu } from "./hamburgerMenu";
import { SignInModal } from "./signInModal";
import { DonateModal } from "./donateModal";
import { Navbar } from "./navbar";
import { MailchimpModal } from "./mailchimpModal";

/**
 * App class that consists of different controllers for different functionlity
 * on the page.
 */
export class App {
  private config: Config;
  private TabSelector: TabSelector;
  private allLearnersDisplayController: AllLearnersDisplayController;
  private yourLearnersDisplayController: YourLearnersDisplayController;
  private authController: AuthController;
  private signInModal: SignInModal;
  private donateModal: DonateModal;
  private mailchimpModal: MailchimpModal;
  private hamburgerMenu: HamburgerMenu;
  private navbar: Navbar;

  constructor() {
    this.config = new Config();
    this.TabSelector = new TabSelector(this.config);
    this.allLearnersDisplayController = new AllLearnersDisplayController(
      this.config);
    this.yourLearnersDisplayController = new YourLearnersDisplayController(
      this.config);
    this.authController = new AuthController(this.config);
    this.hamburgerMenu = new HamburgerMenu(this.config);
    this.signInModal = new SignInModal(this.config, this.authController);
    this.donateModal = new DonateModal(this.config);
    this.mailchimpModal = new MailchimpModal(this.config);
    this.navbar = new Navbar(this.config, this.hamburgerMenu);
    this.hamburgerMenu.close();
  }

  /**
   * Independent method that should be called after the initialization of
   * Google Maps
   */
  init(): void {
    if (!this.TabSelector.isInitialized()) {
      return;
    }
    this.allLearnersDisplayController.init();
    this.allLearnersDisplayController.SetGiveNowClickListener((marker: google.maps.Marker) => {
      this.TabSelector.toggleWithName('tab-campaigns');
    });
    this.yourLearnersDisplayController.init();
    this.yourLearnersDisplayController.SetGiveNowClickListener((marker: google.maps.Marker) => {
      this.TabSelector.toggleWithName('tab-campaigns');
    });
    this.yourLearnersDisplayController.SetOnGiveAgainButtonClickListener(() => {
      this.TabSelector.toggleWithName('tab-campaigns');
    });

    this.signInModal.init();
    this.signInModal.SetOnAuthenticatedSubmitClickListener((email: string) => {
      this.authController.refreshToken();
    });
    this.signInModal.SetOnGoToDonateButtonClickListener(() => {
      this.TabSelector.toggleWithName('tab-campaigns');
    });
    this.donateModal.init();
    this.mailchimpModal.init();

    this.hamburgerMenu.init();

    this.navbar.init();
    this.navbar.setMailChimpButtonClickListener(() => {
      if (this.mailchimpModal) {
        this.mailchimpModal.open();
      }
    });

    this.TabSelector.addEventListener('preTabToggle', (btnId: string, tabId: string) => {
      this.hamburgerMenu.close();
      this.signInModal.close();
      this.donateModal.close();
      this.mailchimpModal.close();
      if (btnId.includes('sign-in')) {
        this.TabSelector.preventDefault();
        if (this.authController.isAuthenticated()) {
          this.authController.signOut();
        } else {
          if (!this.signInModal.isOpen()) {
            this.signInModal.open();
          }
        }
      }
      if (!this.authController.isAuthenticated() && btnId.includes('tab-yl')) {
        this.TabSelector.preventDefault();
        this.signInModal.open();
      }
    });

    this.authController.addEventListener('signIn', () => {
      if (this.authController.isAuthenticated()) {
        this.yourLearnersDisplayController.fetchData(
          `/yourLearners?email=${this.authController.getEmail()!}&token=${this.authController.getToken()!}`,
          (hasData) => {
            if (hasData) {
              this.TabSelector.toggleWithName('tab-your-learners');
              this.yourLearnersDisplayController.displayData();
            }
        });
      }
    });

    this.authController.addEventListener('signOut', () => {
      if (!this.TabSelector.GetCurrentTabId().includes('tab-all-learners')) {
        this.TabSelector.toggleWithName('tab-all-learners');
      }
    });

    this.authController.signIn();

    this.allLearnersDisplayController.fetchData(`/allLearners`, (hasData) => {
      if (hasData) {
        this.TabSelector.toggleWithName('tab-all-learners');
        this.allLearnersDisplayController.displayData();
      }
    });
  }
}

/**
 * Declare a global App | null type variable for the app page
 */
let app: App | null = null;
let googleMapsLoaded: boolean = false;

/* Initialize Maps Function That's Called From the Google Maps Library */
function initGoogleMaps(): void {
  /** If the App reference is assigned then initialize it
   * with Google Maps enabled too
   */
  if (app !== null) {
    app.init();
  }
  googleMapsLoaded = true;
}

/**
 * Assign initGoogleMaps function to the window object so that the Google Maps
 * package can access the function for using that as an initialization callback
 */
(window as any).initGoogleMaps = initGoogleMaps;

/* Window Initialization */
window.onload = () => {
  let app = new App();
  if (googleMapsLoaded) {
    app.init();
  }
}
