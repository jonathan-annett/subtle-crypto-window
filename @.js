//
module.exports = function stub(mod, moduleCode, browserFiles, nodeCode, browserCode, npmPackages, getApp) {

    if (typeof moduleCode==='object' && arguments.length===2) {
        browserFiles = moduleCode.browserFiles; 
        nodeCode     = moduleCode.nodeCode; 
        browserCode  = moduleCode.browserCode; 
        npmPackages  = moduleCode.npmPackages;        
        getApp       = moduleCode.getApp;
        moduleCode   = moduleCode.moduleCode;
    }
    
    function package_json() {
        try {
            return package_json.cache || (package_json.cache=JSON.parse(require("fs").readFileSync("./package.json","utf8")));
        } catch (e) {
            return {};
        }
    }
    
    function devDependencies() {
        return package_json().devDependencies||{};
    }
    
    function dependencies() {
        return package_json().dependencies||{};
    }
    
    function getPkgList(inline) {
        var res={},deps = dependencies(),devDep = devDependencies();
        Object.keys(deps).forEach(pkg.bind(this,deps));
        Object.keys(devDep).forEach(pkg.bind(this,devDep));
        if (inline) Object.keys(inline).forEach(pkg.bind(this,inline));
        res.express=res.express||"express";
        res["get-localhost-hostname"]=res["get-localhost-hostname"]||"github:jonathan-annett/get-localhost-hostname#9bf64bcfaec50d419b20dde7d575386089634acc";
        res["serve-favicon"]=res["serve-favicon"]||"github:jonathan-annett/serve-favicon#612c1a1b6301dc4ab0512bd467a8239e81a2af04";
        return res;
        function pkg(deps,id){
            var ver,pkgLine=deps[id];
            switch (true) {
                case !!(ver=/^\^(?<version>)/.exec(pkgLine)) : 
                case !!(ver=/^\~(?<version>)/.exec(pkgLine)) : 
                case !!(ver=/^\>\=(?<version>)/.exec(pkgLine)) : 
                case !!(ver=/^<\=(?<version>)/.exec(pkgLine)) : 
                    res[id]=id+'@'+ver.groups.version;
                    break;
                case '*':
                    res[id]=id;
                    break;
                case id===pkgLine:
                case !!/^github/.exec(pkgLine) : 
                    res[id]=pkgLine;
                    break;
            }
        }
    }
    
    function stripFuncHeader(fn){
        if (typeof fn!=='function') return '';
        var src = fn.toString();
        return src.substring(src.indexOf('{') + 1, src.length - 1)+'\n';
    }
    
    function npmrequire(mods) {
        
        if (typeof mods==='string') {
            mods = { [mods] : mods }; 
        }
        var ids = Object.keys(mods);
        var failed = {};
        ids.forEach(function(id){
            try {
                mods[id] = mod.require(id);
            } catch (e) {
                if (e.message.indexOf("Cannot find module") < 0) throw e;
                failed[id] = mods[id];
            }
        });
        
        var failed_ids = Object.keys(failed);
        if (failed_ids.length>0) {
            console.log("installing ["+failed_ids.join(",")+"] via npm...");
            var args = ["install"].concat(Object.values(failed))
            require("child_process").spawnSync('npm', args,{cwd:npmrequire.dirname});
            failed_ids.forEach(function( id,ix) {
                mods[id] = mod.require(id);
            });
        }
        
        return mods;
    }
    
    mod.exports = moduleCode;
    browserFiles = browserFiles || [];
    var fs = require("fs"),
        path = require("path"),
        dirname = path.dirname(mod.filename),
        pkg = path.basename(dirname),
        dist = path.join(dirname, 'dist');
        
    npmrequire.dirname = dirname;
    
    if (process.argv.indexOf('--build') > 0 || process.argv.indexOf('--demo') > 0) {
        fs.mkdir(dist, function() {
            var src = stripFuncHeader(mod.exports);
            fs.writeFile(path.join(dist, pkg + '.js'), src, function() {

                function copyFiles(cb) {
                    var file = browserFiles.shift();
                    if (file) {
                        fs.copyFile(
                        path.join(dirname, file),
                        path.join(dist, path.basename(file)),

                        function(err) {
                            if (err) console.log(err.message);
                            copyFiles(cb);
                        });
                    } else {
                        cb();
                    }
                }

                fs.readFile(path.join(dirname, 'index.html'), 'utf8',

                function(err, html) {
                    fs.writeFile(
                    path.join(dist, 'index.html'),

                    html.split('${package}').join(pkg)
                        .split('${injected}').join(stripFuncHeader(browserCode)+src),

                    function() {

                        copyFiles(function() {
                            
                            if (process.argv.indexOf('--demo') > 0) {
                                
                                npmPackages=getPkgList(npmPackages);

                                var 
                                demopkgs = npmrequire(npmPackages),
                                start_browser = mod.require("get-localhost-hostname/start-browser.js");

                                var app = getApp ? getApp(demopkgs) : demopkgs.express();
                                app.use('/', demopkgs.express.static(dist));
                                app.use(demopkgs["serve-favicon"]());
                                start_browser(app, undefined, "/",typeof nodeCode==='function'?function (err,child,app,port,url){
                                    if (err) return nodeCode(err);
                                    nodeCode(null,child,app,port,url,demopkgs);
                                }:undefined);

                            } else {
                                console.log("built to", pkg + '.js', 'in', dist);
                            }
                        });

                    });
                });
            });
        });
    } else {
        moduleCode(mod.exports);
    }
};