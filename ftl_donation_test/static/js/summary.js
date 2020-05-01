var mapRef = null;
const mapParentElement = document.getElementById('map-display');
const mapZoomLevel = 5;
let mapsSharedInfoWindow = null;

/**
 * Callback for Google Maps deferred load that initializes the map
 */
function InitializeMaps()
{
    if (mapParentElement)
    {
        mapRef = new google.maps.Map(mapParentElement,
        {
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false
        });
        mapsSharedInfoWindow = new google.maps.InfoWindow();
    }
    var url_string = window.location.href;
    var url = new URL(url_string);
    var paramValue = url.searchParams.get('[email]');
    console.log("found email: ", paramValue);
    DisplayClusteredData([
        {lat: -31.563910, lng: 147.154312},
        {lat: -33.718234, lng: 150.363181},
        {lat: -33.727111, lng: 150.371124},
        {lat: -33.848588, lng: 151.209834},
        {lat: -33.851702, lng: 151.216968},
        {lat: -34.671264, lng: 150.863657},
        {lat: -35.304724, lng: 148.662905},
        {lat: -36.817685, lng: 175.699196},
        {lat: -36.828611, lng: 175.790222},
        {lat: -37.750000, lng: 145.116667},
        {lat: -37.759859, lng: 145.128708},
        {lat: -37.765015, lng: 145.133858},
        {lat: -37.770104, lng: 145.143299},
        {lat: -37.773700, lng: 145.145187},
        {lat: -37.774785, lng: 145.137978},
        {lat: -37.819616, lng: 144.968119},
        {lat: -38.330766, lng: 144.695692},
        {lat: -39.927193, lng: 175.053218},
        {lat: -41.330162, lng: 174.865694},
        {lat: -42.734358, lng: 147.439506},
        {lat: -42.734358, lng: 147.501315},
        {lat: -42.735258, lng: 147.438000},
        {lat: -43.999792, lng: 170.463352}
      ]);
    // $(document).ready(function ()
    // {
    //     $.get("/viewData", { email: paramValue}, function (data, status)
    //     {
    //         DisplayClusteredData(data.locations);
    //     });
    // });
}

/**
 * Displays the clustered location data on maps
 * @param {Array} locationData is an array of lat, lng objects [{lat: -31.56, lng: 147.15}]
 */
function DisplayClusteredData(locationData)
{
    var labelNumber = 0;

    var bounds = new google.maps.LatLngBounds();

    var markers = locationData.map(function (location, i)
    {
        let sanitizedLocation = { lat: location.lat, lng: location.lng };
        var newMarker = new google.maps.Marker({ position: sanitizedLocation });
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
    });

    var markerCluster = new MarkerClusterer(mapRef, markers,
    {
        imagePath: '/static/imgs/',
        zoomOnClick: false
    });

    markerCluster.addListener("clusterclick", function()
    {
        var currentCluster = markerCluster.getMarkers();
        console.log(currentCluster);
        if (currentCluster.length === 0)
        {
            console.log("There are no markers in this cluster, how did we get here.");
        }
        else
        {
            var firstMarker = currentCluster[0];
            // mapsSharedInfoWindow.setContent(constructInfoWindowContent(
            //     "Australia",
            //     "Sydney",
            //     "Random Fact. Random Fact. Random Fact. Random Fact. Random Fact. Random Fact. Random Fact.",
            //     sanitizedLocation.lat,
            //     sanitizedLocation.lng,
            //     180));
            // mapsSharedInfoWindow.open(mapRef, newMarker);
        }
    });

    mapRef.fitBounds(bounds);
    mapRef.panToBounds(bounds);
    // mapRef.setZoom(mapZoomLevel);
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
