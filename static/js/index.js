let donorModal = null;
const donorEmailElementId = 'donor-email';
let currentDonorEmail = null;
let currentDonorCampaignData = null;

let campaignSelectElement = null;
const campaignSelectElementId = 'campaignSelection';

let countrySelectElement = null;
let countrySelectElementId = 'countrySelection';

let mapYourLearners = null;
let mapAllLearners = null;
const mapYourLearnersParentElementId = 'map-display-your-learners';
const mapAllLearnersParentElementId = 'map-display-all-learners';
let mapsSharedInfoWindow = null;
const staticMapZoomLevel = 3;

const allLearnersCountElementId = 'all-learners-count';

let newDonorInfoTextId = '#new-donor-info-text';

let loadedMarkers = [];
let markerClusterer = null;

let allLearnersData = null;
let loadingAllLearnersData = false;
let yourLearnersData = null;

$(document).ready(function() {
  donorModal = document.getElementById('donor-email-modal');

  if (tabSelector) {
    tabSelector.addEventListener('preTabToggle', (tabId) => {
      if (tabId === 'tab-your-learners' && currentDonorEmail === null && 
        donorModal) {
        $(newDonorInfoTextId).addClass('is-hidden');
        tabSelector.preventDefault();
        donorModal.classList.add('is-active');
      } else if (tabId === 'tab-your-learners' && yourLearnersData) {
        clearAllMarkers();
        displayClusteredData(mapYourLearners, yourLearnersData);
      } else if (tabId === 'tab-all-learners' && allLearnersData === null
        && !loadingAllLearnersData) {
        loadingAllLearnersData = true;
        tabSelector.preventDefault();
        GetDataAndSwitchToAllLearners();
      } else if (tabId === 'tab-all-learners' && allLearnersData === null
        && loadingAllLearnersData) {
        tabSelector.preventDefault();
      } else if (tabId === 'tab-all-learners' && allLearnersData !== null) {
        clearAllMarkers();
        createCountUpTextInElement('all-learners-count', 
          allLearnersData.markerData.length);
        displayClusteredData(mapAllLearners, allLearnersData);
      }
    });
    tabSelector.addEventListener('tabToggle', (tabId) => {
      console.log(tabId);
    });
  }

});

/**
 * Callback for Google Maps deferred load that initializes the map
 */
function initializeMaps() {
  let mapYourLearnersParent = document.getElementById(
    mapYourLearnersParentElementId);
  let mapAllLearnersParent = document.getElementById(
    mapAllLearnersParentElementId);
  campaignSelectElement = document.getElementById(
    campaignSelectElementId);
  countrySelectElement = document.getElementById(
    countrySelectElementId);

  mapsSharedInfoWindow = new google.maps.InfoWindow();

  if (mapYourLearnersParent) {
    mapYourLearners = new google.maps.Map(mapYourLearnersParent, {
      streetViewControl: false,
      mapTypeControl: false
    });
  }

  if (mapAllLearnersParent) {
    mapAllLearners = new google.maps.Map(mapAllLearnersParent, {
      streetViewControl: false,
      mapTypeControl: false
    });
  }

  const targetEmail = getURLParam('email');
  if (targetEmail) {
    currentDonorEmail = targetEmail;
    GetDataAndSwitchToDonorLearners();
  }
}

/**
 * Gets the location data for all learners and switches the tab to all learners
 */
function GetDataAndSwitchToAllLearners() {
  $.get('/allLearners', {e: currentDonorEmail}, function(data, status) {
    if (!data) {
      console.log("Couldn't get data for All Learners!");
      return;
    }
    createCountUpTextInElement(allLearnersCountElementId, data.locData.markerData.length);
    allLearnersData = data.locData;
    initializeCountrySelect(data.locData);
    displayClusteredData(mapAllLearners, data.locData);
    tabSelector.ToggleTab('tab-all-learners');
  });
}

/**
 * Initialized the country select element with location data country values
 * @param {Object} locationData array of location data
 */
function initializeCountrySelect(locationData) {
  if (!countrySelectElement) {
    console.error("Unable to find country select element.");
    return;
  }
  countrySelectElement.options = [];
  countrySelectElement.options[0] = new Option('All Learners', 'all-learners');
  for (var keyCountry in locationData.facts) {
    countrySelectElement.options.add(new Option(keyCountry, keyCountry));
  }
}

/**
 * Called when the country select element value changes
 */
