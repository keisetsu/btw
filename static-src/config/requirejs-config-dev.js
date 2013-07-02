require.config({
 baseUrl: '/static/lib/',
 paths: {
   'jquery': 'jquery-1.9.1',
   'bootstrap': 'bootstrap/js/bootstrap.min'
 },
 shim: {
   'bootstrap': {
     deps: ["jquery"], 
     exports: "jQuery.fn.popover"
   },
   'bootstrap-contextmenu': {
     deps: ["bootstrap"],
     exports: "jQuery.fn.contextmenu"
   },
   'rangy/rangy-core': {
     exports: "rangy",
     init: function() { return this.rangy; }
   },
   'rangy/rangy-selectionsaverestore': {
     deps: ["rangy/rangy-core"],
     exports: "rangy.modules.SaveRestore"
   },
   'wed/jquery.findandself': {
     deps: ["jquery"], 
     exports: "jQuery.fn.findAndSelf"
   },
   'mocha/mocha': {
     exports: "mocha",
     init: function () { this.mocha.setup('bdd'); return this.mocha; }
   }
 },
 config: {
     "wed/wed": {
         schema: "btw/btw-storage.js",
         mode: "btw/btw_mode"
     }
 },
 enforceDefine: true
});