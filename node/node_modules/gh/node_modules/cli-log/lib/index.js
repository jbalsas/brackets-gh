/*
* Copyright (c) 2013, Liferay Inc. All rights reserved.
* Code licensed under the BSD License
*
* @author Eduardo Lundgren <eduardolundgren@gmail.com>
*/

// -- Header -------------------------------------------------------------------
var PREFIX = '',
    PREFIX_BG_COLOR = 'black',
    PREFIX_COLOR = 'cyanBright',
    slice = Array.prototype.slice;

// -- Requires -----------------------------------------------------------------
var clc = require('cli-color');

function log() {
    var args = slice.call(arguments),
        prefixColor = (typeof PREFIX_COLOR === 'number') ?
                        clc.xterm(PREFIX_COLOR).bold : clc[PREFIX_COLOR].bold,
        prefixBgColor = (typeof PREFIX_BG_COLOR === 'number') ?
                        clc.bgXterm(PREFIX_BG_COLOR).bold : clc[PREFIX_BG_COLOR].bold;

    args.unshift(prefixBgColor(prefixColor(PREFIX)));

    console.log.apply(this, args);
}

// -- Utils --------------------------------------------------------------------
exports.init = function(config) {
    if (config.hasOwnProperty('prefix')) {
        PREFIX = config.prefix;
    }

    if (config.hasOwnProperty('prefixColor')) {
        PREFIX_COLOR = config.prefixColor;
    }

    if (config.hasOwnProperty('prefixBgColor')) {
        PREFIX_BG_COLOR = config.prefixBgColor;
    }

    return exports;
};

exports.custom = function(padding, color) {
    var args = slice.call(arguments);

    args.shift();
    args.shift();
    args.unshift(color.call(color, padding));

    log.apply(this, args);
};

exports.info = function() {
    var args = slice.call(arguments);

    args.unshift('[info]');

    log.apply(this, args);
};

exports.success = function() {
    var args = slice.call(arguments);

    args.unshift(clc.green.bold('[success]'));

    log.apply(this, args);
};

exports.warn = function() {
    var args = slice.call(arguments);

    args.unshift(clc.yellow('[warn]'));

    log.apply(this, args);
};

exports.log = function() {
    log.apply(this, arguments);
};

exports.error = function() {
    var args = slice.call(arguments);

    args.unshift(clc.red.bold('[error]'));

    log.apply(this, args);

    process.exit(1);
};

exports.oops = function() {
    var args = slice.call(arguments);

    args.unshift(clc.red.bold('[Oops!]'));

    log.apply(this, args);

    process.exit(1);
};