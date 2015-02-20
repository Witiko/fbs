# Installation and basic usage

Install the `fbs.user.js` file using your userscript manager. The Facebook Batch Sender console can then be opened using the `Ctrl` + `~` key combination at <https://www.facebook.com/messages/*>. A newline character can be inserted into the console using `Ctrl` + `Enter`. The batch can be executed using `Enter` and the history can be cycled through via the `Up` and `Down` arrow keys.

# Input format

    <Message1/Command1><Message2/Command2> … <MessageN/CommandN>(;)
    <Message1/Command1><Message2/Command2> … <MessageN/CommandN>(;)
                                           …
    <Message1/Command1><Message2/Command2> … <MessageN/CommandN>
         
The entire input is called a superbatch. Each of the sections of a superbatch delimited by `(;)` is processed in parallel to others and is called a batch. Each batch can comprise messages, [commands](#commands), [comments](#comments) and [substitutions](#javascript-execution-and-substitution). Batches can be instantiated several times and run in parallel using the `clone()` function.

# Core concepts
## Tokenization

The input tokenization is performed in three steps (see function `tokenize()`):
     
  1. In the first step, the superbatch is split into batches delimited by `(;)`. For each batch:
    1. Split the batch into [comments](#comments) and non-comments. Discard the [comments](#comments).
    2. Split non-comments into strong [substitution](#javascript-execution-and-substitution) / [commands](#commands) and messages.
    3. Concatenate adjoining strong [substitutions](#javascript-execution-and-substitution) and messages into compound messages.
    4. [Execute](#execution) the resulting array of messages and [commands](#commands).
     
## Execution

  1. Take the first [token](#tokenization) in the array.
  2. If the [token](#tokenization) is a [command](#commands), the [command](#commands) is performed.
  3. If the [token](#tokenization) is a message, then:
    1. If the message contains a strong [substitution](#javascript-execution-and-substitution), the [substitution](#javascript-execution-and-substitution) is performed, the resulting string is [retokenized](#tokenization) as if it were a batch, the [tokens](#tokenization) are put in place of the original [token](#tokenization) and the [token](#tokenization) array is executed.
        * _Note: Since the result of the strong [substitution](#javascript-execution-and-substitution) is [retokenized](#tokenization) as if it were a batch (see Tokenization §1.1), the `(;)` separator has no meaning and will be interpreted as plain text._
    2. Otherwise:
        1. If the message contains a weak [substitution](#javascript-execution-and-substitution), the [substitution](#javascript-execution-and-substitution) is performed.
        2. The resulting string is modified based on the value of settings.newlines and sent to the current recipient or logged to the console depending on the current state of the batch instance (see [commands](#commands) `(v)` and `(^)`).
  4. Pop the [token](#tokenization) from the array and repeat the process until the array is empty.

## Name locking

Each input you execute is locked to the name of the current recipient. Input execution will be paused each time you switch to another user. Fbsrc and fbs scripts loaded via the `require()` and `include()` functions are exempt from this rule.

## Freezing

The execution of all batches can be paused using the `(freeze)` and `(unfreeze)` [commands](#commands). Although the effect is similar to that of name locking, note that fbsrc and fbs scripts loaded via the `require()` and `include()` functions are NOT exempt.

## Fbsrc

You can store a superbatch in `localStorage.fbsrc`. This superbatch will be automatically executed (without name locking) each time the userscript is loaded.

# Comments

A comment is either `(/ …)`, `(/ …`, `(// … //)`, `(// …` or `(/// …`.

_Note: When inlining JavaScript calls such as `string.test(/regexp/)`, make sure to put a space after the opening bracket as follows `string.test( /regexp/ )` in order to prevent misinterpretation as a comment._

# Commands
## Responding to actions

  * `(seen)` – Wait until the previous message has been marked as seen.
  * `(replied)` – Wait until the recipient has replied to you.
    * Gets consumed, when you're not the sender of the last message.
  * `(posted)` – Wait until the recipient has posted a message.
    * Gets consumed, when a new message is received.
  * `(changed)` – Wait until the last message in the chat has changed.
    * Gets consumed, when a new message appears in the chat.
  * `(typing)` – Wait until the recipient has started typing to you.
  * `(typing!)` – Wait until the recipient has started typing to you or posted a message.
  * `(any)` – Wait until the recipient has seen the previous message, started typing to you or posted a message.
 
## Responding to states

  * `(online)` – Wait until the recipient has gone online.
  * `(!online)` – Wait until the recipient is no longer online.
  * `(mobile)` – Wait until the recipient has gone mobile.
  * `(!mobile)` – Wait until the recipient is no longer mobile.
  * `(offline)` – Wait until the recipient has gone offline.
  * `(!offline)` – Wait until the recipient is no longer offline.
       
## User events
### Sending
#### Synchronous

  * `(^EVENT)` or `(^EVENT^)` – Emit an event named `EVENT` in the current window passing `"undefined"` as the message. Blocks until captured.
  * `(^EVENT^DATA^)` – Emit an event named `EVENT` in the current window passing `String(eval("DATA"))` as the message. Blocks until captured.
  * `(^^EVENT)` or `(^^EVENT^^)` – Emit an event named `EVENT` in all open windows passing `"undefined"` as the message. Blocks until captured.
  * `(^^EVENT^^DATA^^)` – Emit an event named `EVENT` in all open windows passing `String(eval("DATA"))` as the message. Blocks until captured.
 
#### Asynchronous

  * `(@^EVENT)` or `(@^EVENT^)` – Same as `(^EVENT)` or `(^EVENT^)`. The call, however, doesn't block.
  * `(@^EVENT^DATA^)` – Same as `(^EVENT^DATA^)`. The call, however, doesn't block.
  * `(@^^EVENT)` or `(@^^EVENT^^)` – Same as `(^^EVENT)` or `(^^EVENT^^)`. The call, however, doesn't block.
  * `(@^^EVENT^^DATA^^)` – Same as `(^^EVENT^^DATA^^)`. The call, however, doesn't block.

### Receiving

  * `(:EVENT)` – Wait until the event named `EVENT` has occured in the current window and capture it.
    * Edge-triggered – waits until the event occurs
  * `(::EVENT)` – Wait until the event named `EVENT` has occured in the current window and capture it.
    * Level-triggered – returns immediately, if the event has already been captured in the current batch instance.
 
## Miscellaneous

  * `(v)` – Redirect all following messages to `console.log`.
  * `(^)` – Redirect all following messages to the current recipient (implicit).
  * `(freeze)` – Freezes all operation of the script.
  * `(unfreeze)` – Unfreezes the operation of the script.
    * _Note: When executing a superbatch, the `(unfreeze)` [command](#commands) needs to be the first potentially blocking [command](#commands) in a batch prior to any messages. Otherwise the batch will block indefinitely due to the freeze._
  * `(notify)` – Notify the user using the html5 notification.
  * `(never)` – Block indefinitely.
  * `(repeat)` – Repeats the current instance of the batch (expands to `(js)clone($i)(js)(never)`)
  * `(at #1)` – Wait until the specified point in time
    * If `isNaN(Date.parse("#1"))`, then a `HH:MM:SS` format is assumed (see function `parseHMS()` for details).
    * If `isNaN(parseHMS("#1"))`, then an exception is logged and `(at #1)` expands to `(never)`. 
  * `(<#1><unit1> <#2><unit2> … <#N><unitN>)` – Wait the specified period of time, where valid units comprise:
    * `Y` – Years
    * `M` – Months
    * `d` – Days
    * `h` – Hours
    * `m` – Minutes
    * `s` – Seconds
    * `ms` – Milliseconds

# JavaScript execution and substitution
    
  * `(js) … (js)` or `(js) …` – Execute the enclosed JavaScript code.
    * _Note: This [command](#commands) always takes precedence during the [tokenization](#tokenization), e.g. `(js)…(command)…(js)` always becomes one `(js)…(js)` [token](#tokenization) rather that a `(js)…` message, `(command)` and a `…(js)` message._
  * `` `…` `` – Execute the enclosed JavaScript code and substitute the [command](#commands) for its return value cast to a String. This substitution is weak.
    * _Note: If the expression evaluates to `undefined`, the substitution expands to an empty string rather than to `"undefined"`._
    * Weak substitution is only allowed inside messages.
    * Weak substitution is non-recursive – its return value is always regarded as a message.
    * Examples:                  
        * ``Did you know that 1 + 2 = `1 + 2`?`` ~> `Did you know that 1 + 2 = 3?`
        * ``Hey, `getCurrName()`, I am `getMyName()`.``  ~>  `Hey, Mootykins, I am Witiko.`
        * ``This command will be printed: `"(" + "never" + ")"` `` ~> `This command will be printed: (never)`
  * ```` ```…``` ```` – Execute the enclosed JavaScript code and substitute the [command](#commands) for its return value cast to a String. This substitution is strong.
    * _Note: If the expression evaluates to `undefined`, the substitution expands to an empty string rather than to `"undefined"`._
    * Strong substitution is allowed anywhere.
    * Strong substitution is recursive – its return value is always [retokenized](#tokenization).
    * Examples:
      * ````(```1 + 2```s)You've got five seconds to tell me where I am and three have just passed.````
      * ````This will get posted.```condition ? "(never)"```And this will conditionally not get posted.````
                     
                (js)$i.count = 1; $i.expand = function() {
                  return weak("$i.count++") + "(2s)" + strong("$i.expand()");
                }(js)```$i.expand()``` (/ Will keep on counting ad infinitum

## JavaScript execution context
                    
The following additional methods and variables are available during JavaScript execution and [substitution](#javascript-execution-and-substitution) and during the user event sending:
 
### HTTP requests and reflection

  * `include(lang, url)` – Synchronously loads and executes a script at the given `url`.
    * The language of the script is specified by the value of the `lang` parameter, which can be either:
        * `"js"` – JavaScript
        * `"fbs"` – Facebook Batch Sender
    * If no language is specified, it will be guessed from the suffix of the specified file.
    * In case of a JavaScript script, a function `Export(name, value)` is made available for the script to export functions and data.
  * `require(lang, url)` – Similar to `include()`, but ignores the invocation, if the script at the given `url` has already been loaded.
  * `curl(url)` – Downloads the resource at the given `url` via the GET request and returns its data. You can detect failure by testing for empty string as a return value. If you need more control, use the Greasemonkey [`GM_xmlhttpRequest`](http://wiki.greasespot.net/GM_xmlhttpRequest) function instead.

### Chat context data

  * `getCurrName()` – The name of the current chat window.
  * `getMyName()` – The first name of the sender.
  * `getLastReply()` – The last chat message.
  * `getLastReplyName()` – The name of the last chat message sender.
  
### Batch control

  * `clone(obj)` – Create a new instance of the current batch, whose `$i` hash table is `obj` or `{}` if unspecified.
  * `global` – A reference to the userscript scope. Can be used to reference global members using the bracket notation.
  * `$w` – A non-persistent window-local hash table.
  * `$s` – A non-persistent superbatch-local hash table.
  * `$b` – A non-persistent batch-local hash table.
  * `$i` – A non-persistent batch-instance-local hash table.

### Settings

  * `log(arg1, …)` – Log the arguments into the console (a generic message).
  * `warn(arg1, …)` – Log the arguments into the console (a warning).
  * `err(arg1, …)` – Log the arguments into the console (an error).
  * `settings` - The settings object contains the following values:
    * `freezeOnError` (`false`) – The `(freeze)` [command](#commands) is executed each time the `err()` function is called.
    * `newlines` – The newlines object contains the following values:
        * `trimmed` (`true`) – When true, the outgoing messages are trimmed, e.g. white spaces and newline characters at the beginning and at the end of the string are removed.
        * `TeXLike` (`false`) – When true, one or more whitespace characters or a newline along with any adjacent whitespace characters are replaced with a single space, whereas two or more newlines surrounded by newlines and whitespaces are replaced with two newline characters signifying a paragraph.
    * `debug` – The debug object contains the following values:
        * `warnings` (`true`) – When true, the `warn()` function prints messages into the console.
        * `tokenize` (`false`) – When true, the activity of the [tokenizer](#tokenization) gets logged into the console.
        * `freeze` (`false`) – When true, information regarding the `(freeze)` and `(unfreeze)` [commands](#commands) get logged into the console.
        * `namelock` (`false`) – When true, information regarding the name lock get logged into the console.
        * `require` (`false`) – When true, information regarding the loading and execution of scripts using the `require()` and `include()` functions get logged into the console.
        * `batch` (`false`) – When true, information regarding the state of the executed batches get logged into the console.
        * `time` (`false`) – When true, information concerning the `(at …)` and `(<#1><unit1> <#2><unit2> … <#N><unitN>)` [commands](#commands) get logged into the console.

### User events

  * `eventData` – The data of the last captured [user event](#user-events).

### Convenience [substitution](#javascript-execution-and-substitution) functions

  * `command(s)` – Returns `"(" + s + ")"`.
  * `weak(s)` – Returns ``"`" + s + "`"``.
  * `strong(s)` – Returns ````"```" + s + "```"````.
  * `TeXLike(s)` – Formats the input string `s` as if `settings.newlines.TeXLike == true`.

### Miscellaneous

  * `beep()` – Lets out a beep ([AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) dependent).