import { Helpers } from "./helpers";
import { } from "googlemaps";
import { Config } from "./config";

/**
 * Map display controller is a parent class for shared all & your learners
 * classes that control the tabs of the app with the same name
 */
export class MapDisplayController {
  protected config: Config;
  protected map: google.maps.Map | null = null;
  protected panorama: google.maps.StreetViewPanorama | null = null;
  protected infoWindow: google.maps.InfoWindow | null = null;

  protected loadedMarkers: google.maps.Marker[] | null = null;
  protected learnersData: any | null = null;

  protected streetViewControlFeature: boolean = false;
  protected mapTypeControlFeature: boolean = false;
  protected fullScreenControlFeature: boolean = false;
  protected allCountriesValue: string = "";
  protected zoomFullViewValue: number = 0;
  protected zoomCountryViewValue: number = 0;
  protected maxZoomValue: number = 0;
  protected hiddenClass: string = "";

  protected mapParentId: string = "";
  protected mapParentElement: HTMLElement | null = null;
  protected learnerCountId: string = "";
  protected learnerCountElement: HTMLElement | null = null;
  protected dntCountId: string = "";
  protected dntCountElement: HTMLElement | null = null;
  protected countrySelectId: string = "";
  protected countrySelectElement: HTMLSelectElement | null = null;
  protected resetMapButtonId: string = "";
  protected resetMapButton: HTMLButtonElement | null = null;
  protected panoramaId: string = "";
  protected panoramaElement: HTMLElement | null = null;
  protected panoramaParentId: string = "";
  protected panoramaParentElement: HTMLElement | null = null;
  protected panoramaCloseButtonId: string = "";
  protected panoramaCloseButton: HTMLButtonElement | null = null;

  protected isSuccessfullyInitialized: boolean = false;

  protected currentCountrySelection: string | undefined = '';

  protected onGiveNowButtonClickCallback: {(marker: google.maps.Marker): void} | null = null;

  constructor(config: Config) {
    this.config = config;
    this.streetViewControlFeature = this.config.mapsStreetViewControlFeature;
    this.mapTypeControlFeature = this.config.mapsMapTypeControlFeature;
    this.fullScreenControlFeature = this.config.mapsFullScreenControlFeature;
    this.allCountriesValue = this.config.mapsAllCountriesValue;
    this.zoomFullViewValue = this.config.mapsZoomFullView;
    this.zoomCountryViewValue = this.config.mapsZoomCountryView;
    this.maxZoomValue = this.config.mapsMaxZoomValue;
    this.hiddenClass = this.config.hiddenClass;
  }

  /**
   * Assign references to various UI controls, initialize Map, Panorama, and
   * InfoWindow.
   */
  public init(): void {
    this.mapParentElement = this.mapParentId === "" ? null : 
      Helpers.getElement(this.mapParentId) as HTMLElement;
    this.learnerCountElement = this.learnerCountId === "" ? null :
      Helpers.getElement(this.learnerCountId) as HTMLElement;
    this.dntCountElement = this.dntCountId === "" ? null :
      Helpers.getElement(this.dntCountId) as HTMLElement;
    this.countrySelectElement = this.countrySelectId === "" ? null :
      (Helpers.getElement(this.countrySelectId) as HTMLElement) as HTMLSelectElement;
    this.resetMapButton = this.resetMapButtonId === "" ? null :
      (Helpers.getElement(this.resetMapButtonId) as HTMLElement) as HTMLButtonElement;
    this.panoramaElement = this.panoramaId === "" ? null :
      Helpers.getElement(this.panoramaId) as HTMLElement;
    this.panoramaParentElement = this.panoramaParentId === "" ? null :
      Helpers.getElement(this.panoramaParentId) as HTMLElement;
    this.panoramaCloseButton = this.panoramaCloseButtonId === "" ? null :
      Helpers.getElement(this.panoramaCloseButtonId) as HTMLButtonElement;

    this.isSuccessfullyInitialized = this.mapParentElement !== null &&
      this.learnerCountElement !== null && this.dntCountElement !== null &&
      this.countrySelectElement !== null && this.resetMapButton !== null &&
      this.panoramaElement !== null;
    
    if (this.isSuccessfullyInitialized) {
      this.map = new google.maps.Map(this.mapParentElement as HTMLElement, {
        streetViewControl: this.streetViewControlFeature,
        mapTypeControl: this.mapTypeControlFeature,
        fullscreenControl: this.fullScreenControlFeature,
        maxZoom: this.maxZoomValue,
      });
      this.infoWindow = new google.maps.InfoWindow();
      this.countrySelectElement?.addEventListener('change', 
        (event: any) => { this.onCountryValueChange(event); });
      this.resetMapButton?.addEventListener('click', (event: any) => {
        this.countrySelectElement!.value = this.allCountriesValue;
        this.displayData();
      });
    }

    // console.log(this.panoramaCloseButton);
    if (this.panoramaCloseButton !== null) {
      this.panoramaCloseButton.addEventListener('click', () => {
        this.panoramaParentElement?.classList.add(this.hiddenClass);
      });
    }

    this.map?.addListener('click', (event) => {
      this.infoWindow?.close();
    });
  }

