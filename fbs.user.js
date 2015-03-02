// ==UserScript==
// @name           Facebook Batch Sender
// @author         Witiko
// @include        http*://www.facebook.com/messages/*
// @require        http://tiny.cc/jBus
// @require        http://tiny.cc/dingjs
// @grant          GM_xmlhttpRequest
// @version        1.11
// ==/UserScript==

(function(global) {
  if(window.top != window && window.top != window.unsafeWindow) return;
  var rawCommands = /\(js\)(?:.*?)(?:\(js\)|$)|\(v\)|\(\^\)|\(@?\^\^[^:^]+?\^\^.+?\^\^\)|\(@?\^\^[^:^]+?(?:\^\^)?\)|\(@?\^[^:^]+?\^.+?\^\)|\(@?\^[^:^]+?(?:\^)?\)|\(::?[^:^]+?\)|\(repeat\)|\(at [^`]*?\)|\((?:\d+(?:Y|M|d|h|ms|m|s)\s?)+\)|\(never\)|\(seen\)|\(typing!?\)|\(any\)|\(notify\)|\(replied\)|\(changed\)|\(posted\)|\((?:un)?freeze\)|\(!?(?:(?:on|off)line|mobile)\)/,
      events = {
        send: {
          async: {
            global: {
              data:   /\(@\^\^([^:^]+?)\^\^(.+?)\^\^\)/,
              nodata: /\(@\^\^([^:^]+?)(?:\^\^)?\)/,
            }, local: {
              data:   /\(@\^([^:^]+?)\^(.+?)\^\)/,
              nodata: /\(@\^([^:^]+?)(?:\^)?\)/
            }
          }, sync: {
            global: {
              data:   /\(\^\^([^:^]+?)\^\^(.+?)\^\^\)/,
              nodata: /\(\^\^([^:^]+?)(?:\^\^)?\)/,
            }, local: {
              data:   /\(\^([^:^]+?)\^(.+?)\^\)/,
              nodata: /\(\^([^:^]+?)(?:\^)?\)/
            }
          }
        }, receive: {
          level:  /\(::([^:^]+?)\)/,
          edge:    /\(:([^:^]+?)\)/
        }
      }, newlines = {
        encode: function(str) {
          return str ? str.replace(/~~/g, "~~E").
                           replace(/\n/g, "~~M") : str;
        }, decode: function(str) {
          return str ? str.replace(/~~M/g, "\n").
                           replace(/~~E/g, "~~") : str;
        }
      }, commands = new RegExp("(" + rawCommands.source + ")"),
      evals = /\(js\)(.*?)(?:\(js\)|$)/,
      gEvals = new RegExp(evals.source, "g"),
      rawCr = /\(;\)/,
      cr = new RegExp("(" + rawCr.source + ")"),
      substitution = {
        //      outer capture, inner capture, no capture
        weak:   [   /(`.*?`)/ ,    /(`(.*?)`)/ ,    /`.*?`/   ],
        strong: [ /(```.*?```)/, /(```(.*?)```)/, /```.*?```/ ]
      }, rawTokens = new RegExp(substitution.strong[2].source + "|" + rawCommands.source),
      tokens = new RegExp("(" + rawTokens.source + ")"),
      comments = /(\(\/\/\/.*|\(\/\/.*?(?:\/\/\)|$)|\(\/.*?(?:\)|$))/g,
      hms = /(\d{0,2})(?::(\d{0,2})(?::(\d{0,2}))?)?/,
      units = /(Y|M|d|h|ms|m|s)/,
      unitValues = {
         "Y": 31556925994,
         "M": 2629743831,
         "d": 86400000,
         "h": 3600000,
         "m": 60000,
         "s": 1000,
        "ms": 1
      }, colors = {
        cr:           "#444",
        js:           "#f00",
        substitution: {
          weak:       "#0f0",
          strong:     "violet",
        }, commands:  "#00f",
        comments:     "orange"
      }, settings = {
        freezeOnError: false,
        newlines: {
          trimmed:     true,
          TeXLike:     false
        }, debug: {
          warnings:    true,
          tokenizer:   false,
          freeze:      false,
          namelock:    false,
          require:     false,
          batch:       false,
          time:        false
        }
      }, notification = (window.Notification || function() { /* A dummy notification constructor */ }),
      ctx = new (window.audioContext || window.webkitAudioContext || (function() {
        // A dummy audioContext object
        this.createOscillator = function() {
          return {
            connect:    function() {},
            disconnect: function() {},
            noteOn:     function() {},
            noteOff:    function() {}
          };
        };
        this.connect          = function() {};
        this.disconnect       = function() {};
        this.noteOn           = function() {};
        this.noteOff          = function() {};
      })), MESSAGE_SELECTOR = 'textarea[name="message_body"]',
      PLACEHOLDER_CLASS = "DOMControl_placeholder",
      REPLY_SELECTOR = "div[role=log] li.webMessengerMessageGroup",
      LAST_REPLY_NAME_SELECTOR = "div[role=log] li:last-child strong > a",
      MY_NAME_SELECTOR = "._2dpb", qualifiedName = "name.witiko.fbs.",
      readyPrefix = "ready@", dataPrefix = "data@", receivedPrefix = "received@",
      requiredScripts = [], DOWHEN_INTERVAL = 500,
      h$ml = {
        entities: /&(quot|amp|apos|lt|gt|nbsp|iexcl|cent|pound|curren|yen|brvbar|sect|uml|copy|ordf|laquo|not|shy|reg|macr|deg|plusmn|sup2|sup3|acute|micro|para|middot|cedil|sup1|ordm|raquo|frac14|frac12|frac34|iquest|Agrave|Aacute|Acirc|Atilde|Auml|Aring|AElig|Ccedil|Egrave|Eacute|Ecirc|Euml|Igrave|Iacute|Icirc|Iuml|ETH|Ntilde|Ograve|Oacute|Ocirc|Otilde|Ouml|times|Oslash|Ugrave|Uacute|Ucirc|Uuml|Yacute|THORN|szlig|agrave|aacute|acirc|atilde|auml|aring|aelig|ccedil|egrave|eacute|ecirc|euml|igrave|iacute|icirc|iuml|eth|ntilde|ograve|oacute|ocirc|otilde|ouml|divide|oslash|ugrave|uacute|ucirc|uuml|yacute|thorn|yuml|OElig|oelig|Scaron|scaron|Yuml|fnof|circ|tilde|Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Omicron|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigmaf|sigma|tau|upsilon|phi|chi|psi|omega|thetasym|upsih|piv|ensp|emsp|thinsp|zwnj|zwj|lrm|rlm|ndash|mdash|lsquo|rsquo|sbquo|ldquo|rdquo|bdquo|dagger|Dagger|bull|hellip|permil|prime|Prime|lsaquo|rsaquo|oline|frasl|euro|image|weierp|real|trade|alefsym|larr|uarr|rarr|darr|harr|crarr|lArr|uArr|rArr|dArr|hArr|forall|part|exist|empty|nabla|isin|notin|ni|prod|sum|minus|lowast|radic|prop|infin|ang|and|or|cap|cup|int|there4|sim|cong|asymp|ne|equiv|le|ge|sub|sup|nsub|sube|supe|oplus|otimes|perp|sdot|lceil|rceil|lfloor|rfloor|lang|rang|loz|spades|clubs|hearts|diams);/mg,
        replacements: {
          "quot": "\u0022",
          "amp": "\u0026",
          "apos": "\u0027",
          "lt": "\u003C",
          "gt": "\u003E",
          "nbsp": "\u00A0",
          "iexcl": "\u00A1",
          "cent": "\u00A2",
          "pound": "\u00A3",
          "curren": "\u00A4",
          "yen": "\u00A5",
          "brvbar": "\u00A6",
          "sect": "\u00A7",
          "uml": "\u00A8",
          "copy": "\u00A9",
          "ordf": "\u00AA",
          "laquo": "\u00AB",
          "not": "\u00AC",
          "shy": "\u00AD",
          "reg": "\u00AE",
          "macr": "\u00AF",
          "deg": "\u00B0",
          "plusmn": "\u00B1",
          "sup2": "\u00B2",
          "sup3": "\u00B3",
          "acute": "\u00B4",
          "micro": "\u00B5",
          "para": "\u00B6",
          "middot": "\u00B7",
          "cedil": "\u00B8",
          "sup1": "\u00B9",
          "ordm": "\u00BA",
          "raquo": "\u00BB",
          "frac14": "\u00BC",
          "frac12": "\u00BD",
          "frac34": "\u00BE",
          "iquest": "\u00BF",
          "Agrave": "\u00C0",
          "Aacute": "\u00C1",
          "Acirc": "\u00C2",
          "Atilde": "\u00C3",
          "Auml": "\u00C4",
          "Aring": "\u00C5",
          "AElig": "\u00C6",
          "Ccedil": "\u00C7",
          "Egrave": "\u00C8",
          "Eacute": "\u00C9",
          "Ecirc": "\u00CA",
          "Euml": "\u00CB",
          "Igrave": "\u00CC",
          "Iacute": "\u00CD",
          "Icirc": "\u00CE",
          "Iuml": "\u00CF",
          "ETH": "\u00D0",
          "Ntilde": "\u00D1",
          "Ograve": "\u00D2",
          "Oacute": "\u00D3",
          "Ocirc": "\u00D4",
          "Otilde": "\u00D5",
          "Ouml": "\u00D6",
          "times": "\u00D7",
          "Oslash": "\u00D8",
          "Ugrave": "\u00D9",
          "Uacute": "\u00DA",
          "Ucirc": "\u00DB",
          "Uuml": "\u00DC",
          "Yacute": "\u00DD",
          "THORN": "\u00DE",
          "szlig": "\u00DF",
          "agrave": "\u00E0",
          "aacute": "\u00E1",
          "acirc": "\u00E2",
          "atilde": "\u00E3",
          "auml": "\u00E4",
          "aring": "\u00E5",
          "aelig": "\u00E6",
          "ccedil": "\u00E7",
          "egrave": "\u00E8",
          "eacute": "\u00E9",
          "ecirc": "\u00EA",
          "euml": "\u00EB",
          "igrave": "\u00EC",
          "iacute": "\u00ED",
          "icirc": "\u00EE",
          "iuml": "\u00EF",
          "eth": "\u00F0",
          "ntilde": "\u00F1",
          "ograve": "\u00F2",
          "oacute": "\u00F3",
          "ocirc": "\u00F4",
          "otilde": "\u00F5",
          "ouml": "\u00F6",
          "divide": "\u00F7",
          "oslash": "\u00F8",
          "ugrave": "\u00F9",
          "uacute": "\u00FA",
          "ucirc": "\u00FB",
          "uuml": "\u00FC",
          "yacute": "\u00FD",
          "thorn": "\u00FE",
          "yuml": "\u00FF",
          "OElig": "\u0152",
          "oelig": "\u0153",
          "Scaron": "\u0160",
          "scaron": "\u0161",
          "Yuml": "\u0178",
          "fnof": "\u0192",
          "circ": "\u02C6",
          "tilde": "\u02DC",
          "Alpha": "\u0391",
          "Beta": "\u0392",
          "Gamma": "\u0393",
          "Delta": "\u0394",
          "Epsilon": "\u0395",
          "Zeta": "\u0396",
          "Eta": "\u0397",
          "Theta": "\u0398",
          "Iota": "\u0399",
          "Kappa": "\u039A",
          "Lambda": "\u039B",
          "Mu": "\u039C",
          "Nu": "\u039D",
          "Xi": "\u039E",
          "Omicron": "\u039F",
          "Pi": "\u03A0",
          "Rho": "\u03A1",
          "Sigma": "\u03A3",
          "Tau": "\u03A4",
          "Upsilon": "\u03A5",
          "Phi": "\u03A6",
          "Chi": "\u03A7",
          "Psi": "\u03A8",
          "Omega": "\u03A9",
          "alpha": "\u03B1",
          "beta": "\u03B2",
          "gamma": "\u03B3",
          "delta": "\u03B4",
          "epsilon": "\u03B5",
          "zeta": "\u03B6",
          "eta": "\u03B7",
          "theta": "\u03B8",
          "iota": "\u03B9",
          "kappa": "\u03BA",
          "lambda": "\u03BB",
          "mu": "\u03BC",
          "nu": "\u03BD",
          "xi": "\u03BE",
          "omicron": "\u03BF",
          "pi": "\u03C0",
          "rho": "\u03C1",
          "sigmaf": "\u03C2",
          "sigma": "\u03C3",
          "tau": "\u03C4",
          "upsilon": "\u03C5",
          "phi": "\u03C6",
          "chi": "\u03C7",
          "psi": "\u03C8",
          "omega": "\u03C9",
          "thetasym": "\u03D1",
          "upsih": "\u03D2",
          "piv": "\u03D6",
          "ensp": "\u2002",
          "emsp": "\u2003",
          "thinsp": "\u2009",
          "zwnj": "\u200C",
          "zwj": "\u200D",
          "lrm": "\u200E",
          "rlm": "\u200F",
          "ndash": "\u2013",
          "mdash": "\u2014",
          "lsquo": "\u2018",
          "rsquo": "\u2019",
          "sbquo": "\u201A",
          "ldquo": "\u201C",
          "rdquo": "\u201D",
          "bdquo": "\u201E",
          "dagger": "\u2020",
          "Dagger": "\u2021",
          "bull": "\u2022",
          "hellip": "\u2026",
          "permil": "\u2030",
          "prime": "\u2032",
          "Prime": "\u2033",
          "lsaquo": "\u2039",
          "rsaquo": "\u203A",
          "oline": "\u203E",
          "frasl": "\u2044",
          "euro": "\u20AC",
          "image": "\u2111",
          "weierp": "\u2118",
          "real": "\u211C",
          "trade": "\u2122",
          "alefsym": "\u2135",
          "larr": "\u2190",
          "uarr": "\u2191",
          "rarr": "\u2192",
          "darr": "\u2193",
          "harr": "\u2194",
          "crarr": "\u21B5",
          "lArr": "\u21D0",
          "uArr": "\u21D1",
          "rArr": "\u21D2",
          "dArr": "\u21D3",
          "hArr": "\u21D4",
          "forall": "\u2200",
          "part": "\u2202",
          "exist": "\u2203",
          "empty": "\u2205",
          "nabla": "\u2207",
          "isin": "\u2208",
          "notin": "\u2209",
          "ni": "\u220B",
          "prod": "\u220F",
          "sum": "\u2211",
          "minus": "\u2212",
          "lowast": "\u2217",
          "radic": "\u221A",
          "prop": "\u221D",
          "infin": "\u221E",
          "ang": "\u2220",
          "and": "\u2227",
          "or": "\u2228",
          "cap": "\u2229",
          "cup": "\u222A",
          "int": "\u222B",
          "there4": "\u2234",
          "sim": "\u223C",
          "cong": "\u2245",
          "asymp": "\u2248",
          "ne": "\u2260",
          "equiv": "\u2261",
          "le": "\u2264",
          "ge": "\u2265",
          "sub": "\u2282",
          "sup": "\u2283",
          "nsub": "\u2284",
          "sube": "\u2286",
          "supe": "\u2287",
          "oplus": "\u2295",
          "otimes": "\u2297",
          "perp": "\u22A5",
          "sdot": "\u22C5",
          "lceil": "\u2308",
          "rceil": "\u2309",
          "lfloor": "\u230A",
          "rfloor": "\u230B",
          "lang": "\u2329",
          "rang": "\u232A",
          "loz": "\u25CA",
          "spades": "\u2660",
          "clubs": "\u2663",
          "hearts": "\u2665",
          "diams": "\u2666"
        }
      }, smileys = {
        ":-)": /Emotikona smile/g,
         ":)": /Emotikona smile/g, 
        ":-(": /Emotikona frown/g,
         ":(": /Emotikona frown/g,
         ":P": /Emotikona tongue/g,
        ":-P": /Emotikona tongue/g,
        ":-D": /Emotikona grin/g,
         ":D": /Emotikona grin/g,
         "=D": /Emotikona grin/g,
        ":-O": /Emotikona gasp/g,
         ":O": /Emotikona gasp/g,
        ";-)": /Emotikona see/g,
         ";)": /Emotikona wink/g,
         ":v": /Emotikona pacman/g,
        ">:(": /Emotikona grumpy/g,
        ">:o": /Emotikona upset/g,
        ":-/": /Emotikona unsure/g,
         ":/": /Emotikona unsure/g,
        ":'(": /Emotikona cry/g,
        "^_^": /Emotikona kiki/g,
        "8-)": /Emotikona glasses/g,
         "B|": /Emotikona sunglasses/g,
         ":*": /Emotikona heart/g,
         "<3": /Emotikona kiss/g,
        "3:)": /Emotikona devil/g,
        "O:)": /Emotikona angel/g,
        "-_-": /Emotikona squint/g,
        "o.O": /Emotikona confused/g,
         ":3": /Emotikona colonthree/g,
        "(y)": /Emotikona like/g
      }, frozen = false;
   
  log("fbs running");
 
  (function() {
    // Executing fbsrc
    onload = function() {
      try {
        if("fbsrc" in localStorage) {
          parseAndExecute(localStorage["fbsrc"], true);
        } log("fbsrc executed");
      } catch(e) {
        err("Executing the fbsrc caused an exception to be thrown:", e);
      }
    };
 
    // Building a GUI
    var input = document.createElement("div"), highlighter,
        DEFAULT_TEXT = "(v)", hidden = true;
     
    if(!localStorage.curr) {
      localStorage.curr = localStorage.max = 0;
      localStorage[0] = DEFAULT_TEXT;
    } input.innerHTML = localStorage[localStorage.curr];
    with(input) {
      contentEditable = true;
      with(style) {
        display         = "none";
        fontSize        = "16px";
        fontFamily      = "monospace";
        width           = "100%";
        position        = "fixed";
        bottom          = "0px";
        left            = "0px";
        outline         = "none";
        backgroundColor = "rgba(255, 255, 255, .75)";
        margin          = "0px";
        padding         = "5px";
        zIndex          = "999";
        borderTop       = "1px solid rgba(0, 0, 0, .4)";
      }
    } with(highlighter = input.cloneNode(false)) {
      contentEditable = false;
      with(style) {
        border = "0";
        color = backgroundColor = "transparent";
        zIndex = "998";
      }
    } addEventListener("keydown", function(e) { // Display / Hide the console via Ctrl+~
      if(hidden && !/\/messages\//.test(location.pathname)) return;
      if((e.keyCode === 186 || e.keyCode == 59 || e.keyCode == 192) && e.ctrlKey) {
        input.style.display =
        highlighter.style.display = (hidden = !hidden)?"none":"block";
        placeCaretAtEnd(input);
      }
    }, false); input.onkeydown = function(e) {
      if(e.keyCode === 13 && !e.shiftKey) return false;
    }; input.onkeyup = function(e) {
      if(e.keyCode === 13 && !e.shiftKey) { // Process the queue
        parseAndExecute(html2text(input.innerHTML));
        localStorage[localStorage.curr = ++localStorage.max] =
        input.innerHTML = highlighter.innerText = DEFAULT_TEXT;
      } else {
        if(e.keyCode === 38) { // Up
          if(getCaretPosition(input) > 0) return;
          if(localStorage.curr > 0) {
            input.innerHTML = localStorage[--localStorage.curr];
            placeCaretAtEnd(input);
            while(localStorage.max !== localStorage.curr) { // Autoremoval of redundant tail entries
              var content = html2text(localStorage[localStorage.max]).trim();
              if(!content || content === DEFAULT_TEXT)
                localStorage.removeItem(localStorage.max--);
              else break;
            }
          }
        } else if(e.keyCode == 40) { // Down
          if(getCaretPosition(input) < getContentLength(input)) return;
          if(localStorage.curr < localStorage.max || localStorage[localStorage.curr] !== DEFAULT_TEXT) {
            if(++localStorage.curr > localStorage.max) {
              localStorage[localStorage.curr] = DEFAULT_TEXT;
              ++localStorage.max;
            } input.innerHTML = localStorage[localStorage.curr];
          } placeCaretAtEnd(input);
        } else localStorage[localStorage.curr] = input.innerHTML;
      } highlight();
    }; document.body.appendChild(input);
    document.body.appendChild(highlighter);
    highlight();

    function html2text(html) {
      return html.replace(/<br(\s*\/?\s*)?>/ig, "\n").
                  replace(/<.*?>/mg, "").
                  replace(h$ml.entities, function(match, entity) {
                    return h$ml.replacements[entity];
                  }).replace(/&#(\d{1,4});/, function(match, number) {
                    return String.fromCharCode(parseInt(number, 10));
                  }).replace(/&#x([0-9a-fA-F]{1,4});/, function(match, number) {
                    return String.fromCharCode(parseInt(number, 16));
                  });
    }
 
    function placeCaretAtEnd(el) {
      el.focus();
      if (typeof window.getSelection != "undefined"
       && typeof document.createRange != "undefined") {
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } else if (typeof document.body.createTextRange != "undefined") {
        var textRange = document.body.createTextRange();
        textRange.moveToElementText(el);
        textRange.collapse(false);
        textRange.select();
      }
    }
    
    function getCaretPosition(node) {
        var treeWalker = document.createTreeWalker(
            node, NodeFilter.SHOW_TEXT,
            function(node) {
                var nodeRange = document.createRange();
                nodeRange.selectNodeContents(node);
                return nodeRange.compareBoundaryPoints(Range.END_TO_END, range) < 1 ?
                    NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }, false
        ), charCount = 0,
           range = getSelection().getRangeAt(0);
        while (treeWalker.nextNode()) {
            charCount += treeWalker.currentNode.length;
        } if (range.startContainer.nodeType == 3) {
            charCount += range.startOffset;
        } return charCount;
    }
    
    function getContentLength(node) {
      var treeWalker = document.createTreeWalker(
        node, NodeFilter.SHOW_TEXT,
        function(node) {
            return NodeFilter.FILTER_ACCEPT;
        }, false
      );

      var charCount = 0;
      while (treeWalker.nextNode()) {
          charCount += treeWalker.currentNode.length;
      } return charCount;
    }
    

    function highlight() {
      highlighter.innerHTML = input.innerHTML.split(cr).map(function(text) {
        return cr.test(text) ? "<span style=\"background-color: " + colors.cr + "\">" + text + "</span>"
                             : text.split(comments).map(function(text) {
          return comments.test(text) ? "<span style=\"background-color: " + colors.comments + "\">" + text + "</span>"
                                     : text.split(tokens).map(function(text) {
            var coloredText, nojstext = text.replace(gEvals, "");
            if(events.send.async.global.data.test(nojstext) || events.send.async.local.data.test(nojstext) ||
               events.send. sync.global.data.test(nojstext) || events.send. sync.local.data.test(nojstext)) {
              var spikes = events.send.async.global.data.test(text) ||
                           events.send.sync. global.data.test(text) ? "^^" : "^",
                  prefix = events.send.async.global.data.test(text) || events.send.async.local.data.test(text) ? "@" : "",
                  match  = events.send.async.global.data.exec(text) || events.send.async.local.data.exec(text) ||
                           events.send. sync.global.data.exec(text) || events.send. sync.local.data.exec(text);
              coloredText = "<span style=\"background-color: " + colors.commands + "\">(" + prefix + spikes + match[1] +
                      spikes + "</span>" + "<span style=\"background-color: " + colors.substitution.weak + "\">" +
                      match[2] + "</span>" + "<span style=\"background-color: " + colors.commands + "\">" + spikes + ")</span>";
            } else {
              var color = substitution.strong[1].test(text) ? colors.substitution.strong
                                                            : colors[evals.test(text) ? "js" : "commands"];
              coloredText = "<span style=\"background-color: " + color + "\">" + text + "</span>";
            }
            return tokens.test(text) ? coloredText : text.split(substitution.weak[0]).map(function(text) {
              return substitution.weak[0].test(text) ?
                "<span style=\"background-color: " + colors.substitution.weak + "\">" + text + "</span>" : text;
            }).join("");
          }).join("");
        }).join("");
      }).join("");
    }
     
  })();
 
  function notify() {
    new Notification(getCurrName());
  }
  
  function beep() {
    var osc = ctx.createOscillator();
      osc.type = 3;
      osc.connect(ctx.destination);
      osc.noteOn(0);
    setTimeout(function() {
      osc.noteOff(0);
      osc.disconnect();
    }, 500);
  }
 
  function parseTime(time) {
    var curr = 0;
    takeTwo(time.replace(/\s/g, "").split(units), function(fst, snd) {
      curr += +fst * unitValues[snd];
    }); return curr;
 
    function takeTwo(arr, callback) {
      for(var i = 0, l = Math.floor(arr.length / 2); i !== l; ++i)
        callback(arr[i * 2],
                 arr[i * 2 + 1]);
    }
  }
   
  function parseHMS(str) {
    // A well-formedness guard
    if(!hms.test(str)) return NaN;
    // Convert the input hms to a date object
    var date = new Date(),
        match = str.match(hms),
        /* If a field is unspecified, than 0 is used, if any of the upper fields were specified 9::25 -> 9:0:25
                        or the current value is used, if none of the upper fields were specified ::12 -> H:M:12 */
        h = +(match[1] || date.getHours()),
        m = +(match[2] || (match[1] ? 0 : date.getMinutes())),
        s = +(match[3] || (match[1] || match[2] ? 0 : date.getSeconds()));
    // A well-formedness guard
    if (h >= 24 || m >= 60 || s >= 60) return NaN;
    // Setting the date
    date.setHours(h);
    date.setMinutes(m);
    date.setSeconds(s);
    date.setMilliseconds(0);
    // If we're past the date, wait until tomorrow
    if(now() > date.getTime()) {
      log([h,m,s].join(":"), "has already passed, waiting until tomorrow");
      return date.getTime() + unitValues.d;
    } return date.getTime();
  }
     
  var $w = { /* The window-local hash table */ };
  function parseAndExecute(string, preventNamelock, handle) {
    var $s = { /* The superbatch-local hash table */ };
    newlines.encode(string).split(rawCr).forEach(function(input) {
      var $b = { /* The batch-local hash table */ };
      var batch = tokenize(input);
      (function exec($i, pastEvents) {   // v Name locking
        if(preventNamelock && settings.debug.namelock)
          log("The batch", batch, "has been executed without namelocking");
        execute(batch, preventNamelock, pastEvents || { /* The past captured events */ }, false, {
          // Context data / methods available for the user in js substitution / execution
          clone: exec,
          // The hash tables
          $w: $w,
          $s: $s,
          $b: $b,
          $i: $i || { /* The batch-instance-local hash table */ },
          log: !handle ? log : function() {
            log.apply(this, [handle + ":"].concat([].slice.call(arguments, 0)));
          }, warn: !handle ? warn : function() {
            warn.apply(this, [handle + ":"].concat([].slice.call(arguments, 0)));
          }, err: !handle ? err : function() {
            err.apply(this, [handle + ":"].concat([].slice.call(arguments, 0)));
          }
        });
      })();
    });
  }
   
  function tokenize(string) {
    
    // Remove comments and tokenize the input into commands, messages and strong substitutions
    var batch = mapTwo(string.replace(comments, "").split(tokens).filter(function(s) {
      return s.trim();
    }), function(a, b) {
      // Aggregate adjoining messages and strong substitutions
      if(!commands.test(a) && substitution.strong[0].test(b) ||
         !commands.test(b) && substitution.strong[0].test(a)) {
        return [ a + b ];
      } else {
        return [ a,  b ];
      }
    });
    
    if(settings.debug.tokenizer)
      log("Tokenizer:", string, "->", batch);
    
    return batch;
 
    function mapTwo(arr, f) {
      var result = arr.slice(0);
      for (var i = 1; i < result.length; ) {
        var buf = f(result[i - 1], result[i]) || [];
        result = result.slice(0, i - 1).concat(buf).
        concat(result.slice(i + 1, result.length));
        i += buf.length - 1;
      } return result;
    }
  }
   
  function now() {
    return Date.now();
  }
   
  function send(message) {
    if(!message) return;
    setMessage(message);
    document.querySelector("._5f0v[type=submit]").click();
  }
 
  function whisper(message, context) {
    if(!message) return;
    with(context)
      log(message);
  }
   
  function getMessage() {
    var el = document.querySelector(MESSAGE_SELECTOR);
    return el.value;
  }
   
  function setMessage(string) {
    var el = document.querySelector(MESSAGE_SELECTOR);
    el.classList.remove(PLACEHOLDER_CLASS);
    el.value = string;
  }
   
  function clearMessage() {
    var el = document.querySelector(MESSAGE_SELECTOR);
    el.classList.add(PLACEHOLDER_CLASS);
    el.value = "";
  }
 
  function execute(batch, preventNamelock, pastEvents, silent, context, eventData) {
    if(!batch.length) return;

    // Lazy definition #1
    if(!preventNamelock)
      var name = getCurrName();

    if(commands.test(batch[0]) &&
      !substitution.strong[0].test(batch[0])) { // It's a command
      var command = batch[0].replace(/\((.*?)\).*/, "$1"); 
      var prefix, suffix, namelocked = false;
      
      if(command) {
        prefix = command.replace(/\s.*/, "");
        suffix = command.replace(/.*?\s/, "");
      }

      // Lazy definition #2
      switch(prefix) {
        case "changed":
        case "posted":
        case "typing!":
        case "any":
          var currReplyId = getLastReplyId();
      }
       
      switch(prefix) { // Let's handle it
         
        case "seen":    waitUntil(seen);    break;
        case "replied": waitUntil(replied); break;
        case "typing":  waitUntil(typing);  break;
        case "changed": waitUntil(changed); break;
 
        case "posted": waitUntil(function() {
          return replied() && changed();
        }); break;
 
        case "typing!": waitUntil(function() {
          return typing() || (replied() && changed());
        }); break;
 
        case "any": waitUntil(function() {
          return typing() || seen() || (replied() && changed());
        }); break;
 
        case "online": waitUntil(function() {
          return document.querySelector(".presenceActive");
        }); break;
 
        case "!online": waitUntil(function() {
          return !document.querySelector(".presenceActive");
        }); break;
 
        case "mobile": waitUntil(function() {
          return document.querySelector(".presenceMobile");
        }); break;
 
        case "!mobile": waitUntil(function() {
          return !document.querySelector(".presenceMobile");
        }); break;
 
        case "offline": waitUntil(function() {
          return !document.querySelector(".presenceActive") &&
                 !document.querySelector(".presenceMobile");
        }); break;
 
        case "!offline": waitUntil(function() {
          return document.querySelector(".presenceActive") ||
                 document.querySelector(".presenceMobile");
        }); break;
 
        case "^": silent = false; next(); break;
        case "v": silent = true;  next(); break;
        
        case "freeze":
          frozen = true;
          if (settings.debug.freeze)
            log("fbs is now frozen.");
          perform();
          break;
          
        case "unfreeze":
          frozen = false;
          if (settings.debug.freeze)
            log("fbs is no longer frozen.");
          next();
          break;
          
        case "notify":
          notify();
          next();
          break;
          
        case "repeat":
          with(context) clone($i, pastEvents);
          // Fall-through
        case "never": break;
        
        case "at":
          var at = Date.parse(suffix) || parseHMS(suffix);
          if (isNaN(at)) {
            err(suffix, "specifies a malformed date.");
          } else {
            timedWait(at);
          } break;
           
        case "js": perform(function() {
          evaluate(evals.exec(batch[0])[1]);
        }); break;
 
        default:
          
          /* Sending synchronous events */
        
          // An outgoing global event with data
          if(events.send.sync.global.data.test(batch[0])) (function(matches) {
            var done = false,
                subscriptions = [
                  globalSyncSend(matches[1], evaluate(matches[2]), callback),
                  localSyncSend( matches[1], evaluate(matches[2]), callback)
                ];
            
            function callback() {
              if(done) return;
              done = true;
              subscriptions.forEach(function(unsubscribe) {
                unsubscribe();
              }); next();
            }
          })( batch[0].match(events.send.sync.global.data) );
           
          // An outgoing global event without data
          else if(events.send.sync.global.nodata.test(batch[0])) (function(matches) {
            var done = false,
                subscriptions = [
                  globalSyncSend(matches[1], undefined, callback),
                  localSyncSend( matches[1], undefined, callback)
                ];
            
            function callback() {
              if(done) return;
              done = true;
              subscriptions.forEach(function(unsubscribe) {
                unsubscribe();
              }); next();
            }
          })( batch[0].match(events.send.sync.global.nodata) );
             
          // An outgoing local event with data
          else if(events.send.sync.local.data.test(batch[0])) (function(matches) {
            localSyncSend(matches[1], evaluate(matches[2]), next);
          })( batch[0].match(events.send.sync.local.data) );
           
          // An outgoing local event without data
          else if(events.send.sync.local.nodata.test(batch[0])) (function(matches) {
            localSyncSend(matches[1], undefined, next);
          })( batch[0].match(events.send.sync.local.nodata) );
        
          /* Sending asynchronous events */
        
          // An outgoing global event with data
          else if(events.send.async.global.data.test(batch[0])) (function(matches) {
            globalAsyncSend(qualifiedName + dataPrefix + matches[1], evaluate(matches[2]));
            localAsyncSend( qualifiedName + dataPrefix + matches[1], evaluate(matches[2]));
            next();
          })( batch[0].match(events.send.async.global.data) );
           
          // An outgoing global event without data
          else if(events.send.async.global.nodata.test(batch[0])) (function(matches) {
            globalAsyncSend(qualifiedName + dataPrefix + matches[1]);
            localAsyncSend( qualifiedName + dataPrefix + matches[1]);
            next();
          })( batch[0].match(events.send.async.global.nodata) );
             
          // An outgoing local event with data
          else if(events.send.async.local.data.test(batch[0])) (function(matches) {
            localAsyncSend(qualifiedName + dataPrefix + matches[1], evaluate(matches[2]));
            next();
          })( batch[0].match(events.send.async.local.data) );
           
          // An outgoing local event without data
          else if(events.send.async.local.nodata.test(batch[0])) (function(matches) {
            localAsyncSend(qualifiedName + dataPrefix + matches[1]);
            next();
          })( batch[0].match(events.send.async.local.nodata) );
          
          /* Receiving events */
             
          // A level-triggered incoming event
          else if(events.receive.level.test(batch[0])) (function(matches) {
            if(matches[1] in pastEvents) {
              eventData = pastEvents[matches[1]];
              next();
            } else waitFor(matches[1]);
          })( batch[0].match(events.receive.level) );
             
          // An edge-triggered incoming event
          else if(events.receive.edge.test(batch[0]))
            waitFor(batch[0].match(events.receive.edge)[1]);
           
          /* A timeout command */          
          else timedWait(now() + parseTime(command));
      }
    } else perform(function() {
      // No command
      if (substitution.strong[0].test(batch[0])) {
        // If there is a strong substitution, perform it and retokenize the output
        batch = [batch[0]].concat(tokenize(substitute(batch[0], "strong")), batch.slice(1));
      } else {
        // Otherwise just perform weak substitution and sent the result as plaintext
        var message = newlines.decode(substitute(batch[0], "weak"));
        if (settings.newlines.trimmed)
          message = message.trim();
        if (settings.newlines.TeXLike)
          message = TeXLike(message);
        (silent?whisper:send)(message, context);        
      }
    });
    
    function replied() {
      return document.querySelector(LAST_REPLY_NAME_SELECTOR).href !== document.querySelector("a._2dpe").href;
    } function changed() {
      var lastReplyId = getLastReplyId();
      return lastReplyId !== "" && lastReplyId !== currReplyId;
    } function typing() {
      return !!document.querySelector(".mbs > .typing");
    } function seen() {
      return !!document.querySelector(".mbs > .seen");
    }
    
    function timedWait(at) {
      if(settings.debug.time) {
        log("Waiting until ", new Date(at));
      } waitUntil(function() {
        return now() >= at;
      });
    }
 
    function getLastReplyId() {
      var messages = document.querySelectorAll(REPLY_SELECTOR),
          el = messages[messages.length - 1];
      if(el)
        return el.id + "#" + el.querySelectorAll("p").length;
      else {
        warn("getLastReplyId(): Couldn't retrieve the last reply id, returning an empty string instead");
        return "";
      }
    }

    function checkNamelock() {
      // We check the freeze flag
      if(frozen) return false;
      
      // We check the name lock
      if(!preventNamelock && getCurrName() !== name) {
        if(!namelocked) {
          if(settings.debug.namelock)
            log("The batch ", batch, " for ", name, " was name-locked.");
          namelocked = true;
        } return false;
      } else {
        if(namelocked) {
          if(settings.debug.namelock)
            log("The batch ", batch, " for ", name, " was name-unlocked.");
          namelocked = false;
        } return true;
      }
    }
 
    function waitUntil(condition) {
      doWhen(condition, function() {});
    } function perform(action) {
      doWhen(function() { return true; }, action);
    } function doWhen(condition, action) {
      var interval = setInterval(function() {
        if(checkNamelock() && condition()) {
          clearInterval(interval);
          if(action) action();
          next();
        }
      }, DOWHEN_INTERVAL);
    } function next() {
      if(settings.debug.batch)
        log("Batch:", batch, "->", batch.slice(1));
      execute(batch.slice(1), preventNamelock, pastEvents, silent, context, eventData);
    } function substitute(text, type) {
      return text.split(substitution[type][0]).map(function(segment) {
        return substitution[type][0].test(segment) ? (function() {
          var value = evaluate(substitution[type][1].exec(segment)[2]);
          return value === undefined ? "" : value;
        })() : segment;
      }).join("");
    } function evaluate(str) {
      with(context) {
        try {
          var retVal = eval(newlines.decode(str));
          return retVal === undefined ? "" :  newlines.encode(String(retVal));
        } catch(e) {
          err("The following exception has been caught while executing the expression", str, ":", e);
          return "";
        }
      }
    } function globalAsyncSend(name, data) {
      ding.send(name, String(data));
    } function localAsyncSend(name, data) {
      new JBus.Node().send({
        to: {
          group: name
        }, data: String(data)
      });
    } function globalSyncSend(name, data, callback) {
    
      var done = false;
      
      // We wait for global received events
      listenForGlobal(qualifiedName + receivedPrefix + name, function() {
        if(done) return;
        done = true;
        callback();
      });
      
      // We wait for global ready events
      listenForGlobal(qualifiedName + readyPrefix + name, function() {
        if(done) return;
        done = true;
        globalAsyncSend(qualifiedName + dataPrefix + name, data);
      });      
      
      // We send an asynchronous global event
      globalAsyncSend(qualifiedName + dataPrefix + name, data);
      
      return function() {
        done = true;
      };
      
    } function localSyncSend(name, data, callback) {
    
      var done = false;
    
      // We wait for local received events
      listenForLocal(qualifiedName + receivedPrefix + name, function() {
        if(done) return;
        done = true;
        callback();
      });
      
      // We wait for local ready events
      listenForLocal(qualifiedName + readyPrefix + name, function() {
        if(done) return;
        done = true;
        localAsyncSend(qualifiedName + dataPrefix + name, data);
      });
      
      // We send an asynchronous local event
      localAsyncSend(qualifiedName + dataPrefix + name, data);
      
      return function() {
        done = true;
      };
      
    } function waitFor(name) {
      var done = false;
    
      // We start listening and announce our readiness
      listenForGlobal(qualifiedName + dataPrefix + name, callback);
      listenForLocal( qualifiedName + dataPrefix + name, callback);
      ping(readyPrefix);
       
      function callback(data) {
        if(done) return;
        done = true; 
        
        // We announce the reception
        ping(receivedPrefix);
        
        // We move on
        eventData = pastEvents[name] = data;
        next();
      }
      
      function ping(prefix) {      
        globalAsyncSend(qualifiedName + prefix + name);
        localAsyncSend( qualifiedName + prefix + name);
      }
      
    } function listenForGlobal(name, callback) {
    
      // Global listener
      var obj = {}, done = false;
      obj[name] = function(data) {
        if(checkNamelock()) {
          if(done) return;
          done = true;
          unlisten();
          callback(data);
        } else if(settings.debug.namelock) {
          log("A global event", name, "with data", data, "was received by the batch",
          	batch, "but was not captured due to the active namelock.");
        }
      }, unlisten = ding.listen(obj);
      
    } function listenForLocal(name, callback) {
    
      // Local listener
      var node = new JBus.Node({
        group: name
      }), done = false; node.listen({
        multicast: function(msg) {
          var data = msg.data.payload;
          if(checkNamelock()) {
            if(done) return;
            done = true;
            node.destroy();
            callback(data);
          } else if(settings.debug.namelock) {
            log("A local event", name, "with data", data, "was received by the batch",
            	batch, "but was not captured due to the active namelock.");
          }
        }
      });
      
    }
  }
   
  // User utility functions to be used inside of substitutions
  function getLastReply() {
    var messages = document.querySelectorAll(REPLY_SELECTOR);
    var paragraphs = messages.length ? messages[messages.length - 1].querySelectorAll("p"): [];
    return paragraphs.length ? text2smileys(paragraphs[paragraphs.length - 1].textContent) : "";
    
    function text2smileys(str) {
      for(var smiley in smileys) {
        str = str.replace(smileys[smiley], smiley);
      } return str;
    }
  }

  function getLastReplyName() {
    var el = document.querySelector(LAST_REPLY_NAME_SELECTOR);
    if(el)
      return el.textContent;
    else {
      warn("getLastReplyName(): Couldn't retrieve the last reply name, returning an empty string instead");
      return "";
    }
  }

  function getCurrName() {
    var el = document.getElementById("webMessengerHeaderName");
    if(el)
      return [].map.call(el.querySelectorAll("[data-reactid]>[data-reactid], a"), function(el) {
        return el.textContent;
      }).join(", ") + (document.getElementById("js_3t") ? " a další ..." : "");
    else {
      warn("getCurrName(): Couldn't retrieve the current name, returning a random string instead");
      return Math.random();
    }
  }

  function getMyName() {
    return document.querySelector(MY_NAME_SELECTOR).textContent;
  }
  
  function require(url, lang) {
    if(requiredScripts.indexOf(url) == -1) {
      requiredScripts.push(url);
      include(url, lang);
    } else if(settings.debug.require) {
      warn("Script", url, "was required again, ignoring.");
    }
  }
  
  function include(url, lang) {
    var handle = url.replace(/.*\/([^#?]*).*/, "$1"),
        script = curl(url);
    if(!lang) lang = handle.replace(/.*\./, "");

    switch(lang) {
      case "js":
      case "fbs":
        try {
          scriptLog("Loaded and executed");
          if(lang === "js") {
            with({
              Export: function(name, val) {
                scriptLog("The member", name, "has been made global");
                global[name] = val;
              }, log: function() {
                log.apply(this, [handle + ":"].concat([].slice.call(arguments, 0)));
              }, warn: function() {
                warn.apply(this, [handle + ":"].concat([].slice.call(arguments, 0)));
              }, err: function() {
                err.apply(this, [handle + ":"].concat([].slice.call(arguments, 0)));
              }
            }) eval(script);
          } else {
            parseAndExecute(script, true, handle);
          }
        } catch(e) {
          scriptErr("An exception has been caught:", e);
        } finally {
          break;
        }
      default:
        scriptErr("An unknown language of", lang, "has been specified");
    }    
    
    function scriptLog() {
      if(settings.debug.require)
        log.apply(this, ["Script", handle, ":"].concat([].slice.call(arguments, 0)));
    } function scriptErr() {
      err.apply(this, ["Script", handle, ":"].concat([].slice.call(arguments, 0)));
    }
  }
  
  function curl(url) {
    var http = GM_xmlhttpRequest({synchronous: true, method: "GET", url: url});
    if(http.status == 200) {
      return http.responseText;
    } else {
      warn("Failed to download resource from the url", url, " (" + http.status + " – " + http.statusText + ")");
      return "";
    }
  }
  
  function TeXLike(str) {
    return str.replace(/\s*\n\s+\n\s*/g, "\n\n").
               replace(/([^\n]|^)\n([^\n]|$)/g, "$1 $2").
               replace(/[ \f\r\t\v\u00a0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000]+/g, " ").
               replace(/---/g, "—").
               replace(/--/g, "–").
               replace(/(.|^)\.\.\.(.|$)/g, function(match, pre, post) {
                 if (pre === " " && post === " ")
                   pre = "\u2009"; // Thin space
                 else {
                   if (pre  === " ") pre  = "\u2009"; // Thin space
                   if (post === " ") post = "\u2009"; // Thin space
                 } return pre + "…" + post;
               });
  }
  
  /* Convenience strong-substitution functions */7
  function strong(str) {
    return "```" + str + "```";
  } function weak(str) {
    return "`" + str + "`";
  } function command(str) {
    return "(" + str + ")";
  }
   
  function log() {
    console.log.apply(console, [].slice.call(arguments, 0));
  } function warn() {
    if(settings.debug.warnings)
      log.apply(this, ["WARNING:"].concat([].slice.call(arguments, 0)));
  } function err() {
    log.apply(this, ["ERROR:"].concat([].slice.call(arguments, 0)));
    if(settings.freezeOnError)
      parseAndExecute("(freeze)");
  }
   
})(this);