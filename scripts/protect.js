#!/usr/bin/env node
/**
 * Regenererer priskalkulator_beskyttet.html fra priskalkulator.html.
 *
 * Den beskyttede filen er en låseskjerm pluss kilden XOR-kryptert med SHA-256 av
 * passordet og base64-kodet. Bare selve base64-blobben byttes ut – låseskjermen
 * rundt beholdes uendret, slik at diffen alltid blir én linje.
 *
 * Bruk:  npm run protect
 * Passordet kan overstyres med miljøvariabelen KALKULATOR_PASSORD.
 *
 * Til slutt dekrypteres resultatet og sammenlignes med kilden. Skriptet feiler
 * hvis de ikke er byte-identiske, slik at en ødelagt fil aldri blir committet.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const KILDE = path.join(ROOT, 'priskalkulator.html');
const BESKYTTET = path.join(ROOT, 'priskalkulator_beskyttet.html');
const PASSORD = process.env.KALKULATOR_PASSORD || 'Tilbud';

function xor(buf, key) {
  const ut = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) ut[i] = buf[i] ^ key[i % key.length];
  return ut;
}

const kilde = fs.readFileSync(KILDE);
const wrapper = fs.readFileSync(BESKYTTET, 'utf8');
const key = crypto.createHash('sha256').update(PASSORD, 'utf8').digest();

const BLOB = /const D="[A-Za-z0-9+/=]+"/;
if (!BLOB.test(wrapper)) {
  console.error('FEIL: fant ikke base64-blobben (const D="...") i ' + path.basename(BESKYTTET));
  process.exit(1);
}
const b64 = xor(kilde, key).toString('base64');
const ut = wrapper.replace(BLOB, 'const D="' + b64 + '"');
const uendret = ut === wrapper;
fs.writeFileSync(BESKYTTET, ut);

// Verifiser: dekrypter tilbake og krev byte-likhet med kilden
const m = ut.match(/const D="([A-Za-z0-9+/=]+)"/);
const tilbake = xor(Buffer.from(m[1], 'base64'), key);
if (!tilbake.equals(kilde)) {
  console.error('FEIL: dekryptert innhold er ikke identisk med kilden. Filen er IKKE trygg å committe.');
  process.exit(1);
}

console.log('OK – ' + path.basename(BESKYTTET) + (uendret ? ' var allerede oppdatert' : ' regenerert') + ' og verifisert (' + kilde.length + ' bytes).');