  /** 
   * Fetch learner data 
   */
  public fetchData(url: string, callback: (hasData: boolean) => void): void {
    Helpers.get(url, (data: any | null)=> {
      if (!data) {
        callback(false);
      } else {
        this.learnersData = data;
        callback(true);
      }
    });
  }

  /**
   * Display learner data
   */
  public displayData(): void {
      this.updateUI();
      this.plotData();
  }

  /**
   * Fill in the data values on the UI & prepare for data ploting
   */
  public updateUI(): void {
    this.initializeCountrySelect();
    this.updateCountrySelection();
    this.updateResetMapButtonState();
  }

  /**
   * Initialize the country select element with the initial all countries value
   * & all the other countries
   */
  protected initializeCountrySelect(): void {
    if (this.countrySelectElement && this.countrySelectElement.options.length === 0) {
      this.countrySelectElement.innerHTML = '';
      this.countrySelectElement.options[0] = new Option('All Countries', 
        this.allCountriesValue);
      // console.log(this.learnersData);
      for (let i: number = 0; i < this.learnersData.locationData.length; i++) {
        const country = this.learnersData.locationData[i].country;
        this.countrySelectElement.options.add(new Option(
          country + ' - ' + this.getTotalLearnerCount(
            this.learnersData.campaignData, country), 
            country)
        );
      }
    }
  }

  /**
   * Assign a give now click listener
   * @param callback Callback
   */
  public SetGiveNowClickListener(callback: {(marker: google.maps.Marker): void}): void {
    this.onGiveNowButtonClickCallback = callback;
  }

  /**
   * Update country selection
   */
  public updateCountrySelection(): void {
    this.currentCountrySelection = this.countrySelectElement?.options[
      this.countrySelectElement.selectedIndex].value;
  }

  /** 
   * Update the state of the map reset button based on the country value 
   */
  updateResetMapButtonState(): void {
    if (this.currentCountrySelection === this.allCountriesValue) {
      this.resetMapButton!.classList.add(this.config.hiddenClass);
    } else {
      this.resetMapButton!.classList.remove(this.config.hiddenClass);
    }
  }

  /**
   * Get total learner count for a country in campaign data 
   * @param campaignData Campaign data that we get from the server
   * @param country Chosen country out of campaigns to calculate the total count for
   */
  getTotalLearnerCount(campaignData: any, country: string): number {
    let learnerCount: number = 0;
    for (let i: number = 0; i < campaignData.length; i++) {
      for (let c: number = 0; c < campaignData[i].data.countries.length; c++) {
        if (campaignData[i].data.countries[c].country === country) {
          learnerCount += campaignData[i].data.countries[c].learnerCount;
        }
      }
    }
    return learnerCount;
  }

  /**
   * Get total leaner count from campaign data for a region
   * @param campaignData Campaign data that we get from the server
   * @param country Chosen country
   * @param region Chosen region from the country to calculate the total count for
   */
  getRegionLearnerCount(campaignData: any, country: string, region: string): number {
    let learnerCount = 0;
    for (let i = 0; i < campaignData.length; i++) {
      for (let c = 0; c < campaignData[i].data.countries.length; c++) {
        let countryData = campaignData[i].data.countries[c];
        if (countryData.country === country) {
          let r = countryData.regions.find((reg: any) => {
            return reg.region === region; });
          if (r && r.hasOwnProperty('learnerCount')) {
            learnerCount += r.learnerCount;
          }
        }
      }
    }
    return learnerCount;
  }

