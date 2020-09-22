let donorModal = null;
const donorEmailElementId = 'donor-email';
let currentDonorEmail = null;
let currentDonorCampaignData = null;

let yourLearnersCountrySelectElement = null;
const yourLearnersCountrySelectElementId = 'yourLearnersCountrySelect';

let countrySelectElement = null;
const countrySelectElementId = 'countrySelection';

let mapYourLearners = null;
let mapAllLearners = null;

const mapYourLearnersParentElementId = 'map-display-your-learners';
const mapAllLearnersParentElementId = 'map-display-all-learners';
let mapsSharedInfoWindow = null;
const mapZoomFullView = 3;
const mapZoomCountryView = 7;

const allLearnersCountElementId = 'all-learners-count';
const dntLearnersCountElementId = 'no-region-user-count';
const dntYourLearnersCountElementId = 'your-learners-no-region-user-count';
const allLearnersResetMapButtonId = 'btn-reset-map';

const newDonorInfoTextId = '#new-donor-info-text';
const newDonorInfoContentId = '#new-donor-info-content';
const donorEmailModal = '#donor-email-modal';
const donorEmailSubmit = '#donor-email-submit'

let loadedMarkers = [];
let loadedYourLearnersMarkers = [];
let markerClusterer = null;

let allLearnersData = null;
let loadingAllLearnersData = false;
let yourLearnersData = null;

const COSTPERLEARNER = 0.25;

// Auth data
let signInButton = '#sign-in-out'
let signInTextElement = '#sign-in-text';
let signInText = 'Sign In';
let signOutText = 'Sign Out';
let uid = '';
let email = '';
let emailVerified = false;
let token = undefined;
const TOKENTIMEOUT = 3600001;
let lastRefresh = Date.now();

firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .then(()=>{
      return true;
    }).catch((err)=>{
      console.error(err);
    });


$(document).ready(function() {
  firebase.auth().onAuthStateChanged((user) =>{
    if (user) {
      uid = user.uid;
      email = user.email;
      emailVerified = user.emailVerified;
      $(signInButton).click(function() {
        firebase.auth().signOut();
        tabSelector.ToggleTab('tab-campaigns');
      });
      $(signInTextElement).text(signOutText);
      firebase.auth().currentUser.getIdToken(true).then((newToken) =>{
        token = newToken;
        console.log('token: ', token);
        GetDataAndSwitchToDonorLearners();
        lastRefresh = Date.now();
        return;
      }).catch((err)=>{
        console.error(err);
      });
    } else {
      $(signInButton).click(function() {
        tabSelector.ToggleTab('tab-your-learners');
      });
      $(signInTextElement).text(signInText);
      currentDonorEmail = null;
      uid = '';
      email = '';
      emailVerified = false;
      token = undefined;
    }
  });
  donorModal = document.getElementById('donor-email-modal');
  if (tabSelector) {
    tabSelector.addEventListener('preTabToggle', (tabId) => {
      if (tabId === 'tab-your-learners'&& currentDonorEmail === null &&
        donorModal) {
        if (token) {
          tabSelector.preventDefault();
          CheckTokenAndSwitchToDonorLearners(email);
        } else {
          $(newDonorInfoTextId).addClass('is-hidden');
          tabSelector.preventDefault();
          donorModal.classList.add('is-active');
        }
      } else if (tabId === 'tab-all-learners' && allLearnersData === null &&
        !loadingAllLearnersData) {
        loadingAllLearnersData = true;
        tabSelector.preventDefault();
        GetDataAndSwitchToAllLearners();
      } else if (tabId === 'tab-all-learners' && allLearnersData === null &&
          loadingAllLearnersData) {
        tabSelector.preventDefault();
      } else if (tabId === 'tab-all-learners' && allLearnersData !== null) {
        clearAllMarkers();
        createCountUpTextInElement('all-learners-count',
            getTotalCountForAllLearners(allLearnersData));
        displayAllLearnersData(allLearnersData, true);
        for (let key in allLearnersData.campaignData) {
          if (allLearnersData.campaignData[key].country == 'no-country') {
            createCountUpTextInElement(dntLearnersCountElementId,
                allLearnersData.campaignData[key].learnerCount);
          }
        }
        countrySelectElement.value = 'all-learners';
      }
    });
    tabSelector.addEventListener('tabToggle', (tabId) => {
      // console.log(tabId);
    });
  }
  if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      email = window.prompt('please enter your email to finish signing in');
    }
    firebase.auth().signInWithEmailLink(email, window.location.href)
        .then((result)=>{
          currentDonorEmail = email;
          window.localStorage.removeItem('emailForSignIn');
          window.history.replaceState({}, document.title, '/campaigns');
        }).catch((err)=>{
          window.localStorage.removeItem('emailForSignIn');
          window.history.replaceState({}, document.title, '/campaigns');
          console.error(err);
        });
  } else if (token) {
    CheckTokenAndSwitchToDonorLearners(email);
  }
});

