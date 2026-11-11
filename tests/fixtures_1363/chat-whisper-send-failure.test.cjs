const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf('function chatSend()');
const end = source.indexOf('function renderChat()', start);
assert(start >= 0 && end > start);

for (const [connected, accepted] of [[true, false], [false, false], [true, true]]) {
  const input = {value: 'Hello'};
  const game = {};
  let sends = 0;
  const context = {
    document: {getElementById: () => input},
    chatName: () => 'Sender', chatTab: 'w:Recipient',
    CHATNET: {connected}, G: game,
    chatCap() {}, saveG() {}, renderChat() {}, t: key => key,
    chatNetSend(message) {
      assert.equal(message.text, 'Hello');
      sends++;
      return accepted;
    },
  };
  vm.runInNewContext(source.slice(start, end) + '\nchatSend(); chatSend();', context);
  assert.equal(sends, Number(connected));
  assert.equal(game.whispers.Recipient.length, accepted ? 1 : 2);
  if (!accepted) assert.equal(game.whispers.Recipient[1].txt, 'chat.not_delivered');
}
