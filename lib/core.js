/* ========================================================= ***/
/** ================== INCLUDE NEEDED MODULES =============== **/
/*** ========================================================= */

var https = require("https");
var http = require('http');
var querystring = require("querystring");

/* ========================================================= ***/
/** ===================== PUBLIC FUNCTIONS ================== **/
/*** ========================================================= */

/**
 * Implements functionality similar to SQL LIMIT
 *
 * @param num   the total number to retrieve
 * @param qty   the number to display per page
 * @return {*}
 */
var page = function(num, qty)
{
    return typeof qty != 'undefined' ? this.filter("per_page", qty).filter("page", num) : this.filter("page", num);
};

/**
 * Implements functionality similar to SQL ORDER BY
 *
 * @param field
 * @param dir
 * @return {*}
 */
var order = function(field, dir)
{
    if (arguments.length < 0) { throw Error("MUST SUPPLY AT LEAST ONE ARGUMENT"); }

    if (typeof field === "string")
    {

        if (typeof dir == "undefined") { dir = "desc"; }

        dir = dir.toLowerCase();

        if (dir!="desc"&&dir!="asc") { throw Error("ORDER DIRECTION MUST BE desc or asc"); }

        return this.filter("order", field+"__"+dir);
    }
    else
    {
        for (var i=0; i<arguments.length; i++)
        {
            var arg = arguments[i];

            var field = "";
            var direction = "";

            if (Object.prototype.toString.call( arg ) == '[object Array]')
            {
                field = arg[0];
                direction = arg[1];
            }
            else if (Object.prototype.toString.call( arg ) == '[object Object]')
            {
                field = arg.field;
                direction = arg.direction;
            }
            else
            {
                throw Error("INVALID ORDER ARGUMENT");
            }

            this.filter("order", field+"__"+direction);

        }
        return this;
    }
};

/**
 * Select which fields to display
 *
 * @return {*}
 */
var fields = function()
{
    if (arguments.length<0) { throw Error("MUST SUPPLY AT LEAST ONE FIELD"); }

    for (var i=0; i<arguments.length; i++) { this.filter("fields", arguments[i]); }

    return this;
};

/**
 * Search for full phrase in results
 *
 * @param q     query to search for in results
 * @return {*}
 */
var search = function(q){

    if (this.collection.replace("/search", "") != this.collection) { q = validateSearch(q); }

    return this.filter("query", q);
};

/**
 * Global add params function and to curate WHERE clauses
 *
 * @param field     field to set
 * @param value     value to add
 * @param operator  operator to apply, see operatorCheck
 * @return {*}
 */
var filter = function(field, value, operator){

    //if date, convert to iso format string
    if (Object.prototype.toString.call(value) === '[object Date]') { value = value.toISOString(); }


    if (typeof operator != "undefined" && operator != "=")
    {
        if (field != "order")
        {
            operatorCheck(operator);
            field = field+"__"+operator;
        }
        else if (operator=="asc"||operator=="desc")
        {
            value = value+"__"+operator;
        }
        else
        {
            throw Error("("+operator+") is not a valid operator for "+field);
        }
    }

    // UNSET A FILTER
    if (value==null && typeof this.queryObj[field] != "undefined") { this.queryObj[field] = undefined; }

    // ADD TO A LIST FILTER
    else if (field == "fields" || field == "order")
    {
        var list = [];

        if (typeof this.queryObj[field] != "undefined") { list = this.queryObj[field]; }

        list[list.length] = value;

        this.queryObj[field] = list;
    }
    // SET/OVERWRITE A SIMPLE FILTER
    else
    {
        this.queryObj[field] = value;
    }

    return this;
};

/**
 * Turns debugging mode on.
 *
 * @return {*}
 */
var explain = function()
{
    console.log("This is a convenience for debugging, not a \"supported\" API feature. Don't make automatic requests with explain mode turned on.");
    return this.filter("explain", true);
};

/**
 * Increments the page and make another call to the API.
 *
 * @param success
 * @param failure
 */
var next = function(success, failure)
{
    if (typeof this.queryObj.page != "number") { this.queryObj.page = 0; }
    this.queryObj.page++;
    this.call(success, failure);
};

/**
 * Make request to the API
 *
 * @param callback  callback function for success
 * @param fail      callback function for failure
 */
