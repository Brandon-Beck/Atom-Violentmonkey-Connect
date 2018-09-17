// ==UserScript==
// @name     Mangadex Copy link as BBCode
// @description Adds a "Copy as BBCode" button next to links. Currently operates on title page links, and any breadcrumbs.
// @namespace https://github.com/Brandon-Beck
// @version  0.0.1
// @grant    unsafeWindow
// @grant    GM.setClipboard
// @grant    GM_setClipboard
// @require  https://greasyfork.org/scripts/999999-common-library/code/Common%20Library.js
// @match    https://mangadex.org/*
// ==/UserScript==
let s = 5;
