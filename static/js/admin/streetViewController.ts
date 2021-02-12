
import { Helpers } from '../helpers';
import { } from 'googlemaps';
import { Config } from '../config';
import { toast as makeToast, ToastType } from 'bulma-toast';

interface RawRegionData {
  region: string,
  lat: number,
  lng: number
}

interface RegionData {
  region: string,
  streetViews: StreetViewCollection | null,
  pin: {lat: number, lng: number} | null
}

interface StreetViewCollection {
  region: string,
  locations: Array<{_latitude: number, _longitude: number}>
}

interface RandomStreetViewData {
  [index: string]: Array<RawRegionData>
}

interface StreetView {
  lat: number | null,
  lng: number | null,
  h: number
}

interface StreetViewList {
  [index: string]: Array<StreetView> | any,
  length: number
  push: (elem: Array<StreetView>) => void,
  hasOwnProperty: (prop: string) => boolean,
}

export class StreetViewController {
  private readonly panoramaId: string;
  private readonly mapViewParentId: string;
  private panoramaRef: google.maps.StreetViewPanorama | null;
  private loadedRegionData: Array<RegionData> | undefined;
  private loadedRandomGeoPoints: RandomStreetViewData | undefined;
  private generatedStreetViews: StreetViewList | undefined;
  private streetViewService: google.maps.StreetViewService | null;
  private pinMap: google.maps.Map<Element> |
   undefined;
  private loadedPins: Array<google.maps.Marker>;
  /*Button References*/
  private readonly countrySelectId: string;
  private loadCountriesButton: HTMLButtonElement;
  private loadCountriesId: string;
  private loadRegionsButton: HTMLButtonElement;
  private loadRegionsId: string;
  private generateStreetViewsButton: HTMLButtonElement;
  private generateStreetViewsId: string;
  private toggleMapButton: HTMLButtonElement;
  private toggleMapId: string;
  private saveAllButton: HTMLButtonElement;
  private saveAllId: string;

  constructor(config: Config) {
    this.panoramaId = config.panoramaId;
    this.countrySelectId = config.countrySelectId;
    this.mapViewParentId = config.mapViewParentId;
    this.panoramaRef = null;
    this.loadedRegionData = undefined;
    this.loadedRandomGeoPoints = undefined;
    this.generatedStreetViews = undefined;
    this.streetViewService = null;
    this.pinMap = undefined;
    this.loadedPins = [];
    this.loadCountriesId = config.loadCountriesId;
    this.loadRegionsId = config.loadRegionsId;
    this.generateStreetViewsId = config.generateStreetViewsId;
    this.toggleMapId = config.toggleMapId;
    this.saveAllId = config.saveAllId;
    //get references to UI buttons
    this.loadCountriesButton =
      Helpers.getElement(this.loadCountriesId) as HTMLButtonElement;
    this.loadRegionsButton =
      Helpers.getElement(this.loadRegionsId) as HTMLButtonElement;
    this.generateStreetViewsButton =
      Helpers.getElement(this.generateStreetViewsId) as HTMLButtonElement;
    this.toggleMapButton =
      Helpers.getElement(this.toggleMapId) as HTMLButtonElement;
    this.saveAllButton =
      Helpers.getElement(this.saveAllId) as HTMLButtonElement;

  }

