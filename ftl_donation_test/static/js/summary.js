var mapRef = null;
const mapParentElement = document.getElementById('map-display');
const mapZoomLevel = 6;

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
    }
    var url_string = window.location.href;
    var url = new URL(url_string);
    var paramValue = url.searchParams.get("email");
    $(document).ready(function () 
    {
        $.post("/viewData", { email: paramValue}, function (data, status) 
        {
            DisplayClusteredData(data.locations);
        });
    });
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
        let sanitizedLocation = { lat: location._latitude, lng: location._longitude };
        var newMarker = new google.maps.Marker({ position: sanitizedLocation });
        bounds.extend(newMarker.position);

        return newMarker;
    });

    var markerCluster = new MarkerClusterer(mapRef, markers, 
    {
        imagePath: '/static/imgs/'
    });

    mapRef.fitBounds(bounds);
    mapRef.setZoom(mapZoomLevel);
}