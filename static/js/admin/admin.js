"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.App = void 0;
var panoramaRef;
var panoramaId = 'pano';
var countrySelectId = 'countrySelect';
var loadedRegionData = null;
var loadedRandomGeoPoints = null;
var generatedStreetViews = null;
var streetViewService = null;
var pinMap = null;
var loadedPins = [];
var activeButtonId = 'business-metrics-btn';
var deepDiveModal = 'deep-dive-modal';
var deepDiveTitle = 'deep-dive-header-text';
var currentActiveModal = 'cloud-console';
var businessIframes = [
    'biz-ingestion-iframe',
    'biz-donor-iframe',
    'biz-donation-iframe',
];
var dashIframes = [
    'dash-ingestion-iframe',
    'dash-donation-iframe',
    'dash-assignment-iframe',
];
var toastType = {
    primary: 'primary',
    warning: 'warning',
    danger: 'danger',
    link: 'link',
    info: 'info',
    success: 'success'
};
var App = /** @class */ (function () {
    function App() {
    }
    return App;
}());
exports.App = App;
window.onload = function () {
    if (tabSelector) {
        tabSelector.addEventListener('preTabToggle', function (tabId) {
            var selectedBtn = tabId + "-btn";
            if (activeButtonId !== selectedBtn) {
                document.getElementById(activeButtonId)
                    .classList.toggle('is-active');
                document.getElementById(selectedBtn)
                    .classList.toggle('is-active');
                activeButtonId = selectedBtn;
            }
            // reload iFrames to prevent sizing issues
            // if frame was loaded on inactive tag
            switch (tabId) {
                case 'business-metrics':
                    reloadIFrames(businessIframes);
                    break;
                case 'dashboard-metrics':
                    reloadIFrames(dashIframes);
                    break;
            }
        });
    }
    // gets data and update stoplight chart
};
function reloadIFrames(frameList) {
    frameList.forEach(function (frame) {
        var frameElement = document.getElementById(frame);
        frameElement.src = frameElement.src;
    });
}
// **********************Street Views******************************************
/**
 * Entry point after the goolge maps has finished loading on the page
 */
function initializeMaps() {
    streetViewService = new google.maps.StreetViewService();
    panoramaRef = new google.maps.StreetViewPanorama(document.getElementById(panoramaId));
    pinMap = new google.maps.Map(document.getElementById('map-pins'), {
        streetViewControl: false,
        mapTypeControl: false,
        maxZoom: 14
    });
}
/**
 * Requests the server to generate random locations, then sends requests to the
 * Street Views service to get random street view panoramas close to those
 * locations and then displays a list of generated street views.
 */
