// $GLOBALS -----------------------------------------------------------------------

var PROXIMITY = 15;

function toRadians(int){
    return (Math.PI / 180) * int;
}

function toDegrees(int){
    return int / (Math.PI/180);
}

function normaliseDegree(degree){
    //console.log(degree);
    if(degree > 360){
        return degree - 360;
    }
    else if(degree < 0){
        return 360 + degree;
    }
    return degree;
}

// Cache some selectors

var heading = document.getElementById('heading');
var bearing = document.getElementById('bearing');
var direction = document.getElementById('direction');
var needle = document.getElementById('needle');
var needleContainer = document.getElementById('needle-container');
var debugContainer = document.getElementById('debug-container');

// $DEBUG -----------------------------------------------------------------------

var needleShow = true;

needleContainer.addEventListener('click', function(){
    if(needleShow == true){
        needleContainer.style.opacity = '0';
        debugContainer.style.opacity = '1'
        needleShow = false;
    }
    else {
        needleContainer.style.opacity = '1';
        debugContainer.style.opacity = '0'
        needleShow = true;
    }
})


// $WAYPOINT -----------------------------------------------------------------------

var redIcon = { url: "img/marker-red.png", scaledSize: new google.maps.Size(13, 20) };
var greyIcon = { url: "img/marker-grey.png", scaledSize: new google.maps.Size(13, 20) };

var Waypoint = Backbone.Model.extend({
    initialize: function(){
        this.marker = new google.maps.Marker({
            position: this.attributes.latLng,
            map: App.map,
            icon: greyIcon,
            zIndex: 1,
        })
        this.on('change:target', this.onTargetChange, this);
        this.on('remove', this.onRemoved, this);
    },
    onTargetChange: function(model, value){
        var icon = value ? redIcon : greyIcon;
        var zIndex = value ? 100 : 1;
        this.marker.setIcon(icon);
        this.marker.setZIndex(zIndex);
    },
    distanceTo: function(position){
        var lat1 = toRadians(this.attributes.latitude),
            lat2 = toRadians(position.latitude),
            lng1 = toRadians(this.attributes.longitude),
            lng2 = toRadians(position.longitude),
            haversine = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((lat1 - lat2) / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lng1 - lng2) / 2), 2)));
        return haversine * 6378137;
    },
    onRemoved: function(){
        this.marker.setMap(null);
    }
});

// $JOURNEY -----------------------------------------------------------------------

var Journey = Backbone.Collection.extend({

    model: Waypoint,
    bearing: 0,

    initialize: function(){
        _.bindAll(this, 'onRouteRecieved');
    },

    fetch: function(from, to){
        new google.maps.DirectionsService().route({
            origin: from,
            destination: to,
            travelMode: google.maps.TravelMode.WALKING
        }, this.onRouteRecieved);
    },

    onRouteRecieved: function(result){
        var route = _.map(result.routes[0].overview_path, function(latLng){
            return {
                latitude: latLng.lat(),
                longitude: latLng.lng(),
                latLng: latLng
            }
        });
        this.reset(route);
        this.setTarget(0);
    },

    setTarget: function(index){
        if(this.currentTarget){
            this.currentTarget.set('target', null);
        }
        this.currentTarget = this.at(index);
        this.currentTarget.set('target', true);
        while(index > 0){
            this.remove(this.at(index-1));
            index--;
        }
    },

    getBounds: function(){
        var bounds = new google.maps.LatLngBounds()
        for(var i = 0, model; model = this.models[i]; i++){
            bounds.extend(model.get('latLng'));
        }
        return bounds;
    },

    updatePosition: function(position){
        for(var i = this.length-1, model; model = this.models[i]; i--){
            if(model.distanceTo(position) < PROXIMITY){
                this.setTarget(i + 1);
                break;
            }
        }
        this.updateBearing(position);
    },

    updateBearing: function(position){
        this.bearing = App.position.bearingTo(this.currentTarget)
        bearing.innerHTML = this.bearing;
    }

});


function Compass(){
    this.rotation = 0;
    this.heading = 0;
     _.bindAll(this, 'onCompassUpdate', 'onCompassError');
    navigator.compass.watchHeading(this.onCompassUpdate, this.onCompassError);
}

Compass.prototype.onCompassUpdate = function(reading){
    this.heading = normaliseDegree(reading.trueHeading);
    heading.innerHTML = this.heading;

    var needleDirection = Math.round(App.journey.bearing - this.heading);
    needleDirection = normaliseDegree(needleDirection);
    direction.innerHTML = needleDirection;
    this.spinNeedle(needleDirection);
}

Compass.prototype.spinNeedle = function(nR) {
    var aR;
    aR = this.rotation % 360;
    if ( aR < 0 ) { aR += 360; }
    if ( aR < 180 && (nR > (aR + 180)) ) { this.rotation -= 360; }
    if ( aR >= 180 && (nR <= (aR - 180)) ) { this.rotation += 360; }
    this.rotation += (nR - aR);
    needle.style.webkitTransform = "rotate(" + this.rotation + "deg)";
}

Compass.prototype.onCompassError = function(){
    console.log(arguments);
}

var Position = Backbone.Model.extend({
    initialize: function(){
        this.circle = new google.maps.Circle({
            strokeWeight: 0,
            fillColor: '#FF0000',
            map: App.map,
            radius: PROXIMITY
        });
        _.bindAll(this, 'onPositionUpdate', 'onPositionError');
        navigator.geolocation.watchPosition(this.onPositionUpdate, this.onPositionError, {enableHighAccuracy: true});
    },
    onPositionUpdate: function(position){
        this.set("position", position.coords);
        var center = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        }
        this.circle.setCenter(center)
        App.map.setCenter(center)
    },
    onPositionError: function(e){
        this.position.set("position", {
            latitude: e.latLng.lat(),
            longitude: e.latLng.lng()
        })
    },
    bearingTo: function(target){
        var lat1 = toRadians(this.attributes.position.latitude),
            long1 = toRadians(this.attributes.position.longitude),
            lat2 = toRadians(target.attributes.latitude),
            long2 = toRadians(target.attributes.longitude);
        var y = Math.sin(long2-long1) * Math.cos(lat2);
        var x = Math.cos(lat1) * Math.sin(lat2) -
                Math.sin(lat1) * Math.cos(lat2) * Math.cos(long2-long1);
        var bearing = Math.atan2(y, x);
            bearing = toDegrees(bearing);
        if(bearing < 0) bearing += 360;
        else if(bearing > 360) bearing -= 360;
        return bearing;
    }
})


// $APP -----------------------------------------------------------------------

window.App = {

    initialize: function(){
        this.initMap();
        this.initJourney();
        this.initPosition();
        this.initCompass();
        this.journey.on('reset', this.onJourneyReset, this);
        this.journey.fetch("51.528440, -0.106789", "51.520515, -0.105048");
    },
    initMap: function(){

        this.map = new google.maps.Map(document.getElementById('map'), {
            zoom: 19
        });
        var ctx = this;
        google.maps.event.addListener(this.map, 'click', function(e) {
            ctx.position.onPositionUpdate({
                coords: {
                    latitude: e.latLng.lat(),
                    longitude: e.latLng.lng()
                }
            })
        });
    },
    initJourney: function(){
        this.journey = new Journey()
    },
    initPosition: function(){
        this.position = new Position()
        this.position.on('change:position', this.onPositionChange, this);
    },
    initCompass: function(){
        this.compass = new Compass();
    },
    onPositionChange: function(model, value){
        this.journey.updatePosition(value);
    }
}

document.addEventListener("deviceready", function(){
    App.initialize();
}, false);