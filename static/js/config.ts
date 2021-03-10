/**
 * Class that contains all the config settings for app.
 */
export class Config {

  /* General */
  public readonly activeClass: string = 'is-active';
  public readonly hiddenClass: string = 'is-hidden';
  public readonly darkClass: string = 'is-dark';
  public readonly colorTransparent: string = 'rgba(0, 0, 0, 0)';
  public readonly millisecondsInADay: number = 86400000;

  /* Navbar */
  public readonly navbarId: string = '#navbar';
  public readonly mailchimpButtonId: string = '#mailchimp-button';
  public readonly mailchimpHamburgerButtonId: string = '#mailchimp-hamburger-button';
  public readonly underTitleSocialIconsId: string = '#under-title-social-icons';
  public readonly hamburgerMenuSocialIconsId: string = '#hamburger-social-icons';
  public readonly navbarScrollTopValue: number = 20;
  public readonly navbarMaxHeightLowValue: string = '14vh';
  public readonly navbarBoxShadowLowValue: string = '2px 2px 8px #808080';
  public readonly navbarMaxHeightHighValue : string = '17vh';
  public readonly navbarBoxShadowHighValue: string = '0px 0px 0px #808080';

  /* Hamburger Menu */
  public readonly hamburgerMenuClass: string = '.navbar-burger';

  /* For Tab Selector */
  public readonly tabButtonsId: string = '#tab-buttons';
  public readonly tabsParentId: string = '#tabs-parent';
  public readonly tabButtonTabClickMap: any = [
    {btnId: '#btn-tab-campaigns', tabId: '#tab-campaigns'},
    {btnId: '#btn-tab-yl', tabId: '#tab-your-learners'},
    {btnId: '#btn-tab-al', tabId: '#tab-all-learners'},
    {btnId: '#sign-in-out', tabId: '#tab-your-learners'},
  ];

  /* For Give Now Donation Modal */
  public readonly giveNowModalId: string = '#donate-modal';

  /* Maps Shared Variables */
  public readonly mapsStreetViewControlFeature: boolean = false;
  public readonly mapsMapTypeControlFeature: boolean = false;
  public readonly mapsFullScreenControlFeature: boolean = false;
  public readonly mapsAllCountriesValue: string = 'all-countries';
  public readonly mapsZoomFullView = 3;
  public readonly mapsZoomCountryView = 7;
  public readonly mapsMaxZoomValue = 10;

  /* For Your Learners Tab */
  public readonly ylMapParentId: string = '#map-display-your-learners';
  public readonly ylCountElementId: string = '#learner-count';
  public readonly ylDNTCountElementId: string = '#your-learners-no-region-user-count';
  public readonly ylCountrySelectId: string = '#yourLearnersCountrySelect';
  public readonly ylResetMapButtonId: string = '#btn-reset-map-yl';
  public readonly ylPanoramaId: string = '#your-learners-panorama';
  public readonly ylPanoramaParentId: string = '#your-learners-overlay-pano';
  public readonly ylPanoramaCloseButtonId: string = '#your-learners-pano-close';
  public readonly ylPercentFilledTextId: string = '#percent-filled';
  public readonly ylGiveAgainButtonId: string = '#give-again-button';
  public readonly ylCongratsTextId: string = '#congrats';
  public readonly ylPercentNotFilledValue: string = 'Check back in a few days to see more learners!';
  public readonly ylPercentFilledValue: string = '';
  public readonly ylPercentFilledCongratsValue: string = 'Congrats 🎉! ';
  public readonly ylPercentNotFilledCongratsValue: string = '';
  public readonly ylDonationAmountTextId: string = '#donation-amount';
  public readonly ylDonationDateTextId: string = '#donation-date';
  public readonly ylInCountryId: string = '#your-learners-in-country';

  /* For All Learners Tab */
  public readonly alMapParentId: string = '#map-display-all-learners';
  public readonly alCountElementId: string = '#all-learners-count';
  public readonly alCountrySelectId: string = '#all-learners-country-select';
  public readonly alDNTCountElementId: string = '#no-region-user-count';
  public readonly alResetMapButtonId: string = '#btn-reset-map';
  public readonly alPanoramaId: string = '#all-learners-panorama';
  public readonly alPanoramaParentId: string = '#all-learners-overlay-pano';
  public readonly alPanoramaCloseButtonId: string = '#all-learners-pano-close';
  public readonly alInCountryTextId: string = '#all-learners-in-country';
  public readonly alDNTCountParentId: string = '#no-region-user-count-parent';
  public readonly alLocalStorageDataKey: string = 'ftl-all-learners';
  public readonly alLocalStorageFetchDateKey: string = 'ftl-all-learners-fetch-date';
  public readonly alFetchIntervalInDays: number = 1;

  /* Auth */
  public readonly tokenTimeout: number = 3600001;
  public readonly signInTextButtonTextId: string = '#sign-in-text';
  public readonly signInButtonIconId: string = "#auth-button-icon";
  public readonly signInButtonSignedInTextValue: string = "Sign Out";
  public readonly signInButtonSignedOutTextValue: string = "Sign In";
  public readonly signInButtonIconSignedInClass: string = "fa-sign-out-alt";
  public readonly signInButtonIconSignedOutClass: string = "fa-sign-in-alt";
  public readonly authMethodGoogleValue: string = "google.com";
  public readonly authMethodFacebookValue: string = "facebook.com";
  public readonly authErrorAccountExists: string = "auth/account-exists-with-different-credential";
  public readonly authErrorPopupBlocked: string = "auth/popup-blocked";
  public readonly authInfoAuthConfirmText: string = "You have already authorized using a Facebook account. Click yes if you\'d like to sign in with Google and link credentials and click cancel if you wish to sign in with a Facebook account.";
  public readonly authInfoPopupBlockedText: string = "Please disable popup blocking and retry to authenticate.";
  public readonly authGoogleAccountLinkedText: string = "Your Google account has been successfully linked.";
  public readonly authFacebookAccountLinkedText: string = "Your Facebook account has been successfully linked.";

  /* Sign In Modal */
  public readonly signInModalId: string = '#donor-email-modal';
  public readonly signInModalCloseButtonId: string = '#sign-in-modal-close-btn';
  public readonly signInModalOverlayId: string = '#sign-in-modal-overlay';
  public readonly signInModalInstructionTextId: string = '#modal-instruction-text';
  public readonly signInModalDonorInfoTextId: string = '#new-donor-info-text';
  public readonly signInModalGoogleButtonId: string = '#sign-in-button-google';
  public readonly signInModalFacebookButtonId: string = '#sign-in-button-fb';
  public readonly signInModalDonorEmailInputId: string = '#donor-email';
  public readonly signInModalSubmitButtonId: string = '#donor-email-submit';
  public readonly signInModalGoToDonateButtonId: string = '#go-to-donate-button';
  public readonly singInModalFormId: string = '#sign-in-form';

  /* Mailchimp Modal */
  public readonly mailchimpModalId: string = '#mailchimp-modal';
  public readonly mailchimpModalCloseButtonId: string = '#mailchimp-modal-close-button';
  public readonly mailchimpModalOverlayId: string = '#mailchimp-modal-overlay';

  /* Donate Modal */
  public readonly donateModalId: string = '#donate-modal';
  public readonly donateModalCloseButtonId: string = '#donate-modal-close-button';
  public readonly donateModalOverlayId: string = '#donate-modal-overlay';

    constructor() {

  }

}
