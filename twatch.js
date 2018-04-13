
// ==UserScript==
// @name         TWatch: Twitch Chat Watcher
// @namespace    http://tampermonkey.net/
// @version      v1.0.0
// @description  Watch Twitch chat for certain users, any @mentions of you, or certain watched words, and play a sound/alert when one is posted. HUGE thanks to
// @author       Jake Bathman (Twitter: @jakebathman, Reddit: /u/ironrectangle, Twitch: jakebathman)
// @include      http*://www.twitch.tv*
// @require      https://code.jquery.com/jquery-latest.js
// @require      https://cdn.jsdelivr.net/npm/alertifyjs@1.11.1/build/alertify.min.js
// @resource     alertifyCSS https://cdn.jsdelivr.net/npm/alertifyjs@1.11.1/build/css/alertify.min.css
// @resource     alertifyCSSDefault https://cdn.jsdelivr.net/npm/alertifyjs@1.11.1/build/css/themes/default.min.css
// @grant        none
// ==/UserScript==
/* jshint -W097 */

var TWatch = {

    //  || ||                                || ||
    //  || ||   CHANGE SETTINGS BELOW HERE   || ||
    //  \/ \/                                \/ \/

    // Any user here will be watched for a post (based on their name in-chat)
    // This is case-insensitive (e.g. "JaKebAThmAn" works for "jakebathman")
    watchTheseUsers: [
        'jakebathman', 'drlupo',
    ],

    // Any word here will be watched in any chat message
    // This is also case-insensitive
    watchTheseWords: [
        'giveaway', 'clip.twitch.tv',
    ],

    // By default, alerts will never auto-dismiss. This means you have to click each message to make it go away
    // If you want certain alerts to go away automatically, put the number of seconds below for that
    // type of alert (e.g. "mentionTimeout: 5" will dismiss alerts of @mentions of you after 5 seconds)
    mentionTimeout: 0,
    wordTimeout: 0,
    userTimeout: 0,

    //  /\ /\                                /\ /\
    //  || ||   CHANGE SETTINGS ABOVE HERE   || ||
    //  || ||                                || ||

    messageArray: [],
    debugModeBool: true,

};


/*****************************************

     DON'T CHANGE ANYTHING BELOW HERE

*****************************************/

// Include Alertify.js and styles
// Learn more: http://alertifyjs.com/notifier.html
$("head").append (
    '<script src="https://cdn.jsdelivr.net/npm/alertifyjs@1.11.1/build/alertify.min.js"></script><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/alertifyjs@1.11.1/build/css/alertify.min.css"/><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/alertifyjs@1.11.1/build/css/themes/default.min.css"/>'
);

// If you're in theater mode, the normal alert box will be invisible (underneath the chat)
$("head").append (
    '<style>.alertify-notifier{z-index:99999;}</style>'
);

// Specify the alert defaults (most arean't changed, but don't edit this unless you know what you're doing. Stuff will break.)
alertify.defaults = {
    // dialogs defaults
    autoReset:true,
    basic:false,
    closable:true,
    closableByDimmer:true,
    frameless:false,
    maintainFocus:true, // <== global default not per instance, applies to all dialogs
    maximizable:true,
    modal:true,
    movable:true,
    moveBounded:false,
    overflow:true,
    padding: true,
    pinnable:true,
    pinned:true,
    preventBodyShift:false, // <== global default not per instance, applies to all dialogs
    resizable:true,
    startMaximized:false,
    transition:'pulse',

    // notifier defaults
    notifier:{
        // auto-dismiss wait time (in seconds)
        delay:30,
        // default position
        position:'bottom-right',
        // adds a close button to notifier messages
        closeButton: true
    },

    // language resources
    glossary:{
        // dialogs default title
        title:'AlertifyJS',
        // ok button text
        ok: 'OK',
        // cancel button text
        cancel: 'Cancel'
    },

    // theme settings
    theme:{
        // class name attached to prompt dialog input textbox.
        input:'ajs-input',
        // class name attached to ok button
        ok:'ajs-ok',
        // class name attached to cancel button
        cancel:'ajs-cancel'
    }
};