function onCountrySelectionChanged() {
  if (!countrySelectElement) {
    console.error("Unable to find country select element.");
    return;
  }
  let countrySelection = countrySelectElement.
    options[countrySelectElement.selectedIndex].value;
  
  let learnersLocationData = {};
  if (countrySelection === 'all-learners') {
    learnersLocationData = allLearnersData;
  } else {
    learnersLocationData = { facts: allLearnersData.facts };
    learnersLocationData['markerData'] = allLearnersData.markerData.
      filter((marker) => { 
        return marker.country === countrySelection 
      });
  }
  clearAllMarkers();
  createCountUpTextInElement(allLearnersCountElementId,
    learnersLocationData.markerData.length);
  displayClusteredData(mapAllLearners, learnersLocationData);
}

/**
 * Called from the donor email form
 */
function GetDataAndSwitchToDonorLearners() {
  if (currentDonorEmail === null)
    currentDonorEmail = document.getElementById(donorEmailElementId).value;
  $.get('/getDonorCampaigns', {e: currentDonorEmail}, function(data, status) {
    if (data === "" || data === null || data === undefined) {
      $(newDonorInfoTextId).removeClass('is-hidden');
      setTimeout(() => {
        $(newDonorInfoTextId).addClass('is-hidden');
        $('#' + donorEmailElementId).val('');
      }, 7000);
      currentDonorEmail = null;
      return;
    }
    currentDonorCampaignData = data.campaigns;
    let campaignSelectionOptions = [];
    if (campaignSelectElement) {
      campaignSelectElement.options = [];
      for (let i = 0; i < data.campaigns.length; i++) {
        campaignSelectElement.options[i] = new Option(
          data.campaigns[i].data.campaignID, data.campaigns[i].data.campaignID);
      }
    }
    if (donorModal) {
      donorModal.classList.remove('is-active');
    }
    updateCampaignAndLocationData();
  });
}

/**
 * Update the campaign and location data based on the dropdown campaign
 * selection
 */
function updateCampaignAndLocationData() {
  if (campaignSelectElement) {
    let selectedCampaignID = campaignSelectElement.
      options[campaignSelectElement.selectedIndex].value;
    let campaignData = null;
    for (let i = 0; i < currentDonorCampaignData.length; i++) {
      if (currentDonorCampaignData[i].data.campaignID === selectedCampaignID) {
        campaignData = currentDonorCampaignData[i];
      }
    }
    document.getElementById('donation-amount').innerText = 
      campaignData.data.amount;

    document.getElementById('donation-date').innerText = 
      campaignData.data.startDate;

    tabSelector.ToggleTab('tab-your-learners');

    createCountUpTextInElement('learner-count', campaignData.data.userCount);

    clearAllMarkers();

    $.get('/yourLearners', 
      {email: currentDonorEmail, campaign: selectedCampaignID},
      function(locData, locDataStatus) {
        yourLearnersData = locData.locData;
        displayClusteredData(mapYourLearners, locData.locData);
      });
  }
}

/**
 * 
 * @param {String} elementId Id of the element
 * @param {Number} finalCountValue final value of the counter
 */
function createCountUpTextInElement(elementId, finalCountValue) {
  let userCounter = new CountUp(elementId, 
    finalCountValue, { 
      useEasing: true,
      useGrouping: true,
      duration: 5
  });
  if (!userCounter.error) {
    userCounter.start();
  } else {
    console.log(userCounter.error);
  }
}

/**
 * Called from the UI when the campaign is changed for the user
 */
function onCampaignSelectionChanged() {
  updateCampaignAndLocationData();
}

/**
 * Clears all loaded markers and the maker clusterer on the map
 */
function clearAllMarkers() {
  // Clear markers
  if (loadedMarkers.length > 0) {
    for (let i = 0; i < loadedMarkers.length; i++) {
      loadedMarkers[i].setMap(null);
      loadedMarkers[i] = null;
    }
    loadedMarkers = [];
    if (markerClusterer) {
      markerClusterer.clearMarkers();
    }
  }
}

/**
 * Displays the clustered location data on maps
 * @param {Array} locationData is an array of lat, lng objects
 * [{lat: -31.56, lng: 147.15}]
 * @param {Map} mapRef is a reference to the map
 */
