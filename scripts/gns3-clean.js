// Dev-only cleanup for stray GNS3 state.
//
// The lab teardown path (labSessionService.teardown) only reliably stops node
// processes while the GNS3 controller still holds the project in memory. If the
// GNS3 server is restarted, processes spawned by the previous instance are
// orphaned for good — they keep their NIO UDP ports and make the next build's
// VPCS fail with "Address already in use" (frames then silently stop flowing).
//
// This script cleans both layers:
//   1. asks GNS3 to open → stop → delete every `pingable_*` project (the same
//      sequence teardown uses), clearing controller-tracked state and disk;
//   2. kills any stray vpcs/ubridge/dynamips/qemu processes still running —
//      the cross-restart orphans the API cannot reach.
//
// Usage: npm run gns3:clean   (GNS3 must be reachable for step 1; step 2 is local)
import './load-env.js';

import { spawnSync } from 'child_process';
import * as gns3 from '../src/services/gns3Service.js';

async function cleanProjects() {
  let projects;
  try {
    projects = await gns3.getProjects();
  } catch (err) {
    console.warn(`! GNS3 unreachable, skipping API cleanup: ${err.message}`);
    return;
  }
  const ours = (projects || []).filter((p) => /^pingable_/.test(p.name || ''));
  if (!ours.length) {
    console.log('• no pingable_* projects on the GNS3 server');
    return;
  }
  for (const p of ours) {
    try { await gns3.openProject(p.project_id); }  catch {}
    try { await gns3.stopAllNodes(p.project_id); } catch {}
    try {
      await gns3.deleteProject(p.project_id);
      console.log(`✓ deleted project ${p.name}`);
    } catch (err) {
      console.warn(`! failed to delete ${p.name}: ${err.message}`);
    }
  }
}

function killStrayProcesses() {
  const names = ['vpcs', 'ubridge', 'dynamips', 'qemu-system-x86_64'];
  if (process.platform === 'win32') {
    for (const n of names) {
      // /IM matches the image name; .exe suffix is required on Windows.
      const r = spawnSync('taskkill', ['/F', '/IM', `${n}.exe`], { encoding: 'utf8' });
      if (r.status === 0) console.log(`✓ killed stray ${n}.exe`);
    }
  } else {
    for (const n of names) {
      const r = spawnSync('pkill', ['-9', '-x', n], { encoding: 'utf8' });
      if (r.status === 0) console.log(`✓ killed stray ${n}`);
    }
  }
}

await cleanProjects();
killStrayProcesses();
console.log('done.');
