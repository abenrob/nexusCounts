var outcenter = [15,-6];
var incenter = [45, -100]

// define leaflet map
var map = L.map('map',{
    zoomControl: false,
    attributionControl: false,
    center: incenter,
    zoom: 3
});

// define tiles and add to map
var CartoDB_DarkMatterNoLabels = L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png', {
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
	subdomains: 'abcd',
	minZoom: 0,
	maxZoom: 18
}).addTo(map);

// define torque styling/behavior
var style = [
    'Map {',
    '-torque-frame-count:1024;',
    '-torque-animation-duration:50;',
    '-torque-time-attribute:"loc_date";',
    '-torque-aggregation-function:"count(cartodb_id)";',
    '-torque-resolution:2;',
    '-torque-data-aggregation:cumulative;',
    '}',
    '#timestamped_locations{',
    'comp-op: lighter;',
    'marker-fill-opacity: 0.2;',
    'marker-line-color: #FFF;',
    'marker-line-width: 0.5;',
    'marker-line-opacity: 0.5;',
    'marker-type: ellipse;',
    'marker-width: 2;',
    'marker-fill: #09929e;',
    '}',
    '#timestamped_locations[frame-offset=1] {',
    'marker-width:4;',
    'marker-fill-opacity:0.1; ',
    'marker-line-width: 0;',
    'marker-line-opacity: 0;',
    '}',
    '#timestamped_locations[frame-offset=2] {',
    'marker-width:6;',
    'marker-fill-opacity:0.05; ',
    'marker-line-width: 0;',
    'marker-line-opacity: 0;',
    '}',
    '#timestamped_locations[frame-offset=3] {',
    'marker-width:8;',
    'marker-fill-opacity:0.03333333333333333; ',
    'marker-line-width: 0;',
    'marker-line-opacity: 0;',
    '}',
    '#timestamped_locations[frame-offset=4] {',
    'marker-width:10;',
    'marker-fill-opacity:0.025; ',
    'marker-line-width: 0;',
    'marker-line-opacity: 0;',
    '}',
    '#timestamped_locations[frame-offset=5] {',
    'marker-width:12;',
    'marker-fill-opacity:0.02; ',
    'marker-line-width: 0;',
    'marker-line-opacity: 0;',
    '}',
    '#timestamped_locations[frame-offset=6] {',
    'marker-width:14;',
    'marker-fill-opacity:0.016666666666666666; ',
    'marker-line-width: 0;',
    'marker-line-opacity: 0;',
    '}'
].join('\n');

var torqueLayer;
var counts = [];
var curTot = 0;
var firstDay, lastDay, numDays;

// function that defines torque layer and adds to map
function setTorque(){
    torqueLayer = new L.TorqueLayer({
        user: 'nexuscarto',
        table: 'all_locations',
        cartocss: style,
        blendmode: 'lighter',
        tiler_protocol: 'https',
        loop: false,
        tiler_port: 443
    });

    torqueLayer.addTo(map);
};

// function that initializes torque layer
function playTorque(){
    var curTot = 0;
    var curCountries = 0;
    // start at the beginning
    torqueLayer.setStep(1);
    // do stuff every time the frame changes
    torqueLayer.on('change:time', function(changes) {
        var torqueEpoch = changes.time.getTime();

        var tYear = changes.time.getFullYear()||firstDay.getFullYear();
        var tMonth = (changes.time.getMonth()||firstDay.getMonth())+1;
        tMonth = tMonth ? tMonth : 0;
        if (tMonth < 10){tMonth = '0'+tMonth};

        // find count stats for current frame
        // var match = _.find(counts, function(rec){
        //     var thisDate = new Date(rec[0]).toDateString();
        //     return thisDate == torqueDate;
        // });

        var lessOrEqual = _.filter(counts, function(rec){
            return rec[0] <= torqueEpoch;
        });

        var match;
        match = _.max(lessOrEqual, function(rec){
            return rec[1];
        });

        //if we find a match, update counters
        if (match) {
            curTot = match[1];
            curCountries = match[2];
        }

        // update couter text
        $('#counter').removeClass('hidden');
        $('#curYear').html(tYear+"/"+tMonth);
        $('#curCount').html(curTot.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));
        $('#curCountries').html(curCountries.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));
        // when we hit max
        if (changes.step === torqueLayer.options.steps) {
            // remove change watch
            torqueLayer.off('change:time');
            // pause in case changes object catches max before pauseMax
            torqueLayer.pause();
            // fade in play control after 3 seconds
            window.setTimeout(function(){
                map.setView(outcenter,2);
                window.setTimeout(function(){
                    $('#rePlayControl').fadeIn();
                },3000);
            },2000);
        }
    });

    torqueLayer.play();
    $('#playControl').fadeOut();
    $('#rePlayControl').fadeOut();

};

// clear out to restart
function clearPlay(){
    torqueLayer.off('change:time');
    torqueLayer.stop();
    $('#counter').addClass('hidden');
    $('#curYear').html('');
    $('#curCount').html('');
    $('#curCountries').html('');
    curTot = 0; curCountries = 0;
    playTorque();
};

// function to format counts data
function countsPrep(counts){
    var counter = 0;
    var countries = [];
    var outcouts = [];
    _.each(counts, function(epoch){
        counter = counter + epoch.count;
        countries = _.union(countries,epoch.countries);
        outcouts.push([epoch.date, counter, countries.length]);
    })
    return outcouts;
};

// cartodb api query for counts
var qry = [
    'SELECT l.count,c.countries,c.date from (',
    'SELECT date_part(\'epoch\',loc_date)*1000 AS date,',
    'ARRAY_AGG(DISTINCT country ORDER BY country) AS countries',
    'FROM all_locations',
    'GROUP BY date_part(\'epoch\',loc_date)*1000) c',
    'JOIN ',
    '(SELECT date_part(\'epoch\',loc_date)*1000 AS date,count(cartodb_id) AS count',
    'FROM all_locations',
    'GROUP BY date_part(\'epoch\',loc_date)*1000) l ON l.date = c.date',
    'ORDER BY date'
].join(' ');

// go get the couts data before starting viz
$.ajax({
    url: "http://nexuscarto.cartodb.com/api/v2/sql?q="+qry,
    dataType: "json",
    cache: true,
    success: function (data) {
        // prep data
        counts = _.sortBy(countsPrep(data.rows), function(date){return date[0]});
        //console.log(counts);
        // get limits
        firstDay = new Date(counts[0].date);
        lastDay = new Date(counts[counts.length-1].date);
        numDays = (lastDay-firstDay)/(1000*60*60*24);
        // get torque setup
        setTorque();
        // set play and replay buttons to start viz from start
        $('.play-button').on('click',function(){
            clearPlay();
        })
        $('#rePlayControl').on('click',function(){
            clearPlay();
        })
    }
});
