let panoramaRef;
let panoramaId = 'pano';
let countrySelectId = 'countrySelect';
let loadedRegionData = null;

function initializeMaps() {
  const geocoder = new google.maps.Geocoder();
  const address = '666 5th avenue, New York, NY 10019';
  const locations = [{lat: 37.7626813, lng: -122.3924804},
    {lat: 34.352865, lng: 62.20402869999999},
    {lat: 34.1718313, lng: 70.6216794}];
  const svService = new google.maps.StreetViewService();
  panoramaRef = new google.maps.StreetViewPanorama(
      document.getElementById(panoramaId));
  geocoder.geocode({'address': address}, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
      latLng = results[0].geometry.location;
      console.log(google.maps.LatLng);
      svService.getPanoramaByLocation(new google.maps.LatLng(locations[0].lat,
          locations[0].lng), 50, showPanorama);
    }
  });
}

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
    }
  });
}

function OnLoadCountryRegionsClick() {
  const countrySelectElement = document.getElementById(countrySelectId);
  if (countrySelectElement.options.length < 2) {
    return;
  }
  const countrySelection = countrySelectElement.
      options[countrySelectElement.selectedIndex].value;
  if (countrySelection === 'all-countries') {
    window.alert('Please choose a country to load regions for!');
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
              '&nbsp;<span style="font-size: 1rem">(Pin: <a href="https://maps.google.com/maps/search/' +
              region.pin.lat + ',' + region.pin.lng + '" target="_blank">[' +
              region.pin.lat + ', ' + region.pin.lng + '])' +
              '</h1>';
            regionsParent.innerHTML += '<br>';
            for (let v = 0; v < region.streetViews.locations.length; v++) {
              regionsParent.innerHTML +=
                '<h2 class="subtitle" style="margin-left: 1rem">Street View ' +
                v + '</span>&nbsp;&nbsp;&nbsp;<button class="button" onclick="showStreetView(' +
                i + ', ' + v + ')"> Open Street View </button> <br>';
            }
            regionsParent.innerHTML += '</div>';
          }
        }
      });
}

function showPanorama(svData, status) {
  if (status == google.maps.StreetViewStatus.OK) {
    panoramaRef.setPano(svData.location.pano);
    console.log(svData, svData.location, svData.location.latLng.lat(),
        svData.location.latLng.lng(), svData.location.pano);
    panoramaRef.setVisible(true);
  } else {
    console.log("Street View data not found for this location." + svData);
  }
}

function showStreetView(regionIndex, streetViewIndex) {
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
