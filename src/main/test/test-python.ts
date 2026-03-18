// src/main/dap/test-python.ts
import { DAPClient } from '../dap/DAPClient.ts';
import { spawn } from 'child_process';

const TARGET = 'C:\\Users\\joshu\\Downloads\\Hackathons\\dee-bugr\\tmp\\test-debug.py';

async function testPythonConnection() {
  const client = new DAPClient();

  client.on('event', (msg: any) => {
    console.log('\n[EVENT]', msg.event, JSON.stringify(msg.body, null, 2));
  });

  client.on('event:stopped', async (body: any) => {
    console.log('\n✅ STOPPED at thread', body.threadId, '— reason:', body.reason);
    await inspectState(client, body.threadId);
  });

  client.on('error', (err: Error) => {
    console.error('\n❌ Error:', err.message);
  });

  try {
    // 1. Spawn debugpy — it will wait for us before running the script
    console.log('\n🐍 Starting debugpy...');
    const debugpy = spawn('python', [
      '-m', 'debugpy',
      '--wait-for-client',
      '--listen', '5678',
      TARGET,
    ], { stdio: 'inherit' });

    debugpy.on('error', (err) => console.error('debugpy spawn error:', err));

    // Give it a moment to bind the port
    await new Promise(r => setTimeout(r, 1500));

    // 2. Connect
    console.log('\n🔌 Connecting to debugpy on port 5678...');
    await client.connect('127.0.0.1', 5678);

    // 3. Initialize
    console.log('\n📋 Initializing...');
    const caps = await client.initialize();
    console.log('Capabilities:', Object.keys(caps).filter(k => (caps as any)[k] === true));

    // 4. Attach — fire and forget, wait for initialized event instead
    console.log('\n🚀 Attaching...');
    const attachPromise = client.request('attach', {
      type: 'python',
      request: 'attach',
      name: 'Attach to debugpy',
      connect: { host: '127.0.0.1', port: 5678 },
      pathMappings: [],
      justMyCode: false,
    });

    await waitForEvent(client, 'event:initialized', 10000);
    console.log('\n✅ Initialized event received — proceeding to configure');
    attachPromise.catch(() => {}); // may timeout, that's fine

    // 5. Set breakpoint
    console.log('\n📍 Setting breakpoint...');
    const bpResult = await client.setBreakpoints(TARGET, [7]);
    console.log('Breakpoint verified:', bpResult.breakpoints[0]?.verified);

    // 6. Done configuring — this unpauses the debuggee
    await client.configurationDone();
    console.log('\n▶  Running... (waiting for breakpoint hit)');

  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

function waitForEvent(client: DAPClient, event: string, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeoutMs);

    client.once(event, (body: any) => {
      clearTimeout(timer);
      resolve(body);
    });
  });
}

async function inspectState(client: DAPClient, threadId: number) {
  try {
    const stackResp = await client.stackTrace(threadId);
    const frames = stackResp.stackFrames;
    console.log('\n📚 Call Stack:');
    frames.forEach((f: any, i: number) => {
      console.log(`  ${i === 0 ? '▶' : ' '} ${f.name}() — ${f.source?.path}:${f.line}`);
    });

    const scopeResp = await client.scopes(frames[0].id);
    const scopes = scopeResp.scopes;
    console.log('\n🔍 Scopes:', scopes.map((s: any) => s.name));

    const localsScope = scopes.find((s: any) => s.name === 'Locals');
    if (localsScope) {
      const varResp = await client.variables(localsScope.variablesReference);
      console.log('\n📦 Local Variables:');
      varResp.variables.forEach((v: any) => {
        console.log(`  ${v.name}: ${v.value} (${v.type})`);
      });
    }

    console.log('\n✅ All DAP calls working correctly!');
    console.log('\nStepping once...');
    await client.next(threadId);

  } catch (err) {
    console.error('❌ Inspect failed:', err);
  }
}

testPythonConnection();