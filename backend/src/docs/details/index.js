// Merges every details/<group>.js file (key "METHOD /express/path" -> detail) into one object.
// A detail entry may contain: description (markdown), pathParams, query[], body{ description, fields[], example }, responses{ code: { description, example } }
const fs = require('fs');
const path = require('path');

const merged = {};
for (const file of fs.readdirSync(__dirname).sort()) {
  if (file === 'index.js' || !file.endsWith('.js')) continue;
  Object.assign(merged, require(path.join(__dirname, file)));
}
module.exports = merged;