var call = function(callback, fail)
{
    //== VALIDATE INPUT ==
    // passed an object in callback
    if (typeof callback == "object")
    {
        fail = callback.fail;
        callback = callback.callback;
    }

    // potentially passed a callback function instead
    if (typeof callback != "undefined") { this.success = callback; }
    // wasn't given a new call back function so use old one
    else if (typeof this.success != "undefined") { callback = this.success; }
    // AH! wasn't supplied a valid callback
    else { throw Error("YOU MUST DEFINE A SUCCESS FUNCTION BEFORE PERFORMING CALL"); }

    // potentially passed a new failure callback function
    if (typeof fail != "undefined") { this.failure = fail; }
    // wasn't passed a new failure function
    else if (typeof this.failure != "undefined") { fail = this.failure; }
    // AH! wasn't supplied a valid failure function. Lets fail! HA!
    else { throw Error("YOU MUST DEFINE A FAILURE FUNCTION BEFORE PERFORMING CALL"); }

    //== MAKE API CALL ==
    var endpoint = this.getEndpoint();
    var protocol = null;
    if (endpoint.indexOf("https") > -1) { protocol = https; }
    else if (endpoint.indexOf("http") > -1) { protocol = http; }
    else { throw Error("NO PROTOCOL SPECIFIED IN ENDPOINT"); }

    var _this = this;

    protocol.get(endpoint, function(res)
    {
        var data = "";
        res.on("data", function(chunk) { data+=chunk; });
        res.on("end", function()
        {
            var obj = {
                json_data : JSON.parse(data),
                request : { status : "success", error : undefined }
            };
            if (!(_this.giveAccessors === 'undefined' )) { _this.giveAccessors(obj); }
            callback(obj);
        });
    }).on("error", function(e)
        {
            var obj = {
                json_data: [],
                request : { status : "error", error : e }
            };
            fail(obj);
        });
};


/**
 * Constructs and returns the API endpoint
 *
 * @return {String} the API endpoint
 */
var getEndpoint = function()
{
    this.query = "";
    // var keys = Object.keys(this.queryObj);

    if (this.apikey) { this.queryObj.apikey = this.apikey; }

    this.query = querystring.stringify(this.queryObj);

    // What is this doing here?
    /*
    for (var i=0; i<keys.length; i++)
    {
       var key = keys[i];
       var value = encodeURIComponent(this.queryObj[key]);
       this.query += "&"+key+"="+value;
    }
    */

    if (this.collection) { return this.apiUrl+this.collection+"/?"+this.query; }
    //we're requesting the status page this way
    else { return this.apiUrl; }
};

/* ========================================================= ***/
/** ==================== BASIC OBJECT DATA ================== **/
/*** ========================================================= */

module.exports = {

    //BASE DATA
    apiUrl: "",
    apikey : undefined,
    collection: "",
    query: "",
    queryObj: {}, //used to stage

    //CORE FUNCTIONS
    call: call,
    explain: explain,
    filter: filter,
    page: page,
    next: next,
    order: order,
    fields: fields,
    search: search,
    getEndpoint: getEndpoint,

    //CALLBACK FUNCTIONS
    success: undefined,
    failure: function(data) { console.log("ERROR: " + data.error.message); }
};

/* ========================================================= ***/
/** ==================== BACKEND FUNCTIONS ================== **/
/*** ========================================================= */

/**
 * Operator validator
 *
 * @param operator {String} operator string
 */
var operatorCheck = function(operator)
{
    // PER: https://sunlightlabs.github.io/congress/#operators
    // gt - the field is greater than this value
    // gte - the field is greater than or equal to this value
    // lt - the field is less than this value
    // lte - the field is less than or equal to this value
    // not - the field is not this value
    // all - the field is an array that contains all of these values (separated by |)
    // in - the field is a string that is one of these values (separated by |)
    // nin - the field is a string that is not one of these values (separated by |)
    // exists - the field is both present and non-null (supply true or false)

    var valids = ["gt", "gte", "lt", "lte", "not", "all", "in", "nin", "exists"];

    if(valids.indexOf(operator)==-1){
        throw new Error("In valid operator. Please see https://sunlightlabs.github.io/congress/#operators for a full list");
    }
};

/**
 * Validate search string. Only used on endpoints ending in /search.
 *
 * @param q {String}    query to sanitize
 * @return {String}     sanitized query
 */
var validateSearch = function(q)
{
    q = q.replace(/" *~/g, '"~'); // REMOVE SPACES BETWEEN " AND ~
    q = q.replace(/~ */g, "~");   // REMOVE SPACES DIRECTLY AFTER ~

    var q_parts = q.split('"');

    if (q_parts[0] == "") { q_parts = q_parts.slice(1); }

    var inPhrase = false;

    for (var i=0; i<q_parts.length; i++)
    {
        inPhrase = !inPhrase;

        var part = q_parts[i];

        if (part.indexOf("*") !== -1 && inPhrase)
        {
            var err = "YOU MAY NOT USE * INSIDE OF A PHRASE ("+part+")";
            throw Error(err);
        }
        else if (part.substring(0,1) == "~" && part.replace(/^~[0-9]+/, "") == part)
        {
            var err = "A NUMBER MUST FOLLOW A ~ AFTER A PHRASE ("+part+")";
            throw Error(err);
        }
    }

    return q;
};