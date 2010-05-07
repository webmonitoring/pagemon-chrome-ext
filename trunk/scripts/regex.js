/*
  A Web Worker script to allow interruptable regex searches. Expects the command
  in the following format:
  {
    command: 'run',
    text: 'the text to search in',
    regex: 'the regex pattern string'
  }
  Returns a string of all the matches, separated by new lines (there may also be
  embedded new lines inside the matches).
*/

onmessage = function(raw_message) {
  var message = JSON.parse(raw_message.data);
  
  if (message.command == 'run') {
    var text = message.text;
    var regex = new RegExp(message.regex, 'g');
    var match = null;
    var results = [];
    
    while (match = regex.exec(text, regex.lastIndex)) {
      if (match.join('').length == 0) break;
      
      if (match.length == 1) {
        // If there were no captured groups, append the whole match.
        results.push('"' + match[0] + '"');
      } else {
        // Otherwise append all capture groups but not the whole match.
        results.push('"' + match.slice(1).join('", "') + '"');
      }
    }
    
    postMessage(results.join('\n'));
  }
};
