import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf8');
const url   = env.match(/^UPSTASH_REDIS_REST_URL="?([^"\n]+)"?/m)?.[1]?.trim();
const token = env.match(/^UPSTASH_REDIS_REST_TOKEN="?([^"\n]+)"?/m)?.[1]?.trim();

if (!url || !token) {
  console.error('❌ UPSTASH_REDIS_REST_URL or TOKEN not found in .env');
  process.exit(1);
}

console.log(`Connecting to: ${url}`);

async function redisCmd(...args) {
  const res = await fetch(`${url}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? JSON.stringify(json));
  return json.result;
}

// PING
const pong = await redisCmd('PING');
console.log(`\n1. PING → ${pong}`);

// SET
await redisCmd('SET', 'kiro:test', 'hello-redis', 'EX', 60);
console.log('2. SET kiro:test "hello-redis" EX 60 → OK');

// GET
const val = await redisCmd('GET', 'kiro:test');
console.log(`3. GET kiro:test → "${val}"`);

// TTL
const ttl = await redisCmd('TTL', 'kiro:test');
console.log(`4. TTL kiro:test → ${ttl}s`);

// DEL
await redisCmd('DEL', 'kiro:test');
console.log('5. DEL kiro:test → OK');

// Confirm deleted
const gone = await redisCmd('GET', 'kiro:test');
console.log(`6. GET kiro:test after DEL → ${gone}`);

console.log('\n✅ Upstash Redis is fully operational.');
