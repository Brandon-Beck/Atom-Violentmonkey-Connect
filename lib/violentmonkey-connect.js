'use babel';

import ViolentmonkeyConnectView from './violentmonkey-connect-view';
import { CompositeDisposable } from 'atom';

import {accessSync, existsSync, readFileSync, writeFileSync, mkdirSync} from 'fs';
import {join, relative, dirname, extname, normalize, parse} from 'path';

export default {
  atomLiveServerConf: {
    confFile: ".atom-live-server.json",
    default: {
      host: "localhost",
      port: "3000",
    },
  },
  pluginConf: {
    extention: "js",
    confFile: "userscript.development.json",
  },
  defaultProjectConf: {
    dist_dir: "devtest/",
    distExtention: ".user.js",
    requires: {
      "example.js": [
      {
        publishURI: "https://greasyfork.org/scripts/999999-common-library/code/Common%20Library.js",
        filePath: "common.js",
      },
    ],
    },
  },
  rebuildTimer: null,
  rebuildList: {},
  ViolentmonkeyConnectView: null,
  modalPanel: null,
  subscriptions: null,
  is_enabled: false,
  activate(state) {
    this.ViolentmonkeyConnectView = new ViolentmonkeyConnectView(state.ViolentmonkeyConnectViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.ViolentmonkeyConnectView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'violentmonkey-connect:toggle': () => this.toggle()
    }));
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'violentmonkey-connect:generateConfig': () => this.genConfFile()
    }));

    this.subscriptions.add(atom.workspace.observeTextEditors(textEditor => {
        this.subscriptions.add(textEditor.onDidSave(this.handleDidSave.bind(this)));
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.ViolentmonkeyConnectView.destroy();
  },

  serialize() {
    return {
      ViolentmonkeyConnectViewState: this.ViolentmonkeyConnectView.serialize()
    };
  },

  toggle() {
    console.log('ViolentmonkeyConnect was toggled!');
    if (this.is_enabled) {
      atom.notifications.addInfo("Turning Off Auto Compile");
      this.is_enabled = false;
    }
    else {
      atom.notifications.addInfo("AutoCompile Enabled!");
      this.genConfFile(false);
      this.is_enabled=true;
    }
  },
  processConfEntry(proj_dir,conf,e) {
    if (typeof e.filePath === "string") {
      if (typeof e.devURI !== "string") {
        e.devURI = conf.distURI + "/" + encodeURI(e.filePath);
      }
      e.filePath=join(proj_dir,e.filePath);
    }
    return e;
  },
  notifyOptional(text,doShow=true) {
    if (doShow) {
      atom.notifications.addError(text);
    }
  },
  genConfFile(required=true) {
    let e = atom.workspace.getActiveTextEditor();
    if (e) {
      let path = join(this.getProjDir(e.getPath()).getPath(), this.pluginConf.confFile);
      console.log(path);
      if (!existsSync(path)) {
        let text = JSON.stringify(this.defaultProjectConf, null, 2);
        writeFileSync(path, text);
      }
      else {
        this.notifyOptional("Using existing config file already exists!",required);
      }
      let serverpath = join(this.getProjDir(e.getPath()).getPath(), this.atomLiveServerConf.confFile);
      if (!existsSync(serverpath)) {
        let text = JSON.stringify(this.atomLiveServerConf.default, null, 2);
        writeFileSync(serverpath, text);
      }
      else {
        this.notifyOptional("Using existing atom-live-server config file!",required);
      }
    }
    else {
      this.notifyOptional("No project selected! Open something in the editor first.",required);
    }
  },
  readLiveServerConfig(path) {
    //now open the file and read the text
    if (existsSync(path)) {
      let text = readFileSync(path, 'utf8');
      text = text.replace(/^\s*\/\/.*$/mg,'');
      let c = JSON.parse(text);
      return c;
    }
    else {
      atom.notifications.addError("atom-live-server Conf File doesn't exist: " + path);
    }
  },
  readConfFile(path,serverconf) {
    //now open the file and read the text
    if (existsSync(path)) {
      let text = readFileSync(path, 'utf8');
      text = text.replace(/^\s*\/\/.*$/mg,'');
      let c = JSON.parse(text);
      c.distURI = "http://" + serverconf.host + ":" + serverconf.port;
      let proj_dir=this.getProjDir(path).getPath();
      for (let [userscript,deps] of Object.entries(c.requires)) {
        let new_userscript=join(proj_dir,userscript);
        let new_deps=[];
        for (dep of deps) {
          new_deps.push(this.processConfEntry(proj_dir,c,dep));
        }
        c.requires[new_userscript]=new_deps;
        delete c.requires[userscript];
      }
      return c;
    }
    else {
      atom.notifications.addError("Conf File doesn't exist: " + path);
    }
  },
  generateFileURI(o) {
    console.log("Generating Uri FOR");
    console.log(o);
    if (typeof o.devURI === "string") {
      return o.devURI + "?" + Date.now();
    }
    else if (typeof o.publishURI === "string") {
      return o.publishURI;
    }
    return false;
  },
  getProjDir(path) {
    let proj_dir = atom.project.getDirectories().find(function(dir) {
      return path.startsWith(dir.path);
    });
    return proj_dir;
  },
  handleDidSave(event) {
    if (!this.is_enabled) {
      return false;
    }
      let editor;
      let shouldRebuild = false;

      let updatedFile = event.path;

      let proj_dir = atom.project.getDirectories().find(function(dir) {
        return event.path.startsWith(dir.path);
      }).getPath();

      let serverconf = this.readLiveServerConfig(join(proj_dir,this.atomLiveServerConf.confFile));
      if (!serverconf) {
        console.log("Failed to load atom-live-server config file!");
        atom.notifications.addError(`Config file <${proj_dir}/.atom-live-server.json> Must exist`);
        return;
      }
      if (typeof serverconf.host !== "string" || serverconf.host !== "localhost") {
        // enforce firefox compatibility.
        atom.notifications.addError(`<${proj_dir}/.atom-live-server.json> Must have <"host": "localhost"> set exactly`);
      }
      if (typeof serverconf.port == null) {
        // enforce firefox compatibility.
        atom.notifications.addError(`<${proj_dir}/.atom-live-server.json> Must have some port set (eg: <"port": 3000>)`);
      }

      let proj_conf_file = join(proj_dir,this.pluginConf.confFile)
      let rebuildList = this.rebuildList;
      rebuildList[proj_dir] = rebuildList[proj_dir] || {
        outdatedFiles:{},
      };
      console.log("Conf File: " + proj_conf_file );
      console.log("Updated File: " + updatedFile );
      if (proj_conf_file === updatedFile || typeof rebuildList[proj_dir].conf !== 'object') {
        rebuildList[proj_dir].conf=this.readConfFile(proj_conf_file,serverconf);
      }

      let conf = rebuildList[proj_dir].conf;
      if (!conf) {
        console.log("Failed to load config file!");
        return;
      }

      // Check if a userscript or dep changed
      userscript_check:
      for (let [userscript,deps] of Object.entries(conf.requires)) {
        console.log(userscript);
        if (userscript === updatedFile) {
          shouldRebuild=true;
          rebuildList[proj_dir].outdatedFiles[userscript]=deps;
          continue userscript_check;
        }
        for (dep of deps) {
          if (typeof dep.filePath === "string") {
            if (dep.filePath === updatedFile) {
              shouldRebuild=true;
              rebuildList[proj_dir].outdatedFiles[userscript]=deps;
              continue userscript_check;
            }
          }
        }
      }
      let self = this;
      if (shouldRebuild) {
        console.log("Should Rebuild!");
        clearTimeout(this.rebuildTimer);
        this.rebuildTimer = setTimeout(function(){self.rebuildFiles();},500);
      }
    },
    replaceLine(orig,deps) {
      for (dep of deps) {
        let regex = new RegExp('^//\\s*@require\\s+' + dep.publishURI + '\\s*$',"m");
        if (orig.match(regex)) {
          return "// @require    " + this.generateFileURI(dep);
        }
      }
      return orig;
    },
    rebuildFile(projectConf,path,deps) {
      console.log("Rebuilding File! <" + path + ">");
      let self = this;
      let text = readFileSync(path, 'utf8');
      text = text.replace(/^(\/\/ ==UserScript==)([\s\S]*?)^(\/\/ ==\/UserScript==)/m, function(w,start,inner,stop) {
        let res;
        for (let line of inner.split("\n")) {
          res = (res ? res + "\n" : "") + self.replaceLine(line, deps);
        };
        return start + "\n" + res + "\n" + stop;
      });
      let proj_dir = this.getProjDir(path).getPath();
      let outputDir = join(proj_dir, projectConf.dist_dir );
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir);
      }
      let r = new RegExp("^" + proj_dir,"");
      let subpath = path.replace(r,'');
      let outputPath = join(outputDir, subpath + projectConf.distExtention );
      console.log("Writing to " + outputPath);
      writeFileSync(outputPath,text);
      atom.notifications.addSuccess("Updated Userscript <" + path + ">");
    },
    rebuildFiles() {
      let self = this;
      console.log("Rebuilding Files...");
      // If one did, update the userscript
      Object.entries(this.rebuildList).forEach(function([proj_dir,proj_obj]) {
        Object.entries(proj_obj.outdatedFiles).forEach(function([path,deps]) {
          self.rebuildFile(proj_obj.conf,path,deps);
          delete(proj_obj.outdatedFiles[path]);
        });
      });
      clearTimeout(this.rebuildTimer);
    },
};