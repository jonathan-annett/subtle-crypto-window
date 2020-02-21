
   (function (node) {

   var cryptoWindow =  function (storage,storageKey){
       if (typeof window==='object' && typeof process==='undefined') {
           if (storage!==false) {
               window.keyStorage = window.keyStorage || window[storage||"localStorage"];
           } else {
               window.keyStorage =fakeStorage() ;
           }
           cryptoWindow = function () {return window;};
           cryptoWindow.keyname_public  = !!storageKey ? storageKey+"-public"  : "uploads-public";
           cryptoWindow.keyname_private = !!storageKey ? storageKey+"-private" : "uploads-private";
           return window;
       }
       var 
       
       WebCrypto = require("node-webcrypto-ossl"),
       
       webcrypto = new WebCrypto(storage===false?undefined:{
         directory: storage||"key_storage"
       }),
       subtle = webcrypto.subtle,
       keyStorage = storage ? webcrypto.keyStorage : fakeStorage() ,
       node_window = { crypto : { subtle : subtle }, keyStorage : keyStorage};
       
       cryptoWindow = function () {return node_window;};
       cryptoWindow.keyname_public  = !!storageKey ? storageKey+"-public"  : "uploads-public";
       cryptoWindow.keyname_private = !!storageKey ? storageKey+"-private" : "uploads-private";
       
       return node_window;
   };
   
   
   
   function fakeStorage() {
       var tempKeyStorage={};
       return {
           getItem : function(k)   { 
               console.log({fakeStorage:{getItem:k,value:tempKeyStorage[k]}});
               return tempKeyStorage[k];
           },
           setItem : function(k,v) { 
               console.log({fakeStorage:{setItem:k,value:v}});
               return (tempKeyStorage[k]=v);
           },
       };
   }
   
   
   function loadKey(keyName,cb) {
          var win=cryptoWindow(),k = win.keyStorage.getItem(keyName);
          if ( k ) {
              win.crypto.subtle.exportKey(
                   "jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
                   k //can be a publicKey or privateKey, as long as extractable was true
               )
               .then(function(keyData){
                   //returns the exported key data
                   cb(undefined,k,keyData,keyName);
               })
               .catch(cb);
          }  else {
              cb(new Error("notFound:"+keyName));
          }
   }
   
   
   function ENCRYPT_Algo () {
       var algo = {
            name: "RSA-OAEP",
            modulusLength: 2048, //can be 1024, 2048, or 4096
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: {name: "SHA-256"}, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
       };
       return algo;
   }
   
   function SIGN_ALGO()  {
       var algo = {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 1024,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: {
              name: "SHA-1"
            }
          };
        return algo;
   } 
   
   function isBuffer (x) {
       return typeof x==='object'&& x.constructor && isBuffer.classes.indexOf(x.constructor.name)>=0;
   }
   
   isBuffer.classes = node ? ["Buffer","ArrayBuffer"] : ["Uint8Array","ArrayBuffer"];

   function asBufferNode (_data) {
       return isBuffer(_data) ? _data :
              typeof _data ==='string' ? Buffer.from(_data,"utf-8") :
              Array.isArray(_data)     ? Buffer.from(_data) :
              _data;
   }
   function asBufferBrowser (_data) {
       return isBuffer(_data) ? _data :
              typeof _data ==='string' ? new Uint8Array(_data) :
              Array.isArray(_data) ? new Uint8Array(_data) :
              _data;
   }
   
   var asBuffer = node ? asBufferNode : asBufferBrowser;
   
   function asText (_data) { 
       return new TextDecoder("utf-8").decode(_data);
   }

 
   cryptoWindow.hardCodedPublic=hardCodedPublic;
   function hardCodedPublic (cb) {
       var win=cryptoWindow(false),subtle=win.crypto.subtle,
       exported = { kty: 'RSA',
                      key_ops: [ 'verify' ],
                      e: 'AQAB',
                      n:
                       '4Hwq4gKZvqNQ-aPwP0i-PKS_QXM3ImXti1OaRud3t7TK7lFQNFmrrlSg055Yz8ITHcUKq8VsAZ8RuVRfzgbjiKKs8lqR0jSOFjsZjuGu4q4ZDv8RDXQqDJxthRgEly9wmrWqhzfrPZErN3W__5wqpDi8UPvrsH_Wwj7O7N4POLM',
                      alg: 'RS1',
                      ext: true };
                      
       subtle.importKey(
           "jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
           exported,
           SIGN_ALGO(false),
           true, //whether the key is extractable (i.e. can be used in exportKey)
           ["verify"] //"verify" for public key import, "sign" for private key imports
       )
       .then(function(publicKey){
           //returns a publicKey (or privateKey if you are importing a private key)
           cb(undefined,publicKey);
       })
       .catch(function(err){
           cb(err);
       });
   }
   
   cryptoWindow.hardCodedVerify=hardCodedVerify;
   function hardCodedVerify (_data,signature,cb) {
       hardCodedPublic (function(err,publicKey){
           if (err) return cb(err);
           var win=cryptoWindow(false),subtle=win.crypto.subtle,keyStorage=win.keyStorage,
           data = typeof _data ==='string'? Buffer.from(_data,"utf-8") : _data;
           subtle.verify(
               SIGN_ALGO(false),
               publicKey, //from generateKey or importKey above
               signature, //ArrayBuffer of the signature
               data //ArrayBuffer of the data
           )
           .then(function(isvalid){
               //returns a boolean on whether the signature is true or not
               cb(undefined,isvalid,data,_data);
           })
           .catch(cb);
       });
   }
   
   
   function getEncDecOpts(encdec,cb) {
       if (typeof encdec==='function') {
           cb=encdec;
           encdec=false;
       }
       var win=cryptoWindow();
       return {
           cb     : cb,
           encdec : !!encdec,
           suffix : encdec ? '-crypto':'',
           win :win,
           subtle:win.crypto.subtle,
           keyStorage:win.keyStorage,
           algo : encdec ? ENCRYPT_Algo () : SIGN_ALGO()
       };
   } 
   
   
   cryptoWindow.generateKeys=generateKeys;
   function generateKeys(encdec,cb){
       var opts=getEncDecOpts(encdec,cb);

       // generating RSA key
       opts.subtle.generateKey(
           opts.algo,
           true,
           opts.encdec ? ["encrypt", "decrypt"] : ["sign", "verify"]
         )
         .then(function(keyPairs){
           /** 
            * saving private RSA key to KeyStorage
            * creates file ./key_storage/prvRSA-1024.json
            */
           opts.keyStorage.setItem(cryptoWindow.keyname_private+opts.suffix, keyPairs.privateKey);
           opts.keyStorage.setItem(cryptoWindow.keyname_public+opts.suffix,  keyPairs.publicKey);
           opts.keyStorage.setItem(cryptoWindow.keyname_public+opts.suffix+"-local", keyPairs.publicKey);
           
           opts.subtle.exportKey(
               "jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
               keyPairs.publicKey //can be a publicKey or privateKey, as long as extractable was true
           )
           .then(function(keydata){
               //returns the exported key data
               opts.cb(undefined,keyPairs,keydata);
           })
           .catch(opts.cb);
         });
   }
   
   cryptoWindow.getPrivate=getPrivate;
   function getPrivate (encdec,cb){
       var opts=getEncDecOpts(encdec,cb);
       opts.cb(opts.keyStorage.getItem(cryptoWindow.keyname_private+opts.suffix));
   }
   
   cryptoWindow.getPublic=getPublic;
   function getPublic (encdec,cb){
       var opts=getEncDecOpts(encdec,cb);
       opts.cb(opts.keyStorage.getItem(cryptoWindow.keyname_public+opts.suffix));
   }
   
   cryptoWindow.importPublic=importPublic;
   function importPublic (keydata,encdec,cb,nosave){
       var opts=getEncDecOpts(encdec,cb);
       opts.subtle.importKey(
           "jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
           keydata,
           opts.algo,
           true, //whether the key is extractable (i.e. can be used in exportKey)
           opts.encdec ?["encrypt"] : ["verify"] 
       )
       .then(function(theKey){
           //returns a publicKey (or privateKey if you are importing a private key)
           if (!nosave) opts.keyStorage.setItem(cryptoWindow.keyname_public+opts.suffix,theKey);
           opts.cb(undefined,theKey);
       })
       .catch(opts.cb);
       
       
   }
   
   cryptoWindow.exportPublic=exportPublic;
   function exportPublic (encdec,cb) {
       var opts=getEncDecOpts(encdec,cb);
       opts.subtle.exportKey(
           "jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
           opts.keyStorage.getItem(cryptoWindow.keyname_public+opts.suffix+'-local') //can be a publicKey or privateKey, as long as extractable was true
       )
       .then(function(keydata){
           //returns the exported key data
           opts.cb(undefined,keydata);
       })
       .catch(opts.cb);
   }
   
   cryptoWindow.sign=sign;
   function sign(_data,cb) {
       var opts=getEncDecOpts(false,cb),
       data = asBuffer(_data);
       opts.subtle.sign(
           SIGN_ALGO (false),
           opts.keyStorage.getItem(cryptoWindow.keyname_private), //from generateKey or importKey above
           data //ArrayBuffer of data you want to sign
       )
       .then(function(signature){
           //returns an ArrayBuffer containing the signature
           opts.cb(undefined,new Uint8Array(signature),data,_data);
       })
       .catch(opts.cb);
   }
   
   cryptoWindow.verify=verify;
   function verify(_data,signature,cb) {
       var opts=getEncDecOpts(false,cb),
       data = asBuffer(_data);
       opts.subtle.verify(
           opts.algo,
           opts.keyStorage.getItem(cryptoWindow.keyname_public), //from generateKey or importKey above
           signature, //ArrayBuffer of the signature
           data //ArrayBuffer of the data
       )
       .then(function(isvalid){
           //returns a boolean on whether the signature is true or not
           opts.cb(undefined,isvalid,data,_data);
       })
       .catch(opts.cb);
   }
   
   
   cryptoWindow.encrypt=encrypt;
   function encrypt (_data,cb) {
       var opts=getEncDecOpts(true,cb);
       var data = asBuffer(_data);
       loadKey(cryptoWindow.keyname_public+opts.suffix,function(err,key,keyData,keyName){
           if (err) return opts.cb(err);
           console.log({encryptionKey:{[keyName]:keyData}});
           opts.subtle.encrypt(
               opts.algo,
               key, 
               data //ArrayBuffer of data you want to encrypt
           )
           .then(function(encrypted){
               //returns an ArrayBuffer containing the encrypted data
            
               opts.cb(undefined,Array.from(new Uint8Array(encrypted)),data,_data);
           })
           .catch(opts.cb);
       }); 
       
      
       
   }
   encrypt.max = 128;
   
   
   cryptoWindow.encrypt_chain = encrypt_chain;
   
   function encrypt_chain(data,cb) {
       
       var opts=getEncDecOpts(true,cb);
       loadKey(cryptoWindow.keyname_public+opts.suffix,function(err,key,keyData,keyName){
           
            if (err) return opts.cb(err);
            console.log({encryptionKey:{[keyName]:keyData}});
       
            var max=encrypt.max,twice=max*2,arr = [];
                
            while (data.length>twice) {
                arr.push(asBuffer(data.substr(0,max)));
                data=data.substr(max);
            }
            if (data.length>0) {
               if (data.length>max) {
                   var half = Math.floor(data.length/2);
                   arr.push(asBuffer(data.substr(0,half)));
                   data=data.substr(half);
               }
               arr.push(asBuffer(data));
            }
            
     
            var promises = arr.map(function(_data,ix){
                console.log("element",ix,"is",_data.length,"chars");
                return opts.subtle.encrypt(
                           ENCRYPT_Algo (),
                           key, 
                           _data //ArrayBuffer of data you want to encrypt
                       );
            });
            
            return Promise.all(promises).then(resolve).catch(opts.cb);
            
            function resolve (encrypted) {
                return opts.cb (undefined,encrypted.map(function(el){
                    return Array.from(new Uint8Array(el));
                }));
            } 
       });

   }
   
   cryptoWindow.encrypt_string = encrypt_string;
   function encrypt_string(str,cb) {
       if (str.length<=encrypt.max) {
           console.log("encrypt_string-->encrypt:",str.length,"chars");
           return encrypt(str,function(err,enc_str){
               if (err) return cb(err);
               cb(undefined,{str:enc_str});
           });
       }
       console.log("encrypt_string-->encrypt_chain:",str.length,"chars");
       encrypt_chain(str,function(err,encrypted){
           if (err) return cb(err);
           cb(undefined,{length:str.length,parts:encrypted});
       });
   }
   
   cryptoWindow.encrypt_obj = encrypt_obj;
   function encrypt_obj(obj,cb) {
       encrypt_string(JSON.stringify(obj),cb);
   }
   

   cryptoWindow.decrypt=decrypt;
   function decrypt (_data,cb) {
       var opts=getEncDecOpts(true,cb);
       var data = asBuffer(_data);
       loadKey(cryptoWindow.keyname_private+opts.suffix,function(err,key,keyData,keyName){
           
           if (err) return opts.cb(err);
           console.log({decryptionKey:{[keyName]:keyData}});
           
           opts.subtle.decrypt(
               opts.algo,
               key, 
               data 
           )
           .then(function(decrypted){
               //returns an ArrayBuffer containing the decrypted data
               opts.cb(undefined,new Uint8Array(decrypted),new TextDecoder("utf-8").decode(decrypted));
           })
           .catch(opts.cb);
       });
   }
   
   cryptoWindow.decrypt_chain=decrypt_chain;
   function decrypt_chain(chain,cb) {
       var opts=getEncDecOpts(true,cb);
       loadKey(cryptoWindow.keyname_private+opts.suffix,function(err,key,keyData,keyName){
       
           if (err) return opts.cb(err);
           console.log({decryptionKey:{[keyName]:keyData}});
           var promises = chain.map(function(_data){
               var data = asBuffer(_data) ;
               return opts.subtle.decrypt(
                          ENCRYPT_Algo (),
                          key, 
                          data
                      )
           });
           
           return Promise.all(promises).then(resolve).catch(cb);
           
           function resolve (parts) {
               return cb (undefined,parts);
           } 
       });
       
       

       
       
   }
    
   cryptoWindow.decrypt_string=decrypt_string;
   function decrypt_string(str,cb) {
        if (typeof str==='object' && typeof str.length==='number' && str.parts) {
            decrypt_chain(str.parts,function(err,parts){
               if (err) return cb(err);
               cb(undefined,parts.map(asText).join(''));
            });
        } else {
            if (typeof str==='object' && typeof str.str) {
                decrypt(asBuffer(str.str),function(err,decoded){
                   if (err) return cb(err);
                   cb(undefined,asText(decoded));
                });
            } else {
                return decrypt (asBuffer(str),function(err,buf,decoded_str){
                    cb(err,decoded_str);
                });
            }
        }
       
   }
   
   
   cryptoWindow.decrypt_obj=decrypt_obj;
   function decrypt_obj (encoded_json,cb) {
       decrypt_string(encoded_json,function(err,json){
           if (err) return cb(err);
           return cb(undefined,JSON.parse(json));
       });
   }
   

   window.cryptoWindow = cryptoWindow;

   //generateKeys(console.log.bind(console,"generateKeys:"));
   //getPrivate (console.log.bind(console,"getPrivate:"));
   //getPublic (console.log.bind(console,"getPublic:"));
   //exportPublic (console.log.bind(console,"exportPublic:"));
   //hardCodedPublic (console.log.bind(console,"hardCodedPublic:"));
   /*
   sign("hello world",function(err,signature,data,orig_data){
       if (err) throw(err);
       hardCodedVerify(orig_data,signature,console.log.bind(console,"hardCodedVerify:"))
   });
   */
   })(typeof process==='object' && typeof module==='object' );

