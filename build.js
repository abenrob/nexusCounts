var fs = require("fs");

var index = fs.readFileSync("index.html", "utf8");
var torque = fs.readFileSync("torque.full.js", "utf8");
var js = fs.readFileSync("map.min.js", "utf8");
var css = fs.readFileSync("style.css", "utf8");

var torquereplace = index.replace(/<script src="torque.full.js"><\/script>/g,'<script>\n'+torque+'\n</script>');
var mapreplace = torquereplace.replace(/<script src="map.js"><\/script>/g,'<script>\n'+js+'\n</script>');
var cssreplace = mapreplace.replace(/<link rel="stylesheet" href="style.css" \/>/g,'<style>\n'+css+'\n</style>');

fs.writeFileSync('dist/index.html', cssreplace, 'utf8');