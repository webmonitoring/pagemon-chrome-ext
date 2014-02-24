/*
  A Web Worker script to allow interruptable regex searches. Expects a command
  with the value in the following format (JSON-encoded as a string):
  {
    command: 'run',
    text: 'the text to search in',
    regex: 'the regex pattern string'
  }
  Returns a string of all the matches, each between double quotes and separated
  by new lines (there may also be embedded new lines inside the matches).

  NOTE: If called directly rather than through the Web Worker API, the command
  object should be inside the "data" property of an enclosing object.
*/

onmessage = function(raw_message) {
  try {
    var message = JSON.parse(raw_message.data);
  } catch (e) {
    return;
  }

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
