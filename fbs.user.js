// ==UserScript==
// @name           Facebook Batch Sender
// @author         Witiko
// @include        http*://www.facebook.com/messages/*
// @require        http://tiny.cc/jBus
// @require        http://tiny.cc/dingjs
// @require        http://mujweb.cz/richnovotny/math/math.js
// @require        https://www.dropbox.com/s/51aj7vvttwxbnxy/marek.js?dl=1
// @require        https://www.dropbox.com/s/mgelvou7twxfngy/grammar.js?dl=1
// @downloadURL    https://www.dropbox.com/s/5eet5uqk54xdwlc/fbs.user.js?dl=1
// @grant          none
// @version        1.05
// ==/UserScript==
 
/*
 
  Input: <Message1/Command1><Message2/Command2> ... <MessageN/CommandN>(;)
         <Message1/Command1><Message2/Command2> ... <MessageN/CommandN>(;)
         <Message1/Command1><Message2/Command2> ... <MessageN/CommandN>
          
         Each of the sections delimited by (;) is processed in parallel to the others.
 
  Commands:
    Responding to actions:
          (seen) - Wait until the previous message has been marked as seen
       (replied) - Wait until the recipient has replied to you (gets consumed, when the sender of the last message isn't you)
        (posted) - Wait until the recipient has posted a message (gets consumed, when a new message is received)
       (changed) - Wait until the last message in the chat has changed (be it because of you oor the recipient)
        (typing) - Wait until the recipient has started typing to you
       (typing!) - Wait until the recipient has started typing to you / posted a message
           (any) - Wait until the recipient has started typing to you / posted a message / seen the previous message
 
    Responding to states:
        (online) - Wait until the recipient has gone online
       (!online) - Wait until the recipient is no longer online
        (mobile) - Wait until the recipient has gone mobile
       (!mobile) - Wait until the recipient is no longer mobile
       (offline) - Wait until the recipient has gone offline
      (!offline) - Wait until the recipient is no longer offline
       
  User-defined events:
        (^EVENT)
     or (^EVENT^)  - Emit an event named EVENT in the current window passing undefined as the message
    (^EVENT^DATA^) - Emit an event named EVENT in the current window passing eval("DATA") as the message
       (^^EVENT)
    or (^^EVENT^^) - Emit an event named EVENT in all open windows passing "undefined" as the message
 (^^EVENT^^DATA^^) - Emit an event named EVENT in all open windows passing String(eval("DATA")) as the message
        (:EVENT)   - Wait until the event named EVENT has occured in the current window and capture it
                     Edge-triggered -- waits until the event occurs
       (::EVENT)   - Wait until the event named EVENT has occured in the current window and capture it
                     Level-triggered -- returns immediately, if the event has already been captured)
 
    Miscellaneous:
             (v) - Redirect all following messages to console.log
             (^) - Redirect all following messages to the current recipient (implicit)
          (beep) - Let out a beeping sound (html5.audioContext dependent)
         (never) - Block indefinitely
         (at #1) - Wait until the specified point in time
                 - If isNaN(Date.parse("#1")), then a HH:MM:SS format is assumed (see function parseHMS for details)
                 - If isNaN(parseHMS("#1")), then an exception is logged and (at #1) evaluates to (never)
   (/...) (//...
    or (//...//) - These commands are ignored (comments)
 
   (<#1><unit1> <#2><unit2> ...
    <#N><unitN>) - Wait \sum_{1\leq I\leq N}#i <unitI>, where <unitI>\in:
               Y - Years
               M - Months
               d - Days
               h - Hours
               m - Minutes
               s - Seconds
              ms - Milliseconds
    
    (js)...(js)
    or (js)...   - Execute the enclosed javascript code
          `...`  - Execute the enclosed javascript code and substitute the command for its return value. (weak)
                   Weak substitution is only allowed within messages.
                   Weak substitution is non-recursive -- its return value is always regarded as a message.
                    
                   Examples:                  
                     Did you know that 1 + 2 = `1 + 2`?  ~>  Did you know that 1 + 2 = 3?
                     Hey, `getCurrName()`, I am `getMyName()`.  ~>  Hey, Karel, I am Vít.
                    
         ``...`` - Execute the enclosed javascript code and substitute the command for its return value. (strong)
                   Strong substitution is allowed anywhere.
                   Strong substitution is recursive -- its return value is always retokenized.
                    
                   Examples:
                     (``1 + 2``s)You've got five seconds to tell me where I am and three have just passed.
                     This will get posted.(``condition ? "^" : "v"``)And this will conditionally not get posted.
                    
                   The following additional methods are available for execution, substitution and event sending:
 
       getCurrName() - The name of the recipients of the current chat window
         getMyName() - The first name of the sender
           eventData - The data of the last captured event
      getLastReply() - The last chat message
  getLastReplyName() - The name of the last chat message sender
            repeat() - Repeat the entire batch (poor man's loop)
            editRc() - Pastes the entire fbsrc into the message box.
                       Double-clicking the message box saves the new fbsrc.
      log(arg1, ...) - Log the arguments into the console.
 
  Name locking:
    Each input you execute is locked to the name of the current recipient.
    Input execution will be paused each time you switch to another user.
    Fbsrc inputs are exempt from this rule.
 
  Fbsrc:
    You can store a sequence of inputs delimited by (cr) in localStorage.fbsrc.
    These inputs will be automatically executed (without name locking) each time the userscript is loaded.
   
  Tokenization:
    The input tokenization is performed in three steps (see function tokenize):
     
      1) In the first step, the input is split into sections delimited by (cr). For each section:
        a) In the first step, the section is split into comments and non-comments and comments are discarded.
        b) In the second step non-comments are split into strong substitution / commands and messages.
        c) In the third step, adjoining strong substitution and messages are concatenated into compound messages.
     
  Execution:
    The input string is tokenized and sequentially processed (see function execute):
     
      1) If the token is a command, the command is performed.
      2) If the token is a message, then:
        a) If the message contains a strong substitution, the substitution is performed, the resulting string
           is retokenized, the tokens are put in place of the original message and then executed.
        b) Otherwise:
           i) If the message contains a weak substitution, the substitution is performed.
          ii) The resulting string is sent to the current recipient / logged.
         
 
*/
 
