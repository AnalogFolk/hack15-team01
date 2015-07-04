// $GLOBALS -----------------------------------------------------------------------

var PROXIMITY = 10;

function toRadians(int){
    return (Math.PI / 180) * int;
}

function toDegrees(int){
    return int / (Math.PI/180);
}

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
    }

});

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
    }
})


// $APP -----------------------------------------------------------------------

window.App = {

    initialize: function(){
        this.initMap();
        this.initJourney();
        this.initPosition();
        this.journey.on('reset', this.onJourneyReset, this);
        this.journey.fetch("51.523550, -0.111076", "51.520515, -0.105048");
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
    onPositionChange: function(model, value){
        this.journey.updatePosition(value);
    }
}

App.initialize();

