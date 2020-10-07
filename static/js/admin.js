let panoramaRef;
const panoramaId = 'pano';
const countrySelectId = 'countrySelect';
let loadedRegionData = null;
let loadedRandomGeoPoints = null;
let generatedStreetViews = null;
let streetViewService = null;
let pinMap = null;
let loadedPins = [];

const toastType = {
  primary: 'primary',
  warning: 'warning',
  danger: 'danger',
  link: 'link',
  info: 'info',
  success: 'success',
};

/**
 * Entry point after the goolge maps has finished loading on the page
 */
function initializeMaps() {
  streetViewService = new google.maps.StreetViewService();
  panoramaRef = new google.maps.StreetViewPanorama(
      document.getElementById(panoramaId));
  pinMap = new google.maps.Map(document.getElementById('map-pins'), {
    streetViewControl: false,
    mapTypeControl: false,
    maxZoom: 14,
  });
}

/**
 * Requests the server to generate random locations, then sends requests to the
 * Street Views service to get random street view panoramas close to those
 * locations and then displays a list of generated street views.
 */
function OnGenerateStreetViewsClick() {
  const countrySelectElement = document.getElementById(countrySelectId);
  if (countrySelectElement.options.length < 2) {
    showToast(toastType.danger, 'Error, no countries loaded.');
    return;
  }
  if (loadedPins.length > 0) {
    for (let i = 0; i < loadedPins.length; i++) {
      loadedPins[i].setMap(null);
      loadedPins[i] = null;
    }
    loadedPins = [];
  }
  const countrySelection = countrySelectElement.
      options[countrySelectElement.selectedIndex].value;
  if (countrySelection !== 'all-countries' && loadedRegionData === null ||
      countrySelection === 'all-countries') {
    showToast(toastType.danger,
        'Please load the region data for selected country.');
    return;
  }
  const radiusValue = document.getElementById('inputRadius').value;
  const countValue = document.getElementById('inputCount').value;
  if (radiusValue === NaN || countValue === NaN || countValue === '') {
    showToast(toastType.danger, 'Please fill in radius and count values.');
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  for (let i = 0; i < loadedRegionData.length; i++) {
    const regionPin = new google.maps.Marker(
        {position: new google.maps.LatLng(
            loadedRegionData[i].pin.lat,
            loadedRegionData[i].pin.lng), map: pinMap,
        icon: {url: '/static/imgs/2.png', size: new google.maps.Size(56, 55)},
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(28, 28),
        label: {text: (i + 1).toString()},
        });

    loadedPins.push(regionPin);
    bounds.extend(regionPin.position);
  }

  $.post('/generateRandomGeoPoints', {country: countrySelection,
    radius: radiusValue, svCount: countValue}, function(data, status) {
    if (data) {
      loadedRandomGeoPoints = data.streetViewGenData;
      console.log(loadedRandomGeoPoints);
      generatedStreetViews = {};
      const regionsParent = document.getElementById('regions');
      regionsParent.innerText = '';
      for (let i = 0; i < loadedRegionData.length; i++) {
        const region = loadedRegionData[i];
        regionsParent.innerHTML += '<div id="streetView' + i + '">' +
          '<h1 class="title">' + (i + 1).toString() + ' ' + region.region +
          '&nbsp;<span style="font-size: 1rem">(Pin: <a href="https://maps.google.com/maps/search/' +
          region.pin.lat + ',' + region.pin.lng + '" target="_blank">[' +
          region.pin.lat + ', ' + region.pin.lng + '])' +
          '</h1>';
        regionsParent.innerHTML += '<br></div>';
        generatedStreetViews[region.region] = [];
        let svIndex = 0;
        for (let l = 0; l < loadedRandomGeoPoints[region.region].length; l++) {
          const lat = parseFloat(loadedRandomGeoPoints[region.region][l]
              .lat.toFixed(6));
          const lng = parseFloat(loadedRandomGeoPoints[region.region][l]
              .lng.toFixed(6));
          streetViewService.getPanoramaByLocation(new google.maps.LatLng(
              lat, lng), 10000,
          function(svData, status) {
            const svRegionParent = document.getElementById('streetView' + i);

            if (status == google.maps.StreetViewStatus.OK) {
              // Pano in: svData.location.pano
              generatedStreetViews[region.region].push({
                lat: svData.location.latLng.lat(),
                lng: svData.location.latLng.lng(),
                h: parseFloat(svData.tiles['centerHeading'].toFixed(2)),
              });

              const newMarker = new google.maps.Marker(
                  {position: svData.location.latLng, map: pinMap,
                    icon: {url: '/static/imgs/1.png', size: new google.maps.Size(52, 52)},
                    origin: new google.maps.Point(0, 0),
                    anchor: new google.maps.Point(26, 26),
                    label: {text: (svIndex + 1).toString()},
                  });

              loadedPins.push(newMarker);
              bounds.extend(newMarker.position);

              svRegionParent.innerHTML +=
                '<div class="columns" id=sv'+ region.region.split(' ').join('_') + svIndex +' style="font-size: 1rem"><h2 class="subtitle column is-two-thirds" style="margin-left: 1rem">Street View ' +
                svIndex + '<span> <a href="https://maps.google.com/maps/search/' +
                svData.location.latLng.lat() + ', ' + svData.location.latLng.lng() +
                '" target="_blank">[ ' + svData.location.latLng.lat() +
                ', ' + svData.location.latLng.lng() + ' ]</a></span></h2><span class="column"><button class="button"' +
                'onclick="showGeneratedStreetView(\'' + region.region + '\', ' + svIndex + ')"> Open Street View </button></span>' +
                '<span class="column"><button class="button" onclick="saveSingleStreetViewInDB(\'' +
                region.region + '\', ' + svIndex + ')"> Save in DB </button></span>' +
                '<span class="column"><button class="button is-danger" onclick="removeGeneratedStreetView(\'' +
                region.region + '\', ' + svIndex + ')"> X </button><span></div>';
              svIndex++;
            } else {
              generatedStreetViews[region.region].push({
                lat: null,
                lng: null,
                h: 180,
              });
              svIndex++;
              console.log("Street View data not found." + svData);
            }
            if (loadedPins.length !== 0) {
              pinMap.fitBounds(bounds);
              pinMap.panToBounds(bounds);
            }
          });
        }
      }
      showToast(toastType.success, 'Street view generation complete.');
    }
  });
}

function OnToggleMapClick() {
  $('#map-view-parent').toggle();
}

/**
 * Called when the user attempts to save all generated street views
 */
function OnSaveAllStreetViewsClick() {
  if (!generatedStreetViews || generatedStreetViews.length === 0) {
    showToast(toastType.danger, 'No generated street views found!');
    return;
  }

  const sv = [];
  const countrySelectElement = document.getElementById(countrySelectId);
  const countrySelection = countrySelectElement.
      options[countrySelectElement.selectedIndex].value;

  for (const region in generatedStreetViews) {
    if (generatedStreetViews.hasOwnProperty(region)) {
      sv.push({country: countrySelection,
        region: region, svData: generatedStreetViews[region]});
    }
  }

  $.post('/saveStreetView', {sv: sv}, function(data, status) {
    if (data.message === 'success') {
      showToast(toastType.success, 'Street views saved!');
    } else if (data.message === 'failure') {
      showToast(toastType.danger, 'Failed to save street views!');
    }
  });
}

/**
 * Called when the user attempts to load all countries
 */
function OnLoadCountriesClick() {
  const countrySelectElement = document.getElementById(countrySelectId);
  if (countrySelectElement.options.length > 2) {
    return;
  }
  $.post('/getAllCountriesList', { }, function(data, status) {
    if (data) {
      const countryNames = data.countryNames;
      countrySelectElement.options = [];
      countrySelectElement.options[0] =
        new Option('All Countries', 'all-countries');
      for (let i = 0; i < countryNames.length; i++) {
        const country = countryNames[i];
        if (country !== 'no-country') {
          countrySelectElement.add(new Option(country, country));
        }
      }
      showToast(toastType.success, 'Countries Loaded!');
    } else {
      showToast(toastType.danger,
          'Error loading countries, please refresh the page.');
    }
  });
}

/**
 * Called when the user attempt to load country regions
 */
function OnLoadCountryRegionsClick() {
  const countrySelectElement = document.getElementById(countrySelectId);
  if (countrySelectElement.options.length < 2) {
    showToast(toastType.danger,
        'Load the country data from DB and select a country.');
    return;
  }
  const countrySelection = countrySelectElement.
      options[countrySelectElement.selectedIndex].value;
  if (countrySelection === 'all-countries') {
    showToast(toastType.danger, 'Please select country from the dropdown.');
    return;
  }

  $.post('/getAllCountryRegions', {country: countrySelection},
      function(data, status) {
        if (data) {
          const regionData = data.regionData;
          loadedRegionData = regionData;
          const regionsParent = document.getElementById('regions');
          regionsParent.innerText = '';
          for (let i = 0; i < regionData.length; i++) {
            const region = regionData[i];
            regionsParent.innerHTML += '<div id="streetView' + i + '">' +
              '<h1 class="title">' + region.region +
              '&nbsp;<span style="font-size: 1rem">' +
              '(Pin: <a href="https://maps.google.com/maps/search/' +
              region.pin.lat + ',' + region.pin.lng + '" target="_blank">[' +
              region.pin.lat + ', ' + region.pin.lng + '])' +
              '</h1>';
            regionsParent.innerHTML += '<br>';
            for (let v = 0; v < region.streetViews.locations.length; v++) {
              regionsParent.innerHTML +=
                '<h2 class="subtitle" style="margin-left: 1rem">Street View ' +
                v + '</span>&nbsp;&nbsp;&nbsp;<button class="button"' +
                'onclick="showLoadedStreetView(' + i + ', ' + v +
                ')"> Open Street View </button> <br>';
            }
            regionsParent.innerHTML += '</div>';
          }
          showToast(toastType.success, 'Regions loaded from DB.');
        } else {
          showToast(toastType.danger,
              'Error loading regions for country from DB.');
        }
      });
}

/**
 * Show a street view in panorama element loaded from DB
 * @param {Number} regionIndex Index of the region
 * @param {Number} streetViewIndex Index of the street view within region
 */
function showLoadedStreetView(regionIndex, streetViewIndex) {
  panoramaRef = new google.maps.StreetViewPanorama(
      document.getElementById(panoramaId), {
        position: {lat:
          loadedRegionData[regionIndex].streetViews
              .locations[streetViewIndex]['_latitude'],
        lng: loadedRegionData[regionIndex].streetViews
            .locations[streetViewIndex]['_longitude']},
        pov: {
          heading: 180,
          pitch: 10,
        },
      });
  panoramaRef.setVisible(true);
}

/**
 * Show a generated street view in panorama element
 * @param {String} region Region name
 * @param {Number} streetViewIndex Index of the street view to open
 */
function showGeneratedStreetView(region, streetViewIndex) {
  panoramaRef = new google.maps.StreetViewPanorama(document
      .getElementById(panoramaId), {
    position: {
      lat: generatedStreetViews[region][streetViewIndex].lat,
      lng: generatedStreetViews[region][streetViewIndex].lng},
    pov: {
      heading: generatedStreetViews[region][streetViewIndex].h,
      pitch: 10,
    },
  });
}

/**
 * Remove generated street view and the html element for it
 * @param {String} region Region name
 * @param {Number} streetViewIndex Index of the street view to remove
 */
function removeGeneratedStreetView(region, streetViewIndex) {
  if (generatedStreetViews.hasOwnProperty(region)) {
    generatedStreetViews[region][streetViewIndex] = null;
    delete generatedStreetViews[region][streetViewIndex];
    const svElement = document.getElementById('sv' +
      region.split(' ').join('_') + streetViewIndex);
    svElement.parentNode.removeChild(svElement);
  }
}

/**
 * Save a single street view in the DB
 * @param {String} region Region name
 * @param {Number} streetViewIndex Index of the street view to be saved
 */
function saveSingleStreetViewInDB(region, streetViewIndex) {
  const sv = generatedStreetViews[region][streetViewIndex];
  const countrySelectElement = document.getElementById(countrySelectId);
  const countrySelection = countrySelectElement.
      options[countrySelectElement.selectedIndex].value;
  $.post('/saveStreetView', {sv: [{country: countrySelection, region: region,
    svData: [sv]}]}, function(data, status) {
    if (data.message === 'success') {
      showToast(toastType.success, 'Street view saved!');
    } else if (data.message === 'failure') {
      showToast(toastType.danger, 'Failed to save the street view!');
    }
  });
}

/**
 * Displays a toast message on the page
 * @param {String} type Type of the toast out of: primary, link, info,
 * success, warning, danger
 * @param {String} message Message to display
 */
function showToast(type, message) {
  bulmaToast.toast({
    message: '<h1>' + message + '</h1>',
    type: 'is-' + type,
    dismissible: true,
    closeOnClick: true,
    animate: {in: 'fadeIn', out: 'fadeOut'},
  });
}
