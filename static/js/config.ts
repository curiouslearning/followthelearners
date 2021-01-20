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

  /* Navbar Scroll */
  public readonly navbarId: string = '#navbar';

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

  /* For Auth */
  public readonly tokenTimeout: number = 3600001;
  public readonly signInTextButtonTextId: string = '#sign-in-text';
  public readonly signInButtonIconId: string = "#auth-button-icon";
  public readonly signInButtonSignedInTextValue: string = "Sign Out";
  public readonly signInButtonSignedOutTextValue: string = "Sign In";
  public readonly signInButtonIconSignedInClass: string = "fa-sign-out-alt";
  public readonly signInButtonIconSignedOutClass: string = "fa-sign-in-alt";
  
  /* Sign In Modal */
  public readonly signInModalId: string = '#donor-email-modal';
  public readonly signInModalCloseButtonId: string = '#sign-in-modal-close-btn';
  public readonly signInModalOverlayId: string = '#sign-in-modal-overlay';
  public readonly signInModalInstructionTextId: string = '#modal-instruction-text';
  public readonly signInModalDonorInfoTextId: string = '#new-donor-info-text';
  public readonly signInModalDonorEmailInputId: string = '#donor-email';
  public readonly signInModalSubmitButtonId: string = '#donor-email-submit';
  public readonly signInModalGoToDonateButtonId: string = '#go-to-donate-button';
  public readonly singInModalFormId: string = '#sign-in-form';

  /* Donate Modal */
  public readonly donateModalId: string = '#donate-modal';
  public readonly donateModalCloseButtonId: string = '#donate-modal-close-button';
  public readonly donateModalOverlayId: string = '#donate-modal-overlay';

  /* Hamburger Menu */
  public readonly hamburgerMenuClass: string = '.navbar-burger';

  constructor() {
    
  }

}