(function() {
  if(window.top != window && window.top != window.unsafeWindow) return;
  var rawCommands = /\(js\)(?:.*?)(?:\(js\)|$)|\(v\)|\(\^\)|\(\^\^[a-zA-Z0-9\-.]+?\^\^.+?\^\^\)|\(\^\^[a-zA-Z0-9\-.]+?(?:\^\^)?\)|\(\^[a-zA-Z0-9\-.]+?\^.+?\^\)|\(\^[a-zA-Z0-9\-.]+?(?:\^)?\)|\(::?[a-zA-Z0-9\-.]+?\)|\(at .*?\)|\((?:\d+(?:Y|M|d|h|ms|m|s)\s?)+\)|\(never\)|\(seen\)|\(typing!?\)|\(any\)|\(beep\)|\(replied\)|\(changed\)|\(posted\)|\(!?(?:(?:on|off)line|mobile)\)/,
      events = {
        globalSend: {
          data:   /\(\^\^([a-zA-Z0-9\-.]+?)\^\^(.+?)\^\^\)/,
          nodata: /\(\^\^([a-zA-Z0-9\-.]+?)(?:\^\^)?\)/,
        }, localSend: {
          data:   /\(\^([a-zA-Z0-9\-.]+?)\^(.+?)\^\)/,
          nodata: /\(\^([a-zA-Z0-9\-.]+?)(?:\^)?\)/
        }, receive: {
          level:  /\(::([a-zA-Z0-9\-.]+?)\)/,
          edge:    /\(:([a-zA-Z0-9\-.]+?)\)/
        }
      }, commands = new RegExp("(" + rawCommands.source + ")"),
      evals = /\(js\)(.*?)(?:\(js\)|$)/, rawCr = /\(;\)/,
      cr = new RegExp("(" + rawCr.source + ")"),
      substitution = {
        //      outer capture, inner capture, no capture
        weak:   [  /(`.*?`)/ ,  /(`(.*?)`)/ ,  /`.*?`/  ],
        strong: [ /(``.*?``)/, /(``(.*?)``)/, /``.*?``/ ]
      }, rawTokens = new RegExp(substitution.strong[2].source + "|" + rawCommands.source),
      tokens = new RegExp("(" + rawTokens.source + ")"),
      comments = /(\(\/\/.*?(?:\/\/\)|$)|\(\/.*?\))/,
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
      }, ctx = new (window.audioContext || window.webkitAudioContext || (function() {
        // A dummy audioContext object
        this.createOscillator = function() {};
        this.connect          = function() {};
        this.disconnect       = function() {};
        this.noteOn           = function() {};
        this.noteOff          = function() {};
      })), MESSAGE_SELECTOR = 'textarea[name="message_body"]',
      PLACEHOLDER_CLASS = "DOMControl_placeholder",
      REPLY_SELECTOR = "div[role=log] li.webMessengerMessageGroup",
      LAST_REPLY_NAME_SELECTOR = "div[role=log] li:last-child strong > a",
      MY_NAME_SELECTOR = "._2dpb", qualifiedName = "name.witiko.fbs.",
      pastEvents = {};
   
  log("fbs running");
 
  (function() {
    // Executing fbsrc
    onload = function() {
      if("fbsrc" in localStorage) {
        parseAndExecute(localStorage["fbsrc"]);
      } log("fbsrc executed");
    };
 
    // Building a GUI
    var input = document.createElement("div"), highlighter,
        DEFAULT_TEXT = "(v)",
        ERASABLE = /^(\(v\)|\s*|<br\s*\/?\s*>)$/i,
        hidden = true;
     
    if(!localStorage.curr) {
      localStorage.curr = localStorage.max = 0;
      localStorage[0] = DEFAULT_TEXT;
    } input.innerHTML = localStorage[localStorage.curr];
    with(input) {
      contentEditable = true;
      with(style) {
        display = "none";
        fontSize = "16px";
        width = "100%";
        position = "fixed";
        bottom = "0px";
        left = "0px";
        outline = "none";
        backgroundColor = "rgba(255, 255, 255, .75)";
        margin = "0px";
        padding = "5px";
        zIndex = "999";
        borderTop = "1px solid rgba(0, 0, 0, .4)";
      }
    } with(highlighter = input.cloneNode(false)) {
      contentEditable = false;
      with(style) {
        border = "0";
        color = backgroundColor = "transparent";
        zIndex = "998";
      }
    } onkeydown = function(e) { // Display / Hide the console via Ctrl+~
      if(hidden && !/\/messages\//.test(location.pathname)) return;
      if((e.keyCode === 186 || e.keyCode == 59 || e.keyCode == 192) && e.ctrlKey) {
        input.style.display =
        highlighter.style.display = (hidden = !hidden)?"none":"block";
        placeCaretAtEnd(input);
      }
    }; input.onkeydown = function(e) {
      if(e.keyCode === 13 && !e.shiftKey) return false;
    };
    input.onkeyup = function(e) {
      if(e.keyCode === 13 && !e.shiftKey) { // Process the queue
        parseAndExecute(input.textContent, getCurrName());
        localStorage[localStorage.curr = ++localStorage.max] =
        input.innerHTML = highlighter.innerText = DEFAULT_TEXT;
      } else {
        if(e.keyCode === 38) { // Up
          if(localStorage.curr > 0) {
            input.innerHTML = localStorage[--localStorage.curr];
            placeCaretAtEnd(input);
            while(localStorage.max !== localStorage.curr) { // Autoremoval of redundant tail entries
              if(ERASABLE.test(localStorage[localStorage.max]))
                localStorage.removeItem(localStorage.max--);
              else break;
            }
          }
        } else if(e.keyCode == 40) { // Down
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
     
    function parseAndExecute(string, name) {
      string.split(rawCr).forEach(function(input) {
        var batch = tokenize(input);
        (function exec() {   // v Name locking
          execute(batch, false, name, {
            // Context data / methods available for the user in js substitution / execution
            repeat: exec
          });
        })();
      });
    }
     
    function highlight() {
      highlighter.innerHTML = input.innerHTML.split(cr).map(function(text) {
        return cr.test(text) ? "<span style=\"background-color: " + colors.cr + "\">" + text + "</span>"
                             : text.split(comments).map(function(text) {
          return comments.test(text) ? "<span style=\"background-color: " + colors.comments + "\">" + text + "</span>"
                                     : text.split(tokens).map(function(text) {
            var coloredText;
            if(events.globalSend.data.test(text) || events.localSend.data.test(text)) {
              var spikes = events.globalSend.data.test(text) ? "^^" : "^",
                  match  = events.globalSend.data.test(text) ? text.match(events.globalSend.data) : text.match(events.localSend.data);
              coloredText = "<span style=\"background-color: " + colors.commands + "\">(" + spikes + match[1] + spikes + "</span>" +
                      "<span style=\"background-color: " + colors.substitution.weak + "\">" + match[2] + "</span>" +
                      "<span style=\"background-color: " + colors.commands + "\">" + spikes + ")</span>";
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
 
  function beep() { // Let us let out a beep
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
   
  function tokenize(string) {
    // Remove comments and tokenize the input into commands, messages and strong substitutions
    var batch = string.replace(comments, "").split(tokens).filter( function(s) { return s.trim(); });
     
    // Aggregate adjoining messages and strong substitutions
    return mapTwo(batch, function(a, b) {
      if(!commands.test(a) && substitution.strong[0].test(b) ||
         !commands.test(b) && substitution.strong[0].test(a)) {
        return [ a + b ];
      } else {
        return [ a,  b ];
      }
    });
 
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
    document.querySelector("input[value=\"Odpovědět\"]").click();
  }
 
  function whisper(message) {
    if(!message) return;
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
 
  function execute(batch, silent, name, context, eventData) {
    if(!batch.length) return;
    if(commands.test(batch[0]) &&
      !substitution.strong[0].test(batch[0])) { // It's a command
      var command = batch[0].replace(/\((.*?)\).*/, "$1"); 
      var prefix, suffix, namelocked = false,
          currReplyId = getLastReplyId();
      if(command) {
        prefix = command.replace(/\s.*/, "");
        suffix = command.replace(/.*?\s/, "");
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
        case "beep": perform(beep); break;
        case "never": break;
        case "at":
          var at = Date.parse(suffix) || parseHMS(suffix);
          if (isNaN(at)) {
            log(suffix, "specifies a malformed date.");
          } else setTimeout(perform, at - now()); break;
           
        case "js": perform(function() {
          with(context) {
            try {
              eval(evals.exec(batch[0])[1]);
            } catch(e) {
              log(e);
            }
          }
        }); break;
 
        default:
          // An outgoing global event with data
          if(events.globalSend.data.test(batch[0])) (function(matches) {
            globalSend(matches[1], evaluate(matches[2]));
            next();
          })( batch[0].match(events.globalSend.data) );
           
          // An outgoing global event without data
          else if(events.globalSend.nodata.test(batch[0])) (function(matches) {
            globalSend(matches[1], "undefined");
            next();
          })( batch[0].match(events.globalSend.nodata) );
             
          // An outgoing local event with data
          if(events.localSend.data.test(batch[0])) (function(matches) {
            localSend(matches[1], evaluate(matches[2]));
            next();
          })( batch[0].match(events.localSend.data) );
           
          // An outgoing local event without data
          else if(events.localSend.nodata.test(batch[0])) (function(matches) {
            localSend(matches[1], "undefined");
            next();
          })( batch[0].match(events.localSend.nodata) );
             
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
           
          // A timeout command
          else setTimeout(perform, parseTime(command));
      }
    } else perform(function() {
      // No command
      if(substitution.strong[0].test(batch[0])) {
        // If there is a strong substitution, perform it and retokenize the output
        batch = [batch[0]].concat(tokenize(substitute(batch[0], "strong")), batch.slice(1));
      } else {
        // Otherwise just perform weak substitution and sent the result as plaintext
        (silent?whisper:send)(substitute(batch[0], "weak").trim());
      }
    });
    
    function replied() {
      return document.querySelector(LAST_REPLY_NAME_SELECTOR).href !== document.querySelector("a._2dpe").href;
    } function changed() {
      return getLastReplyId() !== currReplyId;
    } function typing() {
      return !!document.querySelector(".typing");
    } function seen() {
      return document.querySelector("._kv .seenByListener").classList.contains("seenByAll");
    }
 
    function getLastReplyId() {
      var messages = document.querySelectorAll(REPLY_SELECTOR),
          el = messages[messages.length - 1];
      return el.id + "#" + el.querySelectorAll("p").length;
    }
 
    function waitUntil(condition) {
      doWhen(condition, function() {});
    } function perform(action) {
      doWhen(function() { return true; }, action);
    } function doWhen(condition, action) {
      var interval = setInterval(function() {
        // Checking the namelock
        if(name && getCurrName() !== name) {
          if(!namelocked) {
            log("The batch ", batch, " for ", name, " was name-locked.");
            namelocked = true;
          }
        } else {
          if(namelocked) {
            log("The batch ", batch, " for ", name, " was name-unlocked.");
            namelocked = false;
          } if(condition()) {
            clearInterval(interval);
            if(action) action();
            next();
          }
        }
      }, 100);
    } function next() {
      execute(batch.slice(1), silent, name, context, eventData);
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
          return eval(str);
        } catch(e) {
          log(e);
        }
      }
    } function globalSend(name, data) {
      data = String(data);
      ding.send(qualifiedName + name, data);
      localSend(name, data);
    } function localSend(name, data) {
      new JBus.Node().send({
        to: {
          group: qualifiedName + name
        }, data: data
      });
    } function waitFor(name) {
       
      // Global listener
      var obj = {}, done = false;
      obj[qualifiedName + name] = callback;
      ding.listen(obj);
       
      // Local listener
      var node = new JBus.Node({
        group: qualifiedName + name
      }); node.listen({
        multicast: function(msg) {
          node.destroy();
          callback(msg.data.payload);
        }
      });
       
      function callback(data) {
        if(done) return;
        done = true;
        eventData = pastEvents[name] = data;
        next();
      }
    }
  }
   
  // User utility functions to be used inside of substitutions
  function getLastReply() {
    var messages = document.querySelectorAll(REPLY_SELECTOR);
    var paragraphs = messages[messages.length - 1].querySelectorAll("p");
    return paragraphs[paragraphs.length - 1].textContent;
  }

  function getLastReplyName() {
    return document.querySelector(LAST_REPLY_NAME_SELECTOR).textContent;
  }
   
  function getCurrName() {
    return [].map.call(webMessengerHeaderName.querySelectorAll("a[data-hovercard]"), function(el) {
      return el.textContent;
    }).join(", ");
  }
   
  function getMyName() {
    return document.querySelector(MY_NAME_SELECTOR).textContent;
  }
   
  function editRc() {
    log("editing fbsrc");
    setMessage(localStorage.fbsrc);
    var checkbox = Array.prototype.filter.call(document.getElementsByTagName("span"), function(el) {
      return /Odeslat stisknutím klávesy enter/.test(el.textContent);
    })[0].parentElement; checkbox.click(); checkbox.click();
    var checked = checkbox.getAttribute("aria-checked") == "true";
    if (checked) checkbox.click();
    document.querySelector(MESSAGE_SELECTOR).ondblclick = function(e) {
      log("fbsrc stored");
      localStorage.fbsrc = getMessage();
      clearMessage();
      if (checked) checkbox.click();
      document.querySelector(MESSAGE_SELECTOR).ondblclick = null;
    }
  }
   
  function log() {
    console.log.apply(console, [new Date].concat([].slice.call(arguments, 0)));
  }
   
})();