  /**
   * When the value of the country changes
   * - Updates UI
   * - Plots Data
   * @param event Event
   */
  onCountryValueChange(event: any): void {
    this.updateUI();
    this.plotData();
  }

  /**
   * Plot the learner location data on the map as markers based on the country
   * selection
   */
  plotData(): void {
    if (!this.learnersData.locationData) {
      this.resetMapView();
      return;
    }
    this.clearMap();
    this.infoWindow!.close();
    let locationData: any = this.learnersData.locationData;
    
    if (this.currentCountrySelection === this.allCountriesValue) {
      for (let key: number = 0; key < locationData!.length; key++) {
        if (locationData[key].country === 'no-country') {
          continue;
        }
        let learnerCount: number = this.getTotalLearnerCount(
          this.learnersData.campaignData, 
          locationData[key].country);
        this.addNewMarkerOnMap(locationData[key], null, learnerCount);
        this.resetMapView();
      }
    } else {
      let countryData = locationData.find((loc: any) => {
        return loc.country === this.currentCountrySelection; });
      let bounds: google.maps.LatLngBounds = new google.maps.LatLngBounds();

      let regions = countryData.regions!;
      
      for (let r: number = 0; r < regions.length; r++) {
        let region = regions[r]!;
        if (region.region! === 'no-region' && regions.length === 1) {
          this.resetMapView(countryData.pin);
          continue;
        }
        if (region.region! === 'no-region') continue;
        let learnerCount = this.getRegionLearnerCount(
          this.learnersData.campaignData, 
          this.currentCountrySelection!, region.region!);
        if (!this.canPlotRegion(region, learnerCount)) continue;
        let marker = this.addNewMarkerOnMap(countryData, region, learnerCount);
        this.fitMapToBounds(bounds, marker);
      }
    }
  }

  /**
   * Add a new marker to the bounds and fit the map to bounds
   * @param bounds Lat lng bounds
   * @param marker Marker
   */
  fitMapToBounds(bounds: google.maps.LatLngBounds, marker: google.maps.Marker): void {
    bounds.extend(marker.getPosition()!);
    this.map?.fitBounds(bounds);
    this.map?.panToBounds(bounds);
  }

  /**
   * Determine if the region can be included as a marker on the map
   * - If the region has street views and the learner count is higher than 0
   * - And if the region has no street views and the learner count is higher than 0
   * @param region Region object
   * @param learnerCount Learner count
   */
  canPlotRegion(region: any, learnerCount: number): boolean {
    return (learnerCount > 0 && region.hasOwnProperty('streetViews') && 
          region.streetViews.hasOwnProperty('headingValues') && 
          region.streetViews.headingValues.length !== 0 &&
          region.streetViews.hasOwnProperty('locations') &&
          region.streetViews?.locations?.length !== 0) || 
          (learnerCount > 0 && region.hasOwnProperty('streetViews') &&
          region.streetViews.locations.length === 0 &&
          region.pin !== undefined && region.pin.lat !== undefined &&
          region.pin.lng !== undefined);
  }

