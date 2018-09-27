'use babel';

import ViolentmonkeyConnectView from './violentmonkey-connect-view';
import { CompositeDisposable } from 'atom';

import {accessSync, existsSync, readFileSync, writeFileSync, mkdirSync} from 'fs';
import {join, relative, dirname, extname, normalize, parse} from 'path';
function getFileLastCommit(git_dir,file) {
  return require('child_process')
  .execSync(`git -C '${git_dir}' rev-list -1 HEAD -- '${file}'`)
  .toString().trim();
}
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
    dev_dir: "devtest/",
    src_dir: "src/",
    dist_dir: "dist/",
    distExtention: "",
    userscripts: {
      "example.user.js": [
      {
        publishURI: "https://greasyfork.org/scripts/999999-common-library/code/Common%20Library.js",
        devURI: "https://greasyfork.org/scripts/999999-common-library/code/Common%20Library.js?version=SomeSpecificVersionForThisUserscript"
      },
    ],
    },
    libraries: [
      {
        gitURI_prefix: "https://cdn.rawgit.com/Username/Project",
        gitURI_suffix: "optionalnewname.js",
        filePath: "gitlib.js",
      },
      {
        publishURI: "https://greasyfork.org/scripts/999999-common-library/code/Common%20Library.js",
        filePath: "common.js",
      },
    ],
  },
  rebuildTimer: null,
  rebuildList: {},
  ViolentmonkeyConnectView: null,
  modalPanel: null,
  subscriptions: null,
  is_enabled: false,
  is_server_active: false,
  willSaveLocked: false,
  menu: {
    toggle: null
  },
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
    let self = this;
    this.subscriptions.add(atom.workspace.observeTextEditors(textEditor => {
        this.subscriptions.add(textEditor.onDidSave(this.handleDidSave.bind(this)));
        this.subscriptions.add(textEditor.getBuffer().onWillSave((event) => { self.handleWillSave(event,textEditor); return false; }));
    }));
    atom.commands.onDidDispatch((event) => {
      if (event.type === 'atom-live-server:startServer') {
        console.log("startserv");
        this.is_server_active = true;
      }
      else if (event.type === 'atom-live-server:stopServer') {
        console.log("stopserv");
        this.is_server_active = false;
      }
    });
    this.update_view();
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
  update_view() {
    if (this.menu.toggle) {
      this.menu.toggle.dispose();
    }
    this.menu.toggle = atom.menu.add([{
      label: 'Packages',
      submenu : [{
        label: 'violentmonkey-connect',
        submenu : [{
          label: `${ this.is_enabled ? "Disable" : "Enable" } Autocompile`,
          command: `violentmonkey-connect:toggle`
        }]
      }]
    }]);
  },
  toggle() {
    console.log('ViolentmonkeyConnect was toggled!');
    if (this.is_enabled) {
      atom.notifications.addInfo("Turning Off Auto Compile");
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'atom-live-server:stopServer');
      this.is_enabled = false;
    }
    else {
      atom.notifications.addInfo("AutoCompile Enabled!");
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'atom-live-server:startServer');
      this.genConfFile(false);
      this.is_enabled=true;
    }
    this.update_view();
  },
  processConfEntry(proj_dir,conf,e) {
    if (typeof e.filePath === "string") {
      if (typeof e.devURI !== "string") {
        e.devURI = conf.distURI + "/" + encodeURI(e.filePath);
      }
      if (typeof e.gitURI_suffix !== "string") {
        e.gitURI_suffix = e.filePath;
      }
      e.filePath=join(proj_dir,conf.src_dir,e.filePath);
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
  updateConfFile(path,serverconf) {
    let c = this.readConfFile(path,serverconf);
    if (!c) {
      return null;
    }

  },
  readConfFile(path,serverconf) {
    //now open the file and read the text
    if (existsSync(path)) {
      let text = readFileSync(path, 'utf8');
      text = text.replace(/^\s*\/\/.*$/mg,'');
      let c = JSON.parse(text);
      return c;
    }
    else {
      atom.notifications.addError("Conf File doesn't exist: " + path);
    }
  },
  processConfFile(path,serverconf) {
    //now open the file and read the text
    let c = this.readConfFile(path,serverconf);
    if (!c) {
      return null;
    }
    c.distURI = "http://" + serverconf.host + ":" + serverconf.port;
    let proj_dir=this.getProjDir(path).getPath();
    for (let [idx,dep] of Object.entries(c.libraries)) {
      let new_deps=[];
      c.libraries[idx]=this.processConfEntry(proj_dir,c,dep);
    }
    for (let [userscript,deps] of Object.entries(c.userscripts)) {
      let new_userscript=join(proj_dir,c.src_dir,userscript);
      let new_deps=[];
      for (let dep of deps) {
        new_deps.push(this.processConfEntry(proj_dir,c,dep));
      }
      // Add all libraries to end of list.
      // Note, the first match is used by the replace function
      // so duplicates will not be processed. This gives userscipt defined
      // deps priority.
      new_deps.push.apply(new_deps,c.libraries);
      c.userscripts[new_userscript]=new_deps;
      delete c.userscripts[userscript];
    }
    return c;
  },
  generateDevURI({dep,proj_dir}) {
    console.log("Generating Dev Uri for");
    console.log(dep);
    if (typeof dep.devURI === "string") {
      return dep.devURI + "?" + Date.now();
    }
    else if (typeof dep.gitURI_prefix === "string") {
      return this.generateGitURI({dep:dep,proj_dir:proj_dir});
    }
    else if (typeof dep.publishURI === "string") {
      return dep.publishURI;
    }
    return false;
  },
  generateGitURI({dep,proj_dir}) {
    let commit = getFileLastCommit(proj_dir,dep.filePath);
    return `${dep.gitURI_prefix}/${commit}/${dep.gitURI_suffix}`;
  },
  generatePublishURI({dep,proj_dir}) {
    console.log("Generating Publish Uri for");
    console.log(dep);
    if (typeof dep.gitURI_prefix === "string") {
      return this.generateGitURI({dep:dep,proj_dir:proj_dir});
    }
    else if (typeof dep.publishURI === "string") {
      return dep.publishURI;
    }
    return false;
  },
  getProjDir(path) {
    let proj_dir = atom.project.getDirectories().find(function(dir) {
      return path.startsWith(dir.path);
    });
    return proj_dir;
  },
  handleWillSave(event,textEditor) {
    if (!this.is_enabled || this.willSaveLocked) {
      return false;
    }
    this.willSaveLocked=true;
    console.log("WillSave");
    let updatedFile = event.path;
    let proj_dir = atom.project.getDirectories().find(function(dir) {
      return event.path.startsWith(dir.path);
    }).getPath();
    let {shouldRebuild,conf,rebuildList} = this.calculateRebuildList({proj_dir:proj_dir,updatedFile:updatedFile,no_deps:false});
    let self=this;
    if (shouldRebuild) {
      textEditor.getBuffer().replace(/^(\/\/ ==UserScript==)\s*([\s\S]*?)\s*^(\/\/ ==\/UserScript==)/m, function(w,start,inner,stop) {
        let res;
        for (let line of inner.split("\n")) {
          res = (res ? res + "\n" : "") + self.replaceLine({proj_dir:proj_dir,line:line, deps:rebuildList[proj_dir].outdatedFiles[updatedFile],publish:true});
        };
        return start + "\n" + res + "\n" + stop;
      });
    }
    //handleDidSave(event);
    return null;
  },
  handleDidSave(event) {
    if (!this.is_enabled) {
      return false;
    }
    setTimeout(()=>{this.willSaveLocked=false;},1000);
      let editor;

      let updatedFile = event.path;


      let proj_dir = atom.project.getDirectories().find(function(dir) {
        return event.path.startsWith(dir.path);
      }).getPath();

      let {shouldRebuild,conf} = this.calculateRebuildList({proj_dir:proj_dir,updatedFile:updatedFile});
      let self = this;
      if (shouldRebuild) {
        console.log("Should Rebuild!");
        clearTimeout(this.rebuildTimer);
        this.rebuildTimer = setTimeout(function(){self.rebuildFiles();},500);
      }
    },
    calculateRebuildList({proj_dir,updatedFile,no_deps=false}) {
      let shouldRebuild=false;
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
      let rebuildList = {};
      if (!no_deps) {
        rebuildList = this.rebuildList;
      }
      rebuildList[proj_dir] = rebuildList[proj_dir] || {
        outdatedFiles: [],
      };
      console.log("Conf File: " + proj_conf_file );
      console.log("Updated File: " + updatedFile );
      if (proj_conf_file === updatedFile || typeof rebuildList[proj_dir].conf !== 'object') {
        rebuildList[proj_dir].conf=this.processConfFile(proj_conf_file,serverconf);
      }

      let conf = rebuildList[proj_dir].conf;
      if (!conf) {
        console.log("Failed to load config file!");
        return;
      }

      // Check if a userscript or dep changed
      userscript_check:
      for (let [userscript,deps] of Object.entries(conf.userscripts)) {
        console.log(userscript);
        console.log(updatedFile);
        if (userscript === updatedFile) {
          shouldRebuild=true;
          rebuildList[proj_dir].outdatedFiles[userscript]=deps;
          if (no_deps) {
            return {shouldRebuild:shouldRebuild,conf:conf,rebuildList:rebuildList};
          }
          continue userscript_check;
        }
        if (!no_deps) {
          for (let dep of deps) {
            if (typeof dep.filePath === "string") {
              if (dep.filePath === updatedFile) {
                shouldRebuild=true;
                rebuildList[proj_dir].outdatedFiles[userscript]=deps;
                continue userscript_check;
              }
            }
          }
        }
      }
      return {shouldRebuild:shouldRebuild,conf:conf,rebuildList:rebuildList};
    },
    replaceLine({proj_dir,line,deps,publish=false}) {
      for (let dep of deps) {
        let regex = new RegExp('^//\\s*@require\\s+' + dep.publishURI + '\\s*$',"m");
        if (dep.gitURI_prefix) {
          regex = new RegExp('^//\\s*@require\\s+' + dep.gitURI_prefix + '/[^/\\s]+/' + dep.gitURI_suffix + '\\s*$',"m");
          //regex = new RegExp('^//\\s*@require\\s+' + dep.gitURI_suffix + '\\s*$',"m");
        }
        if (line.match(regex)) {
          if (publish) {
            return "// @require  " + this.generatePublishURI({dep:dep,proj_dir:proj_dir});
          }
          return "// @require  " + this.generateDevURI({dep:dep,proj_dir:proj_dir});
        }
      }
      return line;
    },
    rebuildDist(projectConf,path,deps){
      let distText = text.replace(/^(\/\/ ==UserScript==)\s*([\s\S]*?)\s*^(\/\/ ==\/UserScript==)/m, function(w,start,inner,stop) {
        let res;
        for (let line of inner.split("\n")) {
          res = (res ? res + "\n" : "") + self.replaceLine({line:line, deps:deps,publish:true,proj_dir:proj_dir});
        };
        return start + "\n" + res + "\n" + stop;
      });
      let distDir = join(proj_dir, projectConf.dist_dir );

      if (!existsSync(distDir)) {
        mkdirSync(distDir);
      }
      let distPath = join(distDir, subpath + projectConf.distExtention );
      console.log("Writing to Dist " + distPath);
      writeFileSync(distPath,distText);
    },
    rebuildDev(projectConf,path,deps) {
      console.log("Rebuilding File! <" + path + ">");
      let proj_dir = this.getProjDir(path).getPath();
      let self = this;
      let text = readFileSync(path, 'utf8');
      let devText = text.replace(/^(\/\/ ==UserScript==)\s*([\s\S]*?)\s*^(\/\/ ==\/UserScript==)/m, function(w,start,inner,stop) {
        let res;
        for (let line of inner.split("\n")) {
          console.log(`a line <${line}>`);
          res = (res ? res + "\n" : "") + self.replaceLine({line:line, deps:deps,publish:false,proj_dir:proj_dir});
        };
        console.log(`open <${stop}>`);
        console.log(`result <${res}>`);
        console.log(`close <${stop}>`);
        return start + "\n" + res + "\n" + stop;
      });
      let devDir = join(proj_dir, projectConf.dev_dir );
      if (!existsSync(devDir)) {
        mkdirSync(devDir);
      }
      let r = new RegExp("^" + join(proj_dir,projectConf.src_dir),"");
      let subpath = path.replace(r,'');

      let devPath = join(devDir, subpath + projectConf.distExtention );

      console.log("Writing to Dev " + devPath);
      writeFileSync(devPath,devText);
      atom.notifications.addSuccess("Updated Userscript <" + path + ">");
    },

    rebuildFiles() {
      let self = this;
      console.log("Rebuilding Files...");
      // If one did, update the userscript
      Object.entries(this.rebuildList).forEach(function([proj_dir,proj_obj]) {
        Object.entries(proj_obj.outdatedFiles).forEach(function([path,deps]) {
          self.rebuildDev(proj_obj.conf,path,deps);
          delete(proj_obj.outdatedFiles[path]);
        });
      });
      clearTimeout(this.rebuildTimer);
    },
};