function CheckTokenAndSwitchToDonorLearners(email) {
  if (!token) {
    return;
  }
  currentDonorEmail = email;
  if (lastRefresh <= (Date.now() - TOKENTIMEOUT)) {
    firebase.auth().currentUser.getIdToken(true).then((newToken)=>{
      token = newToken;
      lastRefresh = Date.now();
      GetDataAndSwitchToDonorLearners();
    }).catch((err)=>{
      console.error(err);
    });
  } else {
    GetDataAndSwitchToDonorLearners();
  }
}

/**
 * Callback for Google Maps deferred load that initializes the map
 */
function initializeMaps() {
  let mapYourLearnersParent = document.getElementById(
    mapYourLearnersParentElementId);
  let mapAllLearnersParent = document.getElementById(
    mapAllLearnersParentElementId);
  yourLearnersCountrySelectElement = document.getElementById(
    yourLearnersCountrySelectElementId);
  countrySelectElement = document.getElementById(
    countrySelectElementId);

  mapsSharedInfoWindow = new google.maps.InfoWindow();

  if (mapYourLearnersParent) {
    mapYourLearners = new google.maps.Map(mapYourLearnersParent, {
      streetViewControl: false,
      mapTypeControl: false,
      maxZoom: 10
    });
  }

  if (mapAllLearnersParent) {
    mapAllLearners = new google.maps.Map(mapAllLearnersParent, {
      streetViewControl: false,
      mapTypeControl: false,
      maxZoom: 10
    });
  }

  const targetEmail = getURLParam('email');
  if (targetEmail && token) {
    CheckTokenAndSwitchToDonorLearners(targetEmail);
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

    allLearnersData = data.data;
    createCountUpTextInElement(allLearnersCountElementId,
      getTotalCountForAllLearners(allLearnersData));

    for (var key in allLearnersData.campaignData) {
      if (allLearnersData.campaignData[key].country == "no-country") {
        createCountUpTextInElement(dntLearnersCountElementId,
          allLearnersData.campaignData[key].learnerCount);
      }
    }

    initializeCountrySelect(allLearnersData);
    clearAllMarkers();
    tabSelector.ToggleTab('tab-all-learners');

    updateResetMapButtonState();
  });
}

/**
 * Gets aggregate data for all learners from all countries
 * @param {Object} countryLearnersData country learner data
 */
function getTotalCountForAllLearners(countryLearnersData) {
  let totalCount = 0;
  for (let key in countryLearnersData.campaignData) {
    if ( countryLearnersData.campaignData[key] !== undefined) {
      totalCount += countryLearnersData.campaignData[key].learnerCount;
    }
  }
  return totalCount;
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
  for (var key in locationData.campaignData) {
    let country = locationData.campaignData[key].country;
    if (country !== "no-country") {
      countrySelectElement.options.add(new Option(
        country + " - " + locationData.campaignData[key].learnerCount, country));
    }
  }
}

/**
 * Event listener when user clicks on the country take me there button that's on
 * info window
 * @param {String} country country that is selected on the map
 */
function onYourLearnersCountryZoomInClick(country) {
  if (!country || !yourLearnersCountrySelectElement) {
    return;
  }
  yourLearnersCountrySelectElement.value = country;
  onYourLearnersCountrySelectionChanged();
}

/**
 * Event listener when user clicks on the country take me there button that's on
 * info window
 * @param {String} country country that is selected on the map
 */
function onAllLearnersCountryZoomInClick(country) {
  if (!country || !countrySelectElement) {
    return;
  }
  countrySelectElement.value = country;
  onCountrySelectionChanged();
}

/**
 * Called when user interacts with the give now button
 */
function onGiveNowButtonClick() {
  if (!yourLearnersCountrySelectElement) {
    console.error("Unable to find country select element for your learners")
    return;
  }

  let countrySelection = yourLearnersCountrySelectElement.
    options[yourLearnersCountrySelectElement.selectedIndex].value;

  let donorCountries = [];
  if (yourLearnersCountrySelectElement.options.length > 0 &&
    countrySelection === 'all-countries') {
    for (let i = 1; i < yourLearnersCountrySelectElement.options.length; i++) {
      donorCountries.push(yourLearnersCountrySelectElement.options[i].value);
    }
  }

  $.post('/giveAgain', {
    email: currentDonorEmail,
    countrySelection: countrySelection,
    donorCountries: donorCountries},
    function(data, status) {
      if (data) {
        if (data.hasOwnProperty('action')) {
          if (data.action === 'switch-to-regions') {
            tabSelector.ToggleTab('tab-campaigns');
          }
        }
      }
    }
  );

}

function validateEmail(email) {
  if (email === null || email === undefined) return false;
  console.log('validating email: ', email);
  const result = email.match(/[[\w\d-\.]+\@]?[[\w\d-]*[\.]+[\w\d-\.]+]*/);
  if (result !== null && result !== undefined && result !== ['']) {
    return true;
  }
  return false;
}

/**
 * Called from the donor email form
 */
