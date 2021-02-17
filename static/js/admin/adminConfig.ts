import { Config } from '../config';
export class AdminConfig extends Config {
  public readonly tabButtonTabClickMap: any = [
    {btnId: '#business-metrics-btn' ,tabId: '#business-metrics' },
    {btnId: '#dashboard-metrics-btn' ,tabId: '#dashboard-metrics' },
    {btnId: '#status-btn' ,tabId: '#status' },
    {btnId: '#street-views-btn' ,tabId: '#street-views' },
    {btnId: '#campaigns-btn' ,tabId: '#campaigns' },
    {btnId: '#users-btn' ,tabId: '#users' },
  ];
  public readonly tabButtonsId: string = '#tab-buttons';
  public readonly tabsParentId: string = '#tabs-parent';
  public readonly loadCountriesId = '#load-countries';
  public readonly loadRegionsId = '#load-regions';
  public readonly generateStreetViewsId = '#gen-street-views';
  public readonly toggleMapId = '#toggle-map';
  public readonly saveAllId = '#save-street-views';
  public readonly dropdownParent = '#dropdown-parent';
  public readonly panoramaId = '#pano';
  public readonly countrySelectId = '#countrySelect';
  public readonly mapViewParentId = '#map-view-parent';
  public readonly deepDiveModalId = '#deep-dive-modal';
  public readonly deepDiveTitleId = '#deep-dive-header-text';
  public readonly currentActiveDeepDive = '#cloud-console';
  public activeButtonId: string = '#business-metrics-btn';
  public readonly stoplightRows: Array<string> = [
    'cloud',
    'server',
    'firestore',
    'stripe',
    'cronjob',
    'postman',
  ];
  public readonly businessIframes: string[] = [
    'biz-ingestion-iframe',
    'biz-donor-iframe',
    'biz-donation-iframe',
  ];
  public readonly dashIframes: string[] = [
    'dash-ingestion-iframe',
    'dash-donation-iframe',
    'dash-assignment-iframe',
  ];

  /* Postman Config */
  public readonly monitorIds: Array<{name: string, id: string}> = [
    {name: 'frontEnd', id: '13484422-1eb70623-dd83-4ea0-8b1b-6eec4e787249'},
  ];
  public readonly gcloudResourceNames = [
    'projects/follow-the-learners',
  ];

  public readonly gcloudEntriesURL =
  'https://logging.googleapis.com/v2/entries:list';


  constructor() {
    super();
  }
}
