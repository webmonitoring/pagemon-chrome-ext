$(function() {
  test('Invalid', function() {
    expect(0);

    postMessage = function() { ok(false, 'Empty string.'); };
    onmessage('');

    postMessage = function() { ok(false, '"Run" as a string.'); };
    onmessage('run');

    postMessage = function() { ok(false, 'Unserialized command.'); };
    onmessage({ command: 'go', text: 't', regex: 't' });

    postMessage = function() { ok(false, 'Unserialized wrapped command.'); };
    onmessage({ data: { command: 'run', text: 't', regex: 't' } });

    postMessage = function() { ok(false, 'Invalid command string.'); };
    onmessage({ data: '{ "command": "go", "text": "t", "regex": "t" }' });
  });

  test('Valid', function() {
    expect(3);

    postMessage = function() { ok(true, 'Filled text and regex.'); };
    onmessage({ data: '{ "command": "run", "text": "t", "regex": "t" }' });

    postMessage = function() { ok(true, 'Missing text and regex.'); };
    onmessage({ data: '{ "command": "run" }' });

    postMessage = function() {
      ok(true, 'Missing text and regex and an extra property.');
    };
    onmessage({ data: '{ "command": "run", "other": "test" }' });
  });

  test('Value Check', function() {
    expect(5);

    postMessage = function(result) {
      equals(result, '"a"', 'Simple string match');
    };
    onmessage({ data: '{ "command": "run", "text": "a", "regex": "a" }' });

    postMessage = function(result) {
      equals(result, '"a"', 'Simple regex match');
    };
    onmessage({ data: '{ "command": "run", "text": "a", "regex": "." }' });

    postMessage = function(result) {
      equals(result, '"a"\n"a"', 'Multiple string match');
    };
    onmessage({ data: '{ "command": "run", "text": "aba", "regex": "a" }' });

    postMessage = function(result) {
      equals(result, '"a"\n"b"\n"a"', 'Multiple regex match');
    };
    onmessage({ data: '{ "command": "run", "text": "abca", "regex": "[^c]" }' });

    postMessage = function(result) {
      equals(result, '"ab\nc"\n"d\ne"', 'Embedded newlines');
    };
    onmessage({ data: JSON.stringify({
      command: 'run',
      text: 'ab\ncd\nef',
      regex: '.*\\s.'
    }) });
  });
});