  /**
   * Add new marker on the map
   * @param countryData Country object
   * @param region Region
   * @param learnerCount Learner count
   */
  addNewMarkerOnMap(countryData: any, region: any | null, learnerCount: number): google.maps.Marker {
    let pin = new google.maps.LatLng(countryData.pin.lat, countryData.pin.lng);
    let hasStreetViews: boolean = region !== null && region.streetViews.locations.length !== 0;
    if (region !== null) {
      pin = !hasStreetViews ?
        new google.maps.LatLng(region.pin.lat, region.pin.lng) :
        new google.maps.LatLng(region?.streetViews?.locations[0]?._latitude, 
        region?.streetViews?.locations[0]?._longitude);
    }
    let iconOptions = this.getIconOptions(learnerCount);
    let newMarker = new google.maps.Marker({position: pin, 
      map: this.map!,
      icon: {url: iconOptions.Url, size: iconOptions.size,
      origin: new google.maps.Point(0, 0),
      anchor: iconOptions.anchor},
      label: { text: learnerCount.toString() }});

    newMarker.set('country', countryData.country);
    newMarker.set('lat', pin.lat());
    newMarker.set('lng', pin.lng());
    newMarker.set('hasStreetViews', hasStreetViews);
    newMarker.set('region', region === null ? '' : region.region);
    newMarker.set('facts', countryData.facts);
    newMarker.set('heading', hasStreetViews ?
      region.streetViews.headingValues[0] : '');
    
    let streetViews = [];

    if (hasStreetViews && region.streetViews.locations.length > 1 &&
      region.streetViews.locations.length ===
      region.streetViews.headingValues.length) {
      for (let l = 0; l < region.streetViews.locations.length; l++) {
        let loc = region.streetViews.locations[l];
        streetViews.push({
          lat: loc._latitude,
          lng: loc._longitude,
          h: region.streetViews.headingValues[l]});
      }
    }

    newMarker.set('streetViews', streetViews);

    newMarker.addListener('click', () => {
      this.openInfoWindow(newMarker);
    });
    this.loadedMarkers?.push(newMarker);
    return newMarker;
  }

  /**
   * Get icon options based on learner count
   * @param learnerCount Learner count
   */
  getIconOptions(learnerCount: number) {
    return Helpers.getIconOptionsGeneral(learnerCount);
  }

  /** 
   * Clears the markers on the map
   */
  clearMap(): void {
    if (this.loadedMarkers && this.loadedMarkers.length > 0) {
      for (let i: number = 0; i < this.loadedMarkers.length; i++) {
        this.loadedMarkers[i]!.setMap(null);
      }
    }
    this.loadedMarkers = [];
  }

  /**
   * Reset map view on a pin or on the country level center
   * @param pin Pin
   */
  resetMapView(pin: any | undefined = undefined): void {
    const center: google.maps.LatLng = pin === undefined ? 
      new google.maps.LatLng(26.3351, 17.228331) :
      new google.maps.LatLng(pin.lat, pin.lng);
    this.map?.setCenter(center);
    this.map?.setZoom(pin === undefined ? 
      this.zoomFullViewValue : this.zoomCountryViewValue);
  }

  /**
   * Check to see if the class is initialized
   */
  public isInitializedAndHasData(): boolean {
    return this.isSuccessfullyInitialized && this.learnersData;
  }

  /**
   * Initialize and show the info window
   * @param marker Marker
   */
  public openInfoWindow(marker: google.maps.Marker) {
    this.infoWindow?.setContent(this.compileInfoWindowContent(marker));
    this.infoWindow?.open(this.map!);
    this.infoWindow?.setPosition({lat: marker.get('lat'), lng: marker.get('lng')});
    let closeButtons: HTMLCollection = Helpers.getElement('.gm-ui-hover-effect') as HTMLCollection;
    if (closeButtons.length > 0) {
      let imgElement = closeButtons[0].children[0] as HTMLElement;
      imgElement.style.width = '20px';
      imgElement.style.height = '20px';
      imgElement.style.margin = '10px 10px 0px 0px';
    }
  }

  /**
   * Compile the info window content
   * @param marker Marker
   */
  public compileInfoWindowContent(marker: google.maps.Marker): HTMLElement {
    let hasStreetViews = marker.get('hasStreetViews') as boolean;
    let region = marker.get('region') as string;
    // console.log(hasStreetViews, region);
    let parentDiv = document.createElement('div') as HTMLDivElement;
    parentDiv.style.textAlign = 'left';

    let title = this.compileInfoWindowTitle(marker);
    parentDiv.appendChild(title);

    parentDiv.appendChild(document.createElement('br') as HTMLBRElement);

    let body = this.compileInfoWindowBody(marker);

    
    parentDiv.appendChild(body);
    
    if (region === '' || (region !== '' && hasStreetViews)) {
      let buttonsDiv = document.createElement('div') as HTMLDivElement;
      buttonsDiv.style.textAlign = 'center';
      let takeMeThereBtn = document.createElement('button') as HTMLButtonElement;
      takeMeThereBtn.classList.add('button', 'is-link', 'is-outlined');
      takeMeThereBtn.innerHTML = '<i class="fas fa-street-view"></i>&nbsp;&nbsp;Take Me There';
      takeMeThereBtn.addEventListener('click', () => {
        this.onTakeMeThereButtonClick(marker);
      });
      takeMeThereBtn.style.marginRight = '10px';

      let giveNowButton = document.createElement('button') as HTMLButtonElement;
      giveNowButton.classList.add('button', 'is-primary');
      giveNowButton.innerText = 'Give Now';
      giveNowButton.addEventListener('click', () => {
        this.onGiveNowButtonClick(marker);
      });

      buttonsDiv.appendChild(takeMeThereBtn);
      buttonsDiv.appendChild(giveNowButton);
      parentDiv.appendChild(buttonsDiv);
    }

    return parentDiv;
  }