function GetDataAndSwitchToDonorLearners() {
  $.get('/yourLearners', {email: currentDonorEmail, token: token}, function(data, status) {
    if (data.err) {
      $(newDonorInfoContentId).text(data.err);
      $(newDonorInfoTextId).removeClass('is-hidden');
      currentDonorEmail = null;
    }
    if (data === '' || data === null || data === undefined) {
      $(newDonorInfoTextId).removeClass('is-hidden');
      setTimeout(() => {
        $(newDonorInfoTextId).addClass('is-hidden');
        $('#' + donorEmailElementId).val('');
      }, 7000);
      currentDonorEmail = null;
      return;
    }

    yourLearnersData = data;

    if (yourLearnersCountrySelectElement) {
      yourLearnersCountrySelectElement.options = [];
      yourLearnersCountrySelectElement.options[0] =
        new Option('All Countries', 'all-countries');
      for (let i = 0; i < data.locationData.length; i++) {
        yourLearnersCountrySelectElement.options[i + 1] =
          new Option(data.locationData[i].country + ' - ' +
            getTotalCountryLearnerCountFromDonations(
                yourLearnersData.campaignData,
                data.locationData[i].country),
          data.locationData[i].country
          );
      }
    }
    // TODO: expand this  to cover campaigns with varying cost/learner
    let allCountriesAggregateAmount = 0;
    let tempDonationStartDate = null;
    let allCountriesDonationStartDate = '';
    let allCountriesLearnersCount = 0;
    let allCountriesDNTUsersCount = 0;
    let percentFilled = 0;
    for (let i = 0; i < data.campaignData.length; i++) {
      let donation = data.campaignData[i].data;
      allCountriesAggregateAmount += typeof donation.amount === 'string' ?
        parseFloat(donation.amount) : donation.amount;
      if (tempDonationStartDate === null) {
        tempDonationStartDate = new Date(donation.startDate);
        allCountriesDonationStartDate = donation.startDate;
      } else if (tempDonationStartDate > new Date(donation.startDate)) {
        tempDonationStartDate = new Date(donation.startDate);
        allCountriesDonationStartDate = donation.startDate;
      }
      allCountriesLearnersCount += donation.learnerCount;
      for (let c = 0; c < donation.countries.length; c++) {
        let country = donation.countries[c];
        if (country.country === 'no-country') {
          allCountriesDNTUsersCount += country.learnerCount;
        }
      }
    }
    setDonationPercentage(
        allCountriesAggregateAmount,
        allCountriesLearnersCount,
        COSTPERLEARNER,
    );
    document.getElementById('donation-amount').innerText =
      allCountriesAggregateAmount;

    if (allCountriesDonationStartDate !== '') {
      document.getElementById('donation-date').innerText =
        allCountriesDonationStartDate.toString();
    }

    createCountUpTextInElement('learner-count',
        allCountriesLearnersCount);

    if (donorModal) {
      donorModal.classList.remove('is-active');
    }

    createCountUpTextInElement(dntYourLearnersCountElementId,
        allCountriesDNTUsersCount);

    tabSelector.ToggleTab('tab-your-learners');

    displayYourLearnersData(yourLearnersData, true);

  });

}

function checkForDonorSignIn() {
  console.log('token: ', token);
  if (token !== undefined) {
    let email = currentDonorEmail;
    if (email === undefined) {
      email = document.getElementById(donorEmailElementId).value;
    }
    CheckTokenAndSwitchToDonorLearners(email);
    return;
  } else if ($(donorEmailSubmit).prop('disabled') === true) {
    return;
  }
  currentDonorEmail = document.getElementById(donorEmailElementId).value;
  const actionCodeSettings = {
    url: 'http://localhost:3000/campaigns',
    handleCodeInApp: true,
  };

  firebase.auth().sendSignInLinkToEmail(currentDonorEmail, actionCodeSettings)
      .then(function() {
        window.localStorage.setItem('emailForSignIn', currentDonorEmail);
        $(newDonorInfoContentId).text('please follow the link we sent to your email to complete the sign in process! You can now safely close this browser tab.');
        $(newDonorInfoTextId).removeClass('is-hidden');
      }).catch((err) =>{
        console.error(err.code);
      });
}

/**
 * Updates the visibility of the reset button based on country selection
 */
function updateResetMapButtonState() {
  if (!countrySelectElement) {
    console.error("Unable to find country select element.");
    return;
  }
  let countrySelection = countrySelectElement.
    options[countrySelectElement.selectedIndex].value;


  if (countrySelection === 'all-learners') {
    $('#' + allLearnersResetMapButtonId).hide();
  } else {
    $('#' + allLearnersResetMapButtonId).show();
  }
}

/**
 * Called on reset map button click event
 */
