$(function() {
  test('Invalid', function() {
    postMessage = function() { ok(false, 'Called when it shouldn\'t.'); };
    onmessage('');
    onmessage('run');
    onmessage({ command: 'go', text: 't', regex: 't' });
    onmessage({ data: { command: 'go', text: 't', regex: 't' } });
    onmessage({ data: "{ command: 'go', text: 't', regex: 't' }" });
    onmessage({ data: { command: 'run', text: 't', regex: 't' } });
  });
  
  test('Valid', function() {
    expect(3);
    postMessage = function() { ok(true, 'Called when it should.'); };
    onmessage({ data: "{ command: 'run', text: 't', regex: 't' }" });
    onmessage({ data: "{ command: 'run' }" });
    onmessage({ data: "{ command: 'run', other: 'test' }" });
  });
  
  test('Value Check', function() {
    expect(5);
    
    postMessage = function(result) {
      equals(result, '"a"', 'Simple string match');
    };
    onmessage({ data: "{ command: 'run', text: 'a', regex: 'a' }" });
    
    postMessage = function(result) {
      equals(result, '"a"', 'Simple regex match');
    };
    onmessage({ data: "{ command: 'run', text: 'a', regex: '.' }" });
    
    postMessage = function(result) {
      equals(result, '"a"\n"a"', 'Multiple string match');
    };
    onmessage({ data: "{ command: 'run', text: 'aba', regex: 'a' }" });
    
    postMessage = function(result) {
      equals(result, '"a"\n"b"\n"a"', 'Multiple regex match');
    };
    onmessage({ data: "{ command: 'run', text: 'abca', regex: '[^c]' }" });
    
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