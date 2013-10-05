git-wrapper
===========

a wrapper around the git executable

## Installation

    npm install git-wrapper

## API

### var git = new Git(options);

Constructor. See [git(1)](http://git-scm.com/docs/git) for available options.

  * `options` Object. Examples: `{ paginate: true }` enables pagination.
    `{ 'git-dir': '../.git' }` specifies a different `.git` directory.

### git.exec(command [[, options], args], callback);

Executes a git command. See [the Git Reference](http://git-scm.com/docs/) for
available commands.

  * `command`   String.         Examples: `'init'`, `'log'`, `'commit'`, etc.
  * `options`   Object.         The options for a git command. E.g.
                                `{ f: true }` to force a command (equivalent
                                to adding `-f` on the command line).
  * `args`      Array[String].  The arguments for a git command. E.g. some
                                files for `git add`.
  * `callback`  Function.       `callback(err, msg)`.

## Bugs and Issues

If you encounter any bugs or issues, feel free to
[open an issue](https://github.com/pvorb/node-git-wrapper/issues) at github.

## License

Copyright © 2012 Paul Vorbach

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the “Software”), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
