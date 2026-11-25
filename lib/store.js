// Tiny JSON-file store with atomic writes. Swappable for PostgreSQL later:
// every read/write goes through load()/save(), so the API layer never touches the file.
'use strict';
const fs = require('fs');
const path = require('path');

class Store {
  constructor(file) {
    this.file = file;
    this.data = null;
  }
  load(seedFn) {
    if (fs.existsSync(this.file)) {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } else {
      this.data = seedFn();
      this.save();
    }
    return this.data;
  }
  replace(data) {
    this.data = data;
    this.save();
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
  }
  nextId(prefix) {
    this.data.seq = (this.data.seq || 1000) + 1;
    return prefix + this.data.seq;
  }
}

module.exports = { Store };
