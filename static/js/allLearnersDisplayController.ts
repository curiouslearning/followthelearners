import { } from "googlemaps";
import { Config } from "./config";
import { Helpers } from "./helpers";
import { MapDisplayController } from "./mapDisplayController";

export class AllLearnersDisplayController extends MapDisplayController {

  private dataLocalStorageKey: string = '';
  private dataLocalStorageFetchDateKey: string = '';
  private millisecondsInADay: number = 0;
  private fetchIntervalInDays: number = 0;

  private dntCountParentId: string = '';
  private dntCountParent: HTMLElement | null = null;
  private inCountryTextId: string = '';
  private inCountryText: HTMLElement | null = null;

  constructor(config: Config) {
    super(config);
    this.dataLocalStorageKey = this.config.alLocalStorageDataKey;
    this.dataLocalStorageFetchDateKey = this.config.alLocalStorageFetchDateKey;
    this.millisecondsInADay = this.config.millisecondsInADay;
    this.fetchIntervalInDays = this.config.alFetchIntervalInDays;
  }

  public init(): void {
    this.mapParentId = this.config.alMapParentId;
    this.learnerCountId = this.config.alCountElementId;
    this.dntCountId = this.config.alDNTCountElementId;
    this.dntCountParentId = this.config.alDNTCountParentId;
    this.countrySelectId = this.config.alCountrySelectId;
    this.resetMapButtonId = this.config.alResetMapButtonId;
    this.panoramaId = this.config.alPanoramaId;
    this.panoramaParentId = this.config.alPanoramaParentId;
    this.panoramaCloseButtonId = this.config.alPanoramaCloseButtonId;
    this.inCountryTextId = this.config.alInCountryTextId;

    this.dntCountParent = this.dntCountParentId === '' ? null :
      Helpers.getElement(this.dntCountParentId) as HTMLElement;
    this.inCountryText = this.inCountryTextId === '' ? null :
      Helpers.getElement(this.inCountryTextId) as HTMLElement;

    super.init();
  }

  public fetchData(url: string, callback: (hasData: boolean) => void): void {
    const ftlData = window.localStorage.getItem(
      this.dataLocalStorageKey);
    const ftlDataFetchDate = window.localStorage.getItem(
      this.dataLocalStorageFetchDateKey);
    const fetchDate = new Date(ftlDataFetchDate ? ftlDataFetchDate : '');
    const diff = Math.round(Math.abs((
      new Date().getTime() - fetchDate.getTime()) / (this.millisecondsInADay)));
    if (ftlData && ftlDataFetchDate && diff < this.fetchIntervalInDays) {
      this.learnersData = JSON.parse(ftlData);
      callback(true);
      return;
    }

    Helpers.get(url, (data: any | null)=> {
      if (!data) {
        callback(false);
      } else {
        this.learnersData = data.data;
        window.localStorage.setItem(this.dataLocalStorageKey, JSON.stringify(this.learnersData));
        window.localStorage.setItem(this.dataLocalStorageFetchDateKey, JSON.stringify(new Date().toString()));
        callback(true);
      }
    });

  }

  public updateUI(): void {
    super.updateUI();
    if (this.currentCountrySelection !== this.allCountriesValue) {
      this.inCountryText!.innerHTML = `in ${this.currentCountrySelection}`;
      this.dntCountParent?.classList.remove(this.hiddenClass);
      Helpers.createCountUpTextInElement(this.dntCountElement!,
      this.learnersData.masterCounts.allLearnersWithDoNotTrack);
    } else {
      this.inCountryText!.innerHTML = 'Worldwide';
      this.dntCountParent?.classList.add(this.hiddenClass);
    }

    Helpers.createCountUpTextInElement(this.learnerCountElement!,
      this.learnersData.masterCounts.allLearnersCount);
  }

  protected initializeCountrySelect(): void {
    if (this.countrySelectElement && this.countrySelectElement.options.length === 0) {
      this.countrySelectElement.innerHTML = '';
      this.countrySelectElement.options[0] = new Option('All Countries', 
        this.allCountriesValue);
      // console.log(this.learnersData);
      for (const key in this.learnersData.campaignData) {
        const country = this.learnersData.campaignData[key].country;
        if (country !== 'no-country') {
          this.countrySelectElement.options.add(new Option(
            country + ' - ' + 
            this.learnersData.campaignData[key].learnerCount, 
            country)
          );
        }
      }
    }
  }

  public plotData(): void {
    if (!this.learnersData.locationData) {
      this.resetMapView();
      return;
    }
    this.clearMap();
    this.infoWindow!.close();
    const locationData = this.learnersData.locationData;

    if (this.currentCountrySelection === this.allCountriesValue) {
      for (let key = 0; key < locationData.length; key++) {
        const learnerCount = this.learnersData.campaignData[key.toString()].learnerCount;
        this.addNewMarkerOnMap(locationData[key], null, learnerCount);
        this.resetMapView();
      }
    } else {
      const country = locationData.find((c: any) => {
          return c.country === this.currentCountrySelection;
        });

      const campaignData = this.learnersData.campaignData.find((loc: any) => 
        { return loc.country === this.currentCountrySelection});

      let bounds = new google.maps.LatLngBounds();

      let regionsPlotted = 0;
      if (country.regions && country.regions.length !== 0) {
        for (let i = 0; i < country.regions.length; i++) {
          let region = country.regions[i];
          if (region.region === 'no-region' ) {
            if (country.regions.length === 1)
              this.resetMapView(country.pin);
            continue;
          }

          
          let campaignRegion = campaignData.regions.find((reg: any) => {
            return reg.region === region.region;
          })

          if (!campaignRegion) continue;

          let learnerCount = campaignRegion.learnerCount;

          // console.log(region, this.canPlotRegion(region, learnerCount));

          if (!this.canPlotRegion(region, learnerCount)) continue;

          regionsPlotted++;
          let marker = this.addNewMarkerOnMap(country, region, learnerCount);
          this.fitMapToBounds(bounds, marker);
        }
      }

      if (regionsPlotted === 0) {
        this.resetMapView(country.pin);
      }
    }
  }

  public getIconOptions(learnerCount: number) {
    return this.currentCountrySelection === this.allCountriesValue ?
      Helpers.getIconOptionsGrey(learnerCount) : Helpers.getIconOptionsGeneral(learnerCount);
  }

}