function OnResetMapButtonClick() {
  countrySelectElement.value = 'all-learners';
  onCountrySelectionChanged();
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
 * Called when the country select element value changes
 */
function onCountrySelectionChanged() {
  if (!countrySelectElement) {
    console.error("Unable to find country select element.");
    return;
  }
  let countrySelection = countrySelectElement.
    options[countrySelectElement.selectedIndex].value;

  clearAllMarkers();

  if (countrySelection === 'all-learners') {
    displayAllLearnersData(allLearnersData, true);
    createCountUpTextInElement(allLearnersCountElementId,
      getTotalCountForAllLearners(allLearnersData));
    for (var key in allLearnersData.campaignData) {
      if (allLearnersData.campaignData[key].country == "no-country") {
        createCountUpTextInElement(dntLearnersCountElementId,
          allLearnersData.campaignData[key].learnerCount);
      }
    }
  } else {
    displayAllLearnersData(allLearnersData, false, countrySelection);
    let c = allLearnersData.campaignData.find((loc) => { return loc.country === countrySelection; });
    createCountUpTextInElement(allLearnersCountElementId,
      c.learnerCount);
    let noRegion = c.regions.find((r) => { return r.region === "no-region"; });

    if (noRegion && noRegion.hasOwnProperty('learnerCount')) {
      createCountUpTextInElement(dntLearnersCountElementId, noRegion.learnerCount);
    } else if (!noRegion) {
      createCountUpTextInElement(dntLearnersCountElementId, 0);
    }
  }

  updateResetMapButtonState();
}

/**
 * Called from the UI when the country is changed for the user
 */
function onYourLearnersCountrySelectionChanged() {
  if (!yourLearnersCountrySelectElement) {
    console.error("Unable to find country select element for your learners")
    return;
  }

  let countrySelection =  yourLearnersCountrySelectElement.
    options[yourLearnersCountrySelectElement.selectedIndex].value;

  clearYourLearnersMarkers();

  if (countrySelection === 'all-countries') {
    let allCountriesAggregateAmount = 0;
    let tempDonationStartDate = null;
    let allCountriesDonationStartDate = "";
    let allCountriesLearnersCount = 0;
    let allCountriesDNTUsersCount = 0;
    for (let i = 0; i < yourLearnersData.campaignData.length; i++) {
      let donation = yourLearnersData.campaignData[i].data;
      allCountriesAggregateAmount += typeof donation.amount === 'string' ?
        parseFloat(donation.amount) : donation.amount;
      if (tempDonationStartDate === null) {
        tempDonationStartDate = new Date(donation.startDate);
        allCountriesDonationStartDate = donation.startDate;
      } else if (tempDonationStartDate > new Date(donation.startDate)) {
        tempDonationStartDate = new Date(donation.startDate);
        allCountriesDonationStartDate = donation.startDate;
      }
      allCountriesLearnersCount += donation.learnerCount;
      for (let c = 0; c < donation.countries.length; c++) {
        let country = donation.countries[c];
        if (country.country === 'no-country') {
          allCountriesDNTUsersCount += country.learnerCount;
        }
      }
    }

    setDonationPercentage(
        allCountriesAggregateAmount,
        allCountriesLearnersCount,
        COSTPERLEARNER
    );
    document.getElementById('donation-amount').innerText =
      allCountriesAggregateAmount;

    if (allCountriesDonationStartDate !== "") {
      document.getElementById('donation-date').innerText =
        allCountriesDonationStartDate.toString();
    }

    createCountUpTextInElement('learner-count', allCountriesLearnersCount);

    createCountUpTextInElement(dntYourLearnersCountElementId,
      allCountriesDNTUsersCount);

    displayYourLearnersData(yourLearnersData, true);
  } else {
    displayYourLearnersData(yourLearnersData, false, countrySelection);

    let countryDonationAggregate = 0;
    let countryLearnersAggregate = 0;
    let countryDonationStartDate = "";
    let dntRegionLearnersForCountry = 0;
    let tempDonationStartDate = null;

    for (let i = 0; i < yourLearnersData.campaignData.length; i++) {
      let campaign = yourLearnersData.campaignData[i].data;
      if (campaign.country === countrySelection) {
        countryDonationAggregate += typeof campaign.amount === 'string' ?
        parseFloat(campaign.amount) : campaign.amount;
        countryLearnersAggregate += campaign.learnerCount;
        if (tempDonationStartDate === null) {
          tempDonationStartDate = new Date(campaign.startDate);
          countryDonationStartDate = campaign.startDate;
        } else if (tempDonationStartDate > new Date(campaign.startDate)) {
          tempDonationStartDate = new Date(campaign.startDate);
          countryDonationStartDate = campaign.startDate;
        }

        let country = campaign.countries.find((c) => { return c.country === countrySelection});

        let noRegion = country.regions.find((r) => { return r.region === "no-region"; });

        if (noRegion && noRegion.hasOwnProperty('learnerCount')) {
          dntRegionLearnersForCountry += noRegion.learnerCount;
        }
      }
    }

    setDonationPercentage(
        countryDonationAggregate,
        countryLearnersAggregate,
        COSTPERLEARNER
    );
    createCountUpTextInElement('learner-count', countryLearnersAggregate);

    document.getElementById('donation-amount').innerText =
      countryDonationAggregate;

    if (countryDonationStartDate !== "") {
      document.getElementById('donation-date').innerText =
        countryDonationStartDate.toString();
    }

    createCountUpTextInElement(dntYourLearnersCountElementId,
      dntRegionLearnersForCountry);
  }

  console.log(countrySelection);
}

function setDonationPercentage(fullAmount, learnerCount, costPerLearner) {
  let learnerMax = Math.round(fullAmount/costPerLearner);
  if (isNaN(learnerMax)) {
    learnerMax = 0;
  }
  let decimal = Math.round(learnerCount/learnerMax);
  if (isNaN(decimal)) {
    decimal = 0;
  }
  const percentFilled = decimal * 100;
  if (percentFilled < 100) {
    $('#percent-filled').text('Check back in a few days to see more learners!');
    $('#give-again').css('display', 'none');
  } else {
    $('#congrats').text('Congrats 🎉! ');
    $('#give-again').css('display', 'block');
  }
}

function clearYourLearnersMarkers() {
  if (loadedYourLearnersMarkers.length > 0) {
    for (let i = 0; i < loadedYourLearnersMarkers.length; i++) {
      loadedYourLearnersMarkers[i].setMap(null);
      loadedYourLearnersMarkers[i]= null;
    }
  }
  loadedYourLearnersMarkers = [];
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
 * Display all learners country level and region level data and switch smoothly
 * @param {Object} locationData root location data with countries & regions
 * @param {Boolean} isCountryLevelData bool that differs country & region data
 * @param {String} country if the region data should be displayed the country
 * should be passed
 */
async function displayAllLearnersData(locData, isCountryLevelData, country) {
  if (locData === null) {
    const center = new google.maps.LatLng(0, 0);
    mapAllLearners.setCenter(center);
    mapAllLearners.setZoom(mapZoomFullView);
    return;
  }
  if (mapsSharedInfoWindow)
    mapsSharedInfoWindow.close();

  let locationData = locData.locationData;

  if (isCountryLevelData) {
    for (let key = 0; key < locationData.length; key++) {
      if (locationData[key].country === "no-country") {
        continue;
      }
      // console.log(locationData[key].country);
      let learnerCount = locData.campaignData[key.toString()].learnerCount;
      let iconOptions = getIconOptionsBasedOnCount(learnerCount);
      let newMarker = new google.maps.Marker({position: locationData[key].pin,
          map: mapAllLearners,
          icon: {url: iconOptions.iconUrl, size: iconOptions.iconSize,
          origin: new google.maps.Point(0, 0),
          anchor: iconOptions.iconAnchor},
          label: { text: learnerCount.toString() }});
      try{
	      newMarker['country'] = locationData[key].country;
	      newMarker['lat'] = locationData[key].pin.lat;
	      newMarker['lng'] = locationData[key].pin.lng;
	      newMarker['facts'] = locationData[key].facts;
      } catch (e) {
	      console.error("caught error: ", e, " on country: ", locationData[key].country);
      }

      newMarker.addListener('click', function() {
        mapsSharedInfoWindow.setContent(constructCountryLevelInfoWindow(
            newMarker.country,
            getRandomFact(newMarker.facts)));
        mapsSharedInfoWindow.open(mapAllLearners);
        mapsSharedInfoWindow.setPosition(
          {lat: newMarker.lat, lng: newMarker.lng});
      });

      loadedMarkers.push(newMarker);
    }

    const center = new google.maps.LatLng(26.3351, 17.228331);
    mapAllLearners.setCenter(center);
    mapAllLearners.setZoom(mapZoomFullView);
  } else {
    let locationData = locData.locationData;
    let countryData = locationData.find((loc) => { return loc.country === country; });
    let campaignData = locData.campaignData.find((loc) => { return loc.country === country; });

    let bounds = new google.maps.LatLngBounds();

    if (countryData.regions && countryData.regions.length !== 0) {
      for (let i = 0; i < countryData.regions.length; i++) {
        let region = countryData.regions[i];
        if (region.region === 'no-region' && countryData.regions.length === 1) {
          const center = countryData.pin === undefined ?
            new google.maps.LatLng(26.3351, 17.228331) :
            new google.maps.LatLng(countryData.pin.lat, countryData.pin.lng);
          mapAllLearners.setCenter(center);
          mapAllLearners.setZoom(countryData.pin === undefined ?
            mapZoomFullView : mapZoomCountryView);
          continue;
        }
        if (region.region === 'no-region') continue;
        let campaignRegion = campaignData.regions.find((reg) => {
          return reg.region === region.region; })
        if (!campaignRegion) continue;
        let learnerCount = campaignRegion.learnerCount;
        if (region.hasOwnProperty("streetViews") &&
          learnerCount > 0 &&
          region.streetViews.hasOwnProperty("headingValues") &&
          region.streetViews.headingValues.length > 0 &&
          region.streetViews.hasOwnProperty("locations") &&
          region.streetViews.locations.length > 0) {

          let iconOptions = getIconOptionsBasedOnCount(learnerCount);
          let firstStreetViewLoc = region.streetViews.locations[0];
          let regionMarker = new google.maps.Marker({position:
            { lat: firstStreetViewLoc._latitude,
              lng: firstStreetViewLoc._longitude },
              map: mapAllLearners,
              icon: {url: iconOptions.iconUrl, size: iconOptions.iconSize,
              origin: new google.maps.Point(0, 0),
              anchor: iconOptions.iconAnchor},
              label: { text: learnerCount.toString() }});

          try {
            regionMarker['lat'] = firstStreetViewLoc._latitude;
            regionMarker['lng'] = firstStreetViewLoc._longitude;
            regionMarker['country'] = country;
            regionMarker['facts'] = countryData.facts;
            regionMarker['region'] = region.region;
            regionMarker['heading'] = region.streetViews.headingValues[0];
            regionMarker['otherViews'] = [];
          } catch(e) {
            console.error("caught error: ",e," on region: ", region.region," in country: ", country);
          }
          if (region.streetViews.locations.length > 1 &&
              region.streetViews.locations.length ===
              region.streetViews.headingValues.length) {
            for (let l = 1; l < region.streetViews.locations.length; l++) {
              let loc = region.streetViews.locations[l];
              regionMarker['otherViews'].push({
                lat: loc._latitude,
                lng: loc._longitude,
                h: region.streetViews.headingValues[l]});
            }
          }

          regionMarker.addListener('click', function() {
            let streetView = { lat: regionMarker.lat, lng: regionMarker.lng,
              h: regionMarker.heading };

            if (regionMarker.otherViews &&
              regionMarker.otherViews.length !== 0) {
              let randomValue = Math.floor((Math.random() *
                (regionMarker.otherViews.length - 0 + 1))) + 0;
              if (randomValue !== 0)
                streetView = regionMarker.otherViews[randomValue - 1];
            }

            mapsSharedInfoWindow.setContent(constructInfoWindowContent(
              regionMarker.country,
              regionMarker.region,
              getRandomFact(regionMarker.facts),
              streetView.lat,
              streetView.lng,
              streetView.h));
            mapsSharedInfoWindow.open(mapAllLearners);
            mapsSharedInfoWindow.setPosition(
              {lat: regionMarker.lat, lng: regionMarker.lng});
          });

          loadedMarkers.push(regionMarker);
          bounds.extend(regionMarker.position);
        } else if (region.hasOwnProperty('streetViews') &&
          learnerCount > 0 &&
          region.hasOwnProperty('pin') &&
          region.streetViews.locations.length === 0) {

          let iconOptions = getIconOptionsBasedOnCount(learnerCount);
          let regionMarker = new google.maps.Marker({position:
            { lat: region.pin.lat,
              lng: region.pin.lng },
              map: mapAllLearners,
              icon: {url: iconOptions.iconUrl, size: iconOptions.iconSize,
              origin: new google.maps.Point(0, 0),
              anchor: iconOptions.iconAnchor},
              label: { text: learnerCount.toString() }});

          regionMarker['lat'] = region.pin.lat;
          regionMarker['lng'] = region.pin.lng;
          regionMarker['country'] = country;
          regionMarker['facts'] = countryData.facts;
          regionMarker['region'] = region.region;

          regionMarker.addListener('click', function() {
            mapsSharedInfoWindow.setContent(constructRegionPinWindow(
              regionMarker.country,
              regionMarker.region,
              getRandomFact(regionMarker.facts)));
            mapsSharedInfoWindow.open(mapAllLearners);
            mapsSharedInfoWindow.setPosition(
              {lat: regionMarker.lat, lng: regionMarker.lng});
          });

          loadedMarkers.push(regionMarker);
          bounds.extend(regionMarker.position);
        }
      }
    }
    if (loadedMarkers.length !== 0) {
      mapAllLearners.fitBounds(bounds);
      mapAllLearners.panToBounds(bounds);
    }
  }
}

/**
 * Get aggregate learner count for country from given donation data
 * @param {Array} donationData array of donor's donation data
 * @param {String} country name of the country to aggregate the count for
 */
function getTotalCountryLearnerCountFromDonations(donationData, country) {
  let learnerCount = 0;
  for (let i = 0; i < donationData.length; i++) {
    for (let c = 0; c < donationData[i].data.countries.length; c++) {
      if (donationData[i].data.countries[c].country === country) {
        learnerCount += donationData[i].data.countries[c].learnerCount;
      }
    }
  }
  return learnerCount;
}

/**
 * Get aggregate learner count for country from given donation data
 * @param {Array} donationData array of donor's donation data
 * @param {String} country name of the country to aggregate the count for
 */
function getTotalRegionLearnerCountFromDonations(donationData, country, region) {
  let learnerCount = 0;
  for (let i = 0; i < donationData.length; i++) {
    for (let c = 0; c < donationData[i].data.countries.length; c++) {
      let countryData = donationData[i].data.countries[c];
      if (countryData.country === country) {
        let r = countryData.regions.find((reg) => {
          return reg.region === region; });
        if (r && r.hasOwnProperty('learnerCount')) {
          learnerCount += r.learnerCount;
        }
      }
    }
  }
  return learnerCount;
}

async function displayYourLearnersData(locData, isCountryLevelData, countrySelection = null) {
  if (locData === null) {
    const center = new google.maps.LatLng(0, 0);
    mapYourLearners.setCenter(center);
    mapYourLearners.setZoom(mapZoomFullView);
    return;
  }
  if (mapsSharedInfoWindow)
    mapsSharedInfoWindow.close();

  let locationData = locData.locationData;

  if (isCountryLevelData) {
    for (let key = 0; key < locationData.length; key++) {
      if (locationData[key].country === "no-country") {
        continue;
      }
      let learnerCount =
        getTotalCountryLearnerCountFromDonations(locData.campaignData,
          locationData[key].country);
      let iconOptions = getIconOptionsBasedOnCount(learnerCount);
      let newMarker = new google.maps.Marker({position: locationData[key].pin,
          map: mapYourLearners,
          icon: {url: iconOptions.iconUrl, size: iconOptions.iconSize,
          origin: new google.maps.Point(0, 0),
          anchor: iconOptions.iconAnchor},
          label: { text: learnerCount.toString() }});
      try{
	      newMarker['country'] = locationData[key].country;
	      newMarker['lat'] = locationData[key].pin.lat;
	      newMarker['lng'] = locationData[key].pin.lng;
	      newMarker['facts'] = locationData[key].facts;
      } catch (e) {
	      console.error("caught error: ", e, " on country: ", locationData[key].country);
      }

      newMarker.addListener('click', function() {
        mapsSharedInfoWindow.setContent(
          constructCountryLevelYourLearnersInfoWindow(newMarker.country,
            getRandomFact(newMarker.facts)));
        mapsSharedInfoWindow.open(mapYourLearners);
        mapsSharedInfoWindow.setPosition(
          {lat: newMarker.lat, lng: newMarker.lng});
      });

      loadedYourLearnersMarkers.push(newMarker);
    }

    const center = new google.maps.LatLng(26.3351, 17.228331);
    mapYourLearners.setCenter(center);
    mapYourLearners.setZoom(mapZoomFullView);
  } else {
    let countryData = locationData.find((loc) => {
      return loc.country === countrySelection; });
    let bounds = new google.maps.LatLngBounds();

    console.log(countryData);
    if (countryData.regions && countryData.regions.length !== 0) {
      for (let i = 0; i < countryData.regions.length; i++) {
        let region = countryData.regions[i];
        if (region.region === 'no-region' && countryData.regions.length === 1) {
          const center = countryData.pin === undefined ?
            new google.maps.LatLng(26.3351, 17.228331) :
            new google.maps.LatLng(countryData.pin.lat, countryData.pin.lng);
          mapYourLearners.setCenter(center);
          mapYourLearners.setZoom(countryData.pin === undefined ?
            mapZoomFullView : mapZoomCountryView);
          continue;
        }
        if (region.region === 'no-region') continue;
        let learnerCount = getTotalRegionLearnerCountFromDonations(
          locData.campaignData, countrySelection, region.region);
        if (region.hasOwnProperty("streetViews") &&
          learnerCount > 0 &&
          region.streetViews.hasOwnProperty("headingValues") &&
          region.streetViews.headingValues.length > 0 &&
          region.streetViews.hasOwnProperty("locations") &&
          region.streetViews.locations.length > 0) {
          let iconOptions = getIconOptionsBasedOnCount(learnerCount);
          let firstStreetViewLoc = region.streetViews.locations[0];
          let regionMarker = new google.maps.Marker({position:
            { lat: firstStreetViewLoc._latitude,
              lng: firstStreetViewLoc._longitude },
              map: mapYourLearners,
              icon: {url: iconOptions.iconUrl, size: iconOptions.iconSize,
              origin: new google.maps.Point(0, 0),
              anchor: iconOptions.iconAnchor},
              label: { text: learnerCount.toString() }});

          regionMarker['lat'] = firstStreetViewLoc._latitude;
          regionMarker['lng'] = firstStreetViewLoc._longitude;
          regionMarker['country'] = countryData.country;
          regionMarker['facts'] = countryData.facts;
          regionMarker['region'] = region.region;
          regionMarker['heading'] = region.streetViews.headingValues[0];
          regionMarker['otherViews'] = [];

          if (region.streetViews.locations.length > 1 &&
              region.streetViews.locations.length ===
              region.streetViews.headingValues.length) {
            for (let l = 1; l < region.streetViews.locations.length; l++) {
              let loc = region.streetViews.locations[l];
              regionMarker['otherViews'].push({
                lat: loc._latitude,
                lng: loc._longitude,
                h: region.streetViews.headingValues[l]});
            }
          }

          regionMarker.addListener('click', function() {
            let streetView = { lat: regionMarker.lat, lng: regionMarker.lng,
              h: regionMarker.heading };

            if (regionMarker.otherViews &&
              regionMarker.otherViews.length !== 0) {
              let randomValue = Math.floor((Math.random() *
                (regionMarker.otherViews.length - 0 + 1))) + 0;
              if (randomValue !== 0)
                streetView = regionMarker.otherViews[randomValue - 1];
            }

            mapsSharedInfoWindow.setContent(constructInfoWindowContent(
              regionMarker.country,
              regionMarker.region,
              getRandomFact(regionMarker.facts),
              streetView.lat,
              streetView.lng,
              streetView.h));
            mapsSharedInfoWindow.open(mapYourLearners);
            mapsSharedInfoWindow.setPosition(
              {lat: regionMarker.lat, lng: regionMarker.lng});
          });

          loadedYourLearnersMarkers.push(regionMarker);
          bounds.extend(regionMarker.position);

        } else if (region.hasOwnProperty('streetViews') &&
          learnerCount > 0 &&
          region.hasOwnProperty('pin') &&
          region.streetViews.locations.length === 0) {

          let iconOptions = getIconOptionsBasedOnCount(learnerCount);
          let regionMarker = new google.maps.Marker({position:
            { lat: region.pin.lat,
              lng: region.pin.lng },
              map: mapYourLearners,
              icon: {url: iconOptions.iconUrl, size: iconOptions.iconSize,
              origin: new google.maps.Point(0, 0),
              anchor: iconOptions.iconAnchor},
              label: { text: learnerCount.toString() }});

          regionMarker['lat'] = region.pin.lat;
          regionMarker['lng'] = region.pin.lng;
          regionMarker['country'] = countryData.country;
          regionMarker['facts'] = countryData.facts;
          regionMarker['region'] = region.region;

          regionMarker.addListener('click', function() {
            mapsSharedInfoWindow.setContent(constructRegionPinWindow(
              regionMarker.country,
              regionMarker.region,
              getRandomFact(regionMarker.facts)));
            mapsSharedInfoWindow.open(mapYourLearners);
            mapsSharedInfoWindow.setPosition(
              {lat: regionMarker.lat, lng: regionMarker.lng});
          });

          loadedYourLearnersMarkers.push(regionMarker);
          bounds.extend(regionMarker.position);
        }
      }
    }
    if (loadedYourLearnersMarkers.length !== 0) {
      mapYourLearners.fitBounds(bounds);
      mapYourLearners.panToBounds(bounds);
    }
  }
}

/**
 * Get matching png image and proper size of marker icon based on label count
 * @param {Number} count count
 */
function getIconOptionsBasedOnCount(count) {
  let iconOptions = {
    iconUrl: '/static/imgs/1.png',
    iconSize: new google.maps.Size(52, 52),
    iconAnchor: new google.maps.Point(26, 26)};
  if (count > 10) {
    iconOptions.iconUrl = '/static/imgs/2.png';
    iconOptions.iconSize = new google.maps.Size(56, 55);
    iconOptions.iconAnchor = new google.maps.Point(28, 28);
  }
  if (count > 100) {
    iconOptions.iconUrl = '/static/imgs/3.png';
    iconOptions.iconSize = new google.maps.Size(66, 65);
    iconOptions.iconAnchor = new google.maps.Point(33, 33);
  }
  if (count > 1000) {
    iconOptions.iconUrl = '/static/imgs/4.png';
    iconOptions.iconSize = new google.maps.Size(78, 77);
    iconOptions.iconAnchor = new google.maps.Point(39, 39);
  }
  if (count > 10000) {
    iconOptions.iconUrl = '/static/imgs/5.png';
    iconOptions.iconSize = new google.maps.Size(90, 89);
    iconOptions.iconAnchor = new google.maps.Point(45, 45);
  }
  return iconOptions;
}

/**
 * Constructs and returns info window html string content
 * @param {String} country is the country value
 * @param {String} randomFact is the randomFact value displayed on info window
 * @return {String} content string for the info window
 */
function constructCountryLevelYourLearnersInfoWindow(country, randomFact) {
  const contentString = '<div style=\'text-align: left;\'>' +
    '<span style=\'font-size: 18px; color: #606060\'><b>' +
    country + ' </b></span>' +
    '<br><br> <p style=\'max-width: 300px; color: #505050; font-size: 14px\'>' +
    randomFact + '<br><br><div style="text-align: center">' +
    '<button onclick="onYourLearnersCountryZoomInClick(\''+ country + '\')" class=\'button is-link is-outlined \'>' +
    ' <i class="fas fa-search-plus"></i>&nbsp;&nbsp;Take Me There ' +
    '</button></div>';
  return contentString;
}

/**
 * Constructs and returns info window html string content
 * @param {String} country is the country value
 * @param {String} randomFact is the randomFact value displayed on info window
 * @return {String} content string for the info window
 */
function constructCountryLevelInfoWindow(country, randomFact) {
  const contentString = '<div style=\'text-align: left;\'>' +
    '<span style=\'font-size: 18px; color: #606060\'><b>' +
    country + ' </b></span>' +
    '<br><br> <p style=\'max-width: 300px; color: #505050; font-size: 14px\'>' +
    randomFact + '<br><br><div style="text-align: center">' +
    '<button onclick="onAllLearnersCountryZoomInClick(\''+ country + '\')" class=\'button is-link is-outlined \'>' +
    ' <i class="fas fa-search-plus"></i>&nbsp;&nbsp;Take Me There ' +
    '</button>&nbsp;' +
    '<button onclick="GiveNow()" type=\'button\' class=\'button is-primary \'> Give Now ' +
    '</button></div>';
  return contentString;
}

/**
 * Get region Pin Window content
 * @param {String} country country
 * @param {String} region region
 * @param {String} randomFact fact
 * @return {String} HTML content string
 */
function constructRegionPinWindow(country, region, randomFact) {
  const contentString = '<div style=\'text-align: left;\'>' +
    '<span style=\'font-size: 18px; color: #606060\'><b>' +
    region + ' </b></span>' +
    '<span style=\'font-size: 16px; color: #909090\'><b>(' +
    country + ')</b></span>' +
    '<br><br> <p style=\'max-width: 300px; color: #505050; font-size: 14px\'>' +
    randomFact + '<br><br>';
  return contentString;
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
    '</button> ' +
    '<button onclick="GiveNow()" type=\'button\' class=\'button is-primary \'> Give Now ' +
    '</button>' +
    '</form></div>';
  return contentString;
}

/**
 * Function that's called when clicking the give now button on the map pin info
 * window
 */
function GiveNow() {
  tabSelector.ToggleTab('regions');
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
