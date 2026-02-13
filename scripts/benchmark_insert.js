import { spawn } from 'node:child_process';

const PORT = 8788;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const GROUP_ID = 'group_default'; // Changed to default group to use auto-seeded members
const PAYER_ID = 'Daniel';        // Use auto-seeded member

// 🛡️ Added header to bypass local authentication middleware
const AUTH_HEADERS = {
  'X-Member-Id': 'benchmark-test-user',
  'Content-Type': 'application/json'
};

// Helper to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForServer() {
  console.log('Waiting for server...');
  const start = Date.now();
  while (Date.now() - start < 30000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      // Use GET /api/members to trigger auto-seeding if needed
      const res = await fetch(`${BASE_URL}/api/members?group_id=${GROUP_ID}`, {
        signal: controller.signal,
        headers: AUTH_HEADERS
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        console.log('Server is ready and members accessed!');
        return;
      } else {
        const text = await res.text();
        console.log(`Server returned ${res.status}: ${text}`);
      }
    } catch (e) {
      if (e.name !== 'AbortError' && e.cause?.code !== 'ECONNREFUSED') {
         console.log(`Unexpected error while waiting for server: ${e.message}`);
      }
    }
    await wait(1000);
  }
  throw new Error('Server failed to start');
}

async function runBenchmark() {
  const iterations = 100;
  const timings = [];

  console.log(`Starting INSERT benchmark (${iterations} iterations)...`);

  // Warmup
  try {
      // Trigger records table creation if needed
      const res = await fetch(`${BASE_URL}/api/records`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          type: "支出",
          category: "Warmup",
          description: "Warmup Record",
          amount: 1,
          payer_id: PAYER_ID,
          group_id: GROUP_ID,
          date: "2023-01-01"
        })
      });
      const data = await res.json();
      console.log('Warmup response:', JSON.stringify(data).substring(0, 100) + '...');

      // If warmup failed due to table creation, try one more time
      if (data.error && data.error.includes('Table created')) {
          console.log('Retrying warmup...');
          await wait(500);
          const res2 = await fetch(`${BASE_URL}/api/records`, {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify({
              type: "支出",
              category: "Warmup",
              description: "Warmup Record Retry",
              amount: 1,
              payer_id: PAYER_ID,
              group_id: GROUP_ID,
              date: "2023-01-01"
            })
          });
          const data2 = await res2.json();
          console.log('Warmup retry response:', JSON.stringify(data2).substring(0, 100) + '...');
      }

  } catch(e) {
      console.error('Warmup failed', e);
  }

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
        const res = await fetch(`${BASE_URL}/api/records`, {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify({
                type: "支出",
                category: "Bench",
                description: `Bench Record ${i}`,
                amount: 10 + i,
                payer_id: PAYER_ID,
                group_id: GROUP_ID,
                date: "2023-01-01"
            })
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Status ${res.status}: ${err}`);
        }
        await res.json(); // consume body
        const end = performance.now();
        timings.push(end - start);
    } catch (e) {
        console.error('Request failed', e);
    }
    if (i % 10 === 0) process.stdout.write('.');
  }

  console.log('\n');

  if (timings.length === 0) {
      console.log('No successful requests.');
      return;
  }

  const sum = timings.reduce((a, b) => a + b, 0);
  const avg = sum / timings.length;
  const sorted = [...timings].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];

  console.log('Benchmark Results (INSERT):');
  console.log(`  Average: ${avg.toFixed(2)} ms`);
  console.log(`  Median:  ${median.toFixed(2)} ms`);
  console.log(`  P95:     ${p95.toFixed(2)} ms`);
  console.log(`  Min:     ${sorted[0].toFixed(2)} ms`);
  console.log(`  Max:     ${sorted[sorted.length - 1].toFixed(2)} ms`);
}

async function main() {
  let child;
  try {
    console.log('Starting wrangler pages dev...');
    // d1 flag is needed
    child = spawn('npx', ['wrangler', 'pages', 'dev', '.', '--port', PORT.toString(), '--d1', 'DB=monthly_expenses'], {
      stdio: 'inherit',
      shell: true,
      detached: true
    });

    await waitForServer();
    await runBenchmark();

  } catch (err) {
    console.error('Benchmark failed:', err);
    process.exitCode = 1;
  } finally {
    if (child?.pid) {
      console.log('Stopping server...');
      try {
        process.kill(-child.pid);
      } catch (e) {
        console.error(`Failed to stop server process group with PID ${-child.pid}: ${e.message}`);
      }
    }
  }
}

main();