function displayClusteredData(mapRef, locationData) {
  console.log('Loc data: ' + locationData);
  if (!locationData.markerData || locationData.markerData.length == 0) {
    const center = new google.maps.LatLng(0, 0);
    mapRef.setCenter(center);
    mapRef.setZoom(staticMapZoomLevel);
    return;
  }

  const bounds = new google.maps.LatLngBounds();

  loadedMarkers = locationData.markerData.map(function(location, i) {
    if (location.hasOwnProperty('lat') && !isNaN(location.lat)) {
      const newMarker = new google.maps.Marker({position: location});
      bounds.extend(newMarker.position);
      newMarker['lat'] = location.lat;
      newMarker['lng'] = location.lng;
      newMarker['country'] = location.country;
      newMarker['facts'] = locationData.facts;
      newMarker['region'] = location.region;
      newMarker['heading'] = location.headingValue;
      newMarker['otherViews'] = location.otherViews;

      newMarker.addListener('click', function() {
        mapsSharedInfoWindow.setContent(constructInfoWindowContent(
            newMarker.country,
            newMarker.region,
            getRandomFact(newMarker.facts[newMarker.country]),
            location.lat,
            location.lng,
            newMarker.heading));
        mapsSharedInfoWindow.open(mapRef);
        mapsSharedInfoWindow.setPosition(newMarker.getPosition());
      }); 

      loadedMarkers.push(newMarker);

      return newMarker;
    }
    bounds.extend(newMarker.position);
    return newMarker;
  });

  markerClusterer = new MarkerClusterer(mapRef, loadedMarkers, {
    imagePath: '/static/imgs/',
    zoomOnClick: false,
  });

  markerClusterer.addListener('clusterclick', function(cluster) {
    const currentCluster = cluster.getMarkers();
    console.log(currentCluster);
    if (currentCluster.length > 0) {
      const randomMarkerIndex = Math.floor((Math.random() * 
        currentCluster.length));
      const randomMarker = currentCluster[randomMarkerIndex];

      let streetView = { lat: randomMarker.lat, lng: randomMarker.lng, 
        headingValue: randomMarker.heading };

      if (randomMarker.otherViews && randomMarker.otherViews.length !== 0 && 
        Math.floor(Math.random() * 2) === 1) {
        streetView = randomMarker.otherViews[Math.floor((Math.random() * 
          randomMarker.otherViews.length))];
      }

      const content = constructInfoWindowContent(
          randomMarker.country,
          randomMarker.region,
          getRandomFact(randomMarker.facts[randomMarker.country]),
          streetView.lat,
          streetView.lng,
          streetView.headingValue);
      mapsSharedInfoWindow.setContent(content);
      mapsSharedInfoWindow.open(mapRef);
      // Pick the first marker position as the position of
      // the info window to avoid floating info windows
      mapsSharedInfoWindow.setPosition(currentCluster[0].getPosition());
    }
  });

  mapRef.fitBounds(bounds);
  mapRef.panToBounds(bounds);
  if (mapRef === mapAllLearners) {
    mapRef.setZoom(staticMapZoomLevel);
  }
}

/**
 * Constructs and returns info window html string content
 * @param {String} country is the country value
 * @param {String} region is the region value
 * @param {String} randomFact is the randomFact value displayed on info window
 * @param {Number} latitude is the latitude used for street view link
 * @param {Number} longitude is the longitude used for the street view link
 * @param {Number} heading is the heading valued used for street view link
 * @return {String} content string for the info window
 */
function constructInfoWindowContent(country, region, randomFact, latitude,
    longitude, heading) {
  region = region === "no-region" ? "Region not available" : region;
  const contentString = '<div style=\'text-align: left;\'>' +
    '<span style=\'font-size: 18px; color: #606060\'><b>' +
    region + ' </b></span>' + 
    '<span style=\'font-size: 16px; color: #909090\'><b>(' +
    country + ')</b></span>' +
    '<br><br> <p style=\'max-width: 300px; color: #505050; font-size: 14px\'>' +
    randomFact +
    '</p> <br> <form action=\'https://google.com/maps/@?\' method=\'get\' ' +
    'target=\'_blank\' style=\'text-align: center;\'>' +
    '<input type=\'hidden\' name=\'api\' value=\'1\'></input>' +
    '<input type=\'hidden\' name=\'map_action\' value=\'pano\'></input>' +
    '<input type=\'hidden\' name=\'viewpoint\' value=\''+
    latitude + ',' + longitude + '\'></input>' +
    '<input type=\'hidden\' name=\'heading\' value=\'' +
    heading + '\'></input>' +
    '<button type=\'submit\' class=\'button is-link is-outlined \'>' +
    ' <i class="fas fa-street-view"></i>&nbsp;&nbsp;Take Me There ' +
    '</button></form></div>';
  return contentString;
}

/**
 * Get a parameter value from the URL if available
 * @param {String} paramKey name of the parameter to query
 * @return {String} param value if present
 */
function getURLParam(paramKey) {
  const urlString = window.location.href;
  const url = new URL(urlString);
  return url.searchParams.get(paramKey);
}

/**
 * Get a random fact about country
 * @param {Array} factsArray facts string array
 * @return {String} random fact from the given array or no
 * facts available info string
 */
function getRandomFact(factsArray) {
  return factsArray ? getRandomFrom(factsArray) :
    'No facts are available for the country at the moment.';
}

/**
 * Get a random element from array
 * @param {any[]} inputArray input array of any kind
 * @return {any} returns one random element from the array
 */
function getRandomFrom(inputArray) {
  return inputArray[Math.floor((Math.random() * inputArray.length))];
}