  /**
   * Entry point after the google maps has finished loading on the page
   */
  public init() {
    this.streetViewService = new google.maps.StreetViewService();
    this.panoramaRef = new google.maps.StreetViewPanorama(
        <HTMLElement>Helpers.getElement(this.panoramaId));
    const mapDiv = <HTMLElement>Helpers.getElement('#map-pins');
    this.pinMap = new google.maps.Map(mapDiv, {
        streetViewControl: false,
        mapTypeControl: false,
        maxZoom: 14,
      });
    //add onclick events
    this.loadCountriesButton.addEventListener('click', () => {
      this.loadCountries((data: unknown): void => {
        if(data) {
          this.showToast('is-success', 'Countries Loaded!');
        } else {
          this.showToast('is-danger',
              'Error loading countries, please refresh the page.');
        }
      });
    });
    this.loadRegionsButton.addEventListener('click', () => {
      this.loadCountryRegions((res: {error: string | null}): void => {
        if (res.error) {
          this.showToast('is-danger', res.error);
        } else {
          this.showToast('is-success', 'Regions Loaded!');
        }
      });
    });
    this.generateStreetViewsButton.addEventListener('click', () => {
      this.generateStreetViews((res: {error: string | null}): void => {
        if (res.error) {
          this.showToast('is-danger', res.error);
        } else {
          this.showToast('is-success', 'Street view generation complete.')
        }
      });
    });
    this.toggleMapButton.addEventListener('click', () => {
      this.toggleMap();
    });
    this.saveAllButton.addEventListener('click', () => {
      this.saveAllStreetViews(function (this: StreetViewController,
        res: {
          message: string | null,
          error: string | null,
        }) {
          if (res.message === null) {
            this.showToast('is-danger', res.error!);
          }
          if (res.message === 'success') {
            this.showToast('is-success', 'Street views saved!');
          } else if (res.message === 'failure') {
            this.showToast('is-danger', 'Failed to save street views!');
          }
        });
    });
  }

private showToast(type: ToastType, message: string): void {
  makeToast({
    message: '<h1>' + message + '</h1>',
    type: type,
    dismissible: true,
    closeOnClick: true,
    animate: {in: 'fadeIn', out: 'fadeOut'},
  });
}

/**
 * Requests the server to generate random locations, then sends requests to the
 * Street Views service to get random street view panoramas close to those
 * locations and then displays a list of generated street views.
 */
 public generateStreetViews(callback: (res: {error: string |null})=>void) {
    const countrySelectElement = <HTMLSelectElement> Helpers.getElement(
      this.countrySelectId
    );
    if (countrySelectElement.options.length < 2) {
      callback({error: 'Error, no countries loaded.'});
      return;
    }
    while(this.loadedPins.length > 0) {
      this.loadedPins[0].setMap(null);
      this.loadedPins.splice(0,1);
    }
    this.loadedPins = [];
    const countrySelection = countrySelectElement.
        options[countrySelectElement.selectedIndex].value;
    if (countrySelection !== 'all-countries' && this.loadedRegionData === null ||
        countrySelection === 'all-countries') {
      callback({error: 'Please load the region data for selected country.'})
      return;
    }
    const radiusElem = <HTMLInputElement> Helpers.getElement('#inputRadius');
    const radiusValue: unknown =  radiusElem.value;
    const countElem = <HTMLInputElement> Helpers.getElement('#inputCount');
    const countValue: unknown =  countElem.value;
    if (radiusValue === NaN || countValue === NaN || countValue === '') {
      callback({error: 'Please fill in radius and count values.'});
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (let i = 0; i < this.loadedRegionData!.length; i++) {
      const pinData = {
        position: new google.maps.LatLng(
            this.loadedRegionData![i].pin!.lat,
            this.loadedRegionData![i].pin!.lng), map: this.pinMap,
        icon: {url: '/static/imgs/2.png', size: new google.maps.Size(56, 55)},
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(28, 28),
        label: {text: (i + 1).toString()},
      }
      const regionPin: google.maps.Marker = new google.maps.Marker(pinData);

      this.loadedPins.push(regionPin);
      bounds.extend(<google.maps.LatLng>regionPin.getPosition());
    }

    Helpers.get('/generateRandomGeoPoints', {
      country: countrySelection,
      radius: radiusValue,
      svCount: countValue,
    }, (data: {streetViewGenData: RandomStreetViewData})=>{
        //captures callback from above
        this.loadStreetViewData(data, status, bounds, callback);
      });
  }

  private loadStreetViewData(data: {streetViewGenData: RandomStreetViewData},
    status: unknown,
    bounds: google.maps.LatLngBounds,
    callback: (res:{error: string | null}) => void) {
      if (data) {
        this.loadedRandomGeoPoints = data.streetViewGenData;
        console.log(this.loadedRandomGeoPoints);
        this.generatedStreetViews = <StreetViewList>{};
        const regionsParent = Helpers.getElement('#regions') as HTMLElement;
        regionsParent!.innerText = '';
        for (let i = 0; i < this.loadedRegionData!.length; i++) {
          const region = this.loadedRegionData![i];
          regionsParent!.innerHTML += '<div id="streetView' + i + '">' +
            '<h1 class="title">' + (i + 1).toString() + ' ' + region.region +
            '&nbsp;<span style="font-size: 1rem">(Pin: <a href="https://maps.google.com/maps/search/' +
            region.pin!.lat + ',' + region.pin!.lng + '" target="_blank">[' +
            region.pin!.lat + ', ' + region.pin!.lng + ']' +
            '</a>)</h1>';
          regionsParent!.innerHTML += '<br></div>';
          this.generatedStreetViews[region.region] = <Array<StreetView>>[];
          let svIndex = 0;
          for (let l = 0; l < this.loadedRandomGeoPoints[region.region].length; l++) {
            const lat = parseFloat(this.loadedRandomGeoPoints[region.region][l]
                .lat.toFixed(6));
            const lng = parseFloat(this.loadedRandomGeoPoints[region.region][l]
                .lng.toFixed(6));
            const panoLoc = new google.maps.LatLng(lat, lng);
            this.streetViewService!.getPanoramaByLocation(panoLoc, 10000,
              function(this: StreetViewController, svData, status) {
                const svRegion = 'streetView ' + i;
                const svRegionParent = Helpers.getElement(svRegion) as HTMLElement;
                if (status == google.maps.StreetViewStatus.OK) {
                  // Pano in: svData.location.pano
                  this.generatedStreetViews![region.region].push({
                    lat: svData.location!.latLng!.lat(),
                    lng: svData.location!.latLng!.lng(),
                    h: parseFloat(svData.tiles!['centerHeading']!.toFixed(2)),
                  });
                  const markerOptions = {
                    position: svData.location!.latLng!,
                    map: this.pinMap,
                    icon: {
                      url: '/static/imgs/1.png',
                      size: new google.maps.Size(52, 52)
                    },
                    origin: new google.maps.Point(0, 0),
                    anchor: new google.maps.Point(26, 26),
                    label: {text: (svIndex + 1).toString()},
                  }
                  const newMarker = new google.maps.Marker(markerOptions);
                  this.loadedPins.push(newMarker);
                  bounds.extend(<google.maps.LatLng>newMarker.getPosition());

                  svRegionParent!.innerHTML +=
                    '<div class="columns" id=sv'+ region.region.split(' ').join('_') + svIndex +' style="font-size: 1rem"><h2 class="subtitle column is-two-fifths" style="margin-left: 1rem">Street View ' +
                    (svIndex + 1).toString() + '<span> <a href="https://maps.google.com/maps/search/' +
                    svData.location!.latLng!.lat() + ', ' + svData.location!.latLng!.lng() +
                    '" target="_blank">[ ' + svData.location!.latLng!.lat() +
                    ', ' + svData.location!.latLng!.lng() + ' ]</a></span></h2><span class="column"><button class="button"' +
                    'onclick="showGeneratedStreetView(\'' + region.region + '\', ' + svIndex + ')"> Open Street View </button></span>' +
                    '<span class="column"><button class="button" onclick="saveSingleStreetViewInDB(\'' +
                    region.region + '\', ' + svIndex + ')"> Save in DB </button></span>' +
                    '<span class="column"><button class="button is-danger" onclick="removeGeneratedStreetView(\'' +
                    region.region + '\', ' + svIndex + ')"> X </button><span></div>';
                  svIndex++;
                } else {
                  this.generatedStreetViews![region.region].push({
                    lat: null,
                    lng: null,
                    h: 180,
                  });
                  svIndex++;
                  console.log("Street View data not found." + svData);
                }
                if (this.loadedPins.length !== 0) {
                  this.pinMap!.fitBounds(bounds);
                  this.pinMap!.panToBounds(bounds);
                }
              });
            }
          }
          callback({error: null});
        }
    }

  public toggleMap() {
    const mapView: any = Helpers.getElement(this.mapViewParentId);
    mapView.toggle();
  }

  public saveAllStreetViews(callback: (res: {
    message: string | null,
    error: string | null}) => void) {
      if (!this.generatedStreetViews || this.generatedStreetViews.length === 0) {
        callback({message: null, error: 'No generated street views found!'});
        return;
      }

      const sv = [];
      const countrySelectElement =
        <HTMLSelectElement>Helpers.getElement(this.countrySelectId);
      const countrySelection = countrySelectElement!.
          options[countrySelectElement.selectedIndex].value;

      for (const region in this.generatedStreetViews) {
        if (this.generatedStreetViews.hasOwnProperty(region)) {
          sv.push({country: countrySelection,
            region: region, svData: this.generatedStreetViews[region]});
        }
      }

      Helpers.post('/saveStreetView', {sv: sv}, (data: any|null) => {
          callback({message: data.message, error: null});
        });
  }

  public loadCountries(callback: (res: {error: string | null}) => void) {
    const countrySelectElement =
      <HTMLSelectElement>Helpers.getElement(this.countrySelectId);
    if (countrySelectElement!.options.length > 2) {
      return;
    }
    Helpers.post('/getAllCountriesList', { }, (data: any) => {
        this.addCountriesToList(data, status, countrySelectElement, callback)
    });
  }
  private addCountriesToList(this: StreetViewController,
    data: any | null,
    status: any,
    countrySelectElement: HTMLSelectElement,
    callback: (res: {error: string | null}) => void) {
      if (data) {
        const countryNames = data.countryNames;
        while(countrySelectElement.options.length > 0) {
          countrySelectElement.remove(0);
        }
        countrySelectElement.add(new Option('All Countries', 'all-countries'));
        for (let i = 0; i < countryNames.length; i++) {
          const country = countryNames[i];
          if (country !== 'no-country') {
            countrySelectElement.add(new Option(country, country));
          }
        }
        callback(data);
      } else {
        callback({error: null});
      }
  }
  public loadCountryRegions(callback: (res:{error: string|null})=>void): void {
    const countrySelectElement=
        <HTMLSelectElement>Helpers.getElement(this.countrySelectId);
    if (countrySelectElement.options.length < 2) {
      callback({error: 'Load the country data from DB and select a country.'});
      return;
    }
    const countrySelection = countrySelectElement.
        options[countrySelectElement.selectedIndex].value;
    console.log(`selected ${countrySelection}`);
    if (countrySelection === 'all-countries') {
      callback({error: 'Please select country from the dropdown.'});
      return;
    }

    Helpers.get('/getAllCountryRegions', {country: countrySelection},
        (data: any | null) => {
          this.addAllCountryRegionsToList(data, status, callback);
      });
    }

  private addAllCountryRegionsToList(this: StreetViewController,
    data: any | null,
    status: any,
    callback: (res: {error: string | null}) => void) {
        if (data) {
          const regionData = data.regionData;
          this.loadedRegionData = regionData;
          const regionsParent = Helpers.getElement('#regions') as HTMLElement;
          regionsParent!.innerText = '';
          for (let i = 0; i < regionData.length; i++) {
            const region = regionData[i];
            regionsParent!.innerHTML += '<div id="streetView' + i + '">' +
              '<h1 class="title">' + region.region +
              '&nbsp;<span style="font-size: 1rem">' +
              '(Pin: <a href="https://maps.google.com/maps/search/' +
              region.pin!.lat + ',' + region.pin!.lng + '" target="_blank">[' +
              region.pin!.lat + ', ' + region.pin!.lng + '])' +
              '</h1>';
            regionsParent!.innerHTML += '<br>';
            for (let v = 0; v < region.streetViews!.locations!.length; v++) {
              regionsParent!.innerHTML +=
                '<h2 class="subtitle" style="margin-left: 1rem">Street View ' +
                v + '</span>&nbsp;&nbsp;&nbsp;<button class="button"' +
                'onclick="showLoadedStreetView(' + i + ', ' + v +
                ')"> Open Street View </button> <br>';
            }
            regionsParent!.innerHTML += '</div>';
          }
          callback({error: null});
        } else {
          callback({error:'Error loading regions for country from DB.'});
        }
  }

  /**
   * Show a street view in panorama element loaded from DB
   * @param {Number} regionIndex Index of the region
   * @param {Number} streetViewIndex Index of the street view within region
   */
  public showLoadedStreetView(regionIndex: number, streetViewIndex: number) {
    this.panoramaRef = new google.maps.StreetViewPanorama(
        <Element>Helpers.getElement(this.panoramaId), {
          position: {lat:
            this.loadedRegionData![regionIndex].streetViews!
                .locations![streetViewIndex]._latitude,
          lng: this.loadedRegionData![regionIndex].streetViews!
              .locations![streetViewIndex]._longitude},
          pov: {
            heading: 180,
            pitch: 10,
          },
        });
    this.panoramaRef.setVisible(true);
  }

  /**
   * Show a generated street view in panorama element
   * @param {String} region Region name
   * @param {Number} streetViewIndex Index of the street view to open
   */
  public showGeneratedStreetView(region: string, streetViewIndex: number) {
    this.panoramaRef = new google.maps.StreetViewPanorama(<Element>document
      .getElementById(this.panoramaId), {
        position: {
          lat: this.generatedStreetViews![region][streetViewIndex].lat,
          lng: this.generatedStreetViews![region][streetViewIndex].lng},
        pov: {
          heading: this.generatedStreetViews![region][streetViewIndex].h,
          pitch: 10,
        },
      });
  }

  /**
   * Remove generated street view and the html element for it
   * @param {String} region Region name
   * @param {Number} streetViewIndex Index of the street view to remove
   */
  public removeGeneratedStreetView(region: string, streetViewIndex: number) {
    if (this.generatedStreetViews!.hasOwnProperty(region)) {
      this.generatedStreetViews![region][streetViewIndex] = null;
      delete this.generatedStreetViews![region][streetViewIndex];
      const svElement = <HTMLElement>Helpers.getElement('#sv' +
        region.split(' ').join('_') + streetViewIndex);
      svElement!.parentNode!.removeChild(<Element>svElement);
    }
  }

  /**
   * Save a single street view in the DB
   * @param {String} region Region name
   * @param {Number} streetViewIndex Index of the street view to be saved
   */
  public saveSingleStreetViewInDB(region: string,
     streetViewIndex: number,
     callback: (message: string) => void) {
    const sv = this.generatedStreetViews![region][streetViewIndex];
    const countrySelectElement
        = <HTMLSelectElement> Helpers.getElement(this.countrySelectId);
    const countrySelection = countrySelectElement.
        options[countrySelectElement.selectedIndex].value;
    Helpers.post('/saveStreetView', {sv: [{country: countrySelection, region: region,
      svData: [sv]}]}, (data: {message: string}) => {
        callback(data.message);
    });
  }
}
