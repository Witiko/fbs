_Due to its parasitic nature, the script currently only works with the Czech mutation of facebook. If you want to make it work with your locale, you need to fix all the DOM selectors used with the `document.querySelector` and `document.querySelectorAll` functions._

# Installation and basic usage

Install the `fbs.user.js` file using your userscript manager. The facebook batch sender console can then be opened using the `Ctrl` + `~` key combination at <https://www.facebook.com/messages/*>. A newline character can be inserted into the console using `Ctrl` + `Enter`. The message can be sent using `Enter`. Previous messages can be cycled through via the `Up` and `Down` arrow keys.

# Input format

    <Message1/Command1><Message2/Command2> … <MessageN/CommandN>(;)
    <Message1/Command1><Message2/Command2> … <MessageN/CommandN>(;)
                                           …
    <Message1/Command1><Message2/Command2> … <MessageN/CommandN>
         
The entire input is called a superbatch. Each of the sections of a superbatch delimited by `(;)` is processed in parallel to the others and is called a batch. Each batch can be composed of messages, commands, comments and substitutions, whose meaning is described below. Batches can be instantiated several times and run in parallel using the `clone()` function.
 
# Commands
## Responding to actions

  * `(seen)` – Wait until the previous message has been marked as seen.
  * `(replied)` – Wait until the recipient has replied to you (gets consumed, when the sender of the last message isn't you).
  * `(posted)` – Wait until the recipient has posted a message (gets consumed, when a new message is received).
  * `(changed)` – Wait until the last message in the chat has changed (be it because of you oor the recipient).
  * `(typing)` – Wait until the recipient has started typing to you.
  * `(typing!)` – Wait until the recipient has started typing to you / posted a message.
  * `(any)` – Wait until the recipient has started typing to you / posted a message / seen the previous message.
 
## Responding to states

  * `(online)` – Wait until the recipient has gone online
  * `(!online)` – Wait until the recipient is no longer online
  * `(mobile)` – Wait until the recipient has gone mobile
  * `(!mobile)` – Wait until the recipient is no longer mobile
  * `(offline)` – Wait until the recipient has gone offline
  * `(!offline)` – Wait until the recipient is no longer offline
       
## User-defined events

  * `(^EVENT)` or `(^EVENT^)` – Emit an event named `EVENT` in the current window passing `"undefined"` as the message. Blocks until received.
  * `(^EVENT^DATA^)` – Emit an event named `EVENT` in the current window passing `String(eval("DATA"))` as the message. Blocks until received.
  * `(^^EVENT)` or `(^^EVENT^^)` – Emit an event named `EVENT` in all open windows passing `"undefined"` as the message. Blocks until received.
  * `(^^EVENT^^DATA^^)` – Emit an event named `EVENT` in all open windows passing `String(eval("DATA"))` as the message. Blocks until received.
 
  * `(@^EVENT)` or `(@^EVENT^)` – Same as `(^EVENT)` or `(^EVENT^)`. The call, however, doesn't block.
  * `(@^EVENT^DATA^)` – Same as `(^EVENT^DATA^)`. The call, however, doesn't block.
  * `(@^^EVENT)` or `(@^^EVENT^^)` – Same as `(^^EVENT)` or `(^^EVENT^^)`. The call, however, doesn't block.
  * `(@^^EVENT^^DATA^^)` – Same as `(^^EVENT^^DATA^^)`. The call, however, doesn't block.
 
  * `(:EVENT)` – Wait until the event named `EVENT` has occured in the current window and capture it.
    * Edge-triggered – waits until the event occurs
  * `(::EVENT)` – Wait until the event named `EVENT` has occured in the current window and capture it.
    * Level-triggered – returns immediately, if the event has already been captured in the current batch instance.
 
## Miscellaneous

  * `(v)` – Redirect all following messages to `console.log`.
  * `(^)` – Redirect all following messages to the current recipient (implicit).
  * `(freeze)` – Freezes all operation of the script.
  * `(unfreeze)` – Unfreezes the operation of the script.
    * _Note: When executing a new superbatch, the (unfreeze) command needs to be the first potentially blocking command in the batch prior to any messages. Otherwise the batch will block indefinitely due to the freeze._
  * `(notify)` – Notify the user using the html5 notification.
  * `(never)` – Block indefinitely.
  * `(repeat)` – Repeats the current instance of the batch (expands to `(js)clone($i)(js)(never)`)
  * `(at #1)` – Wait until the specified point in time
    * If `isNaN(Date.parse("#1"))`, then a `HH:MM:SS` format is assumed (see function `parseHMS()` for details)
    * If `isNaN(parseHMS("#1"))`, then an exception is logged and `(at #1)` expands to `(never)`.
  * `(/...)`, `(/...`, `(//...//)`, `(//...` or `(///...` – These commands are ignored (comments).
    * _Note: When inlining javascript calls in the following form:_
    
            string.test(/regexp/)
                    
      _put a space after the opening bracket to prevent erroneous interpretation._
 
  * `(<#1><unit1> <#2><unit2> … <#N><unitN>)` – Wait the specified period of time, where valid units comprise:
    * `Y` – Years
    * `M` – Months
    * `d` – Days
    * `h` – Hours
    * `m` – Minutes
    * `s` – Seconds
    * `ms` – Milliseconds

## Substitution
    
  * `(js)...(js)` or `(js)...` – Execute the enclosed JavaScript code.
    * _Note: This command always takes precedence during the tokenization, e.g. `(js)...(command)...(js)` always becomes one `(js)...(js)` token rather that a `(js)...` message, `(command)` and a `...(js)` message._
  * `` `...` ``  - Execute the enclosed JavaScript code and substitute the command for its return value converted to string (weak).
    * _Note: If the expression evaluates to `undefined`, the substition expands to `""` rather than to `"undefined"`._
    * Weak substitution is only allowed within messages.
    * Weak substitution is non-recursive – its return value is always regarded as a message.
    * Examples:                  
        * ``Did you know that 1 + 2 = `1 + 2`?`` ~> `Did you know that 1 + 2 = 3?`
        * ``Hey, `getCurrName()`, I am `getMyName()`.``  ~>  `Hey, Mootykins, I am Witiko.`
        * ``This command will be printed: `"(" + "never" + ")"` `` ~> `This command will be printed: (never)`
  * ```` ```...``` ```` – Execute the enclosed JavaScript code and substitute the command for its return value converted to string (strong).
    * _Note: If the expression evaluates to `undefined`, the substition expands to `""` rather than to `"undefined"`._
    * Strong substitution is allowed anywhere.
    * Strong substitution is recursive – its return value is always retokenized.
    * Examples:
      * ````(```1 + 2```s)You've got five seconds to tell me where I am and three have just passed.````
      * ````This will get posted.```condition ? "(never)"```And this will conditionally not get posted.````
                     
                (js)$i.count = 1; $i.expand = function() {
                  return weak("$i.count++") + "(2s)" + strong("$i.expand()");
                }(js)```$i.expand()``` (/ Will keep on counting ad infinitum

### JavaScript
                    
The following additional methods and variables are available during execution, substitution and event sending:
 
#### HTTP requests and reflection

  * `include(lang, url)` – Synchronously loads and executes a script at the given `url`.
    * The language of the script is specified by the value of the `lang` parameter, which can be either `"js"` (JavaScript) or `"fbs"` (Facebook Batch Sender).
    * If no language is specified, it will be guessed from the suffix of the specified file.
    * In case of a JavaScript script, a function `Export(name, value)` is made available for the script to export functions and data.
  * `require(lang, url)` – Similar to `include()`, but ignores the invocation, if the script at the given `url` has already been loaded.
  * `curl(url)` – Downloads the resource at the given `url` via the GET request and returns its data. You can detect failure by testing for empty string as a return value. If you need more control, use the Greasemonkey [`GM_xmlhttpRequest`](http://wiki.greasespot.net/GM_xmlhttpRequest) function instead.

#### Chat context data

  * `getCurrName()` – The name of the current chat window.
  * `getMyName()` – The first name of the sender.
  * `getLastReply()` – The last chat message.
  * `getLastReplyName()` – The name of the last chat message sender.
  
#### Batch control

  * `clone(obj)` – Create a new instance of the current batch, whose `$i` hash table, if specified, is `obj`.
  * `global` – A reference to the userscript scope. Can be used to reference members using the bracket notation.
  * `$w` – A non-persistent window-local hash table.
  * `$s` – A non-persistent superbatch-local hash table.
  * `$b` – A non-persistent batch-local hash table.
  * `$i` – A non-persistent batch-instance-local hash table.

#### Settings and debugging

  * `log(arg1, …)` – Log the arguments into the console (a generic message).
  * `warn(arg1, …)` – Log the arguments into the console (a warning).
  * `err(arg1, …)` – Log the arguments into the console (an error).
  * `settings` - The settings object contains the following values:
    * `freezeOnError` (`false`) – The `(freeze)` command is executed each time the `err()` function is called.
    * `newlines` – The newlines object contains the following values:
        * `trimmed` (`true`) – The outgoing messages are trimmed, e.g. white spaces and newline characters at the beginning and at the end of the string are removed.
        * `TeXLike` (`false`) – Similarly to TeX, adjacent white spaces and single newline characters are replaced with a single space, whereas two and more consecutive newlines surrounded by whitespaces and newlines are replaced with two newline characters signifying a paragraph.
  * `debug` – The debug object contains the following values:
    * `warnings` (`true`) – Controls, whether the `warn()` function prints any messages into the console.
    * `tokenize` (`false`) – Logs the activity of the tokenizer into the console.
    * `freeze` (`false`) – Logs information regarding the `(freeze)` and `(unfreeze)` commands into the console.
    * `namelock` (`false`) – Logs information regarding the name lock into the console.
    * `require` (`false`) – Logs information regarding the loading and execution of scripts using the `require()` and `include()` functions into the console.
    * `batch` (`false`) – Logs information regarding the state of the executed batches into the console.
    * `time` (`false`) – Logs information concerning the `(at ...)` and `(<#1><unit1> <#2><unit2> … <#N><unitN>)` commands.

#### User events

  * `eventData` – The data of the last captured event.

#### Miscellaneous

  * `editRc()` – Paste the entire `fbsrc` into the message box. Double-clicking the message box saves the new fbsrc.
  * `strong(s)` – Returns `"```"` + s + `"```"`.
  * `weak(s)` – Returns `"\`"` + s + `"\`"`.
  * `beep()` – Lets out a beeping sound (HTML5 AudioContext dependent).

# Core concepts

## Name locking

Each input you execute is locked to the name of the current recipient. Input execution will be paused each time you switch to another user. Fbsrc and fbs scripts loaded via the `require()` and `include()` functions are exempt from this rule.

## Fbsrc

You can store a superbatch in `localStorage.fbsrc`. This superbatch will be automatically executed (without name locking) each time the userscript is loaded.

## Tokenization

The input tokenization is performed in three steps (see function `tokenize()`):
     
  1. In the first step, the superbatch is split into batches delimited by `(;)`. For each batch:
    1. Split the batch into comments and non-comments. Discard the comments.
    2. Split non-comments into strong substitution / commands and messages.
    3. Concatenate adjoining strong substitutions and messages into compound messages.
    4. Execute the resulting string of messages and commands.
     
## Execution

  1. If the token is a command, the command is performed.
  2. If the token is a message, then:
    1. If the message contains a strong substitution, the substitution is performed, the resulting string is retokenized as if it were a batch, the tokens are put in place of the original token and then executed.
        * _Note: Since the result of the strong substitution is retokenized as if it were a batch (see Tokenization §1.1), the `(;)` separator has no meaning and will be interpreted as text._
    2. Otherwise:
        1. If the message contains a weak substitution, the substitution is performed.
        2. The resulting string is modified based on the value of settings.newlines and sent to the current recipient or logged to the console depending on the state of the batch (see commands `(v)` and `(^)`).