'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
module.exports = {
  ROOT,
  JAR: process.env.AM_JAR || path.resolve(ROOT, '..', 'forge neoforge', 'alexsmobs-1.22.9.jar'),
  JAR_DIR: path.join(ROOT, '.tools', 'jar'),
  JAVAP_DIR: path.join(ROOT, '.tools', 'javap'),
  OUT_DIR: path.join(ROOT, '.tools', 'extract'),
  BP: path.join(ROOT, 'addon', 'BP'),
  RP: path.join(ROOT, 'addon', 'RP'),
  NS: 'alexsmobs',
  PKG: 'com/github/alexthe666/alexsmobs',
  ASSETS: path.join(ROOT, '.tools', 'jar', 'assets', 'alexsmobs'),
  DATA: path.join(ROOT, '.tools', 'jar', 'data', 'alexsmobs'),
};
