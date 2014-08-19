/* ========================================================= ***/
/** ================== INCLUDE NEEDED MODULES =============== **/
/*** ========================================================= */

var core = require("./core.js");
var extend = require("./extend.js");

/* ========================================================= ***/
/** ===================== INIT AND CLONE ==================== **/
/*** ========================================================= */

/**
 * Initialize the module with the Sunlight Foundation API key.
 *
 * @param opts {*} Object containing apiUrl and apikey or String for apikey
 */
module.exports.init = function(opts)
{
    var optsType = typeof opts;
    if (optsType == "string") { core.apikey = opts; }
    else if (optsType == "object")
    {
        if (opts.key == undefined && core.apikey == undefined) { throw new Error("Must provide an api key"); }
        else
        {
            core.apiUrl = opts.url || core.apiUrl;
            core.apikey = opts.key;
        }
    }
    else
    {
        throw new Error("Must call init with either api key or a config object");
    }
};

/**
 * Clones an object
 *
 * @param obj {Object} object to clone
 * @return {Object} cloned object
 */
module.exports.clone = function(obj)
{
    return extend(true, {}, obj);
};

/* ========================================================= ***/
/** ========================= ENDPOINTS ===================== **/
/*** ========================================================= */

/**
 * This object is designed to model and provide access to
 * all Sunlight Lab's APIs through a common interface.
 * The structure for each entry should be as followed:
 *
 * <Capitalized API Name> : {
 *      'settings' : {
 *          'url' : <root url address, ex: "https://congress.api.sunlightfoundation.com/" >,
 *          'queryObj' : <object with default key:val query parameters for all queries>, ex: {'format': 'json'}
 *          "giveAccessors" : <function with one argument that augments API return JSON with standardized accessor methods>,
 *      }
 *      'methods' : {
 *          <methodName1> : <object that may contain keys for "collection", "post_processing", and "arg_handler">
 *              "collection"  : {String} for the API endpoint address to append to the root url
 *              "arg_handler" : {function(obj, arg)} handles method input if there are arguments. This is
 *                              not to set query parameters (use the "filter" for that) but for APIs which,
 *                              for instance, use the path as part of the query input. See PartyTime for an
 *                              example of this.
 *               "post_processing" : {Object} additional functions to add for post processing uses after
 *                                   the associated method call.
 *          <methodName2> : ...
 *     }
 * }
 *
 * Once this module is imported then you can use methods to access
 * an API such as in the following example:
 *
 *  var req = api.<API>.<method>(<arg>).filter(<query_param>, <value>);
 *  req.call(function(data) { ... }
 *
 * The "data" argument in this callback should have two main
 * accessor fields: results and meta. These fields must be set
 * in "giveAccessors" below using Object.defineProperty which
 * should return the underlying json_data equivalent. This is
 * done because not all APIs return JSON data possessing the same
 * structure, but for convenience we want to be able to access
 * the data through a common access interface.
 *
 * If set correctly then we can access them in callback argument
 * like in the following example.
 *
 *  req.call(function(data) {
 *      data.results.forEach(function(item) {
 *          ...
 *      }
 *      console.log(data.meta);
 *  }, function(error) {
 *       callback(error);
 *  });
 *
 * This is still a work in progress and will take time to integrate all the
 * available APIs. If the API you want isn't present then feel free to add it
 * using other entries as an example.
 *
 */
