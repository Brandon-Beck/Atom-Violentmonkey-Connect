// ==UserScript==
// @name     Mangadex Copy link as BBCode
// @description Adds a "Copy as BBCode" button next to links. Currently operates on title page links, and any breadcrumbs.
// @namespace https://github.com/Brandon-Beck
// @version  0.0.1
// @grant    unsafeWindow
// @grant    GM.setClipboard
// @grant    GM_setClipboard
// @require  common.js
// @require  https://cdn.rawgit.com/Username/Project/a629aac255ad04fdea2593060da69edfa02ed6b5/gitlib.js
// @match    https://mangadex.org/*
// ==/UserScript==
let s = 5;
