/**
 * Class that contains all the config settings for app.
 */
export class Config {
  /* General Classes */
  public readonly activeClass: string = 'is-active';
  public readonly darkClass: string = 'is-dark';

  /* For Tab Selector */
  public readonly tabButtonsId: string = 'tab-buttons';
  public readonly tabsParentId: string = 'tabs-parent';
  public readonly tabButtonTabClickMap: any = [
    {btnId: 'btn-tab-campaigns', tabId: 'tab-campaigns'},
    {btnId: 'btn-tab-yl', tabId: 'tab-your-learners'},
    {btnId: 'btn-tab-al', tabId: 'tab-all-learners'},
    {btnId: 'sign-in-out', tabId: 'tab-your-learners'},
  ];

  /* For Sign In Modal */
  public readonly signInModalId: string = 'donor-email-modal';
  public readonly inputDonorEmailId: string = 'donor-email';

  /* For Give Now Donation Modal */
  public readonly giveNowModalId: string = 'donate-modal';

  /* Maps Shared Variables */
  public readonly mapsAllCountriesValue: string = 'all-countries';
  public readonly mapsZoomFullView = 3;
  public readonly mapsZoomCountryView = 7;

  /* For Your Learners Tab */
  public readonly alMapParentId: string = 'map-display-all-learners';
  public readonly alCountElementId: string = 'all-learners-count';
  public readonly alDNTCountElementId: string = 'no-region-user-count';
  public readonly alResetMapButtonId: string = 'btn-reset-map';
  public readonly alPanoramaId: string = 'all-learners-panorama';
  
  /* For All Learners Tab */
  public readonly ylMapParentId: string = 'map-display-your-learners';
  public readonly ylDNTCountElementId: string = 'your-learners-no-region-user-count';
  public readonly ylResetMapButtonId: string = 'btn-reset-map-yl';
  public readonly ylPanoramaId: string = 'your-learners-panorama';

  /* For Auth */


  constructor() {

  }

}
