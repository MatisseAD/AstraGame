import test from 'node:test';
import { checks } from '../game/checks.mjs';
for(const [name,fn] of checks)test(name,fn);
