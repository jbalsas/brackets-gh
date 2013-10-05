// userhome
// Copyright (c) 2013 Kyle Robinson Young
// Licensed under the MIT license.

var path = require('path');

module.exports = function() {
  return path.resolve.apply(path.resolve, [
    process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME']
  ].concat(Array.prototype.slice.call(arguments, 0)));
};
