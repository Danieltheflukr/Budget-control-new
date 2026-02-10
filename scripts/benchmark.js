async function main() {
  let child;
  try {
    console.log('Starting wrangler pages dev...');
    // Spawn wrangler.
    // Note: on some systems, npx is a cmd.
    child = spawn('npx', ['wrangler', 'pages', 'dev', '.', '--port', PORT.toString()], {
      stdio: 'inherit', // 'inherit' to debug startup issues
      shell: true,
      detached: true // Allows killing the process group
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
        // Kill process group to ensure wrangler and its children die
        process.kill(-child.pid);
      } catch (e) {
        // Log error but don't fail, as process might already be dead.
        console.error(`Failed to stop server process group with PID ${-child.pid}: ${e.message}`);
      }
    }
  }
}
