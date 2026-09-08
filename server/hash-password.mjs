import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { hashPassword } from './passwordAuth.mjs';

const rl = createInterface({ input, output });
try {
  const password = process.argv.slice(2).join(' ') || await rl.question('Choose an admin password (8+ characters): ');
  console.log(hashPassword(password));
} finally {
  rl.close();
}
