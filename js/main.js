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
    },
    onTargetChange: function(model, value){
        var icon = value ? redIcon : greyIcon;
        var zIndex = value ? 100 : 1;
        this.marker.setIcon(icon);
        this.marker.setZIndex(zIndex);
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
                lat: latLng.lat(),
                lng: latLng.lng(),
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
    },

    getBounds: function(){
        var bounds = new google.maps.LatLngBounds()
        for(var i = 0, model; model = this.models[i]; i++){
            bounds.extend(model.get('latLng'));
        }
        return bounds;
    }

});


// $APP -----------------------------------------------------------------------

window.App = {
    journey: new Journey(),
    initialize: function(){
        this.initMap();
        this.journey.on('reset', this.onJourneyReset, this);
        this.journey.fetch("51.523550, -0.111076", "51.520515, -0.105048");
    },
    initMap: function(){
        this.map = new google.maps.Map(document.getElementById('map'), {
            center: {lat: 51.523550, lng: -0.111076 },
            zoom: 12
        });
    },
    onJourneyReset: function(){
        this.map.fitBounds(this.journey.getBounds());
    }
}

App.initialize();

