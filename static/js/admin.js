let panorama;

function initializeMaps() {
  const geocoder = new google.maps.Geocoder();
  const address = '666 5th avenue, New York, NY 10019';
  const locations = [{lat: 41.720744, lng: 44.7939683},
    {lat: 34.352865, lng: 62.20402869999999},
    {lat: 34.1718313, lng: 70.6216794}];
  const svService = new google.maps.StreetViewService();
  panorama = new google.maps.StreetViewPanorama(
      document.getElementById('pano'));
  geocoder.geocode({'address': address}, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
      latLng = results[0].geometry.location;
      console.log(google.maps.LatLng);
      svService.getPanoramaByLocation(new google.maps.LatLng(locations[0].lat,
          locations[0].lng), 50, showPanorama);
    }
  });
}

function showPanorama(svData, status) {
  if (status == google.maps.StreetViewStatus.OK) {
    panorama.setPano(svData.location.pano);
    console.log(svData, svData.location, svData.location.latLng.lat(),
        svData.location.latLng.lng(), svData.location.pano);
    panorama.setVisible(true);
  } else {
    console.log("Street View data not found for this location." + svData);
  }
}
