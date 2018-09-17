# violentmonkey-connect package

Requires atom-live-server for actual syncing.
If all you want to do is edit a single userscript, or a few non-related scripts. All you need is atom-live-server package.

This package adds the additional capability to serve local versions of \@require scripts. Usefull for those who either use a lot of custom libraries, or use custom libraries a lot!

Atom-Live-Server opens a pathway to Synchronizes your scripts to ViolentMonkey, but isn't enough alone.

Without this, your \@require custom libraries will have the following problems:
1) They point to the published version instead of the local.
A real pain to fix. You either have to have 2 separate versions (local and remote) for each userscript, and copy/past everything between them.
Or you have to replace each \@require with the local version during testing, and remember to replace it again before publication.
2) Not updating. Userscripts \@require scripts are only downloaded once. They will not download again unless you change the URL. This is the largest issue when it comes to testing multiple scripts with a common library. Every time you change the library, you have to update the \@require URL for each userscript. We automate this entirely.


Additionally, ViolentMonkey requires you to rename your scripts to 'whatever.user.js' for syncing. This small prick is resolved with automatic compilation to a local distribution directory ('./devtest' by default).



![Screenshot TODO](https://f.cloud.github.com/assets/69169/2290250/c35d867a-a017-11e3-86be-cd7c5bf3ff9b.gif)
