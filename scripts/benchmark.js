const { spawn } = require('node:child_process');

const PORT = 8788;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const GROUP_ID = 'bench_group';

// Helper to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForServer() {
  console.log('Waiting for server...');
  const start = Date.now();
  while (Date.now() - start < 30000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${BASE_URL}/api/settlement?group_id=${GROUP_ID}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        console.log('Server is ready!');
        return;
      } else {
        const text = await res.text();
        console.log(`Server returned ${res.status}: ${text}`);
      }
    } catch (e) {
      // Log unexpected errors, but ignore expected ones (timeout, connection refused) during startup
      if (e.name !== 'AbortError' && e.cause?.code !== 'ECONNREFUSED') {
         console.log(`Unexpected error while waiting for server: ${e.message}`);
      }
    }
    await wait(1000);
  }
  throw new Error('Server failed to start');
}

async function runBenchmark() {
  const iterations = 50;
  const timings = [];
  
  console.log(`Starting benchmark (${iterations} iterations)...`);

  // Warmup
  try {
      const res = await fetch(`${BASE_URL}/api/settlement?group_id=${GROUP_ID}`);
      const data = await res.json();
      console.log('Warmup response:', JSON.stringify(data).substring(0, 100) + '...');
  } catch(e) {
      console.error('Warmup failed', e);
  }

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
        const res = await fetch(`${BASE_URL}/api/settlement?group_id=${GROUP_ID}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        await res.text(); // consume body
        const end = performance.now();
        timings.push(end - start);
    } catch (e) {
        console.error('Request failed', e);
    }
    process.stdout.write('.');
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

  console.log('Benchmark Results:');
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
    // Spawn wrangler. 
    // Note: 'detached: true' is crucial for killing the process group later.
    child = spawn('npx', ['wrangler', 'pages', 'dev', '.', '--port', PORT.toString()], {
      stdio: 'inherit', // 'inherit' allows seeing wrangler's output directly
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
        // Kill process group (-pid) to ensure wrangler and its child processes (like workerd) die
        process.kill(-child.pid);
      } catch (e) {
        // Log error but don't fail, as process might already be dead.
        console.error(`Failed to stop server process group with PID ${-child.pid}: ${e.message}`);
      }
    }
  }
}

main();