  /**
   * Compile the info window title based on what the marker has assigned to it
   * @param marker Marker
   */
  compileInfoWindowTitle(marker: google.maps.Marker): HTMLElement {
    let hasStreetViews = marker.get('hasStreetViews') as boolean;
    let region = marker.get('region') as string;

    let title = document.createElement('div') as HTMLSpanElement;

    let mainSpan = document.createElement('span') as HTMLSpanElement;
    mainSpan.innerText = region !== '' ? marker.get('region') : marker.get('country');
    mainSpan.style.fontSize = '18px';
    mainSpan.style.color = '#606060';
    mainSpan.style.fontWeight = 'bold';

    title.appendChild(mainSpan);

    if (region !== '') {
      let countrySpan = document.createElement('span') as HTMLSpanElement;
      countrySpan.innerText = ` (${marker.get('country')})`;
      countrySpan.style.fontSize = '16px';
      countrySpan.style.color = '#909090';
      countrySpan.style.fontWeight = 'bold';
      title.appendChild(countrySpan);
    }
    
    return title;
  }

  /**
   * Compile the info window body based on what the marker has assigned to it
   * @param marker Marker
   */
  compileInfoWindowBody(marker: google.maps.Marker): HTMLElement {
    let hasStreetViews = marker.get('hasStreetViews') as boolean;
    let region = marker.get('region') as string;

    let bodyDiv = document.createElement('div') as HTMLDivElement;
    bodyDiv.style.textAlign = 'center';

    let infoP = document.createElement('p') as HTMLParagraphElement;
    if (region !== '' && hasStreetViews) {
      infoP.innerText = 'Take a virtual visit to the region or community reached by your donation.';
    } else if (region !== '' && !hasStreetViews) {
      infoP.innerText = 'Street views are coming soon!';
    } else if (region === '') {
      infoP.innerText = 'Go to the region level to see where children are using apps to learn.';
    }
    infoP.style.maxWidth = '300px';
    infoP.style.color = '#505050';
    infoP.style.fontSize = '14px';
    infoP.style.textAlign = 'left';

    bodyDiv.appendChild(infoP);
    bodyDiv.appendChild(document.createElement('br') as HTMLBRElement);
    return bodyDiv;
  }

  /**
   * On take me there button click
   * @param marker Marker
   */
  onTakeMeThereButtonClick(marker: google.maps.Marker): void {
    let hasStreetViews = marker.get('hasStreetViews') as boolean;
    let region = marker.get('region') as string;
    let streetViews = marker.get('streetViews');

    if (region !== '' && hasStreetViews && streetViews) {
      let stretView = streetViews[Math.floor(Math.random() * streetViews.length)];
      this.panorama = new google.maps.StreetViewPanorama(
        this.panoramaElement!, {
          position: { lat: stretView['lat'], lng: stretView['lng'] },
          pov: { heading: stretView['h'], pitch: 10},
          fullscreenControl: false,
        }
      )
      this.panorama.setVisible(true);
      this.panoramaParentElement?.classList.remove(this.hiddenClass);
    } else {
      this.countrySelectElement!.value = marker.get('country');
      this.displayData();
    }
  }

  /**
   * On give now button click
   * @param marker Marker
   */
  onGiveNowButtonClick(marker: google.maps.Marker): void {
    this.onGiveNowButtonClickCallback!(marker);
    this.infoWindow?.close();
  }
}
  