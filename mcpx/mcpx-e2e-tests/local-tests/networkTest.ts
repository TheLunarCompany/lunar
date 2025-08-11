// local-tests/networkTest.ts
import { createNetwork, removeNetwork } from '../src/docker';

async function main() {
  const netName = 'e2e-net-test';

  // Clean up any old network
  await removeNetwork(netName);

  // 1) Create the network
  const net = await createNetwork(netName);
  console.log(`✅ Created network "${netName}" (ID: ${net.id})`);

  // 2) Remove the network
  await removeNetwork(netName);
  console.log(`✅ Removed network "${netName}"`);
}

main().catch(err => {
  console.error('❌ networkTest failed:', err);
  process.exit(1);
});