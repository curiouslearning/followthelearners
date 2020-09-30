let panoramaRef;
let panoramaId = 'pano';
let countrySelectId = 'countrySelect';
let loadedRegionData = null;
let loadedRandomGeoPoints = null;
let generatedStreetViews = null;
let svService = null;

function initializeMaps() {
  svService = new google.maps.StreetViewService();
  panoramaRef = new google.maps.StreetViewPanorama(
      document.getElementById(panoramaId));
}

function OnGenerateStreetViewsClick() {
  const countrySelectElement = document.getElementById(countrySelectId);
  if (countrySelectElement.options.length < 2) {
    bulmaToast.toast({
      message: '<h1>Error, no countries loaded.</h1>',
      type: 'is-danger',
      dismissible: true,
      closeOnClick: true,
      animate: {in: 'fadeIn', out: 'fadeOut'},
    });
    return;
  }
  const countrySelection = countrySelectElement.
      options[countrySelectElement.selectedIndex].value;
  if (countrySelection !== 'all-countries' && loadedRegionData === null ||
      countrySelection === 'all-countries') {
    bulmaToast.toast({
      message: '<h1>Please load the region data for selected country.</h1>',
      type: 'is-danger',
      dismissible: true,
      closeOnClick: true,
      animate: {in: 'fadeIn', out: 'fadeOut'},
    });
    return;
  }
  const radiusValue = document.getElementById('inputRadius').value;
  const countValue = document.getElementById('inputCount').value;
  if (radiusValue === NaN || countValue === NaN || countValue === '') {
    bulmaToast.toast({
      message: '<h1>Please fill in radius and count values.</h1>',
      type: 'is-danger',
      dismissible: true,
      closeOnClick: true,
      animate: {in: 'fadeIn', out: 'fadeOut'},
    });
    return;
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
          '<h1 class="title">' + region.region +
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
          svService.getPanoramaByLocation(new google.maps.LatLng(
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
              //   panoramaRef.setPano(svData.location.pano);
              //   console.log(svData, svData.location, svData.location.latLng.lat(),
              //       svData.location.latLng.lng(), svData.location.pano);
              //   panoramaRef.setVisible(true);
              svRegionParent.innerHTML +=
                '<div class="columns" style="font-size: 1rem"><h2 class="subtitle column is-two-thirds" style="margin-left: 1rem">Street View ' +
                l + '<span> <a href="https://maps.google.com/maps/search/' +
                svData.location.latLng.lat() + ', ' + svData.location.latLng.lng() +
                '" target="_blank">[ ' + svData.location.latLng.lat() +
                ', ' + svData.location.latLng.lng() + ' ]</a></span></h2><span class="column"><button class="button"' +
                'onclick="showGeneratedStreetView(\'' + region.region + '\', ' + svIndex + ')"> Open Street View </button></span>' +
                '<span class="column"><button class="button" onclick="saveStreetView(\'' +
                region.region + '\', ' + svIndex + ')"> Save in DB </button></span>' +
                '<span class="column"><button class="button is-danger" disabled onclick="removeGeneratedSV()"> X </button><span></div>';
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
          });
        }
      }
      bulmaToast.toast({
        message: '<h1>Street view generation procedure complete.</h1>',
        type: 'is-primary',
        dismissible: true,
        closeOnClick: true,
        animate: {in: 'fadeIn', out: 'fadeOut'},
      });
    }
  });
}

function OnSaveAllStreetViewsClick() {
  if (!generatedStreetViews || generatedStreetViews.length === 0) {
    bulmaToast.toast({
      message: '<h1>No generated street views found!</h1>',
      type: 'is-danger',
      dismissible: true,
      closeOnClick: true,
      animate: {in: 'fadeIn', out: 'fadeOut'},
    });
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
      bulmaToast.toast({
        message: '<h1>Street views saved!</h1>',
        type: 'is-primary',
        dismissible: true,
        closeOnClick: true,
        animate: {in: 'fadeIn', out: 'fadeOut'},
      });
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
      bulmaToast.toast({
        message: '<h1>Countries Loaded!</h1>',
        type: 'is-primary',
        dismissible: true,
        closeOnClick: true,
        animate: {in: 'fadeIn', out: 'fadeOut'},
      });
    } else {
      bulmaToast.toast({
        message: '<h1>Error loading countries, please refresh and try again.</h1>',
        type: 'is-danger',
        dismissible: true,
        closeOnClick: true,
        animate: {in: 'fadeIn', out: 'fadeOut'},
      });
    }
  });
}

function OnLoadCountryRegionsClick() {
  const countrySelectElement = document.getElementById(countrySelectId);
  if (countrySelectElement.options.length < 2) {
    bulmaToast.toast({
      message: '<h1>Load the country data from DB and select a country.</h1>',
      type: 'is-danger',
      dismissible: true,
      closeOnClick: true,
      animate: {in: 'fadeIn', out: 'fadeOut'},
    });
    return;
  }
  const countrySelection = countrySelectElement.
      options[countrySelectElement.selectedIndex].value;
  if (countrySelection === 'all-countries') {
    bulmaToast.toast({
      message: '<h1>Please select country from the dropdown.</h1>',
      type: 'is-danger',
      dismissible: true,
      closeOnClick: true,
      animate: {in: 'fadeIn', out: 'fadeOut'},
    });
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
                v + '</span>&nbsp;&nbsp;&nbsp;<button class="button"' +
                'onclick="showStreetView(' +
                i + ', ' + v + ')"> Open Street View </button> <br>';
            }
            regionsParent.innerHTML += '</div>';
          }
          bulmaToast.toast({
            message: '<h1>Regions loaded from DB.</h1>',
            type: 'is-primary',
            dismissible: true,
            closeOnClick: true,
            animate: {in: 'fadeIn', out: 'fadeOut'},
          });
        } else {
          bulmaToast.toast({
            message: '<h1>Error loading regions for country from DB.</h1>',
            type: 'is-danger',
            dismissible: true,
            closeOnClick: true,
            animate: {in: 'fadeIn', out: 'fadeOut'},
          });
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

function showGeneratedStreetView(region, streetViewIndex) {
  panoramaRef = new google.maps.StreetViewPanorama(
      document.getElementById(panoramaId), {
        position: {
          lat: generatedStreetViews[region][streetViewIndex].lat,
          lng: generatedStreetViews[region][streetViewIndex].lng},
        pov: {
          heading: generatedStreetViews[region][streetViewIndex].h,
          pitch: 10,
        },
      });
}

function saveStreetView(region, streetViewIndex) {
  let sv = generatedStreetViews[region][streetViewIndex];
  const countrySelectElement = document.getElementById(countrySelectId);
  const countrySelection = countrySelectElement.
      options[countrySelectElement.selectedIndex].value;
  $.post('/saveStreetView', {sv: [{country: countrySelection, region: region, svData: [sv]}]}, function(data, status) {
    if (data.message === 'success') {
      bulmaToast.toast({
        message: '<h1>Street view saved!</h1>',
        type: 'is-primary',
        dismissible: true,
        closeOnClick: true,
        animate: {in: 'fadeIn', out: 'fadeOut'},
      });
    }
  });
}