$(function(){
    'use strict';

    console.log('TWatch script loaded!');

    TWatch.logDebugMessage = function(message){
        if(TWatch.debugModeBool){
            console.log("TWatch - " + message);
        }
    };

    TWatch.mainLoop = function(){
        TWatch.checkMessages();
    };

    TWatch.checkMessages = function(){
        var isMention = false;

        // Check for a mention or watched user first, and don't filter those ever
        $('span.chat-author__display-name:not(.TWatchChecked), div.chat-line__message--mention-recipient:not(.TWatchChecked)').each(function(){
            var $message = $(this);
            var audioformsg = new Audio();
            if($message.data('aTarget') == "chat-message-mention"){
                // Play sound for @mentions

                audioformsg.src = 'https://emoji-cheat-sheet.campfirenow.com/sounds/bell.mp3';
                audioformsg.autoplay = true;
                $message.addClass('TWatchChecked');
                $message.parent().addClass('TWatchChecked');

                alertify.notify(
                    "<strong>You were mentioned!</strong><br />"+$message.closest('div.chat-line__message').text().replace(/(\d\d?\:\d\d)(.*)/g, "$1 - $2"),
                    'error',
                    TWatch.mentionTimeout
                );
            }
            else if($message.data('aTarget') == "chat-message-username"){
                $message.addClass('TWatchChecked');
                $message.parent().addClass('TWatchChecked');

                if(TWatch.isWatchedUser($message.text()) === true){
                    // Play sound for watched users

                    audioformsg.src = 'https://jakebathman.com/sounds/robot-blip.mp3';
                    audioformsg.autoplay = true;

                    alertify.notify(
                        '<strong>Watched user!</strong><br />'+$message.closest('div.chat-line__message').text().replace(/(\d\d?\:\d\d)(.*)/g, "$1 - $2"),
                        'warning',
                        TWatch.userTimeout
                    );
                }
            }
        });

        if (isMention === false){
            $('div.chat-line__message > span:not(.TWatchChecked)').each(function(){
                var $message = $(this);
                if($message.data('aTarget') == "chat-message-text"){
                    var $parent = $message.parent();
                    if(TWatch.hasWatchedWord($message.text())){
                        var audioformsg = new Audio();
                        audioformsg.src = 'https://jakebathman.com/sounds/robot-blip.mp3';
                        audioformsg.autoplay = true;

                        alertify.notify(
                            '<strong>Watched word!</strong><br />'+$message.closest('div.chat-line__message').text().replace(/(\d\d?\:\d\d)(.*)/g, "$1 - $2"),
                            'notify',
                            TWatch.wordTimeout
                        );
                    }

                    // Mark the message so we don't keep checking it
                    $message.addClass('TWatchChecked');
                    $parent.addClass('TWatchChecked');
                    TWatch.messageArray.push($message.text());
                }
            });
        }

    };

    TWatch.isMention = function(text){
        if(text.toUpperCase().indexOf(TWatch.username) > -1){
            TWatch.logDebugMessage("Mention!");
            return true;
        }
    };

    TWatch.isWatchedUser = function(text){
        for (var i = 0; i < TWatch.watchTheseUsers.length; i++)
        {
            if(text.toUpperCase().trim() == TWatch.watchTheseUsers[i].toUpperCase().trim()){
                TWatch.logDebugMessage("Watched user!");
                return true;
            }
        }
    };

    TWatch.hasWatchedWord = function(text){
        for (var i = 0; i < TWatch.watchTheseWords.length; i++) {
            if(text.toUpperCase().trim().indexOf(TWatch.watchTheseWords[i].toUpperCase().trim()) > -1){
                TWatch.logDebugMessage("Watched word!");
                return true;
            }
        }
    };

    TWatch.purgeEntries = function(){
        TWatch.messageArray = [];
    };

    // Run the main function every 200ms
    setInterval(TWatch.mainLoop, 200);

    // Remove old stuff every 10 minutes
    setInterval(TWatch.purgeEntries, 1000 * 60 * 10);
});