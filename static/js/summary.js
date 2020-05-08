var mapRefs = [];
const staticMapZoomLevel = 2;
let mapsSharedInfoWindow = null;
const mapParentElement = 'map-display';
let campaignSelectElement = null;

let tabButtonsParent = null;
let tabsParent = null;

/**
 * Callback for Google Maps deferred load that initializes the map
 */
function InitializeMaps()
{
    var targetEmail = getURLParam('[e]');
    if (targetEmail)
    {
        console.log("Target E-mail: ", targetEmail);
    }
    else
    {
        window.location.href = "/";
    }

    let mapParents = document.getElementsByClassName(mapParentElement);
    campaignSelectElement = document.getElementById('campaignSelection');
    tabButtonsParent = document.getElementById('tab-buttons');
    tabsParent = document.getElementById('tabs-parent');

    if (mapParents != [])
    {
      for (var i = 0; i < mapParents.length; i++) {
        let campaign = $(mapParents[i]).attr('id');
        console.log("creating map for ", campaign)
        mapRefs.push(new google.maps.Map(mapParents[i], {
            streetViewControl: false,
            mapTypeControl: false
        }));
        let mapRef = mapRefs[i]
        mapsSharedInfoWindow = new google.maps.InfoWindow();

        $(document).ready(function ()
        {
            $.get("/viewData", { email: targetEmail, campaign: campaign}, function (data, status)
            {
                DisplayClusteredData(data, mapRef);
            });
        });
      }
    }
}

function ToggleTab(tabIndex)
{
    if (tabButtonsParent && tabsParent)
    {
        var tabButtons = tabButtonsParent.children;
        var tabs = tabsParent.children;
        if (tabButtons.length !== tabs.length)
        {
            console.log("Number of tab buttons and tabs are not equal.");
            return;
        }
        for (var i = 0; i < tabButtons.length; i++)
        {
            if (i === tabIndex)
            {
                tabButtons[i].classList.add('is-dark');
                tabs[i].classList.remove('is-hidden');
            }
            else
            {
                tabButtons[i].classList.remove('is-dark');
                tabs[i].classList.add('is-hidden');
            }
        }
    }
}

function OnCampaignSelectionChanged()
{
    if (campaignSelectElement)
    {
        console.log(campaignSelectElement.value);
    }
}

/**
 * Displays the clustered location data on maps
 * @param {Array} locationData is an array of lat, lng objects [{lat: -31.56, lng: 147.15}]
 */
function DisplayClusteredData(locationData, mapRef)
{
    console.log("Loc data: " + locationData);
    if (locationData.length == 0)
    {
        var center = new google.maps.LatLng(0, 0);
        mapRef.setCenter(center);
        mapRef.setZoom(staticMapZoomLevel);
        return;
    }

    var bounds = new google.maps.LatLngBounds();

    var markers = locationData.coords.map(function (location, i)
    {
        if (location.hasOwnProperty('lat') && !isNaN(location.lat))
        {
            var newMarker = new google.maps.Marker({ position: location });
            bounds.extend(newMarker.position);
            newMarker["country"] = locationData.country;
    
            newMarker.addListener('click', function()
            {
                mapsSharedInfoWindow.setContent(constructInfoWindowContent(
                    newMarker.country,
                    "Bihar",
                    "Fact about Bihar.",
                    location.lat,
                    location.lng,
                    180));
                mapsSharedInfoWindow.open(mapRef);
                mapsSharedInfoWindow.setPosition(newMarker.getPosition());
            });
    
            return newMarker;
        }
        var newMarker = new google.maps.Marker({position: {lat: 0, lng: 0}});
        bounds.extend(newMarker.position);
        return newMarker;
    });

    var markerCluster = new MarkerClusterer(mapRef, markers,
    {
        imagePath: '/static/imgs/',
        zoomOnClick: false
    });

    markerCluster.addListener("clusterclick", function(cluster)
    {
        var currentCluster = cluster.getMarkers();
        console.log(currentCluster);
        if (currentCluster.length > 0)
        {
            var randomMarkerIndex = Math.floor((Math.random() * currentCluster.length));
            console.log(randomMarkerIndex);
            var randomMarker = currentCluster[randomMarkerIndex];
            var content = constructInfoWindowContent(
                randomMarker.country,
                "Bihar",
                "Fact about Bihar.",
                randomMarker.getPosition().lat(),
                randomMarker.getPosition().lng(),
                180);
            mapsSharedInfoWindow.setContent(content);
            mapsSharedInfoWindow.open(mapRef);
            mapsSharedInfoWindow.setPosition(randomMarker.getPosition());
        }
    });
    mapRef.fitBounds(bounds);
    mapRef.panToBounds(bounds);
}

function constructInfoWindowContent(country, region, randomFact, latitude, longitude, heading)
{
    var contentString = "<div style='text-align: left;'>" +
                "<span style='font-size: 18px; color: #606060'><b>" + region + " </b></span>" +
                "<span style='font-size: 16px; color: #909090'><b>(" + country + ")</b></span>" +
                "<br><br> <p style='max-width: 280px; color: #505050'>" + randomFact +
                "</p> <br> <form action='https://google.com/maps/@?' method='get' target='_blank' style='text-align: center;'>" +
                "<input type='hidden' name='api' value='1'></input>" +
                "<input type='hidden' name='map_action' value='pano'></input>" +
                "<input type='hidden' name='viewpoint' value='" + latitude + "," + longitude + "'></input>" +
                "<input type='hidden' name='heading' value='" + heading + "'></input>" +
                "<button type='submit' class='button is-link is-outlined '> Take Me There </button></form></div>";
    return contentString;
}

function getURLParam(paramKey)
{
    var url_string = window.location.href;
    var url = new URL(url_string);
    return url.searchParams.get(paramKey);
}
