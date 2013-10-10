# BracketsGH

A Github extension for [Brackets](http://brackets.io/) powered by [NodeGH](http://nodegh.io/)

> Brackets ❤ NodeGH ❤ GitHub

## Table of contents

* [Install](#install)
    * [Extension](#extension)
    * [Github Token](#github-token)
* [Usage](#usage)
* [Dependencies](#dependencies)

## Install

## Extension

BracketsGH is available directly from the [Brackets Registry](https://brackets-registry.aboutweb.com/). For more detailed instructions, check out the [Brackets Extensions wiki page](https://github.com/adobe/brackets/wiki/Brackets-Extensions)

## Github Token

For security reasons, BracketsGH needs a GitHub token to work. To generate it, you need to go to the path where Brackets extensions are installed and execute

    node gh/node/node_modules/gh/bin/gh.js us -l

You'll be prompted for your GitHub username and password, and a token will be generated for you.

In case you don't know where the folder is, just try to using BracketsGH and a message with the comman specific to your installation will appear.

![NoToken](help/notoken.png)
