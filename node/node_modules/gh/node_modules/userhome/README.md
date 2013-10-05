# userhome

> A platform independent path to the user's home.

```js
var userhome = require('userhome');

console.log(userhome('.bashrc'));
// /Users/shama/.bashrc

console.log(userhome('test', 'sub', 'file'));
// /Users/shama/test/sub/file
```

## Release History
* 0.1.0 - initial release

## License
Copyright (c) 2013 Kyle Robinson Young  
Licensed under the MIT license.