function OnGenerateStreetViewsClick() {
    var countrySelectElement = document.getElementById(countrySelectId);
    if (countrySelectElement.options.length < 2) {
        showToast(toastType.danger, 'Error, no countries loaded.');
        return;
    }
    if (loadedPins.length > 0) {
        for (var i = 0; i < loadedPins.length; i++) {
            loadedPins[i].setMap(null);
            loadedPins[i] = null;
        }
        loadedPins = [];
    }
    var countrySelection = countrySelectElement.
        options[countrySelectElement.selectedIndex].value;
    if (countrySelection !== 'all-countries' && loadedRegionData === null ||
        countrySelection === 'all-countries') {
        showToast(toastType.danger, 'Please load the region data for selected country.');
        return;
    }
    var radiusElem = document.getElementById('inputRadius');
    var radiusValue = radiusElem.value;
    var countElem = document.getElementById('inputCount');
    var countValue = countElem.value;
    if (radiusValue === NaN || countValue === NaN || countValue === '') {
        showToast(toastType.danger, 'Please fill in radius and count values.');
        return;
    }
    var bounds = new google.maps.LatLngBounds();
    for (var i = 0; i < loadedRegionData.length; i++) {
        var pinData = {
            position: new google.maps.LatLng(loadedRegionData[i].pin.lat, loadedRegionData[i].pin.lng), map: pinMap,
            icon: { url: '/static/imgs/2.png', size: new google.maps.Size(56, 55) },
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(28, 28),
            label: { text: (i + 1).toString() }
        };
        var regionPin = new google.maps.Marker(pinData);
        loadedPins.push(regionPin);
        bounds.extend(regionPin.position);
    }
    $.post('/generateRandomGeoPoints', { country: countrySelection,
        radius: radiusValue, svCount: countValue }, function (data, status) {
        if (data) {
            loadedRandomGeoPoints = data.streetViewGenData;
            console.log(loadedRandomGeoPoints);
            generatedStreetViews = {};
            var regionsParent = document.getElementById('regions');
            regionsParent.innerText = '';
            var _loop_1 = function (i) {
                var region = loadedRegionData[i];
                regionsParent.innerHTML += '<div id="streetView' + i + '">' +
                    '<h1 class="title">' + (i + 1).toString() + ' ' + region.region +
                    '&nbsp;<span style="font-size: 1rem">(Pin: <a href="https://maps.google.com/maps/search/' +
                    region.pin.lat + ',' + region.pin.lng + '" target="_blank">[' +
                    region.pin.lat + ', ' + region.pin.lng + ']' +
                    '</a>)</h1>';
                regionsParent.innerHTML += '<br></div>';
                generatedStreetViews[region.region] = [];
                var svIndex = 0;
                for (var l = 0; l < loadedRandomGeoPoints[region.region].length; l++) {
                    var lat = parseFloat(loadedRandomGeoPoints[region.region][l]
                        .lat.toFixed(6));
                    var lng = parseFloat(loadedRandomGeoPoints[region.region][l]
                        .lng.toFixed(6));
                    streetViewService.getPanoramaByLocation(new google.maps.LatLng(lat, lng), 10000, function (svData, status) {
                        var svRegionParent = document.getElementById('streetView' + i);
                        if (status == google.maps.StreetViewStatus.OK) {
                            // Pano in: svData.location.pano
                            generatedStreetViews[region.region].push({
                                lat: svData.location.latLng.lat(),
                                lng: svData.location.latLng.lng(),
                                h: parseFloat(svData.tiles['centerHeading'].toFixed(2))
                            });
                            var newMarker = new google.maps.Marker({ position: svData.location.latLng, map: pinMap,
                                icon: { url: '/static/imgs/1.png', size: new google.maps.Size(52, 52) },
                                origin: new google.maps.Point(0, 0),
                                anchor: new google.maps.Point(26, 26),
                                label: { text: (svIndex + 1).toString() }
                            });
                            loadedPins.push(newMarker);
                            bounds.extend(newMarker.position);
                            svRegionParent.innerHTML +=
                                '<div class="columns" id=sv' + region.region.split(' ').join('_') + svIndex + ' style="font-size: 1rem"><h2 class="subtitle column is-two-fifths" style="margin-left: 1rem">Street View ' +
                                    (svIndex + 1).toString() + '<span> <a href="https://maps.google.com/maps/search/' +
                                    svData.location.latLng.lat() + ', ' + svData.location.latLng.lng() +
                                    '" target="_blank">[ ' + svData.location.latLng.lat() +
                                    ', ' + svData.location.latLng.lng() + ' ]</a></span></h2><span class="column"><button class="button"' +
                                    'onclick="showGeneratedStreetView(\'' + region.region + '\', ' + svIndex + ')"> Open Street View </button></span>' +
                                    '<span class="column"><button class="button" onclick="saveSingleStreetViewInDB(\'' +
                                    region.region + '\', ' + svIndex + ')"> Save in DB </button></span>' +
                                    '<span class="column"><button class="button is-danger" onclick="removeGeneratedStreetView(\'' +
                                    region.region + '\', ' + svIndex + ')"> X </button><span></div>';
                            svIndex++;
                        }
                        else {
                            generatedStreetViews[region.region].push({
                                lat: null,
                                lng: null,
                                h: 180
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
            };
            for (var i = 0; i < loadedRegionData.length; i++) {
                _loop_1(i);
            }
            showToast(toastType.success, 'Street view generation complete.');
        }
    });
}
/**
 * Called when the user attempts to toggle the map that displays pins
 */
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
    var sv = [];
    var countrySelectElement = document.getElementById(countrySelectId);
    var countrySelection = countrySelectElement.
        options[countrySelectElement.selectedIndex].value;
    for (var region in generatedStreetViews) {
        if (generatedStreetViews.hasOwnProperty(region)) {
            sv.push({ country: countrySelection,
                region: region, svData: generatedStreetViews[region] });
        }
    }
    $.post('/saveStreetView', { sv: sv }, function (data, status) {
        if (data.message === 'success') {
            showToast(toastType.success, 'Street views saved!');
        }
        else if (data.message === 'failure') {
            showToast(toastType.danger, 'Failed to save street views!');
        }
    });
}
/**
 * Called when the user attempts to load all countries
 */
function OnLoadCountriesClick() {
    var countrySelectElement = document.getElementById(countrySelectId);
    if (countrySelectElement.options.length > 2) {
        return;
    }
    $.post('/getAllCountriesList', {}, function (data, status) {
        if (data) {
            var countryNames = data.countryNames;
            countrySelectElement.options = [];
            countrySelectElement.options[0] =
                new Option('All Countries', 'all-countries');
            for (var i = 0; i < countryNames.length; i++) {
                var country = countryNames[i];
                if (country !== 'no-country') {
                    countrySelectElement.add(new Option(country, country));
                }
            }
            showToast(toastType.success, 'Countries Loaded!');
        }
        else {
            showToast(toastType.danger, 'Error loading countries, please refresh the page.');
        }
    });
}
/**
 * Called when the user attempt to load country regions
 */
function OnLoadCountryRegionsClick() {
    var countrySelectElement = document.getElementById(countrySelectId);
    if (countrySelectElement.options.length < 2) {
        showToast(toastType.danger, 'Load the country data from DB and select a country.');
        return;
    }
    var countrySelection = countrySelectElement.
        options[countrySelectElement.selectedIndex].value;
    if (countrySelection === 'all-countries') {
        showToast(toastType.danger, 'Please select country from the dropdown.');
        return;
    }
    $.post('/getAllCountryRegions', { country: countrySelection }, function (data, status) {
        if (data) {
            var regionData = data.regionData;
            loadedRegionData = regionData;
            var regionsParent = document.getElementById('regions');
            regionsParent.innerText = '';
            for (var i = 0; i < regionData.length; i++) {
                var region = regionData[i];
                regionsParent.innerHTML += '<div id="streetView' + i + '">' +
                    '<h1 class="title">' + region.region +
                    '&nbsp;<span style="font-size: 1rem">' +
                    '(Pin: <a href="https://maps.google.com/maps/search/' +
                    region.pin.lat + ',' + region.pin.lng + '" target="_blank">[' +
                    region.pin.lat + ', ' + region.pin.lng + '])' +
                    '</h1>';
                regionsParent.innerHTML += '<br>';
                for (var v = 0; v < region.streetViews.locations.length; v++) {
                    regionsParent.innerHTML +=
                        '<h2 class="subtitle" style="margin-left: 1rem">Street View ' +
                            v + '</span>&nbsp;&nbsp;&nbsp;<button class="button"' +
                            'onclick="showLoadedStreetView(' + i + ', ' + v +
                            ')"> Open Street View </button> <br>';
                }
                regionsParent.innerHTML += '</div>';
            }
            showToast(toastType.success, 'Regions loaded from DB.');
        }
        else {
            showToast(toastType.danger, 'Error loading regions for country from DB.');
        }
    });
}
/**
 * Show a street view in panorama element loaded from DB
 * @param {Number} regionIndex Index of the region
 * @param {Number} streetViewIndex Index of the street view within region
 */
function showLoadedStreetView(regionIndex, streetViewIndex) {
    panoramaRef = new google.maps.StreetViewPanorama(document.getElementById(panoramaId), {
        position: { lat: loadedRegionData[regionIndex].streetViews
                .locations[streetViewIndex]['_latitude'],
            lng: loadedRegionData[regionIndex].streetViews
                .locations[streetViewIndex]['_longitude'] },
        pov: {
            heading: 180,
            pitch: 10
        }
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
            lng: generatedStreetViews[region][streetViewIndex].lng
        },
        pov: {
            heading: generatedStreetViews[region][streetViewIndex].h,
            pitch: 10
        }
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
        var svElement = document.getElementById('sv' +
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
    var sv = generatedStreetViews[region][streetViewIndex];
    var countrySelectElement = document.getElementById(countrySelectId);
    var countrySelection = countrySelectElement.
        options[countrySelectElement.selectedIndex].value;
    $.post('/saveStreetView', { sv: [{ country: countrySelection, region: region,
                svData: [sv] }] }, function (data, status) {
        if (data.message === 'success') {
            showToast(toastType.success, 'Street view saved!');
        }
        else if (data.message === 'failure') {
            showToast(toastType.danger, 'Failed to save the street view!');
        }
    });
}
// *************************Status Page****************************************
var dropdown = document.querySelector('.dropdown');
dropdown.addEventListener('click', function (event) {
    event.stopPropagation();
    dropdown.classList.toggle('is-active');
});
dropdown.addEventListener('focusout', function (event) {
    event.stopPropagation();
    dropdown.classList.remove('is-active');
});
/**
 * Configure the Deep Dive Modal based on which service was selected
 * @param {String} service The service selected by the user
 */
function onServiceSelected(service) {
    document.getElementById(deepDiveModal).classList.add('is-active');
    document.getElementById(deepDiveTitle).innerHTML = "Deep Dive: " + service;
    if (currentActiveModal !== service + "-console") {
        document.getElementById(currentActiveModal).classList.add('is-hidden');
        currentActiveModal = service + "-console";
        document.getElementById(currentActiveModal).classList.remove('is-hidden');
    }
}
function getStoplightData() {
    return __awaiter(this, void 0, void 0, function () {
        var postmanData, stripeData, cloudData, firestoreData, serverData, cronData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getPostmanData()];
                case 1:
                    postmanData = _a.sent();
                    updateStoplightCell('postman', postmanData.status);
                    return [4 /*yield*/, getStripeData()];
                case 2:
                    stripeData = _a.sent();
                    updateStoplightCell('stripe', stripeData.status);
                    return [4 /*yield*/, getCloudData()];
                case 3:
                    cloudData = _a.sent();
                    updateStoplightCell('cloud', cloudData.status);
                    return [4 /*yield*/, getFirestoreData()];
                case 4:
                    firestoreData = _a.sent();
                    updateStoplightCell('firestore', firestoreData.status);
                    return [4 /*yield*/, getServerData()];
                case 5:
                    serverData = _a.sent();
                    updateStoplightCell('server', serverData.status);
                    return [4 /*yield*/, getCronData()];
                case 6:
                    cronData = _a.sent();
                    updateStoplightCell('cron', getCronData.status);
                    return [2 /*return*/];
            }
        });
    });
}
function getPostmanData() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/];
        });
    });
}
function getStripeData() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/];
        });
    });
}
function getCloudData() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/];
        });
    });
}
function updateStoplightCell(cell, status) {
}
// *************************Helper Functions***********************************
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
        animate: { "in": 'fadeIn', out: 'fadeOut' }
    });
}