var API_MAP = {

    /* =============================================== **
     ** DOCS: http://sunlightlabs.github.com/congress/  **
     ** =============================================== */
    'Congress'  : {

        'settings'  : {
            'url' : "https://congress.api.sunlightfoundation.com/",
            'queryObj': {},
            "giveAccessors": function(obj)
            {
                if (obj.json_data.hasOwnProperty('count') && obj.json_data.hasOwnProperty("page")) {
                    Object.defineProperty(obj, "meta", {
                        get: function() {
                            return {'count' : obj.json_data.count, 'page' : obj.json_data.page }
                        },
                        set: undefined }
                    );
                }

                if (obj.json_data.hasOwnProperty('results')) {
                    Object.defineProperty(obj, "results", {
                        get: function() {
                            return obj.json_data.results;
                        },
                        set: undefined }
                    );
                }
            }
        },
        'methods' : {
            // Roll call votes in Congress, back to 2009. Updated within minutes of votes.
            'votes' : {},
            // Committee hearings in Congress. Updated as hearings are announced.
            'hearings': {},
            // To-the-minute updates from the floor of the House and Senate.
            'floorUpdates' : {'collection':'floor_updates'},
            // Legislation in the House and Senate, back to 2009. Updated daily.
            'bills' : {},
            // Full text search over legislation.
            'billsSearch' : {'collection' : 'bills/search',
                             'post_processing' : {
                                 'highlight' : function() {
                                     if (typeof this.queryObj == "undefined") {
                                         throw Error("SEARCH MUST BE CALLED BEFORE HIGHLIGHT IF HIGHLIGHT IS TO BE USED");
                                     }
                                     if (arguments.length == 2) {
                                         this.filter("highlight.tags", arguments[0]+","+arguments[1]);
                                     }
                                     return this.filter("highlight", true);
                                 }
                             }
            },
            // Current legislators' names, IDs, biography, and social media.
            'legislators' : {},
            // Find representatives and senators for a latitude/longitude or zip.
            'legislatorsLocate' : {'collection': 'legislators/locate'},
            // Find congressional districts for a latitude/longitude or zip
            'districtsLocate' : {'collection' : 'districts/locate'},
            // Current committees, subcommittees, and their membership.
            'committees' : {},
            // Bills scheduled for debate in the future, as announced by party leadership.
            'upcomingBills' : {'collection' : 'upcoming_bills'}
        }
    },

    /* =============================================== **
     ** DOCS: http://politicalpartytime.org/api/        **
     ** =============================================== */
    'PartyTime' : {

        'settings'  : {
            'url' : "http://politicalpartytime.org/api/v1/",
            'queryObj': {'format': 'json'},
            "giveAccessors": function(obj)
            {
                if (obj.json_data.hasOwnProperty('meta')) {
                    Object.defineProperty(obj, "meta", { get: function() { return obj.json_data.meta; }, set: undefined });
                }

                if (obj.json_data.hasOwnProperty('objects')) {
                    Object.defineProperty(obj, "results", { get: function() { return obj.json_data.objects; }, set: undefined });
                    Object.defineProperty(obj, "objects", { get: function() { return obj.json_data.objects; }, set: undefined });
                }
                else {
                    Object.defineProperty(obj, "results", { get: function() { return obj.json_data; }, set: undefined });
                }
            }
        },
        'methods' : {
            'event' : {
                'arg_handler' : function(obj, arg) {
                                    if (typeof(arg) === 'number') {
                                        obj.collection += '/' + arg;
                                    }
                                }},
            'lawmaker': {
                'arg_handler' : function(obj, arg) {
                                    if (typeof(arg) === 'number') {
                                        obj.collection += '/' + arg;
                                    }
                                }},

            'host':{
                'arg_handler' : function(obj, arg) {
                                    if (typeof(arg) === 'number') {
                                        obj.collection += '/' + arg;
                                    }
                                }}
        }
    }
};

/* ========================================================= ***/
/** ===================  MODULE EXPORTS ===================== **/
/*** ========================================================= */

module.exports.api_names = [];

/**
 * Exports all the API functions for in other modules
 */
Object.keys(API_MAP).forEach(function(api_name)
{
    module.exports[api_name] = API_MAP[api_name];
    module.exports.api_names.push(api_name);
    Object.keys(API_MAP[api_name]['methods']).forEach(function(method_name)
    {
        module.exports[api_name][method_name] = function(arg)
        {
            // initialize object and add baseline features
            var obj = extend(true, {}, core);

            // add the API end point path
            obj.collection = API_MAP[api_name]['methods'][method_name].hasOwnProperty('collection') ?
                API_MAP[api_name]['methods'][method_name]['collection'] : method_name.toString();

            // add additional post processing methods if applicable
            if (API_MAP[api_name]['methods'][method_name].hasOwnProperty('post_processing'))
            {
                Object.keys(API_MAP[api_name]['methods'][method_name]['post_processing']).forEach(function(proc_name)
                {
                    obj[proc_name.toString()] =  API_MAP[api_name]['methods'][method_name]['post_processing'][proc_name]
                });
            }

            // add the API's base url
            obj.apiUrl = API_MAP[api_name]['settings']['url'];

            // add the queryObject containing key/val for parameters
            obj.queryObj =  API_MAP[api_name]['settings']['queryObj'];

            // handles formatting results to conform to standardized wrapper result parameters
            if (API_MAP[api_name]['settings'].hasOwnProperty('giveAccessors')) {
                obj.giveAccessors = API_MAP[api_name]['settings']['giveAccessors'];
            }

            // handle arguments if applicable
            if (!(arg === undefined) && !(API_MAP[api_name]['methods'][method_name]['arg_handler'] === undefined))
            {
                API_MAP[api_name]['methods'][method_name]['arg_handler'](obj, arg);
            }

            return obj;
        };
    });

    module.exports[api_name]['status'] = function(cb, fail)
    {
        var obj = extend(true, {}, core);
        obj.collection = undefined;
        obj.call(cb, fail);
    };
});