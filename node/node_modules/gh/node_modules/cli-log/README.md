# cli-log

This project provides common log methods for your command line app.

## Install

	npm -g install cli-log

## How to use:

``` javascript
var  log = require("cli-log").init({ prefix: '[app]', prefixColor: 'cyan', prefixBgColor: 'bgCyan' });

log.log( "hello" );
log.warn( "hello" );
log.oops( "hello" );
log.error( "hello" );
```

For more color options check out [cli-color](https://npmjs.org/package/cli-color).