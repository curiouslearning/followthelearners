var mapRefs = [];
const mapParentElement = 'map-display';
const mapZoomLevel = 5;
let mapsSharedInfoWindow = null;

/**
 * Callback for Google Maps deferred load that initializes the map
 */
function InitializeMaps()
{
    var url_string = window.location.href;
    var url = new URL(url_string);
    var paramValue = url.searchParams.get('[email]');
    console.log("found email: ", paramValue);
    let mapParents = document.getElementsByClassName(mapParentElement)
    if (mapParents != [])
    {
      for (var i = 0; i < mapParents.length; i++) {
        let campaign = $(mapParents[i]).attr('id');
        console.log("creating map for ", campaign)
        mapRefs.push(new google.maps.Map(mapParents[i], {
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false
        }));
        let mapRef = mapRefs[i]
        mapsSharedInfoWindow = new google.maps.InfoWindow();

        $(document).ready(function ()
        {
            $.get("/viewData", { email: paramValue, campaign: campaign}, function (data, status)
            {
                DisplayClusteredData(data.locations, mapRef);
            });
        });
      }
    }
}

/**
 * Displays the clustered location data on maps
 * @param {Array} locationData is an array of lat, lng objects [{lat: -31.56, lng: 147.15}]
 */
function DisplayClusteredData(locationData, mapRef)
{
    var labelNumber = 0;

    var bounds = new google.maps.LatLngBounds();
    var markers = locationData.map(function (location, i)
    {
      if(location.hasOwnProperty('lat') && !isNaN(location.lat)) {
        var newMarker = new google.maps.Marker({ position: location });
        bounds.extend(newMarker.position);

        newMarker.addListener('click', function()
        {
            mapsSharedInfoWindow.setContent(constructInfoWindowContent(
                "Australia",
                "Sydney",
                "Random Fact. Random Fact. Random Fact. Random Fact. Random Fact. Random Fact. Random Fact.",
                sanitizedLocation.lat,
                sanitizedLocation.lng,
                180));
            mapsSharedInfoWindow.open(mapRef, newMarker);
        });

        return newMarker;
      }
      var newMarker = new google.maps.Marker({position: {lat: 0, lng: 0}});
      bounds.extend(newMarker.position);
      return newMarker
    });

    var markerCluster = new MarkerClusterer(mapRef, markers,
    {
        imagePath: '/static/imgs/'
    });
    mapRef.fitBounds(bounds);
    mapRef.setZoom(mapZoomLevel);
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
